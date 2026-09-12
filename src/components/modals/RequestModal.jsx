import React from 'react';

export default function RequestModal({ isOpen, onClose, onToast }) {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onClose();
    e.target.reset();
    onToast('Request received — we’ll keep an eye out for it ✦');
  };

  return (
    <div
      className={`modal ${isOpen ? 'show' : ''}`}
      onClick={(e) => {
        if (e.target.classList.contains('modal')) onClose();
      }}
    >
      <div className="modal-card">
        <button className="close" onClick={onClose}>
          ×
        </button>
        <h2>Put it on our radar.</h2>
        <p>Your request helps shape what appears on the next shelf.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>What are you looking for?</label>
            <input required placeholder="e.g. A compact record player" />
          </div>
          <div className="field">
            <label>Anything specific?</label>
            <textarea placeholder="Colour, brand, budget, or just the feeling you’re after…"></textarea>
          </div>
          <div className="field">
            <label>How can we update you?</label>
            <input required type="email" placeholder="you@example.com" />
          </div>
          <button className="primary" type="submit">
            SEND REQUEST →
          </button>
        </form>
      </div>
    </div>
  );
}
