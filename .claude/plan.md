# Laminar Tracing Integration Plan

## Current State
- `@lmnr-ai/lmnr` v0.5.0 is **already installed** in `orchestrator/package.json`
- `LAMINAR_API_KEY=` exists in `.env` but is **empty** — you'll need to fill this in from your Laminar dashboard
- The dashboard already renders a **"Laminar trace ↗"** link per item (`pipeline-feed.tsx:94`) but it's hardcoded to `#`
- No Laminar setup exists in either the Python pipeline or the TS orchestrator yet
- No `lmnr` Python package in `requirements.txt`

## Architecture

Two independent traces (one per process), linked to Convex items:

1. **Python pipeline trace** — wraps `main()` as a single trace containing spans for SCRAPE, CLASSIFY, VALIDATE. Auto-instruments LangChain/Bedrock LLM calls. Stores a `traceUrl` on each Convex item it creates.

2. **TS orchestrator trace** — wraps each `processItem()` call as a trace containing spans for BUILD (Claude), VERIFY (Browser Use), DEPLOY (PR). Auto-instruments `@anthropic-ai/bedrock-sdk`. Overwrites the item's `traceUrl` with the orchestrator trace (since that's the more interesting one).

The Laminar env var used is `LMNR_PROJECT_API_KEY` (that's what the SDK reads by default). We'll rename the `.env` entry from `LAMINAR_API_KEY` to `LMNR_PROJECT_API_KEY`.

## Changes

### 1. `.env` — rename key
- Rename `LAMINAR_API_KEY=` → `LMNR_PROJECT_API_KEY=`

### 2. `pipeline/requirements.txt` — add Python SDK
- Add `lmnr` package

### 3. `pipeline/main.py` — initialize + trace the pipeline
- `from lmnr import Laminar, observe`
- Call `Laminar.initialize()` at top (reads `LMNR_PROJECT_API_KEY` from env)
- Decorate `main()` with `@observe(name="gripe-pipeline")`
- After pushing items to Convex, get the trace ID via `Laminar.get_trace_id()` and build a Laminar dashboard URL
- Pass `traceUrl` when calling `add_items()` for each item

### 4. `pipeline/classifier.py` — decorate LLM function
- `@observe(name="classify_post")` on `classify_post()`
- `@observe(name="classify_posts")` on `classify_posts()`

### 5. `pipeline/viability.py` — decorate LLM functions
- `@observe(name="validate_bug")` on `validate_bug()`
- `@observe(name="check_feature_viability")` on `check_feature_viability()`

### 6. `pipeline/scraper.py` — decorate scraper
- `@observe(name="scrape_subreddit")` on `scrape_subreddit()`
- `@observe(name="scrape_all")` on `scrape_all()`

### 7. `orchestrator/src/main.ts` — initialize + trace per item
- `import { Laminar, observe } from "@lmnr-ai/lmnr"`
- `import AnthropicBedrock from "@anthropic-ai/bedrock-sdk"`
- Call `Laminar.initialize({ instrumentModules: { anthropic: AnthropicBedrock } })` before creating clients
- Wrap `processItem()` with `observe({ name: "process-item" })`
- After processing, get the trace ID and build a Laminar trace URL
- Update the Convex item's `traceUrl` with the orchestrator's trace link

### 8. `convex/schema.ts` — add traceUrl field
- Add `traceUrl: v.optional(v.string())` to `pipelineItems` table

### 9. `convex/pipeline.ts` — accept traceUrl in addItems mutation
- Include `traceUrl` in the item insert

### 10. `convex/http.ts` — pass traceUrl through HTTP routes
- Accept `traceUrl` in POST `/api/items` and PATCH `/api/items/status`

### 11. `pipeline/convex_client.py` — pass traceUrl in add_items
- Include `traceUrl` field in items payload

### 12. `components/pipeline-feed.tsx` — wire up trace link
- Use `item.traceUrl` instead of hardcoded `#`
- Hide the link if no traceUrl exists yet

## Prerequisite
You need a Laminar API key. Go to https://www.lmnr.ai, create a project, copy the project API key, and paste it into `.env` as `LMNR_PROJECT_API_KEY=<your-key>`.
