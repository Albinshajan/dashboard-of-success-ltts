import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Sparkles, AlertTriangle } from 'lucide-react';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(0, 58, 112, 0.18)',
  background: 'white',
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  color: 'var(--color-navy)',
};

/**
 * Shown when the analyzer is unsure about the data and asks the user to clarify
 * before building the dashboard. Collects answers and posts them to
 * /api/generate, then hands the finished dashboard back to the parent.
 */
const ClarifyPanel = ({ clarify, onResolved, onError }) => {
  const { clarifications = [], session_id } = clarify || {};
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setAnswer = (id, val) => setAnswers((prev) => ({ ...prev, [id]: val }));

  const submit = async () => {
    setError('');
    const unanswered = clarifications.filter((q) => !answers[q.id] || !String(answers[q.id]).trim());
    if (unanswered.length) {
      setError('Please answer all questions so the analysis is accurate.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate the dashboard');
      onResolved(data);
    } catch (e) {
      setError(e.message);
      if (onError) onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!clarify || !clarifications.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      id="analyser"
      style={{
        background: 'rgba(255, 255, 255, 0.97)',
        border: '1px solid rgba(0, 58, 112, 0.12)',
        borderRadius: '28px',
        padding: '36px 40px',
        boxShadow: '0 25px 50px rgba(0, 58, 112, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '760px',
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ padding: '10px', borderRadius: '14px', background: 'rgba(0, 197, 205, 0.12)', color: 'var(--color-teal)' }}>
          <HelpCircle size={24} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
            A few quick questions
          </h3>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.95rem' }}>
            The analyzer wasn’t fully sure about your data. Confirm these so the numbers
            (like Total TCV) and charts are exactly right.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {clarifications.map((q, i) => (
          <div key={q.id || i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontWeight: 700, color: 'var(--color-navy)', fontSize: '1rem' }}>
              {i + 1}. {q.question}
            </label>
            {q.why && (
              <span style={{ fontSize: '0.82rem', color: '#888', marginTop: '-4px' }}>{q.why}</span>
            )}
            {q.type === 'select' && q.options && q.options.length ? (
              <select
                value={answers[q.id] || ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                style={inputStyle}
              >
                <option value="" disabled>Select…</option>
                {q.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <input
                value={answers[q.id] || ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Your answer"
                style={inputStyle}
              />
            )}
          </div>
        ))}
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
          padding: '13px 26px', border: 'none', borderRadius: '100px',
          cursor: busy ? 'wait' : 'pointer', fontWeight: 700, fontSize: '1rem', fontFamily: 'inherit',
          color: 'white', background: busy ? '#9aa7b5' : 'var(--color-navy)',
          transition: 'all 0.2s ease',
        }}
      >
        <Sparkles size={18} /> {busy ? 'Generating dashboard…' : 'Generate dashboard'}
      </button>
    </motion.div>
  );
};

export default ClarifyPanel;
