import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, Wand2, AlertTriangle } from 'lucide-react';

const MARKS = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'point', label: 'Scatter' },
  { value: 'arc', label: 'Pie (status share)' },
];

const AGGREGATES = ['none', 'sum', 'mean', 'count', 'median', 'min', 'max'];

const selectStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(0, 58, 112, 0.18)',
  background: 'white',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  color: 'var(--color-navy)',
};

const labelStyle = { fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '6px', display: 'block' };

const Field = ({ label, children }) => (
  <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

/**
 * Structured "build your own chart" form. Field options come from the uploaded
 * columns + detected types, so the request is always valid. On submit it calls
 * /api/custom-chart, which appends the chart to the linked dashboard and returns
 * recompiled specs (the new chart cross-filters with the rest).
 */
const CustomChartForm = ({ sessionId, columns = [], columnTypes = {}, onAdded }) => {
  const numericCols = useMemo(
    () => columns.filter((c) => columnTypes[c] === 'quantitative'),
    [columns, columnTypes]
  );

  const [mark, setMark] = useState('bar');
  const [xField, setXField] = useState(columns[0] || '');
  const [yField, setYField] = useState(numericCols[0] || columns[0] || '');
  const [aggregate, setAggregate] = useState('sum');
  const [colorField, setColorField] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!xField || !yField) {
      setError('Please choose both an X and a Y field.');
      return;
    }
    setBusy(true);
    try {
      const chart = {
        title: title.trim() || undefined,
        mark,
        x: { field: xField },
        y: { field: yField, aggregate: aggregate === 'none' ? null : aggregate },
        color: colorField ? { field: colorField } : null,
      };
      const res = await fetch('http://localhost:3000/api/custom-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, chart }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not build chart');
      onAdded(data.vega, data.dynamic_charts);
      setTitle('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!sessionId || columns.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(0, 58, 112, 0.1)',
        borderRadius: '24px',
        padding: '28px 32px',
        boxShadow: '0 20px 40px rgba(0, 58, 112, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Wand2 size={20} color="var(--color-teal)" />
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
          Build your own chart
        </h3>
      </div>
      <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
        Add a custom chart to the dashboard above. It joins the linked view, so it cross-filters with the rest.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
        <Field label="Chart type">
          <select value={mark} onChange={(e) => setMark(e.target.value)} style={selectStyle}>
            {MARKS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>

        <Field label={mark === 'arc' ? 'Category (slices)' : 'X axis'}>
          <select value={xField} onChange={(e) => setXField(e.target.value)} style={selectStyle}>
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label={mark === 'arc' ? 'Value (size)' : 'Y axis'}>
          <select value={yField} onChange={(e) => setYField(e.target.value)} style={selectStyle}>
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Aggregate Y">
          <select value={aggregate} onChange={(e) => setAggregate(e.target.value)} style={selectStyle}>
            {AGGREGATES.map((a) => <option key={a} value={a}>{a === 'none' ? 'No aggregation' : a}</option>)}
          </select>
        </Field>

        <Field label="Color / group (optional)">
          <select value={colorField} onChange={(e) => setColorField(e.target.value)} style={selectStyle}>
            <option value="">None</option>
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Title (optional)">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Auto-generated if blank"
            style={selectStyle}
          />
        </Field>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b3151c', fontSize: '0.9rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={busy}
        style={{
          alignSelf: 'flex-start',
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 24px', border: 'none', borderRadius: '100px',
          cursor: busy ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'inherit',
          color: 'white', background: busy ? '#9aa7b5' : 'var(--color-navy)',
          transition: 'all 0.2s ease',
        }}
      >
        <PlusCircle size={18} /> {busy ? 'Building…' : 'Add chart to dashboard'}
      </button>
    </motion.div>
  );
};

export default CustomChartForm;
