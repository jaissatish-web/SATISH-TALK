import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
export const CHANNEL = "instrumentation";
export const FRESH_MS = 30_000;
export const authArgs = { sessionId: v.string(), sessionSecret: v.string() };
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function strong(value: string) {
  return /^[A-Za-z0-9_-]{32,256}$/.test(value);
}
export function gate(roomToken: string, accessCode: string, channel: string) {
  const token = process.env.ROOM_TOKEN,
    code = process.env.ACCESS_CODE;
  if (
    channel !== CHANNEL ||
    !token ||
    !strong(token) ||
    !code ||
    code.length < 8 ||
    roomToken !== token ||
    accessCode !== code
  )
    throw new Error(
      "Invalid private channel credentials or server not configured",
    );
}
export async function member(
  ctx: QueryCtx | MutationCtx,
  sessionId: string,
  sessionSecret: string,
  allowStale = false,
) {
  if (!strong(sessionSecret)) throw new Error("Invalid session");
  const m = await ctx.db
    .query("members")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();
  if (
    !m ||
    m.credentialHash !==
      (await hash(
        (process.env.ROOM_TOKEN ?? "") + "\0" + (process.env.ACCESS_CODE ?? ""),
      )) ||
    m.secretHash !== (await hash(sessionSecret)) ||
    (!allowStale && m.lastSeen < Date.now() - FRESH_MS)
  )
    throw new Error("Session expired. Reconnect to the channel.");
  return m;
}
export const config = query({
  args: {},
  handler: async () => ({ codeRequired: true }),
});
export const info = query({
  args: { channel: v.string(), roomToken: v.string(), accessCode: v.string() },
  handler: async (ctx, a) => {
    gate(a.roomToken, a.accessCode, a.channel);
    const s = await ctx.db
      .query("settings")
      .withIndex("by_channel", (q) => q.eq("channel", CHANNEL))
      .unique();
    return { name: s?.name ?? "Instrumentation Team", channel: CHANNEL };
  },
});
export const rename = mutation({
  args: { channel: v.string(), ownerToken: v.string(), name: v.string() },
  handler: async (ctx, a) => {
    const expected = process.env.OWNER_TOKEN;
    if (
      a.channel !== CHANNEL ||
      !expected ||
      !strong(expected) ||
      a.ownerToken !== expected
    )
      throw new Error("Owner access denied");
    const name = a.name.trim();
    if (name.length < 2 || name.length > 48)
      throw new Error("Channel name must contain 2–48 characters");
    const s = await ctx.db
      .query("settings")
      .withIndex("by_channel", (q) => q.eq("channel", CHANNEL))
      .unique();
    if (s) await ctx.db.patch(s._id, { name });
    else await ctx.db.insert("settings", { channel: CHANNEL, name });
    return { name };
  },
});
