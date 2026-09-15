import React from 'react';

export default function Alert({ kind = 'error', children, onDismiss }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
      {onDismiss && (
        <button type="button" className="ghost sm" onClick={onDismiss} style={{ float: 'right' }}>
          Dismiss
        </button>
      )}
    </div>
  );
}
