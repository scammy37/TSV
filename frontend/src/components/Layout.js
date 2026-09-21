import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

export default function Layout({ children }) {
  const { user, isStaff, isManagement, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          {/* The association name goes to the association's front page, which
              is what a name in a corner is taken to mean everywhere else. The
              nav beside it already leads back into the portal. */}
          <Link to="/" className="brand">
            <Logo size={30} />
            <span className="brand-text">Townsquare Village</span>
          </Link>

          <nav className="nav">
            <NavLink to="/dashboard" end className="nav-link">
              {isStaff ? 'Queue' : 'My Requests'}
            </NavLink>
            {!isStaff && <NavLink to="/tickets/new" className="nav-link">New Request</NavLink>}
            {isStaff && <NavLink to="/reports" className="nav-link">Reports</NavLink>}
            {isManagement && <NavLink to="/users" className="nav-link">People</NavLink>}
            <NavLink to="/profile" className="nav-link">Profile</NavLink>
          </nav>

          <div className="usermenu">
            <div>
              <div className="usermenu-name">{user?.fullName}</div>
              <div className="usermenu-role">
                {user?.role}
                {user?.unitNumber ? ` · ${user.unitNumber}` : ''}
              </div>
            </div>
            <button type="button" className="secondary sm" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="page">{children}</main>
    </div>
  );
}
