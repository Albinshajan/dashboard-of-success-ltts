import React, { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import UploadHub from './components/UploadHub';
import ClarifyPanel from './components/ClarifyPanel';
import Chatbot from './components/Chatbot';
import Footer from './components/Footer';

function App() {
  const [dataUpdated, setDataUpdated] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [clarify, setClarify] = useState(null); // pending clarifying questions

  const handleUploadComplete = (data) => {
    if (data && data.needs_clarification) {
      // Analyzer is unsure — ask the user before building the dashboard.
      setClarify(data);
      setAiData(null);
      return;
    }
    setClarify(null);
    setAiData(data);
    setDataUpdated(true);
  };

  // The user answered the clarifying questions and we got the finished dashboard.
  const handleClarifyResolved = (data) => {
    setClarify(null);
    setAiData(data);
    setDataUpdated(true);
  };

  // Merge updates (e.g. a newly added custom chart) into the current dashboard.
  const handleAiDataUpdate = (partial) => {
    setAiData((prev) => ({ ...prev, ...partial }));
  };

  return (
    <>
      <Header />
      <Hero />
      <div style={{ padding: '48px 24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '64px' }}>
        <UploadHub onUploadComplete={handleUploadComplete} analysisPending={!!clarify} />
        {clarify ? (
          <ClarifyPanel clarify={clarify} onResolved={handleClarifyResolved} />
        ) : (
          <Dashboard dataUpdated={dataUpdated} aiData={aiData} onAiDataUpdate={handleAiDataUpdate} />
        )}
        <Chatbot />
      </div>
      <Footer />
    </>
  );
}

export default App;
