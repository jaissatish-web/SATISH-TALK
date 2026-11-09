import type { FunctionReference } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { convexClient } from "../convexClient";
import type {
  FloorState,
  Member,
  RadioBackend,
  Signal,
  SignalKind,
  JoinResult,
} from "./types";
export class ConvexRadioBackend implements RadioBackend {
  private accessCode = "";
  private roomToken = "";
  private sessionId = "";
  private secrets = new Map<string, string>();
  private listeners = new Set<(connected: boolean) => void>();
  setAccessCode(code: string) {
    this.accessCode = code;
  }
  setRoomToken(token: string) {
    this.roomToken = token;
  }
  private auth(sessionId = this.sessionId) {
    return { sessionId, sessionSecret: this.secrets.get(sessionId) || "" };
  }
  private failed() {
    for (const cb of this.listeners) cb(false);
  }
  subscribeConnection(cb: (connected: boolean) => void) {
    this.listeners.add(cb);
    const unsubscribe = convexClient.subscribeToConnectionState((s) =>
      cb(s.isWebSocketConnected),
    );
    return () => {
      this.listeners.delete(cb);
      unsubscribe();
    };
  }
  private subscribe<T>(
    query: FunctionReference<"query", "public", Record<string, never>, T>,
    args: Record<string, unknown>,
    cb: (value: T) => void,
  ): () => void {
    const watch = convexClient.watchQuery(query, args as Record<string, never>);
    const push = () => {
      try {
        const value = watch.localQueryResult();
        if (value !== undefined) cb(value);
      } catch {
        this.failed();
      }
    };
    const unsubscribe = watch.onUpdate(push);
    push();
    return unsubscribe;
  }
  async codeRequired() {
    return true;
  }
  async join(
    sessionId: string,
    name: string,
    channel: string,
  ): Promise<JoinResult> {
    if (!this.secrets.has(sessionId))
      this.secrets.set(
        sessionId,
        crypto.randomUUID().replaceAll("-", "") +
          crypto.randomUUID().replaceAll("-", ""),
      );
    const result = await convexClient.mutation(api.presence.join, {
      ...this.auth(sessionId),
      name,
      channel,
      roomToken: this.roomToken,
      accessCode: this.accessCode,
    });
    if (result.ok) this.sessionId = sessionId;
    return result as JoinResult;
  }
  async heartbeat(sessionId: string) {
    await convexClient.mutation(api.presence.heartbeat, this.auth(sessionId));
  }
  async leave(sessionId: string) {
    if (!this.secrets.has(sessionId)) return;
    try {
      await convexClient.mutation(api.presence.leave, this.auth(sessionId));
    } finally {
      this.secrets.delete(sessionId);
      if (this.sessionId === sessionId) this.sessionId = "";
    }
  }
  async acquireFloor(sessionId: string, name: string, channel: string) {
    return convexClient.mutation(api.floor.acquire, {
      ...this.auth(sessionId),
      name,
      channel,
    });
  }
  async renewFloor(sessionId: string, channel: string) {
    return convexClient.mutation(api.floor.renew, {
      ...this.auth(sessionId),
      channel,
    });
  }
  async releaseFloor(sessionId: string, channel: string) {
    await convexClient.mutation(api.floor.release, {
      ...this.auth(sessionId),
      channel,
    });
  }
  async sendSignal(
    fromSession: string,
    toSession: string,
    channel: string,
    kind: SignalKind,
    payload: string,
  ) {
    await convexClient.mutation(api.signaling.send, {
      fromSession,
      toSession,
      channel,
      kind,
      payload,
      sessionSecret: this.auth(fromSession).sessionSecret,
    });
  }
  async consumeSignals(ids: string[]) {
    for (let i = 0; i < ids.length; i += 100)
      await convexClient.mutation(api.signaling.consume, {
        ...this.auth(),
        ids: ids.slice(i, i + 100) as Id<"signals">[],
      });
  }
  subscribeRoster(channel: string, cb: (members: Member[]) => void) {
    return this.subscribe(
      api.presence.roster as unknown as FunctionReference<
        "query",
        "public",
        Record<string, never>,
        Member[]
      >,
      { ...this.auth(), channel },
      cb,
    );
  }
  subscribeFloor(channel: string, cb: (floor: FloorState | null) => void) {
    return this.subscribe(
      api.floor.current as unknown as FunctionReference<
        "query",
        "public",
        Record<string, never>,
        FloorState | null
      >,
      { ...this.auth(), channel },
      cb,
    );
  }
  subscribeInbox(sessionId: string, cb: (signals: Signal[]) => void) {
    return this.subscribe(
      api.signaling.inbox as unknown as FunctionReference<
        "query",
        "public",
        Record<string, never>,
        Signal[]
      >,
      {
        toSession: sessionId,
        sessionSecret: this.auth(sessionId).sessionSecret,
      },
      cb,
    );
  }
}
let singleton: ConvexRadioBackend | null = null;
export function getBackend() {
  return (singleton ??= new ConvexRadioBackend());
}
