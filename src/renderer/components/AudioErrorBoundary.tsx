/**
 * AudioErrorBoundary.tsx - Error boundary for audio-related failures
 * 
 * Catches audio errors and provides recovery options
 */

import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Volume2, VolumeX } from 'lucide-react';

interface AudioErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorType: 'audio' | 'timeline' | 'general';
  attemptedRecovery: boolean;
}

interface AudioErrorBoundaryProps {
  children: ReactNode;
  onRecoveryAttempt?: () => void;
  fallbackComponent?: ReactNode;
}

export class AudioErrorBoundary extends Component<AudioErrorBoundaryProps, AudioErrorBoundaryState> {
  private recoveryAttempts = 0;
  private maxRecoveryAttempts = 3;

  constructor(props: AudioErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: 'general',
      attemptedRecovery: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AudioErrorBoundaryState> {
    const errorType = AudioErrorBoundary.categorizeError(error);
    
    return {
      hasError: true,
      error,
      errorType,
      attemptedRecovery: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error for debugging
    console.error('AudioErrorBoundary caught error:', error);
    console.error('Error info:', errorInfo);
    console.error('Component stack:', errorInfo.componentStack);

    // Attempt automatic recovery for certain error types
    if (this.canAttemptRecovery(error) && this.recoveryAttempts < this.maxRecoveryAttempts) {
      this.attemptRecovery(error);
    }
  }

  private static categorizeError(error: Error): 'audio' | 'timeline' | 'general' {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (
      message.includes('audio') ||
      message.includes('media') ||
      message.includes('playback') ||
      stack.includes('audiomanager') ||
      stack.includes('audioeditor')
    ) {
      return 'audio';
    }

    if (
      message.includes('timeline') ||
      message.includes('clip') ||
      message.includes('sequencer') ||
      stack.includes('timeline') ||
      stack.includes('clip')
    ) {
      return 'timeline';
    }

    return 'general';
  }

  private canAttemptRecovery(error: Error): boolean {
    const { errorType } = this.state;
    
    // Only attempt recovery for specific error types
    return errorType === 'audio' || errorType === 'timeline';
  }

  private attemptRecovery = (error: Error) => {
    this.recoveryAttempts++;
    this.setState({ attemptedRecovery: true });

    // Give some time for cleanup, then try recovery
    setTimeout(() => {
      try {
        this.performRecovery(error);
      } catch (recoveryError) {
        console.error('Recovery attempt failed:', recoveryError);
      }
    }, 1000);
  };

  private performRecovery(error: Error) {
    const { errorType } = this.state;
    
    switch (errorType) {
      case 'audio':
        this.recoverAudioSystem();
        break;
      case 'timeline':
        this.recoverTimelineSystem();
        break;
      default:
        this.performGeneralRecovery();
        break;
    }
  }

  private recoverAudioSystem() {
    // Try to reset audio state
    try {
      // Clear any existing audio elements
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        audio.pause();
        audio.src = '';
      });

      // Notify parent component to attempt recovery
      this.props.onRecoveryAttempt?.();

      // Reset error state if recovery might have worked
      setTimeout(() => {
        this.resetError();
      }, 2000);

    } catch (recoveryError) {
      console.error('Audio recovery failed:', recoveryError);
    }
  }

  private recoverTimelineSystem() {
    try {
      // Clear any cached timeline data
      localStorage.removeItem('audioTimeline');
      sessionStorage.removeItem('timelineState');

      this.props.onRecoveryAttempt?.();

      setTimeout(() => {
        this.resetError();
      }, 1500);

    } catch (recoveryError) {
      console.error('Timeline recovery failed:', recoveryError);
    }
  }

  private performGeneralRecovery() {
    try {
      this.props.onRecoveryAttempt?.();
      
      setTimeout(() => {
        this.resetError();
      }, 1000);

    } catch (recoveryError) {
      console.error('General recovery failed:', recoveryError);
    }
  }

  private resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      attemptedRecovery: false,
    });
  };

  private handleManualRestart = () => {
    // Force page reload as last resort
    window.location.reload();
  };

  private getErrorIcon() {
    const { errorType } = this.state;
    
    switch (errorType) {
      case 'audio':
        return <VolumeX size={48} className="text-red-500" />;
      case 'timeline':
        return <RefreshCw size={48} className="text-yellow-500" />;
      default:
        return <AlertCircle size={48} className="text-red-500" />;
    }
  }

  private getErrorTitle() {
    const { errorType } = this.state;
    
    switch (errorType) {
      case 'audio':
        return 'Audio System Error';
      case 'timeline':
        return 'Timeline Error';
      default:
        return 'Application Error';
    }
  }

  private getErrorMessage() {
    const { error, errorType, attemptedRecovery } = this.state;
    
    if (attemptedRecovery) {
      return 'Attempting to recover from the error. Please wait...';
    }

    switch (errorType) {
      case 'audio':
        return 'The audio system encountered an error. This might be due to audio file issues, playback problems, or browser audio limitations.';
      case 'timeline':
        return 'The timeline system encountered an error. This might be due to corrupted clip data or timeline calculation issues.';
      default:
        return `An unexpected error occurred: ${error?.message || 'Unknown error'}`;
    }
  }

  render() {
    if (this.state.hasError) {
      // Show custom fallback if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      // Show recovery screen
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex flex-col items-center text-center">
              {this.getErrorIcon()}
              
              <h2 className="text-2xl font-bold text-gray-900 mt-4">
                {this.getErrorTitle()}
              </h2>
              
              <p className="text-gray-600 mt-4 text-sm leading-relaxed">
                {this.getErrorMessage()}
              </p>

              {this.state.attemptedRecovery && (
                <div className="mt-4 flex items-center text-blue-600">
                  <RefreshCw className="animate-spin mr-2" size={16} />
                  <span className="text-sm">Recovering...</span>
                </div>
              )}

              {!this.state.attemptedRecovery && (
                <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full">
                  <button
                    onClick={this.resetError}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                  >
                    Try Again
                  </button>
                  
                  <button
                    onClick={this.handleManualRestart}
                    className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                  >
                    Restart App
                  </button>
                </div>
              )}

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-6 w-full text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40 text-gray-800">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}