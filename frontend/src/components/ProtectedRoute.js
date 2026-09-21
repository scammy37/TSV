import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import ForcePasswordChange from '../pages/ForcePasswordChange';
import Layout from './Layout';
import Spinner from './Spinner';

/**
 * Gates a route behind authentication and, optionally, a set of roles. Renders
 * inside the app shell so a protected page never flashes the bare login chrome.
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner center />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  // An account on a temporary password gets this and nothing else, whatever it
  // asked for. Rendered in place rather than redirected to, so there is no URL
  // to navigate away from and no route that could be reached without passing
  // through here. The API enforces the same rule regardless.
  if (user.mustChangePassword) return <ForcePasswordChange />;

  if (roles && !roles.includes(user.role)) {
    return (
      <Layout>
        <div className="empty">
          <h3>Not available</h3>
          <p>Your account does not have access to this page.</p>
        </div>
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
}
