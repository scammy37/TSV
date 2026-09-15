import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="card">
      <div className="empty">
        <h3>Page not found</h3>
        <p>That page does not exist.</p>
        <Link to="/"><button type="button">Back to the dashboard</button></Link>
      </div>
    </div>
  );
}
