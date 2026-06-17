import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Target, AlertTriangle } from 'lucide-react';
import LinkedDashboard from './LinkedDashboard';
import CustomChartForm from './CustomChartForm';

const Dashboard = ({ dataUpdated, aiData, onAiDataUpdate }) => {
  if (!aiData || !aiData.dynamic_charts || !Array.isArray(aiData.dynamic_charts) || aiData.dynamic_charts.length === 0) {
    return (
      <div id="analyser" style={{ 
        width: '100%', 
        padding: '80px 40px', 
        textAlign: 'center', 
        background: 'rgba(0, 58, 112, 0.03)', 
        borderRadius: '32px',
        border: '2px dashed rgba(0, 58, 112, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ padding: '20px', borderRadius: '50%', background: 'rgba(0, 58, 112, 0.05)', color: 'var(--color-navy)', opacity: 0.5 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
          </svg>
        </div>
        <h3 style={{ color: 'var(--color-navy)', margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
          Awaiting Situational Data
        </h3>
        <p style={{ color: '#666', maxWidth: '400px', margin: 0, lineHeight: 1.6 }}>
          The dashboard is currently empty. Upload any CSV/Excel file to generate a 100% dynamic, AI-driven dashboard from scratch.
        </p>
      </div>
    );
  }

  return (
    <div id="analyser" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
          Dynamic Analysis Hub 🧪
        </h2>
        <div style={{ 
          background: 'var(--color-teal)', 
          color: 'white', 
          padding: '4px 12px', 
          borderRadius: '100px', 
          fontSize: '0.8rem', 
          fontWeight: 700,
          letterSpacing: '0.5px'
        }}>
          AI DATA SCIENTIST MODE
        </div>
      </div>
      
      <p style={{ color: '#666', fontSize: '1.1rem', maxWidth: '800px', margin: 0 }}>
        LTTS Analyser has analyzed your document's statistical patterns and generated these dynamic charts and hypotheses.
      </p>

      {/* Interactive, cross-filtered linked dashboard (Altair-compiled Vega-Lite) */}
      {aiData.vega ? (
        <LinkedDashboard vega={aiData.vega} />
      ) : aiData.vega_error ? (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '20px 24px',
          background: 'rgba(227, 27, 35, 0.05)',
          border: '1px solid rgba(227, 27, 35, 0.2)',
          borderRadius: '20px',
          color: '#b3151c'
        }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '4px' }}>Interactive charts unavailable</strong>
            <span style={{ fontSize: '0.9rem' }}>{aiData.vega_error}</span>
          </div>
        </div>
      ) : null}

      {/* Structured "build your own chart" section */}
      {aiData.vega && aiData.session_id && (
        <CustomChartForm
          sessionId={aiData.session_id}
          columns={aiData.columns || aiData.vega.columns}
          columnTypes={aiData.column_types || aiData.vega.column_types}
          onAdded={(vega, dynamic_charts) => onAiDataUpdate && onAiDataUpdate({ vega, dynamic_charts })}
        />
      )}

      {/* Per-chart insight & evidence cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '24px',
        marginTop: '8px'
      }}>
        <AnimatePresence>
          {aiData.dynamic_charts.map((chart, index) => (
            <motion.div
              key={chart.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(0, 58, 112, 0.1)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 20px 40px rgba(0, 58, 112, 0.06)',
                position: 'relative'
              }}
            >
              <div style={{ position: 'absolute', top: '20px', right: '20px', color: '#e31b23', opacity: 0.8 }}>
                <Sparkles size={18} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '28px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
                  {chart.title}
                </h3>
                {chart.is_filter_source && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(0, 197, 205, 0.12)',
                    color: 'var(--color-teal)',
                    padding: '2px 8px',
                    borderRadius: '100px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap'
                  }}>
                    <Target size={11} /> CONTROLS DASHBOARD
                  </span>
                )}
              </div>

              <div style={{
                fontSize: '0.95rem',
                lineHeight: 1.6,
                color: '#444',
                padding: '16px',
                background: 'rgba(0, 58, 112, 0.03)',
                borderRadius: '16px',
                borderLeft: '4px solid var(--color-teal)'
              }}>
                <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--color-navy)' }}>Insight & Evidence:</strong>
                {chart.description}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Strategic Hypotheses Section */}
      {(aiData.overall_summary || aiData.strategic_hypotheses) && (
        <div id="hypothesis-generator" style={{ marginTop: '48px', paddingTop: '48px', borderTop: '1px solid rgba(0, 58, 112, 0.1)' }}>
          <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-navy)', marginBottom: '16px' }}>
            Strategic Hypotheses & Summary
          </h3>
          
          {aiData.overall_summary && (
            <p style={{ fontSize: '1.1rem', lineHeight: 1.6, color: '#444', marginBottom: '32px', maxWidth: '900px' }}>
              {aiData.overall_summary}
            </p>
          )}

          {aiData.overall_health !== undefined && (
            <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: '#666' }}>Overall Health Score:</span>
              <div style={{ 
                background: aiData.overall_health > 70 ? 'rgba(0, 197, 205, 0.1)' : (aiData.overall_health > 40 ? 'rgba(255, 165, 0, 0.1)' : 'rgba(227, 27, 35, 0.1)'),
                color: aiData.overall_health > 70 ? 'var(--color-teal)' : (aiData.overall_health > 40 ? 'orange' : '#e31b23'),
                padding: '8px 16px',
                borderRadius: '100px',
                fontWeight: 800,
                fontSize: '1.2rem'
              }}>
                {aiData.overall_health}/100
              </div>
            </div>
          )}

          {aiData.strategic_hypotheses && Array.isArray(aiData.strategic_hypotheses) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              {aiData.strategic_hypotheses.map((hypothesis, index) => (
                <motion.div
                  key={hypothesis.id || index}
                  whileHover={{ y: -5 }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.8)',
                    border: '1px solid rgba(0, 58, 112, 0.05)',
                    borderRadius: '20px',
                    padding: '24px',
                    boxShadow: '0 10px 30px rgba(0, 58, 112, 0.05)'
                  }}
                >
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-navy)', margin: '0 0 12px 0' }}>
                    {hypothesis.title}
                  </h4>
                  <p style={{ fontSize: '0.95rem', color: '#555', marginBottom: '16px', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--color-navy)' }}>Evidence:</strong> {hypothesis.evidence}
                  </p>
                  <div style={{ 
                    background: 'rgba(0, 197, 205, 0.1)', 
                    color: 'var(--color-teal)', 
                    padding: '12px 16px', 
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    borderLeft: '4px solid var(--color-teal)'
                  }}>
                    Action: {hypothesis.action_item}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
