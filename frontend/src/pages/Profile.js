import React, { useState } from 'react';

import { api, errorMessage } from '../api/client';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, setUser, adoptSession } = useAuth();

  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    unitNumber: user?.unitNumber || '',
    phone: user?.phone || '',
  });

  // The address is the login, so moving it needs the password behind it. The
  // field only appears once the address actually differs, so the common edit --
  // a phone number, a corrected surname -- still takes one click.
  const [emailPassword, setEmailPassword] = useState('');
  const emailChanged = profile.email.trim().toLowerCase() !== (user?.email || '').toLowerCase();
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });

  const [profileState, setProfileState] = useState({ error: '', notice: '', busy: false });
  const [passwordState, setPasswordState] = useState({ error: '', notice: '', busy: false });

  const updateProfile = (field) => (e) => setProfile({ ...profile, [field]: e.target.value });
  const updatePassword = (field) => (e) => setPasswords({ ...passwords, [field]: e.target.value });

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileState({ error: '', notice: '', busy: true });
    try {
      const payload = emailChanged ? { ...profile, currentPassword: emailPassword } : profile;
      // A changed address signs out every other session, which invalidates the
      // token this request was made with, so the API hands back a new one.
      const { user: updated, token } = await api.updateProfile(payload);
      if (token) adoptSession(token, updated); else setUser(updated);

      setEmailPassword('');
      setProfileState({
        error: '',
        notice: emailChanged
          ? 'Profile saved. Sign in with your new email address from now on; any other device has been signed out.'
          : 'Profile saved',
        busy: false,
      });
    } catch (err) {
      setProfileState({ error: errorMessage(err, 'Could not save'), notice: '', busy: false });
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordState({ error: '', notice: '', busy: true });
    try {
      // The API returns a fresh token: changing the password invalidates every
      // session that predates it, including the one making this request.
      const { token, user: updated } = await api.changePassword(passwords);
      if (token) adoptSession(token, updated);
      setPasswords({ currentPassword: '', newPassword: '' });
      setPasswordState({
        error: '',
        notice: 'Password updated. Any other device you were signed in on has been signed out.',
        busy: false,
      });
    } catch (err) {
      setPasswordState({ error: errorMessage(err, 'Could not change the password'), notice: '', busy: false });
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Profile</h1>
          <p>{user?.email} · <span style={{ textTransform: 'capitalize' }}>{user?.role}</span></p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <h3>Your details</h3>
        <Alert>{profileState.error}</Alert>
        <Alert kind="success">{profileState.notice}</Alert>

        <form onSubmit={saveProfile}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="firstName">First name</label>
              <input id="firstName" required value={profile.firstName} onChange={updateProfile('firstName')} />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" required value={profile.lastName} onChange={updateProfile('lastName')} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" required autoComplete="email"
              value={profile.email} onChange={updateProfile('email')} />
            <div className="field-hint">You sign in with this.</div>
          </div>

          {emailChanged && (
            <div className="field">
              <label htmlFor="emailPassword">Current password</label>
              <input id="emailPassword" type="password" autoComplete="current-password" required
                value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
              <div className="field-hint">
                Needed to change the address you sign in with.
              </div>
            </div>
          )}

          {/* A street address runs a good deal longer than the unit number this
              field used to take, so it gets the full width of the card rather
              than half a row. */}
          <div className="field">
            <label htmlFor="unitNumber">Address</label>
            <input id="unitNumber" placeholder="12 Pondview Terrace" value={profile.unitNumber} onChange={updateProfile('unitNumber')} />
          </div>

          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" type="tel" value={profile.phone} onChange={updateProfile('phone')} />
          </div>

          <button type="submit" disabled={profileState.busy}>
            {profileState.busy ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <h3>Change password</h3>
        <Alert>{passwordState.error}</Alert>
        <Alert kind="success">{passwordState.notice}</Alert>

        <form onSubmit={savePassword}>
          <div className="field">
            <label htmlFor="currentPassword">Current password</label>
            <input id="currentPassword" type="password" autoComplete="current-password" required
              value={passwords.currentPassword} onChange={updatePassword('currentPassword')} />
          </div>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input id="newPassword" type="password" autoComplete="new-password" required minLength={8}
              value={passwords.newPassword} onChange={updatePassword('newPassword')} />
            <div className="field-hint">At least 8 characters.</div>
          </div>

          <button type="submit" disabled={passwordState.busy}>
            {passwordState.busy ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </>
  );
}
