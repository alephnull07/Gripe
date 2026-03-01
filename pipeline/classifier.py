import asyncio
import json
import re
from pydantic import BaseModel
from typing import Literal

from langchain_aws import ChatBedrockConverse
from langchain_core.messages import HumanMessage
from lmnr import observe

from scraper import RedditPost


def extract_json(text: str) -> dict:
    """Extract a JSON object from text that may contain surrounding prose."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r'\{[^{}]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    raise json.JSONDecodeError("No valid JSON object found", text, 0)


class ClassifiedPost(BaseModel):
    original: RedditPost
    type: Literal["bug", "feature", "none"]
    summary: str
    severity: Literal["low", "medium", "high"]


llm = ChatBedrockConverse(
    model="us.anthropic.claude-3-5-haiku-20241022-v1:0",
    region_name="us-west-2",
)


@observe(name="classify_post")
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
        raw = response.content
        if isinstance(raw, list):
            raw = "".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in raw
            )
        data = extract_json(raw.strip())
        return ClassifiedPost(
            original=post,
            type=data["type"].lower(),
            summary=data["summary"],
            severity=data["severity"].lower(),
        )
    except Exception as e:
        print(f"Error classifying post '{post.title}': {e}")
        return ClassifiedPost(
            original=post,
            type="none",
            summary=f"Could not classify: {post.title}",
            severity="low",
        )


@observe(name="classify_posts")
async def classify_posts(posts: list[RedditPost]) -> list[ClassifiedPost]:
    tasks = [classify_post(post) for post in posts]
    return await asyncio.gather(*tasks)
