import type { PeerConnState, Signal, SignalKind } from "./types";

/** Dedicated relay credentials may be supplied as short-lived ICE config.
 * VITE_ values are public browser configuration, never privileged server keys. */
function iceServers(): RTCIceServer[] {
  const configured = import.meta.env.VITE_ICE_SERVERS;
  if (configured) {
    const parsed: unknown = JSON.parse(configured);
    if (!Array.isArray(parsed))
      throw new Error("Invalid ICE server configuration");
    return parsed as RTCIceServer[];
  }
  return [{ urls: "stun:stun.cloudflare.com:3478" }];
}

const RECONNECT_GRACE_MS = 8_000;

interface PeerEntry {
  pc: RTCPeerConnection;
  offerer: boolean;
  exhausted: boolean;
  makingOffer: boolean;
  hasRemoteDescription: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  audioEl: HTMLAudioElement;
  queue: Promise<void>;
  failTimer: number | null;
}

interface MeshOptions {
  sessionId: string;
  localTrack: MediaStreamTrack;
  localStream: MediaStream;
  sendSignal: (to: string, kind: SignalKind, payload: string) => Promise<void>;
  onPeerStates: (states: Record<string, PeerConnState>) => void;
  onPlaybackBlocked?: (blocked: boolean) => void;
}

/**
 * Full-mesh audio with pre-established connections (PLAN D1): every pair
 * negotiates at join time with the mic track attached but disabled, so PTT is
 * just a track toggle — no renegotiation on press.
 *
 * A deterministic offerer (lower session ID) prevents crossed initial offers
 * and browser ICE candidate loss after glare rollback. The other side only answers.
 */
export class RadioMesh {
  private peers = new Map<string, PeerEntry>();
  private knownMembers = new Set<string>();
  private pendingPlay = new Set<HTMLAudioElement>();
  private destroyed = false;
  private retries = new Map<string, number>();
  private outputId = "";
  private speaker: string | null = null;

  constructor(private opts: MeshOptions) {}

  /** Reconcile the peer set to the current roster. */
  syncPeers(memberIds: string[]): void {
    if (this.destroyed) return;
    this.knownMembers = new Set(
      memberIds.filter((id) => id !== this.opts.sessionId),
    );
    for (const id of this.knownMembers) {
      if (!this.peers.has(id)) this.createPeer(id);
    }
    for (const id of [...this.peers.keys()]) {
      if (!this.knownMembers.has(id)) {
        this.destroyPeer(id);
        this.retries.delete(id);
      }
    }
    this.emitStates();
  }

  /** Route one signaling message; serialized per-peer to preserve order. */
  handleSignal(signal: Signal): void {
    if (this.destroyed) return;
    const from = signal.fromSession;
    let entry = this.peers.get(from);
    if (!entry) {
      // A signal from a member we haven't seen in the roster yet — they just
      // joined. Create the connection so their offer lands somewhere.
      this.knownMembers.add(from);
      entry = this.createPeer(from);
    }
    entry.queue = entry.queue
      .then(() => this.processSignal(entry!, from, signal))
      .catch((err) => console.warn("[mesh] signal processing failed", err));
  }

  /** Tear down and re-offer any dead connections (called on visibility return). */
  reconcile(): void {
    if (this.destroyed) return;
    for (const [id, entry] of this.peers) {
      const st = entry.pc.connectionState;
      if (st === "failed" || st === "closed" || st === "disconnected") {
        this.retryPeer(id);
      }
    }
    this.retryPendingAudio();
  }

  /** iOS autoplay recovery: retry any blocked audio elements on a user gesture. */
  retryPendingAudio(): void {
    for (const el of [...this.pendingPlay]) {
      void el
        .play()
        .then(() => {
          this.pendingPlay.delete(el);
          this.opts.onPlaybackBlocked?.(this.pendingPlay.size > 0);
        })
        .catch(() => {});
    }
  }

  setSpeaker(sessionId: string | null): void {
    this.speaker = sessionId;
    for (const [id, entry] of this.peers) {
      entry.audioEl.muted = id !== sessionId;
      // Unmuting previously silent autoplay can itself require a user gesture.
      if (id === sessionId && entry.audioEl.srcObject)
        this.playAudio(id, entry.audioEl);
    }
  }

  async setOutput(deviceId: string): Promise<void> {
    this.outputId = deviceId;
    await Promise.all(
      [...this.peers.values()].map(async ({ audioEl }) => {
        if ("setSinkId" in audioEl)
          await (
            audioEl as HTMLAudioElement & {
              setSinkId(id: string): Promise<void>;
            }
          ).setSinkId(deviceId);
      }),
    );
  }

  destroy(): void {
    this.destroyed = true;
    for (const id of [...this.peers.keys()]) this.destroyPeer(id);
    this.emitStates();
  }

  private createPeer(peerId: string): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });

    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.muted = peerId !== this.speaker;
    if (this.outputId && "setSinkId" in audioEl)
      void (
        audioEl as HTMLAudioElement & { setSinkId(id: string): Promise<void> }
      )
        .setSinkId(this.outputId)
        .catch(() => {});
    audioEl.setAttribute("playsinline", "");
    audioEl.dataset.peer = peerId;
    audioEl.style.display = "none";
    document.body.appendChild(audioEl);

    const entry: PeerEntry = {
      pc,
      offerer: this.opts.sessionId < peerId,
      exhausted: false,
      makingOffer: false,
      hasRemoteDescription: false,
      pendingCandidates: [],
      audioEl,
      queue: Promise.resolve(),
      failTimer: null,
    };
    this.peers.set(peerId, entry);

    pc.addTrack(this.opts.localTrack, this.opts.localStream);

    pc.onnegotiationneeded = async () => {
      if (!entry.offerer || entry.makingOffer || pc.signalingState !== "stable")
        return;
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        await this.opts.sendSignal(
          peerId,
          "offer",
          JSON.stringify(pc.localDescription),
        );
      } catch (err) {
        console.warn("[mesh] negotiation failed", err);
      } finally {
        entry.makingOffer = false;
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void this.opts
          .sendSignal(peerId, "ice", JSON.stringify(e.candidate))
          .catch(() => {});
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      audioEl.srcObject = stream;
      this.playAudio(peerId, audioEl);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") this.scheduleRetry(peerId, entry);
    };

    pc.onconnectionstatechange = () => {
      this.emitStates();
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected" ||
        pc.connectionState === "connecting"
      ) {
        this.scheduleRetry(peerId, entry);
      } else if (
        pc.connectionState === "connected" &&
        entry.failTimer !== null
      ) {
        clearTimeout(entry.failTimer);
        entry.failTimer = null;
      }
    };

    this.scheduleRetry(peerId, entry);
    this.emitStates();
    return entry;
  }

  private async processSignal(
    entry: PeerEntry,
    peerId: string,
    signal: Signal,
  ): Promise<void> {
    const pc = entry.pc;
    if (pc.signalingState === "closed") return;

    if (signal.kind === "restart") {
      if (entry.offerer) pc.restartIce();
      return;
    }

    if (signal.kind === "ice") {
      const candidate = JSON.parse(signal.payload) as RTCIceCandidateInit;
      if (!entry.hasRemoteDescription) {
        if (entry.pendingCandidates.length < 100)
          entry.pendingCandidates.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn("[mesh] addIceCandidate", err);
      }
      return;
    }

    const description = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
    // Only the elected side may offer; only its counterpart may answer.
    if (description.type === "offer" && entry.offerer) return;
    if (description.type === "answer" && !entry.offerer) return;
    await pc.setRemoteDescription(description);
    entry.hasRemoteDescription = true;
    for (const c of entry.pendingCandidates.splice(0)) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        // stale candidate after renegotiation — harmless
      }
    }
    if (description.type === "offer") {
      await pc.setLocalDescription();
      await this.opts.sendSignal(
        peerId,
        "answer",
        JSON.stringify(pc.localDescription),
      );
    }
  }

  private playAudio(peerId: string, audioEl: HTMLAudioElement): void {
    void audioEl
      .play()
      .then(() => {
        this.pendingPlay.delete(audioEl);
        this.opts.onPlaybackBlocked?.(this.pendingPlay.size > 0);
      })
      .catch(() => {
        if (this.destroyed || this.peers.get(peerId)?.audioEl !== audioEl)
          return;
        this.pendingPlay.add(audioEl);
        this.opts.onPlaybackBlocked?.(true);
      });
  }

  private scheduleRetry(peerId: string, entry: PeerEntry): void {
    if (entry.failTimer !== null || entry.exhausted) return;
    entry.failTimer = window.setTimeout(() => {
      entry.failTimer = null;
      if (
        this.peers.get(peerId) === entry &&
        entry.pc.connectionState !== "connected"
      )
        this.retryPeer(peerId);
    }, RECONNECT_GRACE_MS);
  }

  private retryPeer(peerId: string): void {
    const entry = this.peers.get(peerId);
    const retries = this.retries.get(peerId) ?? 0;
    if (!entry || this.destroyed) return;
    if (retries >= 3) {
      entry.exhausted = true;
      this.emitStates();
      return;
    }
    this.retries.set(peerId, retries + 1);
    // Preserve SDP state. Recreating both sides independently can race old offers
    // against new peer instances. ICE restart keeps a single elected offerer.
    if (entry.offerer) entry.pc.restartIce();
    else void this.opts.sendSignal(peerId, "restart", "{}").catch(() => {});
    this.scheduleRetry(peerId, entry);
    this.emitStates();
  }

  private destroyPeer(peerId: string): void {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    this.peers.delete(peerId);
    if (entry.failTimer !== null) clearTimeout(entry.failTimer);
    entry.pc.onnegotiationneeded = null;
    entry.pc.onicecandidate = null;
    entry.pc.ontrack = null;
    entry.pc.onconnectionstatechange = null;
    entry.pc.oniceconnectionstatechange = null;
    entry.pc.close();
    entry.audioEl.srcObject = null;
    entry.audioEl.remove();
    this.pendingPlay.delete(entry.audioEl);
    this.opts.onPlaybackBlocked?.(this.pendingPlay.size > 0);
  }

  private emitStates(): void {
    const out: Record<string, PeerConnState> = {};
    for (const [id, entry] of this.peers) {
      const st = entry.pc.connectionState;
      out[id] =
        st === "connected"
          ? "connected"
          : entry.exhausted ||
              st === "failed" ||
              st === "closed" ||
              st === "disconnected"
            ? "failed"
            : "connecting";
    }
    this.opts.onPeerStates(out);
  }
}
