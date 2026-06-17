# Dashboard of Success — LTTS

## Running the full stack

The app now has **three** services. Start them in three terminals:

```bash
# 1. Altair chart service (Python) — compiles the interactive Vega-Lite dashboards
cd altair-service
python3 -m venv venv && ./venv/bin/python -m pip install -r requirements.txt   # first time only
./venv/bin/uvicorn main:app --port 8000 --reload

# 2. Node backend — Gemini analysis + forwards chart plans to the Altair service
cd success-dashboard-backend
node server.js        # runs on :3000 (PORT in .env)

# 3. Frontend (Vite)
npm install           # first time only
npm run dev
```

### How the interactive charts work

1. You pick **how many charts** (4–6) and upload a CSV/Excel file. The chosen
   filename stays pinned in the upload area (with an "Analyzing…/Ready" status)
   until the analysis finishes.
2. The Node backend extracts the rows; the **Altair service preprocesses** them —
   trims column names, coerces number/date-like text, drops empty columns and
   duplicate rows, and infers each column's type.
3. Gemini drafts a **chart plan** (the perfect mark per relationship + which
   categorical column drives cross-filtering) plus insights & hypotheses.
4. The **Altair service** builds real Altair charts sharing one selection param,
   **corrects any mismatched chart types** against the detected data types, and
   returns two compiled Vega-Lite specs: a **filter** version and a **highlight**
   version.
5. The frontend renders one responsive, linked `vega-embed` dashboard (2 columns,
   collapsing to 1 on narrow screens). Click a value to cross-filter/highlight every
   chart; the **Filter / Highlight** toggle swaps modes instantly; double-click resets.

### Extra features

- **Build your own chart** — a structured form (chart type + X/Y + aggregate +
  optional color) below the dashboard adds a custom chart that joins the linked
  view and cross-filters with the rest (`POST /api/custom-chart`).
- **Download / Save** — export the whole dashboard as a high-res **PNG** or scalable
  **SVG** from the buttons in the dashboard header.

If the Altair service is down, the dashboard shows a clear notice and still renders
the text insights.

---

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
