/**
 * Comprehensive error handling service
 * Maps technical errors to user-friendly messages and determines appropriate UI response
 */

export interface ErrorInfo {
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  shouldShowModal: boolean;
  shouldShowToast: boolean;
  retryable: boolean;
  suggestedActions?: string[];
  technicalDetails?: string;
}

export interface ApiError {
  status?: number;
  code?: string;
  message?: string;
  details?: any;
  operation?: string;
}

// ==================== Error Classification ====================

export class ErrorHandler {
  /**
   * Main error processing function
   * Takes any error and returns standardized error information
   */
  static processError(error: any, context?: string): ErrorInfo {
    // Handle different error types
    if (error?.response) {
      // HTTP response error
      return this.handleHttpError(error, context);
    } else if (error?.code) {
      // Application/API specific error
      return this.handleApplicationError(error, context);
    } else if (error instanceof Error) {
      // JavaScript Error object
      return this.handleJavaScriptError(error, context);
    } else if (typeof error === 'string') {
      // String error message
      return this.handleStringError(error, context);
    } else {
      // Unknown error format
      return this.handleUnknownError(error, context);
    }
  }

  /**
   * Handle HTTP response errors (fetch, axios, etc.)
   */
  private static handleHttpError(error: any, context?: string): ErrorInfo {
    const status = error.response?.status || error.status;
    const responseData = error.response?.data || error.data;
    const operation = context || 'request';

    switch (status) {
      case 400:
        return {
          title: 'Invalid Request',
          message: 'The request format or content is not supported. Please check your input and try again.',
          type: 'error',
          severity: 'medium',
          shouldShowModal: false,
          shouldShowToast: true,
          retryable: false,
          suggestedActions: ['Check your input format', 'Try a different file or settings'],
          technicalDetails: `HTTP 400: ${responseData?.message || error.message}`,
        };

      case 401:
        return {
          title: 'Authorization Failed',
          message: 'Your API key is invalid or expired. Please check your API settings.',
          type: 'error',
          severity: 'high',
          shouldShowModal: true,
          shouldShowToast: false,
          retryable: false,
          suggestedActions: ['Check your API key', 'Re-enter your credentials', 'Contact support if key is correct'],
          technicalDetails: `HTTP 401: ${responseData?.message || error.message}`,
        };

      case 403:
        return {
          title: 'Access Denied',
          message: 'You don\'t have permission to perform this action. Please check your account permissions.',
          type: 'error',
          severity: 'high',
          shouldShowModal: true,
          shouldShowToast: false,
          retryable: false,
          suggestedActions: ['Check your account permissions', 'Contact your administrator', 'Upgrade your plan if needed'],
          technicalDetails: `HTTP 403: ${responseData?.message || error.message}`,
        };

      case 404:
        return {
          title: 'Service Not Found',
          message: 'The requested service or resource is not available.',
          type: 'error',
          severity: 'medium',
          shouldShowModal: false,
          shouldShowToast: true,
          retryable: true,
          suggestedActions: ['Try again later', 'Check service status'],
          technicalDetails: `HTTP 404: ${responseData?.message || error.message}`,
        };

      case 413:
        return {
          title: 'File Too Large',
          message: 'The audio file is too large to process. Please try a smaller file or compress your audio.',
          type: 'error',
          severity: 'medium',
          shouldShowModal: false,
          shouldShowToast: true,
          retryable: false,
          suggestedActions: ['Use a smaller audio file', 'Compress your audio', 'Split large files into segments'],
          technicalDetails: `HTTP 413: ${responseData?.message || error.message}`,
        };

      case 415:
        return {
          title: 'Unsupported File Format',
          message: 'The audio format is not supported. Please use MP3, WAV, M4A, or other common formats.',
          type: 'error',
          severity: 'medium',
          shouldShowModal: false,
          shouldShowToast: true,
          retryable: false,
          suggestedActions: ['Convert to MP3 or WAV format', 'Try a different audio file'],
          technicalDetails: `HTTP 415: ${responseData?.message || error.message}`,
        };

      case 429:
        return {
          title: 'Rate Limit Exceeded',
          message: 'Too many requests have been made. Please wait a moment and try again.',
          type: 'warning',
          severity: 'medium',
          shouldShowModal: false,
          shouldShowToast: true,
          retryable: true,
          suggestedActions: ['Wait a few minutes before trying again', 'Reduce request frequency'],
          technicalDetails: `HTTP 429: ${responseData?.message || error.message}`,
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          title: 'Service Unavailable',
          message: 'The transcription service is temporarily unavailable. Please try again in a few minutes.',
          type: 'error',
          severity: 'high',
          shouldShowModal: false,
          shouldShowToast: true,
          retryable: true,
          suggestedActions: ['Try again in a few minutes', 'Check service status page'],
          technicalDetails: `HTTP ${status}: ${responseData?.message || error.message}`,
        };

      default:
        return {
          title: `${operation.charAt(0).toUpperCase() + operation.slice(1)} Failed`,
          message: `An unexpected error occurred (${status}). Please try again or contact support if the problem persists.`,
          type: 'error',
          severity: 'medium',
          shouldShowModal: false,
          shouldShowToast: true,
          retryable: true,
          technicalDetails: `HTTP ${status}: ${responseData?.message || error.message}`,
        };
    }
  }

  /**
   * Handle application-specific errors with custom codes
   */
  private static handleApplicationError(error: any, context?: string): ErrorInfo {
    const code = error.code;
    const message = error.message || '';
    const operation = context || 'operation';

    switch (code) {
      case 'NETWORK_ERROR':
      case 'CONNECTION_FAILED':
        return {
          title: 'Connection Failed',
          message: 'Unable to connect to the service. Please check your internet connection and try again.',
          type: 'error',
          severity: 'high',
          shouldShowModal: false,
          shouldShowToast: true,
          retryable: true,
          suggestedActions: ['Check your internet connection', 'Try again in a moment', 'Check firewall settings'],
          technicalDetails: `${code}: ${message}`,
        };

      case 'TIMEOUT':
        return {
          title: 'Request Timeout',
          message: 'The operation took too long to complete. This may be due to a large file or slow connection.',
          type: 'warning',
          severity: 'medium',
          shouldShowModal: false,
          shouldShowToast: true,
          retryable: true,
          suggestedActions: ['Try again with a smaller file', 'Check your connection speed', 'Try again later'],
          technicalDetails: `${code}: ${message}`,
        };

      case 'FILE_NOT_FOUND':
        return {
          title: 'File Not Found',
          message: 'The selected file could not be found or accessed. Please select a different file.',
          type: 'error',
          severity: 'medium',
          shouldShowModal: false,
          shouldShowToast: true,
          retryable: false,
          suggestedActions: ['Select a different file', 'Check file permissions', 'Ensure file still exists'],
          technicalDetails: `${code}: ${message}`,
        };

      case 'INVALID_API_KEY':
        return {
          title: 'Invalid API Key',
          message: 'The API key is missing or invalid. Please check your API settings.',
          type: 'error',
          severity: 'critical',
          shouldShowModal: true,
          shouldShowToast: false,
          retryable: false,
          suggestedActions: ['Go to API Settings', 'Enter a valid API key', 'Check key permissions'],
          technicalDetails: `${code}: ${message}`,
        };

      case 'PERMISSION_DENIED':
        return {
          title: 'Permission Denied',
          message: 'Unable to access the required resources. Please check file permissions.',
          type: 'error',
          severity: 'high',
          shouldShowModal: true,
          shouldShowToast: false,
          retryable: false,
          suggestedActions: ['Check file permissions', 'Run as administrator if needed', 'Try a different location'],
          technicalDetails: `${code}: ${message}`,
        };

      case 'TRANSCRIPTION_FAILED':
        return {
          title: 'Transcription Failed',
          message: 'Unable to transcribe the audio file. This may be due to poor audio quality or an unsupported format.',
          type: 'error',
          severity: 'medium',
          shouldShowModal: false,
          shouldShowToast: true,
          retryable: true,
          suggestedActions: ['Try with better quality audio', 'Convert to a common format', 'Check audio is not corrupted'],
          technicalDetails: `${code}: ${message}`,
        };

      default:
        return {
          title: `${operation.charAt(0).toUpperCase() + operation.slice(1)} Error`,
          message: message || 'An unexpected error occurred. Please try again.',
          type: 'error',
          severity: 'medium',
          shouldShowModal: false,
          shouldShowToast: true,
          retryable: true,
          technicalDetails: `${code}: ${message}`,
        };
    }
  }

  /**
   * Handle JavaScript Error objects
   */
  private static handleJavaScriptError(error: Error, context?: string): ErrorInfo {
    const operation = context || 'operation';

    // Check for specific error types
    if (error.name === 'TypeError') {
      return {
        title: 'Application Error',
        message: 'An internal error occurred. Please refresh the page and try again.',
        type: 'error',
        severity: 'high',
        shouldShowModal: false,
        shouldShowToast: true,
        retryable: true,
        suggestedActions: ['Refresh the page', 'Try again', 'Restart the application'],
        technicalDetails: `${error.name}: ${error.message}`,
      };
    }

    return {
      title: `${operation.charAt(0).toUpperCase() + operation.slice(1)} Failed`,
      message: 'An unexpected error occurred. Please try again or restart the application.',
      type: 'error',
      severity: 'medium',
      shouldShowModal: false,
      shouldShowToast: true,
      retryable: true,
      suggestedActions: ['Try again', 'Restart the application', 'Check console for details'],
      technicalDetails: `${error.name}: ${error.message}\n${error.stack}`,
    };
  }

  /**
   * Handle string error messages
   */
  private static handleStringError(error: string, context?: string): ErrorInfo {
    const operation = context || 'operation';

    return {
      title: `${operation.charAt(0).toUpperCase() + operation.slice(1)} Failed`,
      message: error || 'An error occurred. Please try again.',
      type: 'error',
      severity: 'medium',
      shouldShowModal: false,
      shouldShowToast: true,
      retryable: true,
      technicalDetails: error,
    };
  }

  /**
   * Handle unknown error formats
   */
  private static handleUnknownError(error: any, context?: string): ErrorInfo {
    const operation = context || 'operation';

    return {
      title: `${operation.charAt(0).toUpperCase() + operation.slice(1)} Failed`,
      message: 'An unexpected error occurred. Please try again or contact support.',
      type: 'error',
      severity: 'medium',
      shouldShowModal: false,
      shouldShowToast: true,
      retryable: true,
      technicalDetails: JSON.stringify(error, null, 2),
    };
  }

  /**
   * Helper method to determine if an error should block the UI
   */
  static isBlockingError(errorInfo: ErrorInfo): boolean {
    return errorInfo.severity === 'critical' || errorInfo.shouldShowModal;
  }

  /**
   * Helper method to get retry delay based on error type
   */
  static getRetryDelay(errorInfo: ErrorInfo): number {
    if (!errorInfo.retryable) return 0;

    switch (errorInfo.severity) {
      case 'low':
        return 1000; // 1 second
      case 'medium':
        return 3000; // 3 seconds
      case 'high':
        return 5000; // 5 seconds
      case 'critical':
        return 10000; // 10 seconds
      default:
        return 3000;
    }
  }
}

// ==================== Convenience Functions ====================

/**
 * Quick error processing for common scenarios
 */
export const handleApiError = (error: any, operation: string = 'API request') => {
  return ErrorHandler.processError(error, operation);
};

export const handleFileError = (error: any) => {
  return ErrorHandler.processError(error, 'file operation');
};

export const handleTranscriptionError = (error: any) => {
  return ErrorHandler.processError(error, 'transcription');
};

export const handleNetworkError = (error: any) => {
  return ErrorHandler.processError(error, 'network operation');
};