import { useCallback, useEffect, useRef, useState } from "react";
import { getBackend } from "../lib/radio/convexBackend";
import { RadioMesh } from "../lib/radio/mesh";
import { initAudio } from "../lib/radio/beeps";
import {
  loadKeepAwake,
  mintSessionId,
  saveDisplayName,
  saveKeepAwake,
} from "../lib/radio/session";
import type { FloorState, Member, PeerConnState } from "../lib/radio/types";

export interface RadioState {
  screen: "join" | "channel";
  joining: boolean;
  sessionId: string;
  name: string;
  channel: string;
  members: Member[];
  floor: FloorState | null;
  talking: boolean;
  requesting: boolean;
  busy: boolean;
  peerStates: Record<string, PeerConnState>;
  joinError: string | null;
  connection: "offline" | "connecting" | "online" | "reconnecting" | "error";
  wakeLock: "off" | "active" | "unavailable" | "waiting";
  micPermission: "unknown" | "granted" | "denied";
}
const initial: RadioState = {
  screen: "join",
  joining: false,
  sessionId: "",
  name: "",
  channel: "",
  members: [],
  floor: null,
  talking: false,
  requesting: false,
  busy: false,
  peerStates: {},
  joinError: null,
  connection: "offline",
  wakeLock: "off",
  micPermission: "unknown",
};

export function useRadio() {
  const [state, setState] = useState(initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const epoch = useRef(0),
    press = useRef(false),
    active = useRef(false);
  const pressVersion = useRef(0),
    pendingPress = useRef(false),
    pendingAttempt = useRef(0);
  const connectionDeadline = useRef<number>();
  const releaseBarrier = useRef<Promise<void>>(Promise.resolve());
  const stream = useRef<MediaStream | null>(null),
    mesh = useRef<RadioMesh | null>(null);
  const credentials = useRef({ name: "", channel: "", code: "", session: "" });
  const unsubs = useRef<Array<() => void>>([]),
    timers = useRef<number[]>([]);
  const renew = useRef<number>(),
    cutoff = useRef<number>(),
    receiveCutoff = useRef<number>();
  const wake = useRef<WakeLockSentinel | null>(null),
    wakePending = useRef(false),
    awake = useRef(loadKeepAwake());
  const input = useRef(""),
    output = useRef(""),
    healthy = useRef(false);
  const processed = useRef(new Set<string>());
  const stop = useCallback(() => {
    press.current = false;
    ++pressVersion.current;
    stream.current?.getAudioTracks().forEach((t) => {
      t.enabled = false;
    });
    clearInterval(renew.current);
    clearTimeout(cutoff.current);
    setState((s) => ({ ...s, talking: false, requesting: false }));
    if (active.current)
      releaseBarrier.current = getBackend()
        .releaseFloor(credentials.current.session, credentials.current.channel)
        .catch(() => {});
  }, []);
  const requestWake = useCallback(async () => {
    if (
      !awake.current ||
      !active.current ||
      document.visibilityState !== "visible" ||
      wakePending.current ||
      (wake.current && !wake.current.released)
    )
      return;
    if (!("wakeLock" in navigator)) {
      setState((s) => ({ ...s, wakeLock: "unavailable" }));
      return;
    }
    wakePending.current = true;
    const generation = epoch.current;
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      if (
        !awake.current ||
        !active.current ||
        generation !== epoch.current ||
        document.visibilityState !== "visible"
      ) {
        await sentinel.release();
        return;
      }
      wake.current = sentinel;
      sentinel.addEventListener("release", () => {
        if (wake.current === sentinel) {
          wake.current = null;
          setState((s) => ({
            ...s,
            wakeLock: awake.current && active.current ? "waiting" : "off",
          }));
        }
      });
      setState((s) => ({ ...s, wakeLock: "active" }));
    } catch {
      setState((s) => ({ ...s, wakeLock: "unavailable" }));
    } finally {
      wakePending.current = false;
    }
  }, []);
  const setKeepAwake = useCallback(
    (on: boolean) => {
      awake.current = on;
      saveKeepAwake(on);
      if (on) void requestWake();
      else {
        void wake.current?.release().catch(() => {});
        wake.current = null;
        setState((s) => ({ ...s, wakeLock: "off" }));
      }
    },
    [requestWake],
  );
  const leave = useCallback(() => {
    ++epoch.current;
    clearTimeout(connectionDeadline.current);
    stop();
    pendingPress.current = false;
    pendingAttempt.current = 0;
    clearTimeout(receiveCutoff.current);
    active.current = false;
    healthy.current = false;
    unsubs.current.splice(0).forEach((f) => f());
    timers.current.splice(0).forEach(clearInterval);
    mesh.current?.destroy();
    mesh.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void wake.current?.release().catch(() => {});
    wake.current = null;
    processed.current.clear();
    if (credentials.current.session)
      void getBackend()
        .leave(credentials.current.session)
        .catch(() => {});
    setState((s) => ({
      ...initial,
      name: s.name,
      micPermission: s.micPermission,
    }));
  }, [stop]);
  // A queued Convex mutation may never reject during an outage.
  // Release all resources unless a heartbeat confirms membership within 30s.
  const confirmConnection = useCallback(() => {
    clearTimeout(connectionDeadline.current);
    const generation = epoch.current;
    connectionDeadline.current = window.setTimeout(() => {
      if (generation !== epoch.current || !active.current) return;
      leave();
      setState((s) => ({
        ...s,
        connection: "error",
        joinError: "Connection could not be restored. Tap Reconnect.",
      }));
    }, 30000);
  }, [leave]);
  const join = useCallback(
    async (name: string, channel: string, accessCode = "") => {
      leave();
      const generation = epoch.current;
      getBackend().setAccessCode(accessCode);
      initAudio();
      setState((s) => ({
        ...s,
        joining: true,
        connection: "connecting",
        joinError: null,
      }));
      let local: MediaStream | null = null;
      const session = mintSessionId();
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Microphone requires HTTPS and a supported browser.");
        local = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(input.current ? { deviceId: { exact: input.current } } : {}),
          },
        });
        local.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
        if (generation !== epoch.current) {
          local.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = local; // Mode OFF can release the mic while backend join is pending.
        const result = await getBackend().join(session, name.trim(), channel);
        if (!result.ok)
          throw new Error(
            result.reason === "channel-full"
              ? "Channel full. A maximum of 10 members can connect."
              : result.reason === "name-in-use"
                ? "That display name is already active. Choose another name."
                : "Access denied. Check your invitation and access code.",
          );
        if (generation !== epoch.current) {
          local.getTracks().forEach((t) => t.stop());
          void getBackend()
            .leave(session)
            .catch(() => {});
          return;
        }
        stream.current = local;
        active.current = true;
        healthy.current = true;
        credentials.current = {
          name: name.trim(),
          channel,
          code: accessCode,
          session,
        };
        saveDisplayName(name.trim());
        const radioMesh = new RadioMesh({
          sessionId: session,
          localTrack: local.getAudioTracks()[0],
          localStream: local,
          sendSignal: (to, kind, payload) =>
            getBackend().sendSignal(session, to, channel, kind, payload),
          onPeerStates: (peerStates) => {
            if (generation === epoch.current)
              setState((s) => ({ ...s, peerStates }));
          },
        });
        mesh.current = radioMesh;
        await radioMesh.setOutput(output.current);
        local.getAudioTracks()[0].onended = () => {
          stop();
          healthy.current = false;
          setState((s) => ({
            ...s,
            connection: "error",
            micPermission: "denied",
            joinError:
              "Microphone disconnected. Select a microphone and reconnect.",
          }));
        };
        unsubs.current.push(
          getBackend().subscribeConnection((connected) => {
            if (generation !== epoch.current) return;
            if (!connected) {
              stop();
              radioMesh.setSpeaker(null);
              healthy.current = false;
              setState((s) => ({ ...s, connection: "reconnecting" }));
            }
            // Transport recovery alone does not prove membership; heartbeat confirms it.
          }),
          getBackend().subscribeRoster(channel, (members) => {
            if (generation !== epoch.current) return;
            setState((s) => ({ ...s, members }));
            radioMesh.syncPeers(members.map((m) => m.sessionId));
          }),
          getBackend().subscribeFloor(channel, (floor) => {
            if (generation !== epoch.current) return;
            clearTimeout(receiveCutoff.current);
            radioMesh.setSpeaker(
              healthy.current && document.visibilityState === "visible"
                ? (floor?.sessionId ?? null)
                : null,
            );
            if (floor)
              receiveCutoff.current = window.setTimeout(
                () => radioMesh.setSpeaker(null),
                Math.max(
                  0,
                  (floor.expiresAt ?? floor.since + 10000) - Date.now(),
                ),
              );
            if (stateRef.current.talking && floor?.sessionId !== session)
              stop();
            setState((s) => ({ ...s, floor }));
          }),
          getBackend().subscribeInbox(session, (signals) => {
            if (generation !== epoch.current) return;
            const fresh = signals.filter((s) => !processed.current.has(s.id));
            for (const signal of fresh) {
              processed.current.add(signal.id);
              radioMesh.handleSignal(signal);
            }
            if (fresh.length)
              void getBackend()
                .consumeSignals(fresh.map((s) => s.id))
                .catch(() => {});
            if (processed.current.size > 2000)
              processed.current = new Set(fresh.map((s) => s.id));
          }),
        );
        let failures = 0,
          pendingHeartbeat = false;
        const heartbeat = async () => {
          if (generation !== epoch.current || pendingHeartbeat) return;
          pendingHeartbeat = true;
          try {
            await getBackend().heartbeat(session);
            if (generation !== epoch.current) return;
            failures = 0;
            healthy.current = true;
            confirmConnection();
            radioMesh.reconcile();
            void requestWake();
            const floor = stateRef.current.floor;
            if (
              document.visibilityState === "visible" &&
              floor &&
              (floor.expiresAt ?? floor.since + 10000) > Date.now()
            )
              radioMesh.setSpeaker(floor.sessionId);
            setState((s) => ({ ...s, connection: "online", joinError: null }));
          } catch {
            if (generation !== epoch.current) return;
            stop();
            radioMesh.setSpeaker(null);
            healthy.current = false;
            failures++;
            setState((s) => ({
              ...s,
              connection: failures >= 3 ? "error" : "reconnecting",
              joinError:
                failures >= 3
                  ? "Connection lost. Tap Reconnect."
                  : "Reconnecting to your team…",
            }));
            if (failures >= 3) {
              leave();
              setState((s) => ({
                ...s,
                connection: "error",
                joinError: "Connection lost. Tap Reconnect.",
              }));
            }
          } finally {
            pendingHeartbeat = false;
          }
        };
        timers.current.push(
          window.setInterval(() => {
            void heartbeat();
          }, 5000),
        );
        setState((s) => ({
          ...s,
          screen: "channel",
          joining: false,
          sessionId: session,
          name: name.trim(),
          channel,
          connection: "online",
          micPermission: "granted",
        }));
        confirmConnection();
        void requestWake();
      } catch (error) {
        local?.getTracks().forEach((t) => t.stop());
        if (generation !== epoch.current) return;
        leave();
        const denied =
          error instanceof DOMException &&
          ["NotAllowedError", "SecurityError"].includes(error.name);
        setState((s) => ({
          ...s,
          connection: "error",
          micPermission: denied ? "denied" : s.micPermission,
          joinError: denied
            ? "Allow microphone access in your browser settings, then reconnect."
            : error instanceof Error
              ? error.message
              : "Could not connect. Check your internet and try again.",
        }));
      }
    },
    [confirmConnection, leave, requestWake, stop],
  );
  const releasePTT = stop;
  const pressPTT = useCallback(async () => {
    if (
      !active.current ||
      !healthy.current ||
      press.current ||
      pendingPress.current ||
      document.visibilityState !== "visible" ||
      !navigator.onLine
    )
      return;
    press.current = true;
    pendingPress.current = true;
    const attempt = ++pressVersion.current;
    pendingAttempt.current = attempt;
    const generation = epoch.current;
    const { session, name, channel } = credentials.current;
    mesh.current?.retryPendingAudio();
    setState((s) => ({ ...s, requesting: true, busy: false }));
    try {
      await releaseBarrier.current;
      if (
        !press.current ||
        attempt !== pressVersion.current ||
        generation !== epoch.current
      )
        return;
      const result = await getBackend().acquireFloor(session, name, channel);
      if (
        !press.current ||
        attempt !== pressVersion.current ||
        generation !== epoch.current ||
        !healthy.current ||
        document.visibilityState !== "visible"
      ) {
        if (result.granted)
          await getBackend()
            .releaseFloor(session, channel)
            .catch(() => {});
        return;
      }
      if (!result.granted) {
        stop();
        setState((s) => ({ ...s, busy: true }));
        return;
      }
      // Stop before the server lease expires, even if a renewal request hangs.
      const armCutoff = (expiresAt?: number) => {
        clearTimeout(cutoff.current);
        cutoff.current = window.setTimeout(
          stop,
          Math.max(
            0,
            Math.min(9000, (expiresAt ?? Date.now() + 9000) - Date.now() - 500),
          ),
        );
      };
      armCutoff(result.expiresAt);
      stream.current?.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      setState((s) => ({
        ...s,
        talking: true,
        requesting: false,
        busy: false,
      }));
      let renewing = false;
      renew.current = window.setInterval(async () => {
        if (renewing) return;
        renewing = true;
        try {
          const result = await getBackend().renewFloor(session, channel);
          if (
            generation !== epoch.current ||
            attempt !== pressVersion.current ||
            !press.current
          )
            return;
          if (!result.held) stop();
          else armCutoff(result.expiresAt);
        } catch {
          stop();
          healthy.current = false;
          setState((s) => ({ ...s, connection: "reconnecting" }));
        } finally {
          renewing = false;
        }
      }, 3000);
    } catch {
      if (generation === epoch.current && attempt === pressVersion.current) {
        stop();
        setState((s) => ({
          ...s,
          joinError: "Unable to request microphone. Check connection.",
        }));
      }
    } finally {
      if (pendingAttempt.current === attempt) pendingPress.current = false;
    }
  }, [stop]);
  const reconnect = useCallback(() => {
    const { name, channel, code } = credentials.current;
    if (name) void join(name, channel, code);
  }, [join]);
  const setMicrophone = useCallback(
    (id: string) => {
      input.current = id;
      if (active.current) reconnect();
    },
    [reconnect],
  );
  const setOutput = useCallback(async (id: string) => {
    try {
      await mesh.current?.setOutput(id);
      output.current = id;
    } catch {
      setState((s) => ({
        ...s,
        joinError:
          "Audio output could not be changed. Use your device output settings.",
      }));
    }
  }, []);
  useEffect(() => {
    const interrupt = () => stop();
    const visibility = () => {
      stop();
      mesh.current?.setSpeaker(null);
      if (document.visibilityState !== "visible") {
        void wake.current?.release().catch(() => {});
        wake.current = null;
        setState((s) => ({
          ...s,
          wakeLock: awake.current && active.current ? "waiting" : "off",
        }));
      }
      if (document.visibilityState === "visible" && active.current) {
        healthy.current = false;
        setState((s) => ({ ...s, connection: "reconnecting" }));
        mesh.current?.reconcile();
        void requestWake();
      }
    };
    const offline = () => {
      stop();
      mesh.current?.setSpeaker(null);
      healthy.current = false;
      setState((s) => ({
        ...s,
        connection: active.current ? "reconnecting" : "offline",
      }));
    };
    const online = () => {
      if (active.current) reconnect();
    };
    const hide = () => leave();
    window.addEventListener("blur", interrupt);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", interrupt);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", visibility);
      leave();
    };
  }, [leave, reconnect, requestWake, stop]);
  return {
    state,
    join,
    leave,
    pressPTT,
    releasePTT,
    setKeepAwake,
    setMicrophone,
    setOutput,
    reconnect,
  };
}
