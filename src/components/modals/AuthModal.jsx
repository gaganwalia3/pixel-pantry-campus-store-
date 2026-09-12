import React, { useState } from 'react';

export default function AuthModal({ isOpen, onClose, onToast }) {
  const [isSignUp, setIsSignUp] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onClose();
    if (isSignUp) {
      onToast('Account created! Welcome to Pixel Pantry.');
    } else {
      onToast('You’re in. Your little corner is ready.');
    }
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

        {!isSignUp ? (
          <div>
            <h2>Welcome back.</h2>
            <p>
              Sign in to save your shelf, follow orders, and make checkout
              quicker.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Email address</label>
                <input required type="email" placeholder="you@example.com" />
              </div>
              <div className="field">
                <label>Password</label>
                <input required type="password" placeholder="••••••••" />
              </div>
              <button className="primary" type="submit">
                SIGN IN →
              </button>
            </form>
            <p className="switch">
              New around here?{' '}
              <button type="button" onClick={() => setIsSignUp(true)}>
                Create an account
              </button>
            </p>
          </div>
        ) : (
          <div>
            <h2>Make it yours.</h2>
            <p>Create an account for saved favourites and gentler checkouts.</p>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Your name</label>
                <input required placeholder="Your name" />
              </div>
              <div className="field">
                <label>Email address</label>
                <input required type="email" placeholder="you@example.com" />
              </div>
              <div className="field">
                <label>Create password</label>
                <input
                  required
                  type="password"
                  placeholder="Choose something secure"
                />
              </div>
              <button className="primary" type="submit">
                CREATE ACCOUNT →
              </button>
            </form>
            <p className="switch">
              Already a member?{' '}
              <button type="button" onClick={() => setIsSignUp(false)}>
                Sign in
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
