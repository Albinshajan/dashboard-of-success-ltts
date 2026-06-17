import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle, FileText, BarChart3 } from 'lucide-react';

const CHART_COUNTS = [4, 5, 6];

const UploadHub = ({ onUploadComplete, analysisPending = false }) => {
  const [status, setStatus] = useState('idle'); // idle, uploading, complete
  const [fileName, setFileName] = useState('');
  const [chartCount, setChartCount] = useState(5);

  const handleFileUpload = async (files) => {
    if (files.length === 0) return;
    setFileName(files[0].name);
    setStatus('uploading');

    const formData = new FormData();
    formData.append('document', files[0]);
    formData.append('chart_count', String(chartCount));

    try {
      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      onUploadComplete(data);
      // If the analyzer needs clarification, return to idle so the questions
      // panel takes over; otherwise show the completed state. Filename persists.
      setStatus(data && data.needs_clarification ? 'idle' : 'complete');
    } catch (error) {
      console.error("Upload failed", error);
      alert(`Backend Connection Error: ${error.message}. Ensure the server is running at http://localhost:3000`);
      setStatus('idle');
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    handleFileUpload(acceptedFiles);
  }, [onUploadComplete, chartCount]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: status === 'uploading',
  });

  return (
    <div id="upload-section" style={{ padding: '0 20px', width: '100%' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '20px', color: 'var(--color-navy)', textAlign: 'center' }}>
        Universal AI Analysis
      </h2>

      {/* Chart-count selector (4-6) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '16px', marginBottom: '20px', flexWrap: 'wrap'
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-navy)', fontWeight: 600 }}>
          <BarChart3 size={18} color="var(--color-teal)" /> Charts to generate
        </span>
        <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(0, 58, 112, 0.06)', borderRadius: '100px' }}>
          {CHART_COUNTS.map((n) => {
            const active = chartCount === n;
            return (
              <button
                key={n}
                type="button"
                disabled={status === 'uploading'}
                onClick={() => setChartCount(n)}
                style={{
                  width: '44px', height: '36px', border: 'none', borderRadius: '100px',
                  cursor: status === 'uploading' ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '0.95rem', fontFamily: 'inherit',
                  color: active ? 'white' : 'var(--color-navy)',
                  background: active ? 'var(--color-navy)' : 'transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* Persistent uploaded-file indicator — stays until operations are done */}
      {fileName && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          margin: '0 auto 16px', padding: '10px 18px', maxWidth: 'fit-content',
          background: status === 'complete' ? 'rgba(0, 197, 205, 0.1)' : 'rgba(0, 58, 112, 0.06)',
          border: `1px solid ${status === 'complete' ? 'rgba(0, 197, 205, 0.4)' : 'rgba(0, 58, 112, 0.15)'}`,
          borderRadius: '100px', fontSize: '0.9rem', color: 'var(--color-navy)', fontWeight: 600,
        }}>
          <FileText size={16} color="var(--color-teal)" />
          <span>{fileName}</span>
          <span style={{ color: '#888', fontWeight: 500 }}>
            {status === 'uploading'
              ? '· Analyzing…'
              : analysisPending
              ? '· Needs your input ↓'
              : status === 'complete'
              ? '· Ready ✓'
              : ''}
          </span>
        </div>
      )}

      <motion.div
        {...getRootProps()}
        whileHover={status === 'idle' ? { scale: 1.01 } : {}}
        animate={{
          borderColor: status === 'uploading' ? '#e31b23' : (isDragActive ? 'var(--color-teal)' : 'rgba(255, 255, 255, 0.4)'),
          boxShadow: status === 'uploading' 
            ? '0 0 20px rgba(227, 27, 35, 0.4)' 
            : '0 20px 40px rgba(0, 58, 112, 0.08)'
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          background: 'rgba(245, 245, 247, 0.6)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          borderRadius: '24px',
          cursor: status === 'idle' ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 40px',
          textAlign: 'center',
          gap: '20px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {status === 'uploading' && (
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              border: '4px solid #e31b23',
              borderRadius: '24px',
              pointerEvents: 'none'
            }}
          />
        )}

        <input {...getInputProps()} />
        
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
            >
              <div style={{ color: isDragActive ? 'var(--color-teal)' : '#e31b23' }}>
                <UploadCloud size={56} strokeWidth={1.5} />
              </div>
              <div>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', color: 'var(--color-navy)' }}>
                  {isDragActive ? 'Drop Anything to Analyze' : 'Drop Any Data Here'}
                </p>
                <p style={{ color: '#666666', fontSize: '1.1rem' }}>
                  Raw Text, Unordered Notes, Reports, or Images
                </p>
              </div>
            </motion.div>
          )}

          {status === 'uploading' && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  border: '3px solid rgba(227, 27, 35, 0.1)',
                  borderTopColor: '#e31b23'
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-navy)', margin: 0 }}>
                  LTTS Analyser is analyzing document structure...
                </p>
                <p style={{ fontSize: '1rem', color: '#666', margin: 0, fontStyle: 'italic' }}>
                  {fileName}
                </p>
              </div>
            </motion.div>
          )}

          {status === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
            >
              <CheckCircle size={56} color="var(--color-teal)" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                  Analysis Complete
                </p>
                <p style={{ fontSize: '1.1rem', color: 'var(--color-teal)', fontWeight: 500, margin: 0 }}>
                  {fileName}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default UploadHub;
