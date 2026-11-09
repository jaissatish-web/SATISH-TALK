import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
const token = "r".repeat(43),
  code = "private-access-code";
const auth = (i: number) => ({
  sessionId: String(i).padStart(32, "s"),
  sessionSecret: String(i).padStart(43, "k"),
});
const scope = (i: number) => ({ ...auth(i), channel: "instrumentation" });
const join = (i: number) => ({
  ...scope(i),
  name: `Member ${i}`,
  roomToken: token,
  accessCode: code,
});
beforeEach(() => {
  vi.stubEnv("ROOM_TOKEN", token);
  vi.stubEnv("ACCESS_CODE", code);
  vi.stubEnv("OWNER_TOKEN", "o".repeat(43));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe("private coordination backend", () => {
  it("fails closed without credentials and rejects stolen identities", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.presence.join, { ...join(1), roomToken: "wrong" }),
    ).rejects.toThrow();
    await t.mutation(api.presence.join, join(1));
    await expect(
      t.query(api.presence.roster, {
        ...scope(1),
        sessionSecret: "z".repeat(43),
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.presence.join, {
        ...join(1),
        sessionSecret: "z".repeat(43),
      }),
    ).rejects.toThrow();
    expect(
      await t.mutation(api.presence.join, { ...join(2), name: "Member 1" }),
    ).toMatchObject({ ok: false, reason: "name-in-use" });
  });
  for (const n of [2, 5, 10])
    it(`coordinates ${n} members and one floor winner`, async () => {
      const t = convexTest(schema, modules);
      for (let i = 1; i <= n; i++)
        expect(await t.mutation(api.presence.join, join(i))).toMatchObject({
          ok: true,
        });
      expect(await t.query(api.presence.roster, scope(1))).toHaveLength(n);
      const results = await Promise.all(
        Array.from({ length: n }, (_, i) =>
          t.mutation(api.floor.acquire, scope(i + 1)),
        ),
      );
      expect(results.filter((r) => r.granted)).toHaveLength(1);
      const floor = await t.query(api.floor.current, scope(1));
      expect(floor?.expiresAt).toBeGreaterThan(Date.now());
      const winner = Number(floor!.sessionId.replaceAll("s", ""));
      await t.mutation(api.presence.leave, auth(winner));
      const remaining = winner === 1 ? 2 : 1;
      expect(await t.query(api.floor.current, scope(remaining))).toBeNull();
      if (n === 10)
        expect(await t.mutation(api.presence.join, join(11))).toMatchObject({
          ok: true,
        });
    });
  it("rejects an eleventh active member", async () => {
    const t = convexTest(schema, modules);
    for (let i = 1; i <= 10; i++) await t.mutation(api.presence.join, join(i));
    expect(await t.mutation(api.presence.join, join(11))).toMatchObject({
      ok: false,
      reason: "channel-full",
    });
  });
  it("expires dead floor leases and enforces hard transmission cap", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await t.mutation(api.presence.join, join(1));
    await t.mutation(api.presence.join, join(2));
    await t.mutation(api.floor.acquire, scope(1));
    vi.advanceTimersByTime(10_001);
    expect(await t.mutation(api.floor.renew, scope(1))).toEqual({
      held: false,
    });
    expect(await t.mutation(api.floor.acquire, scope(2))).toMatchObject({
      granted: true,
    });
    for (let elapsed = 0; elapsed < 60_000; elapsed += 5_000) {
      vi.advanceTimersByTime(5_000);
      await t.mutation(api.presence.heartbeat, auth(2));
      const renewal = await t.mutation(api.floor.renew, scope(2));
      if (elapsed < 55_000) expect(renewal.held).toBe(true);
      else expect(renewal.held).toBe(false);
    }
  });
  it("keeps signals recipient private and rejects oversized payloads", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.presence.join, join(1));
    await t.mutation(api.presence.join, join(2));
    await t.mutation(api.signaling.send, {
      fromSession: auth(1).sessionId,
      toSession: auth(2).sessionId,
      sessionSecret: auth(1).sessionSecret,
      channel: "instrumentation",
      kind: "offer",
      payload: "{}",
    });
    const inbox = await t.query(api.signaling.inbox, {
      toSession: auth(2).sessionId,
      sessionSecret: auth(2).sessionSecret,
    });
    expect(inbox).toHaveLength(1);
    await expect(
      t.query(api.signaling.inbox, {
        toSession: auth(2).sessionId,
        sessionSecret: auth(1).sessionSecret,
      }),
    ).rejects.toThrow();
    await t.mutation(api.signaling.consume, { ...auth(1), ids: [inbox[0].id] });
    expect(
      await t.query(api.signaling.inbox, {
        toSession: auth(2).sessionId,
        sessionSecret: auth(2).sessionSecret,
      }),
    ).toHaveLength(1);
    await expect(
      t.mutation(api.signaling.send, {
        fromSession: auth(1).sessionId,
        toSession: auth(2).sessionId,
        sessionSecret: auth(1).sessionSecret,
        channel: "instrumentation",
        kind: "ice",
        payload: "x".repeat(32769),
      }),
    ).rejects.toThrow();
  });
  it("enforces signaling budget and rejects stale member actions", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.presence.join, join(1));
    await t.mutation(api.presence.join, join(2));
    await t.run(async (ctx) => {
      const m = await ctx.db
        .query("members")
        .withIndex("by_session", (q) => q.eq("sessionId", auth(1).sessionId))
        .unique();
      await ctx.db.patch(m!._id, { signalCount: 600 });
    });
    await expect(
      t.mutation(api.signaling.send, {
        fromSession: auth(1).sessionId,
        toSession: auth(2).sessionId,
        sessionSecret: auth(1).sessionSecret,
        channel: "instrumentation",
        kind: "offer",
        payload: "{}",
      }),
    ).rejects.toThrow("rate limit");
    await t.run(async (ctx) => {
      const m = await ctx.db
        .query("members")
        .withIndex("by_session", (q) => q.eq("sessionId", auth(1).sessionId))
        .unique();
      await ctx.db.patch(m!._id, { lastSeen: Date.now() - 30_001 });
    });
    await expect(t.mutation(api.floor.acquire, scope(1))).rejects.toThrow(
      "expired",
    );
  });
  it("revokes existing sessions after credential rotation and gates owner rename", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.presence.join, join(1));
    await expect(
      t.mutation(api.access.rename, {
        channel: "instrumentation",
        ownerToken: "bad",
        name: "New team",
      }),
    ).rejects.toThrow();
    await t.mutation(api.access.rename, {
      channel: "instrumentation",
      ownerToken: "o".repeat(43),
      name: "New team",
    });
    expect(
      await t.query(api.access.info, {
        channel: "instrumentation",
        roomToken: token,
        accessCode: code,
      }),
    ).toMatchObject({ name: "New team" });
    vi.stubEnv("ROOM_TOKEN", "n".repeat(43));
    await expect(t.mutation(api.presence.heartbeat, auth(1))).rejects.toThrow();
  });
});
