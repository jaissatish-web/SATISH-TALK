// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RadioMesh } from "../src/lib/radio/mesh";
const instances: FakePeer[] = [];
class FakePeer {
  connectionState = "new";
  signalingState = "stable";
  iceConnectionState = "new";
  localDescription: { type: string; sdp: string } | null = null;
  onnegotiationneeded?: () => Promise<void>;
  onconnectionstatechange?: () => void;
  addTrack = vi.fn();
  close = vi.fn();
  restartIce = vi.fn();
  addIceCandidate = vi.fn();
  setLocalDescription = vi.fn(async () => {
    this.localDescription = {
      type: this.signalingState === "have-remote-offer" ? "answer" : "offer",
      sdp: "test",
    };
    this.signalingState =
      this.localDescription.type === "offer" ? "have-local-offer" : "stable";
  });
  setRemoteDescription = vi.fn(async (description: { type: string }) => {
    this.signalingState =
      description.type === "offer" ? "have-remote-offer" : "stable";
  });
  constructor() {
    instances.push(this);
  }
}
function create(id: string, peer: string) {
  const sendSignal = vi.fn().mockResolvedValue(undefined),
    states = vi.fn(),
    playback = vi.fn();
  const mesh = new RadioMesh({
    sessionId: id,
    localTrack: {} as MediaStreamTrack,
    localStream: {} as MediaStream,
    sendSignal,
    onPeerStates: states,
    onPlaybackBlocked: playback,
  });
  mesh.syncPeers([id, peer]);
  return { mesh, pc: instances.at(-1)!, sendSignal, states, playback };
}
beforeEach(() => {
  instances.length = 0;
  vi.stubGlobal("RTCPeerConnection", FakePeer);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
describe("deterministic WebRTC negotiation", () => {
  it("only lower session initiates; higher session answers without rollback", async () => {
    const lower = create("a", "b"),
      higher = create("b", "a");
    await lower.pc.onnegotiationneeded!();
    await higher.pc.onnegotiationneeded!();
    expect(lower.sendSignal).toHaveBeenCalledWith(
      "b",
      "offer",
      expect.any(String),
    );
    expect(higher.sendSignal).not.toHaveBeenCalled();
    higher.mesh.handleSignal({
      id: "1",
      fromSession: "a",
      channel: "test",
      kind: "offer",
      payload: JSON.stringify({ type: "offer", sdp: "test" }),
    });
    await vi.waitFor(() =>
      expect(higher.sendSignal).toHaveBeenCalledWith(
        "a",
        "answer",
        expect.any(String),
      ),
    );
    expect(higher.pc.setRemoteDescription).toHaveBeenCalledTimes(1);
    lower.mesh.destroy();
    higher.mesh.destroy();
  });
  it("non-offerer requests ICE restart and only offerer performs it", async () => {
    const lower = create("a", "b"),
      higher = create("b", "a");
    higher.pc.connectionState = "failed";
    higher.mesh.reconcile();
    expect(higher.sendSignal).toHaveBeenCalledWith("a", "restart", "{}");
    expect(higher.pc.restartIce).not.toHaveBeenCalled();
    lower.mesh.handleSignal({
      id: "2",
      fromSession: "b",
      channel: "test",
      kind: "restart",
      payload: "{}",
    });
    await vi.waitFor(() =>
      expect(lower.pc.restartIce).toHaveBeenCalledTimes(1),
    );
    expect(instances).toHaveLength(2);
    lower.mesh.destroy();
    higher.mesh.destroy();
  });
  it("bounds retries and reports failed instead of linking forever", async () => {
    vi.useFakeTimers();
    const peer = create("a", "b");
    peer.pc.connectionState = "connecting";
    peer.pc.onconnectionstatechange!();
    await vi.advanceTimersByTimeAsync(32001);
    expect(peer.pc.restartIce).toHaveBeenCalledTimes(3);
    expect(peer.states).toHaveBeenLastCalledWith({ b: "failed" });
    await vi.advanceTimersByTimeAsync(60000);
    expect(peer.pc.restartIce).toHaveBeenCalledTimes(3);
    peer.mesh.destroy();
  });
  it("reports blocked autoplay and clears it after an explicit speaker gesture succeeds", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValueOnce(
        new DOMException("Gesture required", "NotAllowedError"),
      )
      .mockResolvedValue(undefined);
    const peer = create("a", "b");
    const pc = peer.pc as unknown as {
      ontrack: (event: { streams: object[] }) => void;
    };
    pc.ontrack({ streams: [{}] });
    await vi.waitFor(() =>
      expect(peer.playback).toHaveBeenLastCalledWith(true),
    );
    peer.mesh.retryPendingAudio();
    await vi.waitFor(() =>
      expect(peer.playback).toHaveBeenLastCalledWith(false),
    );
    expect(play).toHaveBeenCalledTimes(2);
    peer.mesh.destroy();
  });
});
