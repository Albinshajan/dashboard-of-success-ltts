# Altair Chart Service

Compiles interactive, cross-filtered **Vega-Lite** dashboards from a chart *plan*.

The Node backend drafts the plan with Gemini, then POSTs the dataset + plan here.
This service builds real **Altair** charts, wires a shared selection so the views are
linked, validates them (Altair's `.to_dict()` enforces the Vega-Lite schema), and
returns two compiled specs that the React frontend renders with `vega-embed`:

- `filter_spec` — clicking a value filters the rows of every other chart.
- `highlight_spec` — clicking highlights matching marks while keeping all data visible.

The frontend toggles between the two specs instantly (no re-fetch).

## Why a separate Python service?

Altair is a Python library — it can't run in Node or the browser. It only *emits*
Vega-Lite JSON, which is what the browser actually renders. This service is where the
"hybrid" validation happens: Gemini drafts, Altair compiles & validates.

## Setup

```bash
cd altair-service
python3 -m venv venv
./venv/bin/python -m pip install -r requirements.txt
```

## Run

```bash
./venv/bin/uvicorn main:app --port 8000 --reload
```

The Node backend calls `http://localhost:8000` by default; override with the
`ALTAIR_SERVICE_URL` env var on the Node side.

## Endpoints

- `GET  /health` → `{ "status": "ok" }`
- `POST /build`  → `{ data: [...rows], plan: {...} }` ⇒
  `{ filter_spec, highlight_spec, crossfilter_field, columns, row_count }`

### Plan shape

```jsonc
{
  "dashboard_title": "Sales Performance",
  "crossfilter_field": "Country",          // the dimension users click to slice
  "dynamic_charts": [
    {
      "id": "c1",
      "title": "Sales by Country",
      "mark": "bar",                        // bar | line | point | area | arc
      "is_filter_source": true,             // exactly ONE chart drives the cross-filter
      "x": { "field": "Country", "type": "nominal", "aggregate": null },
      "y": { "field": "Sales", "type": "quantitative", "aggregate": "sum" },
      "color": null
    }
  ]
}
```
