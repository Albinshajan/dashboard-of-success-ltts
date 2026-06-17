import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Minus, MessageCircle } from 'lucide-react';

const TypingIndicator = () => (
  <div style={{ display: 'flex', gap: '4px', padding: '12px 16px', background: 'rgba(245, 245, 247, 0.6)', backdropFilter: 'blur(10px)', borderRadius: '16px', width: 'fit-content' }}>
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
        style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#666' }}
      />
    ))}
  </div>
);

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: 'Hello! I am your Success Dashboard Assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Real Gemini API call via backend
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });

      if (!response.ok) throw new Error('Assistant failed');
      
      const data = await response.json();
      const aiMsg = { 
        id: Date.now() + 1, 
        sender: 'ai', 
        text: data.text 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat Error:', error);
      setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: 'Sorry, I encountered an error connecting to the AI brain.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          width: '64px',
          height: '64px',
          borderRadius: '32px',
          backgroundColor: '#e31b23', // LTTS Red
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 25px rgba(227, 27, 35, 0.3)',
          zIndex: 1000,
          cursor: 'pointer',
          visibility: isOpen ? 'hidden' : 'visible'
        }}
      >
        <Sparkles size={28} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              bottom: '32px',
              right: '32px',
              width: '400px',
              height: '600px',
              backgroundColor: 'white',
              borderRadius: '24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 1001
            }}
          >
            {/* Header */}
            <div style={{ 
              padding: '20px 24px', 
              backgroundColor: 'var(--color-navy)', 
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Sparkles size={20} color="#e31b23" />
                <span style={{ fontWeight: 600 }}>Success Dashboard Assistant</span>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', color: 'white', cursor: 'pointer' }}>
                <Minus size={20} />
              </button>
            </div>

            {/* Chat Area */}
            <div 
              ref={scrollRef}
              style={{ 
                flex: 1, 
                padding: '24px', 
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                backgroundColor: '#f8f9fa'
              }}
            >
              {messages.map(msg => (
                <div key={msg.id} style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{
                    padding: '12px 18px',
                    borderRadius: '18px',
                    fontSize: '0.95rem',
                    lineHeight: 1.5,
                    backgroundColor: msg.sender === 'user' ? 'var(--color-navy)' : 'rgba(245, 245, 247, 0.8)',
                    color: msg.sender === 'user' ? 'white' : '#333',
                    backdropFilter: msg.sender === 'ai' ? 'blur(10px)' : 'none',
                    border: msg.sender === 'ai' ? '1px solid rgba(255,255,255,0.5)' : 'none',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                    borderBottomRightRadius: msg.sender === 'user' ? '4px' : '18px',
                    borderBottomLeftRadius: msg.sender === 'ai' ? '4px' : '18px'
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && <TypingIndicator />}
            </div>

            {/* Input Area */}
            <div style={{ padding: '20px', borderTop: '1px solid #eee', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                style={{
                  flex: 1,
                  border: 'none',
                  backgroundColor: '#f0f2f5',
                  padding: '12px 20px',
                  borderRadius: '100px',
                  outline: 'none',
                  fontSize: '0.95rem'
                }}
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleSend}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '22px',
                  backgroundColor: 'var(--color-navy)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Send size={18} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Chatbot;
