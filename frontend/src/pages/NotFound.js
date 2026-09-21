import React from 'react';
import { Link } from 'react-router-dom';

import Layout from '../components/Layout';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';

/**
 * Reached by anyone, signed in or not, which is why it does not assume a
 * session. The site has a public front door now, so a stranger who mistypes a
 * URL or follows a stale link arrives here -- and being shown a login form
 * instead, as they were, reads as "you are not welcome" rather than "no such
 * page".
 */
export default function NotFound() {
  const { user } = useAuth();

  // Signed in, this wraps itself in the app shell. It used to get that from
  // ProtectedRoute, which no longer wraps it -- without this the page loses its
  // header and the reader loses their way out.
  if (user) {
    return (
      <Layout>
        <div className="card">
          <div className="empty">
            <h3>Page not found</h3>
            <p>That page does not exist.</p>
            <Link to="/dashboard"><button type="button">Back to my requests</button></Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <span className="brand">
          <Logo size={26} /> <span className="brand-text">Townsquare Village HOA</span>
        </span>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
          That page does not exist. It may have moved, or the link may be out of date.
        </p>
        <Link to="/"><button type="button" className="block">Go to the home page</button></Link>
        <p className="auth-foot">
          Need to report something? <Link to="/register">Submit a request</Link>
        </p>
      </div>
    </div>
  );
}
