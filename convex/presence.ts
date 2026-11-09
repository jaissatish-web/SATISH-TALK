import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  authArgs,
  gate,
  hash,
  strong,
  member,
  FRESH_MS,
  CHANNEL,
} from "./access";
export { FRESH_MS } from "./access";
export const join = mutation({
  args: {
    ...authArgs,
    name: v.string(),
    channel: v.string(),
    roomToken: v.string(),
    accessCode: v.string(),
  },
  handler: async (ctx, a) => {
    gate(a.roomToken, a.accessCode, a.channel);
    if (!strong(a.sessionId) || !strong(a.sessionSecret))
      throw new Error("Invalid session identifier");
    const name = a.name.trim();
    if (name.length < 2 || name.length > 32 || /[\x00-\x1f]/.test(name))
      throw new Error("Name must contain 2–32 printable characters");
    const now = Date.now(),
      secretHash = await hash(a.sessionSecret),
      credentialHash = await hash(a.roomToken + "\0" + a.accessCode);
    const existing = await ctx.db
      .query("members")
      .withIndex("by_session", (q) => q.eq("sessionId", a.sessionId))
      .unique();
    if (existing && existing.secretHash !== secretHash)
      throw new Error("Session identity conflict");
    const roster = await ctx.db
      .query("members")
      .withIndex("by_channel", (q) => q.eq("channel", CHANNEL))
      .collect();
    const active = roster.filter(
      (m) => m.lastSeen > now - FRESH_MS && m.sessionId !== a.sessionId,
    );
    if (active.length >= 10) return { ok: false, reason: "channel-full" };
    if (
      active.some(
        (m) => m.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      return { ok: false, reason: "name-in-use" };
    if (existing)
      await ctx.db.patch(existing._id, { name, lastSeen: now, credentialHash });
    else
      await ctx.db.insert("members", {
        sessionId: a.sessionId,
        secretHash,
        credentialHash,
        name,
        channel: CHANNEL,
        joinedAt: now,
        lastSeen: now,
        signalWindow: now,
        signalCount: 0,
      });
    return { ok: true };
  },
});
export const heartbeat = mutation({
  args: authArgs,
  handler: async (ctx, a) => {
    const m = await member(ctx, a.sessionId, a.sessionSecret);
    await ctx.db.patch(m._id, { lastSeen: Date.now() });
    return { ok: true };
  },
});
export const leave = mutation({
  args: authArgs,
  handler: async (ctx, a) => {
    const m = await member(ctx, a.sessionId, a.sessionSecret, true);
    await ctx.db.delete(m._id);
    const f = await ctx.db
      .query("floor")
      .withIndex("by_channel", (q) => q.eq("channel", m.channel))
      .unique();
    if (f?.sessionId === m.sessionId) await ctx.db.delete(f._id);
    const rows = await ctx.db
      .query("signals")
      .withIndex("by_recipient", (q) => q.eq("toSession", m.sessionId))
      .collect();
    for (const s of rows) await ctx.db.delete(s._id);
  },
});
export const roster = query({
  args: { ...authArgs, channel: v.string() },
  handler: async (ctx, a) => {
    const me = await member(ctx, a.sessionId, a.sessionSecret);
    if (a.channel !== me.channel) throw new Error("Access denied");
    const members = await ctx.db
      .query("members")
      .withIndex("by_channel", (q) => q.eq("channel", me.channel))
      .collect();
    return members
      .filter((m) => m.lastSeen > Date.now() - FRESH_MS)
      .map((m) => ({
        sessionId: m.sessionId,
        name: m.name,
        joinedAt: m.joinedAt,
      }));
  },
});
