import os
import requests

CONVEX_SITE_URL = os.getenv("CONVEX_SITE_URL", "https://beaming-zebra-910.convex.site")


def add_items(items: list) -> list:
    """Send scraped items to Convex. Returns list of Convex IDs."""
    payload = {"items": items}
    resp = requests.post(f"{CONVEX_SITE_URL}/api/items", json=payload)
    resp.raise_for_status()
    return resp.json()["ids"]


def update_item_status(item_id: str, status: str, message: str = "", **kwargs):
    """Update a pipeline item's status."""
    payload = {"id": item_id, "status": status}
    if message:
        payload["statusMessage"] = message
    payload.update(kwargs)
    resp = requests.patch(f"{CONVEX_SITE_URL}/api/items/status", json=payload)
    resp.raise_for_status()


def trigger_run() -> str:
    """Trigger a new pipeline run. Returns run ID."""
    resp = requests.post(f"{CONVEX_SITE_URL}/api/runs/trigger")
    resp.raise_for_status()
    return resp.json()["runId"]


def update_run_step(run_id: str, step_name: str, step_status: str, next_step: str = None):
    """Update which step the pipeline is currently on."""
    payload = {"id": run_id, "stepName": step_name, "stepStatus": step_status}
    if next_step:
        payload["nextStep"] = next_step
    resp = requests.patch(f"{CONVEX_SITE_URL}/api/runs/step", json=payload)
    resp.raise_for_status()


def complete_run(run_id: str, items_processed: int):
    """Mark a pipeline run as complete."""
    resp = requests.post(f"{CONVEX_SITE_URL}/api/runs/complete", json={
        "id": run_id,
        "itemsProcessed": items_processed,
    })
    resp.raise_for_status()
