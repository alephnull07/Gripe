import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("pipelineItems").order("desc").collect();
  },
});

export const getStats = query({
  handler: async (ctx) => {
    const items = await ctx.db.query("pipelineItems").collect();
    const done = items.filter((i) => i.status === "done");
    return {
      totalItems: items.length,
      itemsShipped: done.length,
      bugs: items.filter((i) => i.type === "bug").length,
      features: items.filter((i) => i.type === "feature").length,
      bugsDone: done.filter((i) => i.type === "bug").length,
      featuresDone: done.filter((i) => i.type === "feature").length,
      statusCounts: items.reduce(
        (acc, i) => {
          acc[i.status] = (acc[i.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  },
});

export const addItems = mutation({
  args: {
    items: v.array(
      v.object({
        title: v.string(),
        body: v.string(),
        summary: v.string(),
        severity: v.string(),
        type: v.string(),
        source: v.string(),
        subreddit: v.string(),
        url: v.string(),
        upvotes: v.number(),
        topComments: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const item of args.items) {
      const id = await ctx.db.insert("pipelineItems", {
        ...item,
        status: "detected",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});

export const updateItemStatus = mutation({
  args: {
    id: v.id("pipelineItems"),
    status: v.string(),
    statusMessage: v.optional(v.string()),
    pr: v.optional(v.string()),
    verified: v.optional(v.boolean()),
    filesChanged: v.optional(v.array(v.string())),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});
