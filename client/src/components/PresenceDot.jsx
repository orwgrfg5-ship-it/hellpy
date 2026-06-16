import React from 'react';

export default function PresenceDot({ status = 'OFFLINE' }) {
  return <span className={`presence-dot presence-${status}`} title={status.toLowerCase()} />;
}
