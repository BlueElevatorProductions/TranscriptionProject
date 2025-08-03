/**
 * Modal dialog for critical errors that require user attention
 * Used for blocking errors that prevent normal app operation
 */

import React, { useEffect, useRef } from 'react';
import './Modal.css';

export interface ErrorModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string; // Technical details (optional)
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'danger';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
  dismissible?: boolean;
  showDetails?: boolean;
}

const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  title,
  message,
  details,
  primaryAction,
  secondaryAction,
  onClose,
  dismissible = true,
  showDetails = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);

  // Focus management for accessibility
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      firstElement?.focus();
    }
  }, [isOpen]);

  // Keyboard event handling
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape' && dismissible && onClose) {
        onClose();
      }

      // Trap focus within modal
      if (event.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, dismissible, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && dismissible && onClose) {
      onClose();
    }
  };

  return (
    <div 
      className="modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-modal-title"
      aria-describedby="error-modal-message"
    >
      <div className="modal modal--error" ref={modalRef}>
        {/* Header */}
        <div className="modal__header">
          <div className="modal__icon modal__icon--error">
            ❌
          </div>
          <h2 id="error-modal-title" className="modal__title">
            {title}
          </h2>
          {dismissible && onClose && (
            <button
              className="modal__close"
              onClick={onClose}
              aria-label="Close dialog"
              type="button"
            >
              ×
            </button>
          )}
        </div>

        {/* Content */}
        <div className="modal__content">
          <p id="error-modal-message" className="modal__message">
            {message}
          </p>

          {/* Technical details (expandable) */}
          {details && (
            <div className="modal__details">
              <button
                className="modal__details-toggle"
                onClick={() => setDetailsExpanded(!detailsExpanded)}
                type="button"
                aria-expanded={detailsExpanded}
              >
                {detailsExpanded ? '▼' : '▶'} Technical Details
              </button>
              {detailsExpanded && (
                <div className="modal__details-content">
                  <pre>{details}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="modal__actions">
          {secondaryAction && (
            <button
              className="modal__action modal__action--secondary"
              onClick={secondaryAction.onClick}
              type="button"
            >
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              className={`modal__action modal__action--${primaryAction.variant || 'primary'}`}
              onClick={primaryAction.onClick}
              type="button"
            >
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;