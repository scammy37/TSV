import React, { useState } from 'react';

import { api, errorMessage } from '../api/client';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, setUser } = useAuth();

  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    unitNumber: user?.unitNumber || '',
    phone: user?.phone || '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });

  const [profileState, setProfileState] = useState({ error: '', notice: '', busy: false });
  const [passwordState, setPasswordState] = useState({ error: '', notice: '', busy: false });

  const updateProfile = (field) => (e) => setProfile({ ...profile, [field]: e.target.value });
  const updatePassword = (field) => (e) => setPasswords({ ...passwords, [field]: e.target.value });

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileState({ error: '', notice: '', busy: true });
    try {
      setUser(await api.updateProfile(profile));
      setProfileState({ error: '', notice: 'Profile saved', busy: false });
    } catch (err) {
      setProfileState({ error: errorMessage(err, 'Could not save'), notice: '', busy: false });
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordState({ error: '', notice: '', busy: true });
    try {
      await api.changePassword(passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      setPasswordState({ error: '', notice: 'Password updated', busy: false });
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

          <div className="field-row">
            <div className="field">
              <label htmlFor="unitNumber">Unit number</label>
              <input id="unitNumber" value={profile.unitNumber} onChange={updateProfile('unitNumber')} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" type="tel" value={profile.phone} onChange={updateProfile('phone')} />
            </div>
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
