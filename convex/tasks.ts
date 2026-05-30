import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { priorityValidator } from "./schema";

const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 32;

function sanitizeTitle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Task title is required");
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    throw new Error(`Title cannot exceed ${MAX_TITLE_LENGTH} characters`);
  }
  return trimmed;
}

function sanitizeNotes(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes cannot exceed ${MAX_NOTES_LENGTH} characters`);
  }
  return trimmed;
}

function sanitizeTags(raw: string[] | undefined): string[] {
  if (!raw) return [];
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const tag of raw) {
    const normalized = tag.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(normalized);
    if (cleaned.length >= MAX_TAGS) break;
  }
  return cleaned;
}

async function requireOwnerId(ctx: {
  auth: { getUserIdentity: () => Promise<unknown> };
}) {
  const identity = (await ctx.auth.getUserIdentity()) as
    | { subject?: string; tokenIdentifier?: string }
    | null;
  const ownerId = identity?.subject || identity?.tokenIdentifier;
  if (!ownerId) {
    throw new Error("Authentication required");
  }
  return ownerId;
}

export const list = query({
  args: {
    filter: v.optional(
      v.union(v.literal("all"), v.literal("open"), v.literal("done")),
    ),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const filter = args.filter ?? "all";
    if (filter === "all") {
      return await ctx.db
        .query("tasks")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .order("desc")
        .take(200);
    }
    const completed = filter === "done";
    return await ctx.db
      .query("tasks")
      .withIndex("by_owner_completed_created", (q) =>
        q.eq("ownerId", ownerId).eq("completed", completed),
      )
      .order("desc")
      .take(200);
  },
});

export const search = query({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const term = args.term.trim();
    if (!term) return [];
    return await ctx.db
      .query("tasks")
      .withSearchIndex("search_title", (q) =>
        q.search("title", term).eq("ownerId", ownerId),
      )
      .take(50);
  },
});

export const stats = query({
  args: { userTimezoneOffset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const all = await ctx.db
      .query("tasks")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
      .collect();
    const now = Date.now();
    const offsetMs = (args.userTimezoneOffset ?? 0) * 60 * 1000;
    const localNow = now - offsetMs;
    const startOfDay = Math.floor(localNow / 86_400_000) * 86_400_000 + offsetMs;
    const endOfDay = startOfDay + 86_400_000;

    let total = 0;
    let open = 0;
    let done = 0;
    let dueToday = 0;
    let overdue = 0;
    let highPriority = 0;

    for (const task of all) {
      total += 1;
      if (task.completed) {
        done += 1;
      } else {
        open += 1;
        if (task.priority === "high") highPriority += 1;
        if (task.dueAt !== undefined) {
          if (task.dueAt < startOfDay) overdue += 1;
          else if (task.dueAt >= startOfDay && task.dueAt < endOfDay) dueToday += 1;
        }
      }
    }

    return { total, open, done, dueToday, overdue, highPriority };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    notes: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    tags: v.optional(v.array(v.string())),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    return await ctx.db.insert("tasks", {
      ownerId,
      title: sanitizeTitle(args.title),
      notes: sanitizeNotes(args.notes),
      priority: args.priority ?? "medium",
      completed: false,
      tags: sanitizeTags(args.tags),
      dueAt: args.dueAt,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    tags: v.optional(v.array(v.string())),
    dueAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.ownerId !== ownerId) {
      throw new Error("Task not found");
    }
    const patch: Partial<typeof existing> = {};
    if (args.title !== undefined) patch.title = sanitizeTitle(args.title);
    if (args.notes !== undefined) patch.notes = sanitizeNotes(args.notes);
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.tags !== undefined) patch.tags = sanitizeTags(args.tags);
    if (args.dueAt !== undefined) {
      patch.dueAt = args.dueAt === null ? undefined : args.dueAt;
    }
    await ctx.db.patch(args.id, patch);
  },
});

export const toggle = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.ownerId !== ownerId) {
      throw new Error("Task not found");
    }
    const completed = !existing.completed;
    await ctx.db.patch(args.id, {
      completed,
      completedAt: completed ? Date.now() : undefined,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.ownerId !== ownerId) return;
    await ctx.db.delete(args.id);
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    const seedKey = `tasks_seeded:${ownerId}`;
    const existingSeed = await ctx.db
      .query("seeds")
      .withIndex("by_key", (q) => q.eq("key", seedKey))
      .unique();
    if (existingSeed) return { seeded: false };

    const now = Date.now();
    await ctx.db.insert("seeds", {
      key: seedKey,
      createdAt: now,
    });

    const day = 24 * 60 * 60 * 1000;
    const samples: Array<{
      title: string;
      notes?: string;
      priority: "low" | "medium" | "high";
      completed: boolean;
      tags: string[];
      dueAt?: number;
      offset: number;
    }> = [
      {
        title: "Map the onboarding review queue",
        notes: "Confirm the first request states, owners, and handoff criteria.",
        priority: "high",
        completed: false,
        tags: ["design", "ops"],
        dueAt: now + day,
        offset: 0,
      },
      {
        title: "Wire up Convex schema for billing events",
        priority: "high",
        completed: false,
        tags: ["backend", "billing"],
        dueAt: now + day * 3,
        offset: 1000 * 60 * 12,
      },
      {
        title: "Draft launch announcement",
        notes: "Keep it concise. Highlight: realtime sync, type-safety end-to-end, one command deploy.",
        priority: "medium",
        completed: false,
        tags: ["writing"],
        offset: 1000 * 60 * 45,
      },
      {
        title: "Reply to the design review comments",
        priority: "medium",
        completed: true,
        tags: ["design"],
        offset: 1000 * 60 * 60 * 4,
      },
      {
        title: "Set up the staging Convex deployment",
        priority: "low",
        completed: true,
        tags: ["infra"],
        offset: 1000 * 60 * 60 * 26,
      },
    ];

    for (const sample of samples) {
      await ctx.db.insert("tasks", {
        ownerId,
        title: sample.title,
        notes: sample.notes,
        priority: sample.priority,
        completed: sample.completed,
        tags: sample.tags,
        dueAt: sample.dueAt,
        createdAt: now - sample.offset,
        completedAt: sample.completed ? now - sample.offset / 2 : undefined,
      });
    }
    return { seeded: true };
  },
});
