/**
 * AudioFileErrorScreen - User-friendly error screen for missing audio files
 */

import React from 'react';
import { AlertCircle, FileX, FolderOpen, Settings } from 'lucide-react';

interface AudioFileErrorScreenProps {
  projectName?: string;
  expectedAudioPath?: string;
  onContinueWithoutAudio?: () => void;
  onRetry?: () => void;
}

export const AudioFileErrorScreen: React.FC<AudioFileErrorScreenProps> = ({
  projectName = 'this project',
  expectedAudioPath = '',
  onContinueWithoutAudio,
  onRetry
}) => {
  const getExpectedDirectory = () => {
    if (expectedAudioPath) {
      const parts = expectedAudioPath.split('/');
      return parts.slice(0, -1).join('/');
    }
    return '';
  };

  const getFileName = () => {
    if (expectedAudioPath) {
      const parts = expectedAudioPath.split('/');
      return parts[parts.length - 1];
    }
    return '';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="flex items-center mb-6">
          <div className="flex-shrink-0">
            <AlertCircle className="h-12 w-12 text-amber-500" />
          </div>
          <div className="ml-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Audio File Not Found
            </h1>
            <p className="text-gray-600">
              The audio file for {projectName} is missing or has been moved.
            </p>
          </div>
        </div>

        {/* Problem Description */}
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6">
          <div className="flex items-start">
            <FileX className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-amber-800 mb-1">
                Missing Audio File
              </h3>
              <div className="text-sm text-amber-700">
                <p className="mb-2">The application is looking for:</p>
                <code className="block bg-amber-100 p-2 rounded text-xs break-all">
                  {expectedAudioPath || 'Audio file path not available'}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Solutions */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">
            How to resolve this:
          </h2>

          {/* Option 1: Locate and restore file */}
          <div className="border border-gray-200 rounded-md p-4">
            <div className="flex items-start">
              <FolderOpen className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Option 1: Restore the audio file
                </h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>If you have the audio file somewhere else:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    <li>Locate the audio file: <code className="text-xs bg-gray-100 px-1 rounded">{getFileName()}</code></li>
                    <li>Copy it to the expected directory: <code className="text-xs bg-gray-100 px-1 rounded break-all">{getExpectedDirectory()}</code></li>
                    <li>Click "Retry Loading" below</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Option 2: Continue without audio */}
          <div className="border border-gray-200 rounded-md p-4">
            <div className="flex items-start">
              <Settings className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Option 2: Continue without audio
                </h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>You can still work with the transcript:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Edit transcript text and speaker assignments</li>
                    <li>Organize and merge clips</li>
                    <li>Export the final transcript</li>
                  </ul>
                  <p className="text-amber-600 font-medium">
                    Note: Audio playback and synchronization will not be available.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button
            onClick={onRetry}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            Retry Loading
          </button>
          <button
            onClick={onContinueWithoutAudio}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Continue Without Audio
          </button>
        </div>

        {/* Technical Details (Collapsible) */}
        <details className="mt-6">
          <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
            Technical Details
          </summary>
          <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-600">
            <p><strong>Project:</strong> {projectName}</p>
            <p><strong>Expected Path:</strong> {expectedAudioPath}</p>
            <p><strong>Error:</strong> Failed to open audio file</p>
          </div>
        </details>
      </div>
    </div>
  );
};

export default AudioFileErrorScreen;