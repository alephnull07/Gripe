import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function corsResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function corsOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET /api/items?status=detected
http.route({
  path: "/api/items",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let items;
    if (status) {
      items = await ctx.runQuery(api.pipeline.getByStatus, { status });
    } else {
      items = await ctx.runQuery(api.pipeline.getAll);
    }
    return corsResponse({ items });
  }),
});

// POST /api/items
http.route({
  path: "/api/items",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const ids = await ctx.runMutation(api.pipeline.addItems, {
      items: body.items,
    });
    return corsResponse({ ids });
  }),
});

http.route({
  path: "/api/items",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptions()),
});

// PATCH /api/items/status
http.route({
  path: "/api/items/status",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    await ctx.runMutation(api.pipeline.updateItemStatus, body);
    return corsResponse({ ok: true });
  }),
});

http.route({
  path: "/api/items/status",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptions()),
});

// GET /api/runs/current
http.route({
  path: "/api/runs/current",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const run = await ctx.runQuery(api.runs.getCurrent);
    return corsResponse(run);
  }),
});

http.route({
  path: "/api/runs/current",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptions()),
});

// POST /api/runs/trigger
http.route({
  path: "/api/runs/trigger",
  method: "POST",
  handler: httpAction(async (ctx) => {
    const id = await ctx.runMutation(api.runs.triggerRun);
    return corsResponse({ runId: id });
  }),
});

http.route({
  path: "/api/runs/trigger",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptions()),
});

// PATCH /api/runs/step
http.route({
  path: "/api/runs/step",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    await ctx.runMutation(api.runs.updateStep, body);
    return corsResponse({ ok: true });
  }),
});

http.route({
  path: "/api/runs/step",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptions()),
});

// POST /api/runs/complete
http.route({
  path: "/api/runs/complete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    await ctx.runMutation(api.runs.completeRun, body);
    return corsResponse({ ok: true });
  }),
});

http.route({
  path: "/api/runs/complete",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptions()),
});

export default http;
