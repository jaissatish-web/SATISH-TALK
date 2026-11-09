import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
  settings: defineTable({ channel: v.string(), name: v.string() }).index(
    "by_channel",
    ["channel"],
  ),
  members: defineTable({
    sessionId: v.string(),
    secretHash: v.string(),
    credentialHash: v.string(),
    name: v.string(),
    channel: v.string(),
    joinedAt: v.number(),
    lastSeen: v.number(),
    signalWindow: v.number(),
    signalCount: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_channel", ["channel"])
    .index("by_lastSeen", ["lastSeen"]),
  floor: defineTable({
    channel: v.string(),
    sessionId: v.string(),
    name: v.string(),
    since: v.number(),
    expiresAt: v.number(),
  })
    .index("by_channel", ["channel"])
    .index("by_expiresAt", ["expiresAt"]),
  signals: defineTable({
    toSession: v.string(),
    fromSession: v.string(),
    channel: v.string(),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
    createdAt: v.number(),
  })
    .index("by_recipient", ["toSession"])
    .index("by_createdAt", ["createdAt"]),
});
