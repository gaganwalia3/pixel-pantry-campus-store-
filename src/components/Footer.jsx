
import React from 'react';

export default function Footer() {
  return (
    <footer>
      <span>© {new Date().getFullYear()} SUPER CAMPUS</span>

      <div className="footer-links">
        <a href="/privacy-policy">PRIVACY</a>
        <a href="/terms-of-service">TERMS</a>
        <span>HELP</span>
        <span>INSTAGRAM</span>
      </div>
    </footer>
  );
}
