/**
 * Hook for handling transcription errors with user notifications
 * Integrates with the notification system to show appropriate error messages
 */

import { useCallback } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorHandler } from '../services/errorHandling';

export const useTranscriptionErrorHandler = () => {
  const { showError, showWarning } = useNotifications();

  const handleTranscriptionError = useCallback((error: any, operation: string = 'transcription') => {
    console.error(`Transcription error in ${operation}:`, error);

    // Process the error using our error handling service
    const errorInfo = ErrorHandler.processError(error, operation);

    // Show appropriate notification based on error severity
    if (errorInfo.shouldShowModal) {
      // For critical errors, we might want to show a modal
      // This would be handled by the App component listening for critical errors
      return errorInfo;
    } else if (errorInfo.shouldShowToast) {
      if (errorInfo.type === 'warning') {
        showWarning(errorInfo.title, errorInfo.message, {
          duration: 6000,
          action: errorInfo.retryable ? {
            label: 'Retry',
            onClick: () => {
              // Emit retry event - this will be handled by the caller
              window.dispatchEvent(new CustomEvent('transcription-retry', { 
                detail: { errorInfo, originalError: error } 
              }));
            }
          } : undefined
        });
      } else {
        showError(errorInfo.title, errorInfo.message, {
          duration: errorInfo.severity === 'high' ? 8000 : 6000,
          action: errorInfo.retryable ? {
            label: 'Retry',
            onClick: () => {
              // Emit retry event - this will be handled by the caller
              window.dispatchEvent(new CustomEvent('transcription-retry', { 
                detail: { errorInfo, originalError: error } 
              }));
            }
          } : undefined
        });
      }
    }

    return errorInfo;
  }, [showError, showWarning]);

  const handleApiKeyError = useCallback(() => {
    showError(
      'API Key Required', 
      'Please configure your API key in settings to use cloud transcription services.',
      {
        duration: 0, // Don't auto-dismiss
        action: {
          label: 'Open Settings',
          onClick: () => {
            // Emit settings event - this will be handled by the App component
            window.dispatchEvent(new CustomEvent('open-api-settings'));
          }
        }
      }
    );
  }, [showError]);

  const handleTranscriptionSuccess = useCallback((fileName: string, duration: number = 4000) => {
    // This could be called from the completion handler
    // For now, we'll keep success messages minimal to avoid notification fatigue
    console.log(`Transcription completed successfully for ${fileName}`);
  }, []);

  const handleTranscriptionProgress = useCallback((fileName: string, progress: number, status: string) => {
    // Progress updates are handled by the progress view, but we could add notifications
    // for significant milestones (e.g., 50%, 90% complete)
    if (progress >= 90 && status.includes('Processing results')) {
      console.log(`Transcription nearly complete for ${fileName}: ${progress}%`);
    }
  }, []);

  return {
    handleTranscriptionError,
    handleApiKeyError,
    handleTranscriptionSuccess,
    handleTranscriptionProgress,
  };
};