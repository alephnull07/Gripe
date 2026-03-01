import asyncio
import json
from pydantic import BaseModel
from typing import Literal

from langchain_aws import ChatBedrockConverse
from langchain_core.messages import HumanMessage

from scraper import RedditPost


class ClassifiedPost(BaseModel):
    original: RedditPost
    type: Literal["bug", "feature", "none"]
    summary: str
    severity: Literal["low", "medium", "high"]


llm = ChatBedrockConverse(
    model="us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    region_name="us-west-2",
)


async def classify_post(post: RedditPost) -> ClassifiedPost:
    prompt = f"""Classify this Reddit post into exactly one category:

- BUG: User is reporting something that is broken, not working, or malfunctioning.
- FEATURE: User is requesting new functionality, an improvement, or a change to how the product works.
- NONE: The post is general feedback, praise, a question, off-topic, or does not describe a specific bug or feature request.

Be strict. Only classify as BUG if something is clearly broken. Only classify as FEATURE if the user is clearly asking for something new or different. Everything else is NONE.

Title: {post.title}
Body: {post.body}
Top comments: {post.top_comments}
Subreddit: {post.subreddit}
Source: {post.source}

Respond with ONLY valid JSON, no markdown backticks:
{{"type": "bug" or "feature" or "none", "summary": "one sentence summary", "severity": "low" or "medium" or "high"}}"""

    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            raw = raw.rsplit("```", 1)[0].strip()
        data = json.loads(raw)
        return ClassifiedPost(
            original=post,
            type=data["type"],
            summary=data["summary"],
            severity=data["severity"],
        )
    except Exception as e:
        print(f"Error classifying post '{post.title}': {e}")
        return ClassifiedPost(
            original=post,
            type="none",
            summary=f"Could not classify: {post.title}",
            severity="low",
        )


async def classify_posts(posts: list[RedditPost]) -> list[ClassifiedPost]:
    tasks = [classify_post(post) for post in posts]
    return await asyncio.gather(*tasks)
