"""
Altair compilation microservice.

The Node backend drafts a chart *plan* with Gemini, then POSTs the dataset + plan
here. This service builds real Altair charts, wires a shared selection for
cross-filtering, validates them, and returns two compiled Vega-Lite specs
(filter + highlight) that the React frontend renders with vega-embed.

Run:
    pip install -r requirements.txt
    uvicorn main:app --port 8000 --reload
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from builder import build_specs

app = FastAPI(title="LTTS Altair Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class BuildRequest(BaseModel):
    data: list[dict[str, Any]]
    plan: dict[str, Any]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "altair"}


@app.post("/build")
def build(req: BuildRequest) -> dict[str, Any]:
    try:
        return build_specs(req.data, req.plan)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:  # noqa: BLE001 - surface compile errors to the caller
        raise HTTPException(status_code=500, detail=f"Altair compile failed: {e}")
