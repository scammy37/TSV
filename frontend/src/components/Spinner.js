import React from 'react';

export default function Spinner({ center = false }) {
  const spinner = <div className="spinner" role="status" aria-label="Loading" />;
  return center ? <div className="spinner-center">{spinner}</div> : spinner;
}
