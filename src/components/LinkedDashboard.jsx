import React, { useEffect, useMemo, useRef, useState } from 'react';
import embed from 'vega-embed';
import { Filter, Highlighter, MousePointerClick, Download } from 'lucide-react';

const colsFor = (width) => (width < 700 ? 1 : 2);

// Vega-Lite doesn't support width:"container" inside a concat/grid spec, so we
// measure the available width and write explicit pixel sizes into each child
// view. `width` here is only the PLOT rectangle — the y-axis renders to its left,
// so we reserve space for it; `correction` is an extra reduction applied after
// measuring the actual rendered size, guaranteeing nothing exceeds the section.
const buildSizedSpec = (spec, width, correction = 0) => {
  if (!spec || !width) return null;
  const sized = structuredClone(spec);
  const views = Array.isArray(sized.concat) ? sized.concat : null;
  if (!views) return sized;

  const cols = colsFor(width);
  const spacing = 28;
  const cellW = Math.floor((width - spacing * (cols - 1)) / cols);
  // Start optimistic (axis labels are SI-short like "300k") to make charts as
  // LARGE as possible; the adaptive loop adds `correction` only if a wide axis
  // actually overflows. This maximises chart size while guaranteeing fit.
  const AXIS_RESERVE = 56;
  const chartW = Math.max(220, cellW - AXIS_RESERVE - correction);
  const chartH = Math.min(440, Math.max(320, Math.round(chartW * 0.66)));

  sized.columns = cols;
  sized.spacing = spacing;
  for (const v of views) {
    v.width = chartW;
    v.height = chartH;
    // Titles don't wrap in Vega-Lite — a long one makes the whole cell wider than
    // the plot and breaks the grid. Cap the title to the chart width (truncates
    // with an ellipsis); the full title still shows on the insight card below.
    const titleText = typeof v.title === 'string' ? v.title : (v.title && v.title.text) || '';
    if (titleText) {
      v.title = {
        text: titleText,
        limit: chartW,
        fontSize: 13,
        anchor: 'middle',
        color: '#003a70',
        font: 'Montserrat, sans-serif',
      };
    }
  }
  return sized;
};

/**
 * Renders the Altair-compiled, cross-filtered Vega-Lite dashboard.
 *
 * Cross-filtering only works when every linked view shares one selection param
 * inside a single compound spec, so this embeds ONE spec (not a grid of separate
 * charts). The backend returns two pre-compiled specs — `filter_spec` and
 * `highlight_spec` — and the toggle simply swaps which one is embedded, so
 * switching modes is instant with no re-fetch.
 */
const LinkedDashboard = ({ vega }) => {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const [mode, setMode] = useState('filter'); // 'filter' | 'highlight'
  const [width, setWidth] = useState(0);
  const [correction, setCorrection] = useState(0);

  const spec = mode === 'filter' ? vega?.filter_spec : vega?.highlight_spec;
  const sizedSpec = useMemo(() => buildSizedSpec(spec, width, correction), [spec, width, correction]);

  // Measure the container and re-size charts responsively (debounced).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      clearTimeout(timer);
      // Round to 24px steps so small drags don't trigger constant re-embeds.
      timer = setTimeout(() => {
        const stepped = Math.round(w / 24) * 24;
        setWidth((prev) => {
          if (prev !== stepped) setCorrection(0); // re-measure fit at the new width
          return stepped;
        });
      }, 120);
    });
    ro.observe(el);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current || !sizedSpec) return;

    embed(containerRef.current, sizedSpec, {
      actions: { export: true, source: false, compiled: false, editor: false },
      renderer: 'canvas',
      config: { background: 'transparent' },
    })
      .then((result) => {
        if (cancelled) {
          result.finalize();
          return;
        }
        viewRef.current = result.view;

        // Adaptive fit: measure the ACTUAL rendered width and, if it still spills
        // past the container, shrink the charts and re-render until it fits.
        const el = containerRef.current;
        const node = el && el.querySelector('canvas, svg');
        if (el && node) {
          const overflow = node.getBoundingClientRect().width - el.clientWidth;
          if (overflow > 2 && correction < 800) {
            const cols = colsFor(width);
            setCorrection((c) => c + Math.ceil(overflow / cols) + 6);
          }
        }
      })
      .catch((err) => console.error('Vega embed failed:', err));

    return () => {
      cancelled = true;
      if (viewRef.current) {
        viewRef.current.finalize();
        viewRef.current = null;
      }
    };
  }, [sizedSpec]);

  // Export the rendered dashboard via the Vega view (PNG raster / SVG vector).
  const downloadImage = async (ext) => {
    if (!viewRef.current) return;
    try {
      const url = await viewRef.current.toImageURL(ext, ext === 'png' ? 2 : 1);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(`Download (${ext}) failed:`, err);
    }
  };

  if (!vega || (!vega.filter_spec && !vega.highlight_spec)) return null;

  const ToggleButton = ({ value, icon: Icon, label }) => {
    const active = mode === value;
    return (
      <button
        onClick={() => setMode(value)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 700,
          fontFamily: 'inherit',
          color: active ? 'white' : 'var(--color-navy)',
          background: active ? 'var(--color-navy)' : 'transparent',
          borderRadius: '100px',
          transition: 'all 0.2s ease',
        }}
      >
        <Icon size={16} />
        {label}
      </button>
    );
  };

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 58, 112, 0.1)',
        borderRadius: '28px',
        padding: '28px 32px 32px',
        boxShadow: '0 25px 50px rgba(0, 58, 112, 0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#555', fontSize: '0.95rem' }}>
          <MousePointerClick size={18} color="var(--color-teal)" />
          <span>
            Click a <strong style={{ color: 'var(--color-navy)' }}>{vega.crossfilter_field}</strong> to{' '}
            {mode === 'filter' ? 'filter' : 'highlight'} every chart · double-click to reset
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              gap: '4px',
              padding: '4px',
              background: 'rgba(0, 58, 112, 0.06)',
              borderRadius: '100px',
            }}
          >
            <ToggleButton value="filter" icon={Filter} label="Filter" />
            <ToggleButton value="highlight" icon={Highlighter} label="Highlight" />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['png', 'svg'].map((ext) => (
              <button
                key={ext}
                onClick={() => downloadImage(ext)}
                title={`Download dashboard as ${ext.toUpperCase()}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', border: '1px solid rgba(0, 58, 112, 0.15)',
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit',
                  color: 'var(--color-navy)', background: 'white', borderRadius: '100px',
                }}
              >
                <Download size={15} /> {ext.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={containerRef} style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }} />
    </div>
  );
};

export default LinkedDashboard;
