import React, { useState } from 'react';
import { Scissors, Plus, Play, Trash2, Edit, Copy } from 'lucide-react';
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
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Show all clips (both generated and user-created)
  const allClips = clips;
  const userClips = clips.filter(clip => clip.type === 'user-created');
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEditStart = (clip: Clip) => {
    setEditingClipId(clip.id);
    setEditText(clip.text);
  };

  const handleEditSave = () => {
    // TODO: Implement clip text editing
    setEditingClipId(null);
    setEditText('');
  };

  const handleCopyClip = (clip: Clip) => {
    navigator.clipboard.writeText(clip.text);
  };

  if (allClips.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500 mb-3">
          No transcript loaded. Load a project to see clips.
        </p>
        <div className="text-xs text-gray-400 space-y-1">
          <p>• Speaker changes create automatic clips</p>
          <p>• Right-click words for options</p>
          <p>• Press Enter to split text into clips</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">
        {allClips.length} clip{allClips.length !== 1 ? 's' : ''} total
        {userClips.length > 0 && ` (${userClips.length} user-created)`}
      </p>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {allClips.map((clip, index) => (
          <div 
            key={clip.id} 
            className={`
              border rounded-lg p-3 cursor-pointer
              ${clip.type === 'user-created' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}
              ${selectedClipId === clip.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}
            `}
            onClick={() => onClipSelect?.(clip.id)}
          >
            {/* Clip header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-600">
                  Clip {index + 1}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                </span>
                <span className="text-xs text-gray-400">
                  {formatTime(clip.duration)}
                </span>
              </div>
              
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClipPlay?.(clip);
                  }}
                  className="p-1 hover:bg-gray-200 rounded text-gray-600"
                  title="Play clip"
                >
                  <Play size={12} />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyClip(clip);
                  }}
                  className="p-1 hover:bg-gray-200 rounded text-gray-600"
                  title="Copy clip text"
                >
                  <Copy size={12} />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditStart(clip);
                  }}
                  className="p-1 hover:bg-gray-200 rounded text-gray-600"
                  title="Edit clip"
                >
                  <Edit size={12} />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this clip?')) {
                      onClipDelete?.(clip.id);
                    }
                  }}
                  className="p-1 hover:bg-red-200 rounded text-red-600"
                  title="Delete clip"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            
            {/* Clip content */}
            <div className="text-sm">
              <div className="text-xs text-blue-600 font-medium mb-1">
                {clip.speaker}
              </div>
              
              {editingClipId === clip.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded p-2 resize-none"
                    rows={3}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSave();
                      }}
                      className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingClipId(null);
                        setEditText('');
                      }}
                      className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700">
                  {clip.text.length > 100 ? `${clip.text.substring(0, 100)}...` : clip.text}
                </p>
              )}
            </div>
            
            {/* Clip metadata */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
              <span className="text-xs text-gray-400">
                Created {new Date(clip.createdAt).toLocaleDateString()}
              </span>
              <span className="text-xs text-gray-400">
                {clip.words.length} words
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200">
        <button 
          className="rounded px-3 py-1.5 hover:bg-gray-100 text-sm"
          onClick={onClose}
        >
          Done
        </button>
        <span className="text-xs text-gray-500">
          Create clips by pressing Enter or using right-click menu in Edit mode
        </span>
      </div>
    </div>
  );
};

export default ClipsPanel;