import React, { useState } from 'react';
import { Scissors, Plus, Play, Trash2, Copy } from 'lucide-react';
import { Clip } from '../TranscriptEdit/useClips';

interface ClipsPanelProps {
  clips: Clip[];
  selectedClipId?: string | null;
  onClipSelect?: (clipId: string) => void;
  onClipDelete?: (clipId: string) => void;
  onClipPlay?: (clip: Clip) => void;
  onClose: () => void;
}

const ClipsPanel: React.FC<ClipsPanelProps> = ({
  clips,
  selectedClipId,
  onClipSelect,
  onClipDelete,
  onClipPlay,
  onClose
}) => {
  // Removed editing state - no longer needed

  // Show all clips (both generated and user-created)
  const allClips = clips;
  const userClips = clips.filter(clip => clip.type === 'user-created');
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Removed edit handlers - no longer needed

  const handleCopyClip = (clip: Clip) => {
    navigator.clipboard.writeText(clip.text);
  };

  if (allClips.length === 0) {
    return (
      <div>
        <p className="text-sm text-white opacity-80 mb-3">
          No transcript loaded. Load a project to see clips.
        </p>
        <div className="text-xs text-white opacity-60 space-y-1">
          <p>• Speaker changes create automatic clips</p>
          <p>• Right-click words for options</p>
          <p>• Press Enter to split text into clips</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-white opacity-80 mb-3">
        {allClips.length} clip{allClips.length !== 1 ? 's' : ''}
      </p>
      
      <div className="space-y-3 flex-1 overflow-y-auto">
        {allClips.map((clip, index) => (
          <div 
            key={clip.id} 
            className={`
              border rounded-lg p-3 cursor-pointer
              ${clip.type === 'user-created' ? 'bg-green-900 bg-opacity-20 border-green-400 border-opacity-40' : 'bg-white bg-opacity-10 border-white border-opacity-20'}
              ${selectedClipId === clip.id ? 'bg-blue-900 bg-opacity-30 border-blue-400' : 'hover:bg-white hover:bg-opacity-15'}
            `}
            onClick={() => onClipSelect?.(clip.id)}
          >
            {/* Clip header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-300">
                  Clip {index + 1}
                </span>
                <span className="text-xs text-white opacity-70">
                  {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                </span>
                <span className="text-xs text-white opacity-50">
                  {formatTime(clip.duration)}
                </span>
              </div>
              
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClipPlay?.(clip);
                  }}
                  className="p-1 hover:bg-white hover:bg-opacity-20 rounded text-white opacity-70 hover:opacity-100"
                  title="Play clip"
                >
                  <Play size={12} />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyClip(clip);
                  }}
                  className="p-1 hover:bg-white hover:bg-opacity-20 rounded text-white opacity-70 hover:opacity-100"
                  title="Copy clip text"
                >
                  <Copy size={12} />
                </button>
                
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this clip?')) {
                      onClipDelete?.(clip.id);
                    }
                  }}
                  className="p-1 hover:bg-red-900 hover:bg-opacity-30 rounded text-red-400"
                  title="Delete clip"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            
            {/* Clip content */}
            <div className="text-sm">
              <div className="text-xs text-blue-300 font-medium mb-1">
                {clip.speaker}
              </div>
              
              <p className="text-white opacity-90">
                {clip.text.length > 100 ? `${clip.text.substring(0, 100)}...` : clip.text}
              </p>
            </div>
            
            {/* Clip metadata */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white border-opacity-20">
              <span className="text-xs text-white opacity-50">
                Created {new Date(clip.createdAt).toLocaleDateString()}
              </span>
              <span className="text-xs text-white opacity-50">
                {clip.words.length} words
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClipsPanel;