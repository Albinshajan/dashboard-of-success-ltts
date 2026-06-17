"""
Altair chart builder.

Takes a structured chart *plan* (drafted by Gemini in the Node backend) plus the
raw dataset, and compiles two validated Vega-Lite specs:

  * "filter"    – selecting a value in the cross-filter source chart filters the
                  underlying rows of every other chart (classic linked dashboard).
  * "highlight" – selecting highlights matching marks across all charts while
                  keeping the full dataset visible (brushing & linking).

Because Vega-Lite cross-filtering only works when the linked views share a single
selection parameter inside one compound spec, all charts are combined into one
`concat` spec. The shared `alt.selection_point` is what links them together.

Altair's `.to_dict()` performs schema validation, so an invalid plan raises here
rather than silently producing a broken chart in the browser.
"""

from __future__ import annotations

import re
from typing import Any

import altair as alt
import pandas as pd

# LTTS brand palette. Ordered so ADJACENT categories are maximally distinct
# (no two neighbouring colours are both teal/green) — important for pie slices.
NAVY = "#003a70"
TEAL = "#00c5cd"
RED = "#e31b23"
PALETTE = [TEAL, NAVY, RED, "#f29e4c", "#7d5ba6", "#2a9d8f", "#ffd166", "#8d99ae", "#5bc0be", "#b5179e"]

DIMMED_OPACITY = 0.18

# Altair embeds the data inline in the spec. Cap rows so specs stay reasonable;
# row-level data is needed for cross-filtering to recompute aggregates. Set high
# enough that typical tender datasets are NOT truncated (which would make totals
# like Total TCV wrong); truncation is logged rather than silent.
MAX_ROWS = 50000

_TYPE_MAP = {
    "nominal": "nominal",
    "n": "nominal",
    "quantitative": "quantitative",
    "q": "quantitative",
    "temporal": "temporal",
    "t": "temporal",
    "ordinal": "ordinal",
    "o": "ordinal",
}

_MARK_MAP = {
    "bar": "bar",
    "line": "line",
    "area": "area",
    "point": "point",
    "scatter": "point",
    "circle": "circle",
    "tick": "tick",
    "arc": "arc",
    "pie": "arc",
    "boxplot": "boxplot",
}


def _coerce_type(t: str | None) -> str:
    if not t:
        return "nominal"
    return _TYPE_MAP.get(str(t).strip().lower(), "nominal")


# ---------------------------------------------------------------------------
# Natural ordering for sequential categories (months, weekdays, quarters) so
# axes/legends read Jan, Feb, Mar… instead of alphabetically Apr, Aug, Dec…
# ---------------------------------------------------------------------------
_MONTH_ORDER = {
    name: i
    for i, names in enumerate(
        [("jan", "january"), ("feb", "february"), ("mar", "march"), ("apr", "april"),
         ("may",), ("jun", "june"), ("jul", "july"), ("aug", "august"),
         ("sep", "sept", "september"), ("oct", "october"), ("nov", "november"), ("dec", "december")],
        start=1,
    )
    for name in names
}
_WEEKDAY_ORDER = {
    name: i
    for i, names in enumerate(
        [("mon", "monday"), ("tue", "tues", "tuesday"), ("wed", "wednesday"),
         ("thu", "thur", "thurs", "thursday"), ("fri", "friday"), ("sat", "saturday"), ("sun", "sunday")],
        start=1,
    )
    for name in names
}


def _ordered_categories(values: list[Any]) -> list[Any] | None:
    """Return the values sorted into natural order if they're months/weekdays/
    quarters, else None. ALL values must match the same family."""
    vals = [v for v in values if isinstance(v, str) and v.strip()]
    if not vals:
        return None

    def month_key(v: str):
        s = v.strip().lower()
        return _MONTH_ORDER.get(s) or _MONTH_ORDER.get(s[:3])

    def weekday_key(v: str):
        s = v.strip().lower()
        return _WEEKDAY_ORDER.get(s) or _WEEKDAY_ORDER.get(s[:3])

    def quarter_key(v: str):
        m = re.match(r"^(?:q|quarter)\s*([1-4])$", v.strip().lower())
        return int(m.group(1)) if m else None

    for keyfn in (month_key, weekday_key, quarter_key):
        keyed = [(keyfn(v), v) for v in vals]
        if all(k is not None for k, _ in keyed):
            return [v for _, v in sorted(keyed, key=lambda kv: kv[0])]
    return None


# ---------------------------------------------------------------------------
# Preprocessing — the "analyzer" cleans the data before any chart is built.
# ---------------------------------------------------------------------------

# Strip ONLY thousands separators, currency symbols, %, and spaces — never
# letters (so "Q1"/"A2" stay categorical and aren't turned into 1/2).
_NUM_CLEAN_RE = r"[,$€£₹%\s]"


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """Clean an uploaded dataset so charts and TOTALS are correct.

    - Trims whitespace from column names (real-world CSVs often have
      "Life expectancy " with trailing spaces).
    - Drops fully-empty columns.
    - Coerces number-like text columns to numeric, and date-like text columns
      to datetime, so the right chart types and aggregates work.

    NOTE: rows are NOT de-duplicated — two tenders with identical values are
    distinct records, and dropping them would undercount sums like Total TCV.
    """
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]

    # Drop columns that are entirely empty, and a runaway index column if present.
    df = df.dropna(axis=1, how="all")
    if "Unnamed: 0" in df.columns:
        df = df.drop(columns=["Unnamed: 0"])

    for col in df.columns:
        if df[col].dtype != object:
            continue
        series = df[col]
        # Strip thousands separators / currency / % so "1,200,000" and "$1,200"
        # sum correctly — but keep letters so category codes stay categorical.
        cleaned = series.astype(str).str.replace(_NUM_CLEAN_RE, "", regex=True).str.strip()
        as_num = pd.to_numeric(cleaned, errors="coerce")
        if as_num.notna().mean() >= 0.8:  # mostly numbers -> treat as numeric
            df[col] = as_num
            continue
        # Try datetime only when values look date-like to avoid false positives.
        sample = series.dropna().astype(str).head(25)
        looks_dateish = sample.str.contains(r"[-/:]", regex=True).mean() > 0.5 if len(sample) else False
        if looks_dateish:
            as_dt = pd.to_datetime(series, errors="coerce")
            if as_dt.notna().mean() >= 0.8:
                df[col] = as_dt
                continue

        # Categorical text: canonicalise so spelling/spacing/case variants of the
        # SAME value merge into one bucket (e.g. "ICCC", "ICCC ", "iccc" -> "ICCC").
        df[col] = _canonicalize_categories(series)

    return df.reset_index(drop=True)


def _canonicalize_categories(series: pd.Series) -> pd.Series:
    """Merge trivial variants of a categorical value into one canonical spelling.

    Trims whitespace, collapses internal runs of spaces, and maps case-insensitive
    duplicates to their MOST FREQUENT original spelling. So "ICCC", "ICCC " and
    "iccc" all become the single most-common form, counted as one category — while
    genuinely different labels are left untouched.
    """
    cleaned = (
        series.astype(str)
        .str.strip()
        .str.replace(r"\s+", " ", regex=True)
        .mask(series.isna())  # keep nulls as null, not the string "nan"
    )
    nonnull = cleaned.dropna()
    if nonnull.empty:
        return cleaned

    # value_counts is sorted by frequency desc -> first spelling seen per key wins.
    canon: dict[str, str] = {}
    for val in nonnull.value_counts().index:
        key = val.casefold()
        if key not in canon:
            canon[key] = val
    return cleaned.map(lambda v: canon.get(v.casefold(), v) if isinstance(v, str) else v)


# Column names that denote an ordered category rather than a measure.
_ORDINAL_NAME_HINTS = (
    "year", "quarter", "month", "week", "day", "rank", "rating",
    "grade", "level", "stage", "tier", "score band", "decile",
)


def detect_types(df: pd.DataFrame) -> dict[str, str]:
    """Map each column to the Vega-Lite type the data actually warrants."""
    types: dict[str, str] = {}
    for col in df.columns:
        dtype = df[col].dtype
        name = str(col).strip().lower()
        if pd.api.types.is_datetime64_any_dtype(dtype):
            types[col] = "temporal"
        elif pd.api.types.is_numeric_dtype(dtype):
            # Default numbers to quantitative (a measure). Only treat as ordinal
            # when the NAME implies an ordered category (e.g. Year, Quarter) and
            # cardinality is low — never demote a real measure like Sales.
            nunique = df[col].nunique(dropna=True)
            is_ordered_name = any(h in name for h in _ORDINAL_NAME_HINTS)
            if pd.api.types.is_integer_dtype(dtype) and is_ordered_name and nunique <= 30:
                types[col] = "ordinal"
            else:
                types[col] = "quantitative"
        else:
            types[col] = "nominal"
    return types


def _resolve_type(field: str, requested: str | None, col_types: dict[str, str]) -> str:
    """Trust the detected dtype over the LLM's guess, falling back to its hint."""
    detected = col_types.get(field)
    if detected:
        # Honor an explicit ordinal/temporal request when it doesn't fight the data.
        if requested and _coerce_type(requested) == "temporal" and detected != "nominal":
            return "temporal"
        return detected
    return _coerce_type(requested)


def _field_kwargs(
    field_def: dict[str, Any] | None,
    columns: list[str],
    col_types: dict[str, str],
) -> dict[str, Any] | None:
    """Translate a plan field definition into Altair channel kwargs, or None."""
    if not field_def:
        return None
    field = field_def.get("field")
    if not field or field not in columns:
        # Skip channels that reference columns the dataset doesn't actually have.
        return None
    ftype = _resolve_type(field, field_def.get("type"), col_types)
    kwargs: dict[str, Any] = {"field": field, "type": ftype}
    agg = (str(field_def.get("aggregate")).lower() if field_def.get("aggregate") else None)
    if agg == "count":
        # COUNT works on any column (counts records) and is always quantitative —
        # used by the status pie to size slices by number of tenders per status.
        kwargs["aggregate"] = "count"
        kwargs["type"] = "quantitative"
    elif agg and agg not in ("none", "null", "") and ftype == "quantitative":
        # Other aggregates (sum/mean/…) only make sense on quantitative measures.
        kwargs["aggregate"] = agg
    if field_def.get("title"):
        kwargs["title"] = field_def["title"]
    if field_def.get("sort"):
        kwargs["sort"] = field_def["sort"]
    return kwargs


# Monetary / value columns that are reported in MILLIONS (e.g. TCV). Their axes
# are labelled "(Millions)" and shown as plain grouped numbers, not SI-abbreviated.
_MONEY_HINTS = ("tcv", "contract value", "value", "amount", "revenue",
                "sales", "profit", "cost", "price", "budget", "order", "billing")


def _is_money_field(field: str | None) -> bool:
    if not field:
        return False
    name = str(field).lower()
    return any(h in name for h in _MONEY_HINTS)


def _axis_for(field_kwargs: dict[str, Any]) -> alt.Axis:
    """Axis for a quantitative channel. Money columns (in millions) get a
    '(Millions)' title and plain comma numbers; others get compact SI labels."""
    field = field_kwargs.get("field", "")
    if _is_money_field(field):
        return alt.Axis(format=",.1f", title=f"{field} (Millions)")
    return alt.Axis(format="~s")


def _tooltip_for(col: str, col_types: dict[str, str]) -> alt.Tooltip:
    """Typed, formatted tooltip entry for a column."""
    t = col_types.get(col, "nominal")
    if t == "quantitative":
        return alt.Tooltip(col, type="quantitative", format=",.2f")
    if t == "temporal":
        return alt.Tooltip(col, type="temporal")
    return alt.Tooltip(col, type=t if t in ("nominal", "ordinal") else "nominal")


# Only these four chart families are supported.
ALLOWED_MARKS = ("bar", "line", "point", "arc")


def _pick_mark(chart_def: dict[str, Any], col_types: dict[str, str]) -> str:
    """Choose the best-fit mark from the 4 allowed types, fixing wrong choices.

    bar/column, line, point (scatter), arc (pie/donut). Heuristics: two measures
    -> point; temporal/ordinal x with a measure -> line; categorical x with a
    measure -> bar. Anything else (area, boxplot, …) is coerced to the nearest fit.
    """
    requested = _MARK_MAP.get(str(chart_def.get("mark", "")).lower())
    x = chart_def.get("x") or {}
    y = chart_def.get("y") or {}
    xt = col_types.get(x.get("field"), _coerce_type(x.get("type")))
    yt = col_types.get(y.get("field"), _coerce_type(y.get("type")))

    # Honour an explicit pie/donut request.
    if requested == "arc":
        return "arc"

    if xt == "quantitative" and yt == "quantitative":
        best = "point"
    elif xt in ("temporal", "ordinal"):
        best = "line"
    elif xt == "nominal" and yt == "quantitative":
        best = "bar"
    elif requested in ("bar", "line", "point"):
        best = requested
    else:
        best = "bar"

    return best if best in ALLOWED_MARKS else "bar"


def _build_unit(
    chart_def: dict[str, Any],
    source: alt.Chart,
    selection: alt.Parameter,
    cf_field: str,
    columns: list[str],
    col_types: dict[str, str],
    default_color: dict[str, str] | None,
    category_orders: dict[str, list],
    mode: str,
    force_target: bool = False,
) -> alt.Chart | None:
    mark = _pick_mark(chart_def, col_types)

    enc: dict[str, Any] = {}
    x = _field_kwargs(chart_def.get("x"), columns, col_types)
    y = _field_kwargs(chart_def.get("y"), columns, col_types)
    color = _field_kwargs(chart_def.get("color"), columns, col_types)

    # Apply natural ordering (months/weekdays/quarters) to any sequential field.
    def _apply_order(kw):
        if kw and kw.get("field") in category_orders and not kw.get("sort"):
            kw["sort"] = category_orders[kw["field"]]
    _apply_order(x)
    _apply_order(color)

    # Ensure EVERY chart carries a color encoding -> a real, applied legend.
    # If the plan didn't specify one, fall back to a sensible low-cardinality
    # category (usually the cross-filter dimension) so colors map to the data.
    if not color and default_color and default_color.get("field"):
        df_field = default_color["field"]
        # Don't colour a chart by the very field already on its x axis if that
        # would just recolour each bar identically — but for categorical x it
        # actually gives a useful per-category legend, so allow it.
        color = {"field": df_field, "type": col_types.get(df_field, "nominal")}

    # Track the fields actually encoded, so the tooltip can mirror them safely.
    encoded_kwargs: list[dict[str, Any]] = []

    # Arc/pie charts use theta (slice size) + color (slice category).
    if mark == "arc":
        # Pick the slice CATEGORY with clear priority: explicit colour, else the
        # x field, else the default categorical. Pie slices must be DISCRETE — a
        # quantitative category renders as a single-hue gradient (looks like one
        # colour), so force nominal and never aggregate the category.
        cat = (
            _field_kwargs(chart_def.get("color"), columns, col_types)
            or _field_kwargs(chart_def.get("x"), columns, col_types)
            or (dict(color) if color else None)
        )
        _apply_order(cat)
        if y:
            enc["theta"] = alt.Theta(**y, stack=True)
            encoded_kwargs.append(y)
        if cat:
            cat.pop("aggregate", None)
            if cat.get("type") not in ("nominal", "ordinal"):
                cat["type"] = "nominal"
            enc["color"] = alt.Color(**cat, scale=alt.Scale(range=PALETTE))
            encoded_kwargs.append(cat)
    else:
        if x:
            if x.get("type") == "quantitative":
                x["axis"] = _axis_for(x)
            enc["x"] = alt.X(**x)
            encoded_kwargs.append(x)
        if y:
            if y.get("type") == "quantitative":
                y["axis"] = _axis_for(y)
            enc["y"] = alt.Y(**y)
            encoded_kwargs.append(y)
        if color:
            enc["color"] = alt.Color(**color, scale=alt.Scale(range=PALETTE))
            encoded_kwargs.append(color)
        elif mark in ("bar", "area"):
            enc["color"] = alt.value(TEAL)

    if not enc:
        return None

    # Tooltip MUST NOT corrupt aggregation: including raw, un-grouped columns in
    # an aggregated chart forces them into the group-by and breaks totals (e.g.
    # Total TCV). So when the chart aggregates, the tooltip mirrors ONLY the
    # encoded (grouped/aggregated) channels. Non-aggregated charts (e.g. scatter)
    # safely get a rich all-columns tooltip.
    has_agg = any(kw.get("aggregate") for kw in encoded_kwargs)
    if has_agg:
        tips, seen = [], set()
        for kw in encoded_kwargs:
            f = kw.get("field")
            if not f or f in seen:
                continue
            seen.add(f)
            tkw: dict[str, Any] = {"field": f, "type": kw.get("type", "nominal")}
            if kw.get("aggregate"):
                tkw["aggregate"] = kw["aggregate"]
            if tkw["type"] == "quantitative":
                tkw["format"] = ",.2f"
            tips.append(alt.Tooltip(**tkw))
        enc["tooltip"] = tips
    else:
        enc["tooltip"] = [_tooltip_for(c, col_types) for c in columns[:12]]

    # Is the cross-filter dimension this chart's main categorical axis? If so it's
    # a natural SELECTOR — keep it unfiltered so all its categories stay clickable.
    x_field = (chart_def.get("x") or {}).get("field")
    arc_cat = (chart_def.get("color") or chart_def.get("x") or {}).get("field")
    is_dimension = ((x_field == cf_field) or (mark == "arc" and arc_cat == cf_field)) and not force_target

    # Full pie (no inner radius) for status share; standard marks otherwise.
    chart = source.mark_arc() if mark == "arc" else getattr(source, f"mark_{mark}")(
        cornerRadius=3 if mark == "bar" else 0,
        point=(mark == "line"),
    )
    chart = chart.encode(**enc)

    # Every chart can be clicked to drive the shared selection.
    chart = chart.add_params(selection)

    if mode == "filter":
        # Filter every chart EXCEPT the dimension charts, which stay full so the
        # user can keep picking categories from them.
        if not is_dimension:
            chart = chart.transform_filter(selection)
    else:  # highlight
        # Opacity reacts to the shared selection on every chart.
        enc["opacity"] = alt.condition(selection, alt.value(1.0), alt.value(DIMMED_OPACITY))
        chart = chart.encode(**enc)

    title = chart_def.get("title") or ""
    # Numeric default size; the frontend overrides width/height responsively per
    # viewport. ("container" sizing is NOT supported inside a concat spec, so it
    # must be a number or the views collapse and overlap.)
    return chart.properties(width=360, height=280, title=title)


def build_specs(data: list[dict[str, Any]], plan: dict[str, Any]) -> dict[str, Any]:
    """Return {'filter_spec', 'highlight_spec', 'crossfilter_field', 'columns'}."""
    if not data:
        raise ValueError("No data rows provided.")

    df = pd.DataFrame(data)
    truncated = 0
    if len(df) > MAX_ROWS:
        truncated = len(df) - MAX_ROWS
        print(f"⚠️  Dataset has {len(df)} rows; truncating to {MAX_ROWS}. "
              f"Aggregates (e.g. Total TCV) will exclude {truncated} rows.")
        df = df.head(MAX_ROWS)
    # The analyzer cleans + type-infers the data before any chart is built.
    df = preprocess(df)
    columns = list(df.columns)
    col_types = detect_types(df)

    # Natural ordering for sequential categories (months/weekdays/quarters) so
    # they render in calendar order instead of alphabetically.
    category_orders: dict[str, list] = {}
    for c in columns:
        if col_types.get(c) in ("nominal", "ordinal"):
            order = _ordered_categories(df[c].dropna().unique().tolist())
            if order:
                category_orders[c] = order

    chart_defs = plan.get("dynamic_charts") or []
    if not chart_defs:
        raise ValueError("Plan contains no charts.")

    # Resolve the cross-filter field. Prefer the plan's choice; fall back to the
    # first chart marked as the filter source, then the first categorical column.
    cf_field = plan.get("crossfilter_field")
    if not cf_field or cf_field not in columns:
        cf_field = None
        for c in chart_defs:
            if c.get("is_filter_source"):
                for ch in (c.get("x"), c.get("color")):
                    if ch and ch.get("field") in columns:
                        cf_field = ch["field"]
                        break
            if cf_field:
                break
    if not cf_field:
        categorical = [c for c in columns if col_types.get(c) in ("nominal", "ordinal")]
        cf_field = categorical[0] if categorical else columns[0]

    # Cardinality of each categorical column — used to pick a legend-friendly
    # default colour (avoid colouring everything by a 190-value field).
    LEGEND_MAX_CARD = 15
    cardinality = {c: int(df[c].nunique(dropna=True)) for c in columns}

    def _is_low_card_categorical(field: str | None) -> bool:
        return (
            bool(field)
            and field in columns
            and col_types.get(field) in ("nominal", "ordinal")
            and cardinality.get(field, 999) <= LEGEND_MAX_CARD
        )

    # Default colour field so every chart can show an applied legend. Prefer the
    # cross-filter dimension (ties legend colours to what you click) when it's
    # low-cardinality, else the first small categorical column.
    default_color_field = None
    if _is_low_card_categorical(cf_field):
        default_color_field = cf_field
    else:
        for c in columns:
            if _is_low_card_categorical(c):
                default_color_field = c
                break
    default_color = {"field": default_color_field} if default_color_field else None

    # If EVERY chart is a dimension chart (x == cross-filter field), nothing would
    # filter — force the non-source ones to behave as targets by clearing the flag.
    dim_charts = [c for c in chart_defs if (c.get("x") or {}).get("field") == cf_field]
    all_dimension = len(dim_charts) == len(chart_defs)

    row_count = len(df)

    def compile_mode(mode: str) -> dict[str, Any]:
        # Passing the DataFrame lets Altair infer channel types (incl. tooltips)
        # and run its NaN->null sanitizer when embedding the data inline.
        source = alt.Chart(df)
        selection = alt.selection_point(
            fields=[cf_field],
            name="crossfilter",
            toggle=True,
            on="click",
            clear="dblclick",
            empty=True,  # nothing selected => everything shown
        )
        units = []
        for idx, cd in enumerate(chart_defs):
            # When every chart shares the cross-filter field on x, keep the first
            # as the selector and force the rest to filter so clicking does something.
            force_target = all_dimension and idx > 0
            unit = _build_unit(
                cd, source, selection, cf_field, columns, col_types,
                default_color, category_orders, mode, force_target=force_target,
            )
            if unit is not None:
                units.append(unit)
        if not units:
            raise ValueError("No valid charts could be built from the plan.")

        compound = (
            alt.concat(*units, columns=2)
            .resolve_scale(color="independent")
            .properties(
                title=alt.TitleParams(
                    text=plan.get("dashboard_title", "Linked Analysis Dashboard"),
                    subtitle=f"Click a {cf_field} to {mode} • double-click to reset",
                    anchor="start",
                )
            )
            # Frame each chart cell so the 2-column grid reads like a table.
            .configure_view(stroke="#e3e8ef", strokeWidth=1, fill="#ffffff")
            .configure_axis(grid=True, gridColor="rgba(0,0,0,0.05)", labelColor="#444", titleColor=NAVY)
            .configure_title(color=NAVY, fontSize=15, font="Montserrat, sans-serif")
            # Legends at the bottom add height, not width — so charts fit the
            # column without a right-side legend pushing them past the edge.
            .configure_legend(orient="bottom", direction="horizontal", labelColor="#444", titleColor=NAVY)
        )
        # .to_dict() validates against the Vega-Lite schema.
        return compound.to_dict()

    return {
        "filter_spec": compile_mode("filter"),
        "highlight_spec": compile_mode("highlight"),
        "crossfilter_field": cf_field,
        "columns": columns,
        "column_types": col_types,
        "row_count": row_count,
    }
