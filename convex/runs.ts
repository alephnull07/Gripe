import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_STEPS = [
  { name: "SCRAPE", status: "pending" },
  { name: "CLASSIFY", status: "pending" },
  { name: "VALIDATE", status: "pending" },
  { name: "BUILD", status: "pending" },
  { name: "VERIFY", status: "pending" },
  { name: "DEPLOY", status: "pending" },
  { name: "POST", status: "pending" },
];

export const getCurrent = query({
  handler: async (ctx) => {
    const run = await ctx.db.query("pipelineRuns").order("desc").first();
    if (!run) {
      return { status: "idle", steps: DEFAULT_STEPS, itemsProcessed: 0 };
    }
    // If a run has been "running" for more than 10 minutes, treat it as stale/failed
    if (
      run.status === "running" &&
      run.startedAt &&
      Date.now() - run.startedAt > 10 * 60 * 1000
    ) {
      return { ...run, status: "stale" };
    }
    return run;
  },
});

export const triggerRun = mutation({
  handler: async (ctx) => {
    return await ctx.db.insert("pipelineRuns", {
      status: "running",
      currentStep: "SCRAPE",
      steps: DEFAULT_STEPS.map((s, i) => ({
        ...s,
        status: i === 0 ? "running" : "pending",
      })),
      startedAt: Date.now(),
      itemsProcessed: 0,
    });
  },
});

export const updateStep = mutation({
  args: {
    id: v.id("pipelineRuns"),
    stepName: v.string(),
    stepStatus: v.string(),
    nextStep: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.id);
    if (!run) return;

    const steps = run.steps.map((s) => {
      if (s.name === args.stepName) return { ...s, status: args.stepStatus };
      if (args.nextStep && s.name === args.nextStep)
        return { ...s, status: "running" };
      return s;
    });

    await ctx.db.patch(args.id, {
      steps,
      currentStep: args.nextStep || args.stepName,
    });
  },
});

export const completeRun = mutation({
  args: { id: v.id("pipelineRuns"), itemsProcessed: v.number() },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.id);
    if (!run) return;
    const steps = run.steps.map((s) => ({ ...s, status: "done" }));
    await ctx.db.patch(args.id, {
      status: "completed",
      steps,
      completedAt: Date.now(),
      itemsProcessed: args.itemsProcessed,
    });
  },
});
