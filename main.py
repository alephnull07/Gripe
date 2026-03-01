import asyncio
import json
import sys
import time

from dotenv import load_dotenv

load_dotenv(override=True)

from scraper import scrape_all
from classifier import classify_posts
from viability import validate_bugs, check_viability

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

    # Step 1: Scrape
    print("\n[1/4] Scraping subreddits")
    all_posts = await run_with_spinner("Scraping r/YCHackathonDemo + r/competitorYCHackathon", scrape_all())
    print(f"       -> {len(all_posts)} posts found")

    if not all_posts:
        print("\nNo posts found. Exiting.")
        return

    # Step 2: Classify
    print("\n[2/4] Classifying posts")
    classified = await run_with_spinner(f"Classifying {len(all_posts)} posts via Bedrock", classify_posts(all_posts))
    bugs = [p for p in classified if p.type == "bug"]
    features = [p for p in classified if p.type == "feature"]
    skipped = [p for p in classified if p.type == "none"]
    print(f"       -> {len(bugs)} bugs, {len(features)} features, {len(skipped)} skipped")

    # Step 3: Validate bugs with Claude
    print("\n[3/4] Validating bugs + checking feature viability")
    accepted_bugs, accepted_features = await asyncio.gather(
        run_with_spinner(f"Validating {len(bugs)} bugs via Bedrock", validate_bugs(bugs)),
        run_with_spinner(f"Checking {len(features)} features via Bedrock", check_viability(features)),
    )
    print(f"       -> {len(accepted_bugs)} confirmed bugs, {len(accepted_features)} viable features")

    # Step 4: Output
    print("\n[4/4] Writing output")
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
    print("  Done! Results -> output.json")
    print("=" * 50)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
