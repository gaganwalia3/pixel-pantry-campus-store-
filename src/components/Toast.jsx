import React from 'react';

export default function Toast({ message, visible }) {
  return (
    <div className={`toast ${visible ? 'show' : ''}`} id="toast">
      {message}
    </div>
  );
}
