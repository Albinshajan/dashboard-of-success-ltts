import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '../assets/ltts-3d-logo.png';

const navItems = [
  'Home',
  'Analyser',
  'Hypothesis Generator',
  'About Us'
];

const Header = () => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [scrollY, setScrollY] = useState(0);
  const [isMouseInTopHalf, setIsMouseInTopHalf] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e) => {
      // Rule 2: Reappear if mouse enters top 50% of viewport
      setIsMouseInTopHalf(e.clientY < window.innerHeight / 2);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Rule 1 & 2 combination: Visible if at top of page OR mouse is in top half
  const isVisible = scrollY < 10 || isMouseInTopHalf;

  return (
    <>
      <motion.header
        initial={false}
        animate={{ 
          opacity: isVisible ? 1 : 0,
          y: isVisible ? 0 : '-100%', 
          pointerEvents: isVisible ? 'auto' : 'none'
        }}
        transition={isVisible 
          ? { type: "spring", damping: 14, stiffness: 100 } 
          : { duration: 3.0, ease: "easeInOut" } 
        }
        style={{
          position: 'fixed',
          top: 0,
          zIndex: 9999, // Rule 3: Highest stacking order
          backgroundColor: 'var(--color-navy)',
          width: '100%',
          height: '80px', // Standard premium header height
          padding: '0 10%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          overflow: 'visible' // Allows logo to pop out
        }}
      >
        {/* Logo Container */}
        <div style={{
          position: 'absolute',
          left: '5%',
          top: '60%',
          transform: 'translateY(-50%)',
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none'
        }}>
          <img
            src={logo}
            alt="L&T Technology Services Logo"
            style={{
              height: '100%',
              objectFit: 'contain',
              transform: 'scale(1.5)',
              transformOrigin: 'left center'
            }}
          />
        </div>

        {/* Spacer to keep nav on the right since logo is now absolute */}
        <div style={{ width: '300px' }} />

        {/* Navigation Menu */}
        <nav style={{
          display: 'flex',
          gap: '4px'
        }}>
          <AnimatePresence>
            {navItems.map((item, index) => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                onHoverStart={() => setHoveredIndex(index)}
                onHoverEnd={() => setHoveredIndex(null)}
                style={{
                  position: 'relative',
                  padding: '10px 20px',
                  color: hoveredIndex === index ? 'var(--color-red)' : 'var(--color-white)',
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'color 0.3s ease'
                }}
              >
                {/* Liquid Glass Background on Hover */}
                {hoveredIndex === index && (
                  <motion.div
                    layoutId="nav-pill"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(15px)',
                      WebkitBackdropFilter: 'blur(15px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)', // 0.5px visual equivalent
                      borderRadius: '20px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      zIndex: -1
                    }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>{item}</span>
              </motion.a>
            ))}
          </AnimatePresence>
        </nav>

        {/* Contact Us Button */}
        <motion.a
          href="#contact-us"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            padding: '10px 24px',
            backgroundColor: '#007bff',
            color: 'var(--color-white)',
            textDecoration: 'none',
            fontSize: '0.95rem',
            fontWeight: 600,
            borderRadius: '20px',
            boxShadow: '0 4px 12px rgba(0, 123, 255, 0.3)',
            cursor: 'pointer'
          }}
        >
          Contact Us
        </motion.a>
      </motion.header>
    </>
  );
};

export default Header;
