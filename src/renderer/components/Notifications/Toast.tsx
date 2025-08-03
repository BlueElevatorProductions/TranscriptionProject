/**
 * Toast notification component for user feedback
 * Provides success, error, warning, and info notifications
 */

import React, { useEffect, useState } from 'react';
import './Toast.css';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // milliseconds
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  dismissible = true,
  action,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const showTimer = setTimeout(() => setIsVisible(true), 50);

    // Auto-dismiss timer
    let dismissTimer: NodeJS.Timeout;
    if (duration > 0) {
      dismissTimer = setTimeout(() => {
        handleDismiss();
      }, duration);
    }

    return () => {
      clearTimeout(showTimer);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [duration]);

  const handleDismiss = () => {
    if (!dismissible) return;
    
    setIsExiting(true);
    setTimeout(() => {
      onDismiss?.(id);
    }, 300); // Match CSS animation duration
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div
      className={`toast toast--${type} ${isVisible ? 'toast--visible' : ''} ${isExiting ? 'toast--exiting' : ''}`}
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="toast__icon">
        {getIcon()}
      </div>
      
      <div className="toast__content">
        <div className="toast__title">
          {title}
        </div>
        {message && (
          <div className="toast__message">
            {message}
          </div>
        )}
      </div>

      {action && (
        <button
          className="toast__action"
          onClick={action.onClick}
          type="button"
        >
          {action.label}
        </button>
      )}

      {dismissible && (
        <button
          className="toast__dismiss"
          onClick={handleDismiss}
          type="button"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Toast;