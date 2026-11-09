import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authArgs, member } from "./access";
const args = { ...authArgs, channel: v.string() };
const HOLD_MS = 10_000,
  MAX_MS = 60_000;
export const acquire = mutation({
  args: { ...args, name: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const m = await member(ctx, a.sessionId, a.sessionSecret);
    if (m.channel !== a.channel) throw new Error("Access denied");
    const now = Date.now();
    const f = await ctx.db
      .query("floor")
      .withIndex("by_channel", (q) => q.eq("channel", m.channel))
      .unique();
    if (f && f.expiresAt > now) {
      if (f.sessionId !== m.sessionId)
        return { granted: false, holder: f.name };
      if (now - f.since >= MAX_MS) return { granted: false, holder: f.name };
      return { granted: true, holder: f.name, expiresAt: f.expiresAt };
    }
    if (f) await ctx.db.delete(f._id);
    const expiresAt = now + HOLD_MS;
    await ctx.db.insert("floor", {
      channel: m.channel,
      sessionId: m.sessionId,
      name: m.name,
      since: now,
      expiresAt,
    });
    return { granted: true, holder: m.name, expiresAt };
  },
});
export const renew = mutation({
  args,
  handler: async (ctx, a) => {
    const m = await member(ctx, a.sessionId, a.sessionSecret);
    if (m.channel !== a.channel) throw new Error("Access denied");
    const now = Date.now();
    const f = await ctx.db
      .query("floor")
      .withIndex("by_channel", (q) => q.eq("channel", m.channel))
      .unique();
    if (!f || f.sessionId !== m.sessionId || f.expiresAt <= now)
      return { held: false };
    if (now - f.since >= MAX_MS) {
      await ctx.db.delete(f._id);
      return { held: false };
    }
    const expiresAt = Math.min(now + HOLD_MS, f.since + MAX_MS);
    await ctx.db.patch(f._id, { expiresAt });
    return { held: true, expiresAt };
  },
});
export const release = mutation({
  args,
  handler: async (ctx, a) => {
    const m = await member(ctx, a.sessionId, a.sessionSecret, true);
    if (m.channel !== a.channel) throw new Error("Access denied");
    const f = await ctx.db
      .query("floor")
      .withIndex("by_channel", (q) => q.eq("channel", m.channel))
      .unique();
    if (f?.sessionId === m.sessionId) await ctx.db.delete(f._id);
  },
});
export const current = query({
  args,
  handler: async (ctx, a) => {
    const m = await member(ctx, a.sessionId, a.sessionSecret);
    if (m.channel !== a.channel) throw new Error("Access denied");
    const f = await ctx.db
      .query("floor")
      .withIndex("by_channel", (q) => q.eq("channel", m.channel))
      .unique();
    return !f || f.expiresAt <= Date.now()
      ? null
      : {
          sessionId: f.sessionId,
          name: f.name,
          since: f.since,
          expiresAt: f.expiresAt,
        };
  },
});
