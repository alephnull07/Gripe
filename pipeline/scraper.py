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
        task = await client.tasks.create_task(
            task=task_text,
            start_url=url,
            structured_output=json.dumps(ScrapeResult.model_json_schema()),
        )
        task_id = task.id
        print(f"    Cloud task created: {task_id} for {url}")

        # Wait for completion (polls automatically, 5 min timeout)
        result = await client.tasks.wait(task_id, timeout=300, interval=3)

        if result.output:
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
