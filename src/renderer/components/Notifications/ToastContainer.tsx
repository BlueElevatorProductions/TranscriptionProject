/**
 * Toast container component that manages multiple toast notifications
 * Handles positioning, stacking, and lifecycle management
 */

import React from 'react';
import Toast, { ToastProps } from './Toast';
import './ToastContainer.css';

export interface ToastContainerProps {
  toasts: ToastProps[];
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxToasts?: number;
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  position = 'top-right',
  maxToasts = 5,
  onDismiss,
}) => {
  // Limit the number of visible toasts
  const visibleToasts = toasts.slice(0, maxToasts);

  if (visibleToasts.length === 0) {
    return null;
  }

  return (
    <div 
      className={`toast-container toast-container--${position}`}
      role="region"
      aria-label="Notifications"
    >
      {visibleToasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

export default ToastContainer;