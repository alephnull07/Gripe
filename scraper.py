import asyncio
import json
import os
from pydantic import BaseModel
from typing import Literal

from browser_use_sdk import AsyncBrowserUse


class RedditPost(BaseModel):
    title: str
    body: str
    upvotes: int
    url: str
    subreddit: str
    source: Literal["our_app", "competitor"]
    top_comments: list[str]  # up to 5


class ScrapeResult(BaseModel):
    posts: list[RedditPost]


async def scrape_subreddit(url: str, source: str) -> ScrapeResult:
    client = AsyncBrowserUse(api_key=os.getenv("BROWSER_USE_API_KEY"))

    task_text = (
        f"Go to {url}. For each post visible on the page, extract: the post title, "
        f"the post body/description text, the upvote count (as an integer), and the full post URL. "
        f"Then click into each post and extract the text of up to 5 top comments. "
        f"After collecting all posts, navigate back if needed and repeat for any remaining posts. "
        f"For every post, set the subreddit field to the subreddit name (e.g. 'r/YCHackathonDemo') "
        f'and set the source field to exactly "{source}". '
        f"Return all data as structured output matching the required schema."
    )

    try:
        # Create the task
        task = await client.tasks.create_task(
            task=task_text,
            start_url=url,
            structured_output=True,
            schema=ScrapeResult,
        )
        task_id = task.id
        print(f"    Cloud task created: {task_id} for {url}")

        # Poll until done
        while True:
            status = await client.tasks.get_task_status(task_id=task_id)
            state = status.status if hasattr(status, "status") else str(status)
            if state in ("finished", "completed", "done"):
                break
            if state in ("failed", "error", "stopped"):
                print(f"    Task {task_id} failed: {state}")
                return ScrapeResult(posts=[])
            await asyncio.sleep(3)

        # Get results
        result = await client.tasks.get_task(task_id=task_id, schema=ScrapeResult)
        if result.output:
            if isinstance(result.output, ScrapeResult):
                return result.output
            data = result.output
            if isinstance(data, str):
                data = json.loads(data)
            return ScrapeResult.model_validate(data)

        print(f"Warning: No results from {url}, returning empty list")
        return ScrapeResult(posts=[])
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return ScrapeResult(posts=[])


async def scrape_all() -> list[RedditPost]:
    result_ours, result_competitor = await asyncio.gather(
        scrape_subreddit("https://www.reddit.com/r/YCHackathonDemo/best/", "our_app"),
        scrape_subreddit("https://www.reddit.com/r/competitorYCHackathon/", "competitor"),
    )
    return result_ours.posts + result_competitor.posts
