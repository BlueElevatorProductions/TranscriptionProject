/**
 * Notification context for managing toast notifications throughout the app
 * Provides hooks for showing success, error, warning, and info messages
 */

import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { ToastProps } from '../components/Notifications/Toast';

// ==================== Types ====================

export interface NotificationState {
  toasts: ToastProps[];
}

export type NotificationAction =
  | { type: 'ADD_TOAST'; payload: ToastProps }
  | { type: 'REMOVE_TOAST'; payload: { id: string } }
  | { type: 'CLEAR_ALL_TOASTS' };

export interface NotificationContextValue {
  state: NotificationState;
  showToast: (toast: Omit<ToastProps, 'id' | 'onDismiss'>) => string;
  showSuccess: (title: string, message?: string, options?: Partial<ToastProps>) => string;
  showError: (title: string, message?: string, options?: Partial<ToastProps>) => string;
  showWarning: (title: string, message?: string, options?: Partial<ToastProps>) => string;
  showInfo: (title: string, message?: string, options?: Partial<ToastProps>) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

// ==================== Initial State ====================

const initialState: NotificationState = {
  toasts: [],
};

// ==================== Reducer ====================

function notificationReducer(
  state: NotificationState,
  action: NotificationAction
): NotificationState {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.payload],
      };

    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.payload.id),
      };

    case 'CLEAR_ALL_TOASTS':
      return {
        ...state,
        toasts: [],
      };

    default:
      return state;
  }
}

// ==================== Context ====================

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ==================== Provider ====================

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);

  // Generate unique ID for toasts
  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Generic toast creator
  const showToast = useCallback((toast: Omit<ToastProps, 'id' | 'onDismiss'>) => {
    const id = generateId();
    const fullToast: ToastProps = {
      ...toast,
      id,
      onDismiss: (toastId: string) => dismissToast(toastId),
    };

    dispatch({ type: 'ADD_TOAST', payload: fullToast });
    return id;
  }, [generateId]);

  // Convenience methods for different toast types
  const showSuccess = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<ToastProps>
  ) => {
    return showToast({
      type: 'success',
      title,
      message,
      duration: 4000,
      ...options,
    });
  }, [showToast]);

  const showError = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<ToastProps>
  ) => {
    return showToast({
      type: 'error',
      title,
      message,
      duration: 6000, // Longer duration for errors
      ...options,
    });
  }, [showToast]);

  const showWarning = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<ToastProps>
  ) => {
    return showToast({
      type: 'warning',
      title,
      message,
      duration: 5000,
      ...options,
    });
  }, [showToast]);

  const showInfo = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<ToastProps>
  ) => {
    return showToast({
      type: 'info',
      title,
      message,
      duration: 4000,
      ...options,
    });
  }, [showToast]);

  // Toast dismissal
  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: { id } });
  }, []);

  const clearAllToasts = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_TOASTS' });
  }, []);

  const value: NotificationContextValue = {
    state,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismissToast,
    clearAllToasts,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// ==================== Hooks ====================

export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Convenience hooks for specific toast types
export const useToast = () => {
  const { showToast } = useNotifications();
  return showToast;
};

export const useSuccessToast = () => {
  const { showSuccess } = useNotifications();
  return showSuccess;
};

export const useErrorToast = () => {
  const { showError } = useNotifications();
  return showError;
};

export const useWarningToast = () => {
  const { showWarning } = useNotifications();
  return showWarning;
};

export const useInfoToast = () => {
  const { showInfo } = useNotifications();
  return showInfo;
};

// Utility hook for common error patterns  
export const useApiErrorToast = () => {
  const { showError } = useNotifications();
  
  return useCallback((error: any, operation: string = 'operation') => {
    let title = `${operation.charAt(0).toUpperCase() + operation.slice(1)} failed`;
    let message = 'An unexpected error occurred. Please try again.';

    // Map common API errors to user-friendly messages
    if (error?.status === 401 || error?.code === 'UNAUTHORIZED') {
      title = 'Authorization failed';
      message = 'Please check your API key and try again.';
    } else if (error?.status === 400 || error?.code === 'BAD_REQUEST') {
      title = 'Invalid request';
      message = 'The request format or content is not supported.';
    } else if (error?.status === 403 || error?.code === 'FORBIDDEN') {
      title = 'Access denied';
      message = 'You don\'t have permission to perform this action.';
    } else if (error?.status === 404 || error?.code === 'NOT_FOUND') {
      title = 'Service not found';
      message = 'The requested service is not available.';
    } else if (error?.status === 429 || error?.code === 'RATE_LIMITED') {
      title = 'Rate limit exceeded';
      message = 'Too many requests. Please wait and try again.';
    } else if (error?.status === 503 || error?.code === 'SERVICE_UNAVAILABLE') {
      title = 'Service unavailable';
      message = 'The service is temporarily unavailable. Please try again later.';
    } else if (error?.code === 'NETWORK_ERROR') {
      title = 'Connection failed';
      message = 'Please check your internet connection and try again.';
    } else if (error?.message && typeof error.message === 'string') {
      message = error.message;
    }

    return showError(title, message, {
      action: {
        label: 'Retry',
        onClick: () => {
          // This will be overridden by the caller if needed
          window.location.reload();
        }
      }
    });
  }, [showError]);
};

export default NotificationContext;