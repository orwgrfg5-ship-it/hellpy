import React, { useState } from 'react';

// Mobile-responsive layout wrapper
export function ResponsiveContainer({ children, className = '' }) {
  return (
    <div className={`w-full h-full flex flex-col md:flex-row overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// Mobile sidebar toggle button
export function MobileSidebarToggle({ isOpen, onToggle, label = '☰' }) {
  return (
    <button
      onClick={onToggle}
      className="md:hidden fixed top-4 left-4 z-50 p-2 rounded bg-[var(--bg-3)] hover:bg-[var(--accent)] text-[var(--text)] min-h-12 min-w-12 flex items-center justify-center"
      title={label}
    >
      {label}
    </button>
  );
}

// Mobile-friendly sidebar wrapper
export function MobileSidebar({ isOpen, onClose, children, className = '' }) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={onClose}
        />
      )}
      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative
          left-0 top-0 bottom-0
          w-64 md:w-auto
          bg-[var(--bg-1)]
          z-40
          transform transition-transform md:transform-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          overflow-y-auto
          ${className}
        `}
      >
        {children}
      </aside>
    </>
  );
}

// Mobile-friendly button group
export function ButtonGroup({ children, className = '' }) {
  return (
    <div className={`flex gap-2 flex-wrap md:flex-nowrap ${className}`}>
      {children}
    </div>
  );
}

// Mobile-optimized input
export function MobileInput({ label, ...props }) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold mb-2 text-[var(--text)]">{label}</label>}
      <input
        {...props}
        className={`w-full px-3 py-3 md:py-2 rounded bg-[var(--bg-3)] text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${props.className || ''}`}
      />
    </div>
  );
}

// Mobile-optimized message list
export function MobileMessageList({ messages, className = '' }) {
  return (
    <div
      className={`
        flex-1 overflow-y-auto
        flex flex-col gap-2 md:gap-3
        p-2 md:p-4
        snap-scroll
        ${className}
      `}
    >
      {messages.map((msg, i) => (
        <div key={i} className="snap-item">
          {msg}
        </div>
      ))}
    </div>
  );
}

// Mobile-optimized message input
export function MobileMessageInput({ onSend, disabled = false, className = '' }) {
  const [text, setText] = React.useState('');

  const handleSend = () => {
    if (text.trim()) {
      onSend(text);
      setText('');
    }
  };

  return (
    <div className={`flex gap-2 p-2 md:p-4 bg-[var(--bg-1)] ${className}`}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        disabled={disabled}
        placeholder="Type a message..."
        className="flex-1 min-h-12 md:min-h-10 p-2 md:p-3 rounded bg-[var(--bg-3)] text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none text-base md:text-sm"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className="min-h-12 min-w-12 md:min-h-10 md:min-w-10 px-3 py-2 rounded bg-[var(--accent)] hover:brightness-110 text-white font-semibold disabled:opacity-50 flex items-center justify-center"
      >
        📤
      </button>
    </div>
  );
}

// Mobile viewport height fix (for notched devices)
export function useMobileViewport() {
  React.useEffect(() => {
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
    
    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);
}
