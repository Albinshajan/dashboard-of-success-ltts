import React from 'react';
import { Mail, MapPin, Phone, Globe } from 'lucide-react';
import whiteLogo from '../assets/whitel&t.png';

const Footer = () => {
  return (
    <footer id="about-us" style={{
      backgroundColor: 'var(--color-navy)',
      color: 'white',
      padding: '80px 10% 40px',
      marginTop: '80px',
      borderTop: '4px solid var(--color-teal)',
      position: 'relative',
      zIndex: 10
    }}>
      <img 
        src={whiteLogo} 
        alt="LTTS Logo" 
        style={{ 
          position: 'absolute',
          top: '45px',
          left: '20px',
          height: '100px', 
          objectFit: 'contain',
          opacity: 0.9
        }} 
      />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '40px',
        marginBottom: '60px'
      }}>
        {/* Brand Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '80px' }}>
          <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, fontSize: '1rem', marginTop: '10px' }}>
            Dashboard of Success is an AI-driven platform transforming raw data into strategic business intelligence. Powered by L&T Technology Services.
          </p>
          <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
            <a href="https://www.ltts.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-teal)', transition: 'color 0.3s' }}>
              <Globe size={24} />
            </a>
          </div>
        </div>

        {/* Services Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h4 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--color-teal)', letterSpacing: '0.5px' }}>Our Services</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <li><a href="#" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '1.05rem', transition: 'color 0.3s' }}>AI Data Analytics</a></li>
            <li><a href="#" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '1.05rem', transition: 'color 0.3s' }}>Predictive Modeling</a></li>
            <li><a href="#" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '1.05rem', transition: 'color 0.3s' }}>Business Intelligence</a></li>
            <li><a href="#" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '1.05rem', transition: 'color 0.3s' }}>Strategic Consulting</a></li>
          </ul>
        </div>

        {/* Contact Section */}
        <div id="contact-us" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h4 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--color-teal)', letterSpacing: '0.5px' }}>Contact Us</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: 'rgba(255,255,255,0.85)', fontSize: '1.05rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ background: 'rgba(227, 27, 35, 0.15)', padding: '10px', borderRadius: '50%', color: 'var(--color-red)' }}>
                <MapPin size={22} />
              </div>
              <span style={{ lineHeight: 1.5, marginTop: '8px' }}>Larsen & Toubro<br />Sheikh Abdulla Building, 6th Floor<br />Al Qasimia, Sharjah, UAE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'rgba(227, 27, 35, 0.15)', padding: '10px', borderRadius: '50%', color: 'var(--color-red)' }}>
                <Phone size={22} />
              </div>
              <span style={{ marginTop: '2px' }}>+971 6 5731549</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'rgba(227, 27, 35, 0.15)', padding: '10px', borderRadius: '50%', color: 'var(--color-red)' }}>
                <Mail size={22} />
              </div>
              <span style={{ marginTop: '2px' }}>info@ltts.com</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.15)',
        paddingTop: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        fontSize: '0.95rem',
        color: 'rgba(255,255,255,0.6)'
      }}>
        <p style={{ margin: 0 }}>© {new Date().getFullYear()} L&T Technology Services. All rights reserved.</p>
        <div style={{ display: 'flex', gap: '32px' }}>
          <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Terms of Service</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
