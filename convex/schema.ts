import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const priorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

export default defineSchema({
  seeds: defineTable({
    key: v.string(),
    createdAt: v.number(),
  }).index("by_key", ["key"]),
  tasks: defineTable({
    ownerId: v.string(),
    title: v.string(),
    notes: v.optional(v.string()),
    priority: priorityValidator,
    completed: v.boolean(),
    tags: v.array(v.string()),
    dueAt: v.optional(v.number()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_owner_created", ["ownerId", "createdAt"])
    .index("by_owner_completed_created", ["ownerId", "completed", "createdAt"])
    .index("by_due", ["dueAt"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["ownerId", "completed"],
    }),
});
