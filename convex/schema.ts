import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  pipelineItems: defineTable({
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
    status: v.string(),
    statusMessage: v.optional(v.string()),
    pr: v.optional(v.string()),
    verified: v.optional(v.boolean()),
    filesChanged: v.optional(v.array(v.string())),
    detail: v.optional(v.string()),
    traceUrl: v.optional(v.string()),
    screenshotUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_created", ["createdAt"]),

  pipelineRuns: defineTable({
    status: v.string(),
    currentStep: v.optional(v.string()),
    steps: v.array(
      v.object({
        name: v.string(),
        status: v.string(),
      })
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    itemsProcessed: v.number(),
  }),
});
