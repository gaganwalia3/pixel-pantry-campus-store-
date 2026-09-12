import React from 'react';

export default function BenefitsSection() {
  return (
    <section className="benefits">
      <div className="benefit">
        <div className="benefit-icon">✦</div>
        <div>
          <h4>Deliberately selected</h4>
          <p>Useful objects with a little more character.</p>
        </div>
      </div>
      <div className="benefit">
        <div className="benefit-icon">▣</div>
        <div>
          <h4>Made for safe arrival</h4>
          <p>Thoughtful packing, tracked straight to you.</p>
        </div>
      </div>
      <div className="benefit">
        <div className="benefit-icon">₹</div>
        <div>
          <h4>Simple payment</h4>
          <p>Pay securely when your order reaches your door.</p>
        </div>
      </div>
    </section>
  );
}
