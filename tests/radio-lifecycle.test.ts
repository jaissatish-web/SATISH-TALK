// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRadio } from "../src/hooks/useRadio";
const { backend, track, mesh } = vi.hoisted(() => ({
  backend: {
    setAccessCode: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    heartbeat: vi.fn(),
    acquireFloor: vi.fn(),
    renewFloor: vi.fn(),
    releaseFloor: vi.fn(),
    sendSignal: vi.fn(),
    consumeSignals: vi.fn(),
    subscribeRoster: vi.fn(),
    subscribeFloor: vi.fn(),
    subscribeInbox: vi.fn(),
    subscribeConnection: vi.fn(),
  },
  track: { enabled: false, stop: vi.fn(), onended: null },
  mesh: {
    destroy: vi.fn(),
    setOutput: vi.fn(),
    setSpeaker: vi.fn(),
    syncPeers: vi.fn(),
    retryPendingAudio: vi.fn(),
    reconcile: vi.fn(),
    handleSignal: vi.fn(),
  },
}));
vi.mock("../src/lib/radio/convexBackend", () => ({
  getBackend: () => backend,
}));
vi.mock("../src/lib/radio/mesh", () => ({
  RadioMesh: vi.fn(function () {
    return mesh;
  }),
}));
vi.mock("../src/lib/radio/beeps", () => ({ initAudio: vi.fn() }));
async function joined() {
  const hook = renderHook(() => useRadio());
  await act(async () => {
    await hook.result.current.join("Satish", "instrumentation", "code");
  });
  return hook;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  track.enabled = false;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getAudioTracks: () => [track],
        getTracks: () => [track],
      }),
    },
  });
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  backend.join.mockResolvedValue({ ok: true });
  backend.leave.mockResolvedValue(undefined);
  backend.releaseFloor.mockResolvedValue(undefined);
  backend.heartbeat.mockResolvedValue(undefined);
  backend.acquireFloor.mockResolvedValue({
    granted: true,
    expiresAt: Date.now() + 10000,
  });
  backend.renewFloor.mockResolvedValue({
    held: true,
    expiresAt: Date.now() + 10000,
  });
  backend.subscribeConnection.mockReturnValue(() => {});
  backend.subscribeRoster.mockReturnValue(() => {});
  backend.subscribeFloor.mockReturnValue(() => {});
  backend.subscribeInbox.mockReturnValue(() => {});
  mesh.setOutput.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("push-to-talk fail closed lifecycle", () => {
  it("joins muted and only enables audio after authoritative grant; release cuts audio synchronously", async () => {
    const hook = await joined();
    expect(track.enabled).toBe(false);
    expect(hook.result.current.state.connection).toBe("online");
    await act(async () => {
      await hook.result.current.pressPTT();
    });
    expect(track.enabled).toBe(true);
    act(() => hook.result.current.releasePTT());
    expect(track.enabled).toBe(false);
    expect(backend.releaseFloor).toHaveBeenCalled();
  });
  it("never transmits if finger releases while permission is pending", async () => {
    const hook = await joined();
    let grant!: (value: { granted: boolean }) => void;
    backend.acquireFloor.mockReturnValue(
      new Promise((resolve) => {
        grant = resolve;
      }),
    );
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.pressPTT();
    });
    act(() => hook.result.current.releasePTT());
    await act(async () => {
      grant({ granted: true });
      await pending;
    });
    expect(track.enabled).toBe(false);
    expect(backend.releaseFloor).toHaveBeenCalled();
  });
  it("stops on mode off and cannot enable a new session using a stale grant", async () => {
    const hook = await joined();
    let grant!: (value: { granted: boolean }) => void;
    backend.acquireFloor.mockReturnValue(
      new Promise((resolve) => {
        grant = resolve;
      }),
    );
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.pressPTT();
    });
    act(() => hook.result.current.leave());
    await act(async () => {
      grant({ granted: true });
      await pending;
    });
    expect(track.enabled).toBe(false);
    expect(track.stop).toHaveBeenCalled();
    expect(mesh.destroy).toHaveBeenCalled();
    expect(hook.result.current.state.connection).toBe("offline");
  });
  it("cuts audio on lease renewal failure", async () => {
    const hook = await joined();
    await act(async () => {
      await hook.result.current.pressPTT();
    });
    backend.renewFloor.mockRejectedValue(new Error("offline"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(track.enabled).toBe(false);
  });
  it("cuts audio before lease expiry even if renewal hangs", async () => {
    const hook = await joined();
    backend.renewFloor.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      await hook.result.current.pressPTT();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9500);
    });
    expect(track.enabled).toBe(false);
  });
  it("stops immediately when page hides or network drops", async () => {
    const hook = await joined();
    await act(async () => {
      await hook.result.current.pressPTT();
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(track.enabled).toBe(false);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await hook.result.current.pressPTT();
    });
    act(() => window.dispatchEvent(new Event("offline")));
    expect(track.enabled).toBe(false);
    expect(mesh.setSpeaker).toHaveBeenCalledWith(null);
  });
  it("does not claim online when microphone permission is denied", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
      new DOMException("Denied", "NotAllowedError"),
    );
    const hook = await joined();
    expect(hook.result.current.state.connection).toBe("error");
    expect(hook.result.current.state.micPermission).toBe("denied");
    expect(backend.join).not.toHaveBeenCalled();
  });
  it("requests and releases screen wake lock only when enabled in a joined session", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({
      released: false,
      release,
      addEventListener: vi.fn(),
    });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });
    const hook = await joined();
    expect(request).not.toHaveBeenCalled();
    await act(async () => {
      hook.result.current.setKeepAwake(true);
    });
    expect(request).toHaveBeenCalledWith("screen");
    expect(hook.result.current.state.wakeLock).toBe("active");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(release).toHaveBeenCalled();
    expect(hook.result.current.state.wakeLock).toBe("waiting");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(hook.result.current.state.wakeLock).toBe("active");
    act(() => hook.result.current.setKeepAwake(false));
    expect(release).toHaveBeenCalled();
    expect(hook.result.current.state.wakeLock).toBe("off");
  });
  it("releases a pending wake lock if mode is disabled before browser grants it", async () => {
    let resolve!: (value: unknown) => void;
    const release = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: vi.fn().mockReturnValue(
          new Promise((r) => {
            resolve = r;
          }),
        ),
      },
    });
    const hook = await joined();
    act(() => hook.result.current.setKeepAwake(true));
    act(() => hook.result.current.leave());
    await act(async () => {
      resolve({ released: false, release, addEventListener: vi.fn() });
    });
    expect(release).toHaveBeenCalled();
    expect(hook.result.current.state.wakeLock).toBe("off");
  });

  it("serializes rapid release/repress while the prior grant is in flight", async () => {
    const hook = await joined();
    let grant!: (value: { granted: boolean }) => void;
    backend.acquireFloor.mockReturnValueOnce(
      new Promise((resolve) => {
        grant = resolve;
      }),
    );
    let pending!: Promise<void>;
    await act(async () => {
      pending = hook.result.current.pressPTT();
      await Promise.resolve();
    });
    act(() => hook.result.current.releasePTT());
    await act(async () => {
      await hook.result.current.pressPTT();
    });
    expect(backend.acquireFloor).toHaveBeenCalledTimes(1);
    await act(async () => {
      grant({ granted: true });
      await pending;
    });
    expect(track.enabled).toBe(false);
    await act(async () => {
      await hook.result.current.pressPTT();
    });
    expect(track.enabled).toBe(true);
  });

  it("releases microphone immediately when mode is disabled during backend join", async () => {
    let resolve!: (value: { ok: boolean }) => void;
    backend.join.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const hook = renderHook(() => useRadio());
    let pending!: Promise<void>;
    await act(async () => {
      pending = hook.result.current.join("Satish", "instrumentation", "code");
      await Promise.resolve();
    });
    act(() => hook.result.current.leave());
    expect(track.stop).toHaveBeenCalled();
    await act(async () => {
      resolve({ ok: true });
      await pending;
    });
    expect(track.enabled).toBe(false);
    expect(hook.result.current.state.connection).toBe("offline");
  });
  it("bounds reconnection and releases resources when an offline heartbeat never settles", async () => {
    const hook = await joined();
    backend.heartbeat.mockReturnValue(new Promise(() => {}));
    act(() => {
      backend.subscribeConnection.mock.calls[0][0](false);
    });
    expect(hook.result.current.state.connection).toBe("reconnecting");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30001);
    });
    expect(track.stop).toHaveBeenCalled();
    expect(mesh.destroy).toHaveBeenCalled();
    expect(hook.result.current.state.connection).toBe("error");
    expect(hook.result.current.state.joinError).toContain("Reconnect");
  });
});
