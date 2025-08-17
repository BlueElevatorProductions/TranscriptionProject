import React from 'react';
import { X, Cloud, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface GlassProgressOverlayProps {
  isVisible: boolean;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  fileName?: string;
  provider?: string;
  onCancel?: () => void;
  onClose?: () => void;
  error?: string;
}

export const GlassProgressOverlay: React.FC<GlassProgressOverlayProps> = ({
  isVisible,
  progress,
  status,
  message = 'Processing...',
  fileName,
  provider,
  onCancel,
  onClose,
  error
}) => {
  if (!isVisible) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />;
      default:
        return <Cloud className="w-8 h-8 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'border-green-500 bg-green-50/90';
      case 'error':
        return 'border-red-500 bg-red-50/90';
      case 'processing':
        return 'border-blue-500 bg-blue-50/90';
      default:
        return 'border-gray-500 bg-gray-50/90';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div 
        className={`
          relative mx-4 w-full max-w-md rounded-xl border-2 
          ${getStatusColor()}
          backdrop-blur-md p-6 shadow-2xl
        `}
      >
        {/* Close button - only show if completed or error */}
        {(status === 'completed' || status === 'error') && onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Status icon and header */}
        <div className="flex flex-col items-center text-center mb-6">
          {getStatusIcon()}
          
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            {status === 'completed' ? 'Transcription Complete!' :
             status === 'error' ? 'Transcription Failed' :
             status === 'processing' ? 'Transcribing Audio...' :
             'Preparing Transcription...'}
          </h3>
          
          {fileName && (
            <p className="text-sm text-gray-600 mt-1 truncate max-w-full">
              {fileName}
            </p>
          )}
          
          {provider && (
            <div className="flex items-center gap-2 mt-2">
              <Cloud className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500 uppercase tracking-wide">
                {provider} API
              </span>
            </div>
          )}
        </div>

        {/* Progress bar - only show when processing */}
        {status === 'processing' && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}

        {/* Status message */}
        <div className="text-center mb-6">
          {status === 'error' && error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800 font-medium mb-1">Error Details:</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">{message}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-center">
          {status === 'processing' && onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white/70 hover:bg-white/90 border border-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          
          {status === 'completed' && onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              Continue
            </button>
          )}
          
          {status === 'error' && (
            <div className="flex gap-2">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white/70 hover:bg-white/90 border border-gray-300 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          )}
        </div>

        {/* Helpful tips for different states */}
        {status === 'processing' && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              This may take a few minutes depending on file size and internet connection.
            </p>
          </div>
        )}
        
        {status === 'completed' && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Your transcript is ready! You can now edit speakers, create clips, and export your work.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlassProgressOverlay;