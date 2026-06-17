import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Bot, Zap } from 'lucide-react';
import heroVideo from '../assets/Animate_beams_flow_202604271751.mp4';

const GlassCard = ({ icon: Icon, title, content }) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      style={{
        flex: 1,
        minWidth: '300px',
        background: 'rgba(255, 255, 255, 0.85)', // Opaque white material
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        borderRadius: '24px',
        padding: '40px',
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'flex-start', 
        gap: '20px',
        boxShadow: '0 20px 40px rgba(0, 58, 112, 0.12)',
        transition: 'all 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 30px 60px rgba(0, 58, 112, 0.18)';
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 58, 112, 0.12)';
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)';
      }}
    >
      <div style={{ color: '#e31b23' }}>
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <h3 style={{ 
        fontSize: '1.5rem', 
        fontWeight: 700, 
        color: 'var(--color-navy)',
        margin: 0
      }}>
        {title}
      </h3>
      <p style={{ 
        fontSize: '1.05rem', 
        lineHeight: 1.6, 
        color: '#333333',
        margin: 0
      }}>
        {content}
      </p>
    </motion.div>
  );
};

const Hero = () => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.5;
    }
  }, []);

  return (
    <div 
      id="home"
      style={{ 
      position: 'relative',
      textAlign: 'center', 
      padding: '120px 10%', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '80px',
      minHeight: '100vh', 
      justifyContent: 'center',
      backgroundColor: 'var(--color-navy)',
      overflow: 'hidden'
    }}>
      {/* Background Video (Looping at 35% opacity, 0.5x speed) */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        loop
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'left center',
          opacity: 0.35,
          zIndex: 0,
          pointerEvents: 'none'
        }}
      >
        <source src={heroVideo} type="video/mp4" />
      </video>

      {/* Main Content Overlay */}
      <div 
        style={{ 
          position: 'relative', 
          zIndex: 5, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '24px'
        }}
      >
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: 'spring' }}
          style={{ 
            fontSize: '4.5rem', 
            fontWeight: 800, 
            letterSpacing: '-0.02em',
            color: 'var(--color-white)',
            margin: 0,
            textShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}
        >
          Dashboard Of Success
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            fontSize: '1.5rem',
            color: 'rgba(255, 255, 255, 0.8)',
            maxWidth: '700px',
            margin: '0 0 16px 0',
            lineHeight: 1.4
          }}
        >
          AI-driven business intelligence for real-time strategic decision making.
        </motion.p>
        
        <motion.a
          href="#upload-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            backgroundColor: 'var(--color-teal)',
            color: 'var(--color-white)',
            padding: '18px 40px',
            borderRadius: '100px',
            fontSize: '1.125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 10px 30px -5px rgba(0, 197, 205, 0.5)',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            textDecoration: 'none'
          }}
        >
          <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Explore Insights <ArrowRight size={22} />
          </span>
          <motion.div
            initial={{ x: '-100%', opacity: 0.5 }}
            whileHover={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              zIndex: 0
            }}
          />
        </motion.a>
      </div>

      {/* Mission & Vision Grid Overlay */}
      <motion.div 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.2
            }
          }
        }}
        style={{ 
          position: 'relative',
          zIndex: 5,
          display: 'flex', 
          flexWrap: 'wrap', 
          width: '100%', 
          maxWidth: '1200px',
          gap: '40px',
          justifyContent: 'center',
          marginTop: '20px'
        }}
      >
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 30 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
          }}
          style={{ flex: 1, minWidth: '300px', display: 'flex' }}
        >
          <GlassCard 
            icon={Bot}
            title="Autonomous AI Agent"
            content="Empowering LTTS teams with an autonomous data scientist that instantly transforms complex raw datasets into actionable strategic intelligence."
          />
        </motion.div>
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 30 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
          }}
          style={{ flex: 1, minWidth: '300px', display: 'flex' }}
        >
          <GlassCard 
            icon={Zap}
            title="Seamless Data Analysis"
            content="Eliminate manual data wrangling. Our intelligent engine dynamically interprets your CSV and Excel files, providing bespoke visualizations in seconds."
          />
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Hero;
