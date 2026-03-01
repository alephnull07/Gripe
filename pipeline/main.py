import asyncio
import json
import sys
import time

from dotenv import load_dotenv

load_dotenv(override=True)

from scraper import scrape_all
from classifier import classify_posts
from viability import validate_bugs, check_viability
from convex_client import trigger_run, update_run_step, complete_run, add_items, update_item_status

SPINNER = ["\u28cb", "\u28d9", "\u28f9", "\u28f8", "\u28fc", "\u28f4", "\u28e6", "\u28e7", "\u28c7", "\u28cf"]


async def run_with_spinner(label: str, coro):
    """Run an async coroutine while showing a spinner + elapsed time."""
    start = time.time()
    done = False
    result = None
    error = None

    async def spin():
        i = 0
        while not done:
            elapsed = time.time() - start
            sys.stdout.write(f"\r  {SPINNER[i % len(SPINNER)]} {label} [{elapsed:.0f}s]  ")
            sys.stdout.flush()
            i += 1
            await asyncio.sleep(0.15)

    async def work():
        nonlocal result, error, done
        try:
            result = await coro
        except Exception as e:
            error = e
        finally:
            done = True

    await asyncio.gather(spin(), work())
    elapsed = time.time() - start
    sys.stdout.write(f"\r  \u2713 {label} [{elapsed:.1f}s]\n")
    sys.stdout.flush()

    if error:
        raise error
    return result


async def main():
    print("=" * 50)
    print("  Gripe Pipeline")
    print("=" * 50)

    # Trigger run in Convex (frontend shows "running")
    print("\n  Triggering pipeline run in Convex...")
    run_id = trigger_run()
    print(f"  Run ID: {run_id}")

    # Step 1: Scrape
    print("\n[1/4] Scraping subreddits")
    update_run_step(run_id, "SCRAPE", "running")
    all_posts = await run_with_spinner("Scraping r/YCHackathonDemo + r/competitorYCHackathon", scrape_all())
    print(f"       -> {len(all_posts)} posts found")
    update_run_step(run_id, "SCRAPE", "done", "CLASSIFY")

    if not all_posts:
        print("\nNo posts found. Exiting.")
        complete_run(run_id, 0)
        return

    # Step 2: Classify
    print("\n[2/4] Classifying posts")
    update_run_step(run_id, "CLASSIFY", "running")
    classified = await run_with_spinner(f"Classifying {len(all_posts)} posts via Bedrock", classify_posts(all_posts))
    bugs = [p for p in classified if p.type == "bug"]
    features = [p for p in classified if p.type == "feature"]
    skipped = [p for p in classified if p.type == "none"]
    print(f"       -> {len(bugs)} bugs, {len(features)} features, {len(skipped)} skipped")
    update_run_step(run_id, "CLASSIFY", "done", "VALIDATE")

    # Step 3: Validate bugs + check feature viability
    print("\n[3/4] Validating bugs + checking feature viability")
    update_run_step(run_id, "VALIDATE", "running")
    accepted_bugs, accepted_features = await asyncio.gather(
        run_with_spinner(f"Validating {len(bugs)} bugs via Bedrock", validate_bugs(bugs)),
        run_with_spinner(f"Checking {len(features)} features via Bedrock", check_viability(features)),
    )
    print(f"       -> {len(accepted_bugs)} confirmed bugs, {len(accepted_features)} viable features")
    update_run_step(run_id, "VALIDATE", "done", "BUILD")

    # Step 4: Push accepted items to Convex
    print("\n[4/4] Pushing to Convex dashboard")
    update_run_step(run_id, "BUILD", "running")

    items_for_convex = []
    for p in accepted_bugs:
        items_for_convex.append({
            "title": p.original.title,
            "body": p.original.body,
            "summary": p.summary,
            "severity": p.severity,
            "type": "bug",
            "source": p.original.source,
            "subreddit": p.original.subreddit,
            "url": p.original.url,
            "upvotes": p.original.upvotes,
            "topComments": p.original.top_comments,
        })
    for p in accepted_features:
        items_for_convex.append({
            "title": p.original.title,
            "body": p.original.body,
            "summary": p.summary,
            "severity": p.severity,
            "type": "feature",
            "source": p.original.source,
            "subreddit": p.original.subreddit,
            "url": p.original.url,
            "upvotes": p.original.upvotes,
            "topComments": p.original.top_comments,
        })

    if items_for_convex:
        item_ids = add_items(items_for_convex)
        print(f"       -> {len(item_ids)} items pushed to Convex")

        # Mark each item as done
        for item_id in item_ids:
            update_item_status(item_id, "done")
    else:
        item_ids = []
        print("       -> No items to push")

    # Mark remaining steps as done and complete the run
    update_run_step(run_id, "BUILD", "done", "VERIFY")
    update_run_step(run_id, "VERIFY", "done", "DEPLOY")
    update_run_step(run_id, "DEPLOY", "done", "POST")
    update_run_step(run_id, "POST", "done")
    complete_run(run_id, len(item_ids))

    # Also write local output.json
    output = {
        "accepted_bugs": [
            {
                "title": p.original.title,
                "body": p.original.body,
                "summary": p.summary,
                "severity": p.severity,
                "upvotes": p.original.upvotes,
                "url": p.original.url,
                "subreddit": p.original.subreddit,
                "source": p.original.source,
                "top_comments": p.original.top_comments,
            }
            for p in accepted_bugs
        ],
        "accepted_features": [
            {
                "title": p.original.title,
                "body": p.original.body,
                "summary": p.summary,
                "severity": p.severity,
                "upvotes": p.original.upvotes,
                "url": p.original.url,
                "subreddit": p.original.subreddit,
                "source": p.original.source,
                "top_comments": p.original.top_comments,
            }
            for p in accepted_features
        ],
    }

    with open("output.json", "w") as f:
        json.dump(output, f, indent=2)

    print("=" * 50)
    print("  Done! Results -> output.json + Convex dashboard")
    print("=" * 50)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
