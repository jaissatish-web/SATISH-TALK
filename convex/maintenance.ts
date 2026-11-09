import { internalMutation } from "./_generated/server";
import { FRESH_MS } from "./access";
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("members")
      .withIndex("by_lastSeen", (q) => q.lt("lastSeen", now - FRESH_MS))
      .collect();
    for (const m of stale) await ctx.db.delete(m._id);
    const floors = await ctx.db
      .query("floor")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .collect();
    for (const f of floors) await ctx.db.delete(f._id);
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", now - 60_000))
      .collect();
    for (const s of signals) await ctx.db.delete(s._id);
  },
});
