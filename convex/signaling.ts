import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { member, FRESH_MS } from "./access";
export const send = mutation({
  args: {
    fromSession: v.string(),
    toSession: v.string(),
    sessionSecret: v.string(),
    channel: v.string(),
    kind: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("ice"),
      v.literal("restart"),
    ),
    payload: v.string(),
  },
  handler: async (ctx, a) => {
    const m = await member(ctx, a.fromSession, a.sessionSecret);
    if (m.channel !== a.channel || a.toSession === m.sessionId)
      throw new Error("Invalid signal recipient");
    const target = await ctx.db
      .query("members")
      .withIndex("by_session", (q) => q.eq("sessionId", a.toSession))
      .unique();
    if (
      !target ||
      target.channel !== m.channel ||
      target.lastSeen < Date.now() - FRESH_MS
    )
      throw new Error("Recipient unavailable");
    if (a.payload.length > 32_768) throw new Error("Signal too large");
    JSON.parse(a.payload);
    const now = Date.now(),
      fresh = m.signalWindow > now - 60_000,
      count = fresh ? m.signalCount : 0;
    if (count >= 600)
      throw new Error("Signaling rate limit reached. Wait one minute.");
    await ctx.db.patch(m._id, {
      signalWindow: fresh ? m.signalWindow : now,
      signalCount: count + 1,
    });
    await ctx.db.insert("signals", {
      toSession: a.toSession,
      fromSession: m.sessionId,
      channel: m.channel,
      kind: a.kind,
      payload: a.payload,
      createdAt: now,
    });
  },
});
export const inbox = query({
  args: { toSession: v.string(), sessionSecret: v.string() },
  handler: async (ctx, a) => {
    const m = await member(ctx, a.toSession, a.sessionSecret);
    const rows = await ctx.db
      .query("signals")
      .withIndex("by_recipient", (q) => q.eq("toSession", m.sessionId))
      .collect();
    return rows
      .filter((s) => s.createdAt > Date.now() - 60_000)
      .map((s) => ({
        id: s._id,
        fromSession: s.fromSession,
        channel: s.channel,
        kind: s.kind,
        payload: s.payload,
      }));
  },
});
export const consume = mutation({
  args: {
    sessionId: v.string(),
    sessionSecret: v.string(),
    ids: v.array(v.id("signals")),
  },
  handler: async (ctx, a) => {
    const m = await member(ctx, a.sessionId, a.sessionSecret);
    if (a.ids.length > 100) throw new Error("Too many signal acknowledgements");
    for (const id of a.ids) {
      const s = await ctx.db.get(id);
      if (s?.toSession === m.sessionId) await ctx.db.delete(id);
    }
  },
});
