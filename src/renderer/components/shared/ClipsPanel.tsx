import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Scissors, Plus, Play, Trash2, Copy, GripVertical } from 'lucide-react';
import { Clip } from '../../../shared/types';

interface ClipsPanelProps {
  clips: Clip[];
  selectedClipId?: string | null;
  onClipSelect?: (clipId: string) => void;
  onClipDelete?: (clipId: string) => Promise<boolean>;
  onClipPlay?: (clip: Clip) => void;
  onClipMerge?: (clipIds: string[]) => Promise<boolean>;
  onClipReorder?: (clipId: string, newOrder: number) => Promise<boolean>;
  onClose: () => void;
}

const ClipsPanel: React.FC<ClipsPanelProps> = ({
  clips,
  selectedClipId,
  onClipSelect,
  onClipDelete,
  onClipPlay,
  onClipMerge,
  onClipReorder,
  onClose
}) => {
  // Multi-select state
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipIds: string[] } | null>(null);
  
  // Drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Panel ref for click-outside detection
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle click outside to deselect clips
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setSelectedClipIds(new Set());
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show all clips in v2.0 - no 'audio-only' or 'status' fields
  const allClips = clips || [];
  const userClips = clips.filter(clip => clip.type === 'user-created');

  // Handle clip selection with multi-select support
  const handleClipClick = useCallback((clipId: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd click - toggle selection
      setSelectedClipIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(clipId)) {
          newSet.delete(clipId);
        } else {
          newSet.add(clipId);
        }
        return newSet;
      });
    } else if (event.shiftKey && selectedClipIds.size > 0) {
      // Shift click - select range
      const clipIds = allClips.map(c => c.id);
      const lastSelected = Array.from(selectedClipIds).pop();
      if (lastSelected) {
        const startIndex = clipIds.indexOf(lastSelected);
        const endIndex = clipIds.indexOf(clipId);
        const [minIndex, maxIndex] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
        
        const rangeIds = clipIds.slice(minIndex, maxIndex + 1);
        setSelectedClipIds(new Set(rangeIds));
      }
    } else {
      // Regular click - single selection
      setSelectedClipIds(new Set([clipId]));
      onClipSelect?.(clipId);
    }
  }, [selectedClipIds, allClips, onClipSelect]);

  // Handle right-click context menu
  const handleContextMenu = useCallback((event: React.MouseEvent, clipId: string) => {
    event.preventDefault();
    
    let clipIds: string[];
    if (selectedClipIds.has(clipId)) {
      // Right-clicked on selected clip - use all selected
      clipIds = Array.from(selectedClipIds);
    } else {
      // Right-clicked on unselected clip - just this clip
      clipIds = [clipId];
      setSelectedClipIds(new Set([clipId]));
    }

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      clipIds
    });
  }, [selectedClipIds]);

  // Handle merge action
  const handleMerge = useCallback(() => {
    if (contextMenu && contextMenu.clipIds.length >= 2) {
      onClipMerge?.(contextMenu.clipIds);
      setSelectedClipIds(new Set());
    }
    setContextMenu(null);
  }, [contextMenu, onClipMerge]);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', allClips[index].id);
  }, [allClips]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex && onClipReorder) {
      const clipId = allClips[draggedIndex].id;
      await onClipReorder(clipId, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, onClipReorder, allClips]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Removed edit handlers - no longer needed

  // Helper function to extract text from v2.0 segments
  const getClipText = (clip: Clip): string => {
    return clip.segments
      .filter(segment => segment.type === 'word')
      .map(segment => segment.text)
      .join(' ')
      .trim();
  };

  const handleCopyClip = (clip: Clip) => {
    navigator.clipboard.writeText(getClipText(clip));
  };

  if (allClips.length === 0) {
    return (
      <div>
        <p className="text-sm opacity-80 mb-3" style={{ color: 'hsl(var(--text))' }}>
          No transcript loaded. Load a project to see clips.
        </p>
        <div className="text-xs opacity-60 space-y-1" style={{ color: 'hsl(var(--text))' }}>
          <p>• Speaker changes create automatic clips</p>
          <p>• Right-click words for options</p>
          <p>• Press Enter to split text into clips</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef}>
      <p className="text-sm opacity-80 mb-3" style={{ color: 'hsl(var(--text))' }}>
        {allClips.length} clip{allClips.length !== 1 ? 's' : ''}
      </p>
      
      <div className="space-y-3 flex-1 overflow-y-auto">
        {allClips.map((clip, index) => {
          const isSelected = selectedClipIds.has(clip.id);
          const isActive = selectedClipId === clip.id;
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;
          
          return (
          <div 
            key={clip.id} 
            className={`
              border rounded-lg p-3 cursor-pointer transition-colors relative
              ${clip.type === 'user-created' ? 'bg-green-900 bg-opacity-20 border-green-400 border-opacity-40' : 'bg-white bg-opacity-10 border-white border-opacity-20'}
              ${isSelected ? 'bg-purple-900 bg-opacity-40 border-purple-400' : 
                isActive ? 'bg-blue-900 bg-opacity-30 border-blue-400' : 
                'hover:bg-white hover:bg-opacity-15'}
              ${isDragging ? 'opacity-50' : ''}
              ${isDragOver ? 'border-blue-500 border-2' : ''}
            `}
            draggable={true}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={(e) => handleClipClick(clip.id, e)}
            onContextMenu={(e) => handleContextMenu(e, clip.id)}
          >
            {/* Clip header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <GripVertical 
                  size={12} 
                  className="opacity-40 hover:opacity-70 cursor-grab active:cursor-grabbing"
                  style={{ color: 'hsl(var(--text))' }}
                  title="Drag to reorder"
                />
                <span className="text-xs font-medium opacity-70" style={{ color: 'hsl(var(--text))' }}>
                  Clip {index + 1}
                </span>
                <span className="text-xs opacity-70" style={{ color: 'hsl(var(--text))' }}>
                  {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                </span>
                <span className="text-xs opacity-50" style={{ color: 'hsl(var(--text))' }}>
                  {formatTime(clip.duration)}
                </span>
              </div>
              
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClipPlay?.(clip);
                  }}
                  className="p-1 hover:bg-white hover:bg-opacity-20 rounded opacity-70 hover:opacity-100"
                  style={{ color: 'hsl(var(--text))' }}
                  title="Play clip"
                >
                  <Play size={12} />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyClip(clip);
                  }}
                  className="p-1 hover:bg-white hover:bg-opacity-20 rounded opacity-70 hover:opacity-100"
                  style={{ color: 'hsl(var(--text))' }}
                  title="Copy clip text"
                >
                  <Copy size={12} />
                </button>
                
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClipDelete?.(clip.id);
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
              
              <p className="opacity-90" style={{ color: 'hsl(var(--text))' }}>
                {(() => {
                  const text = getClipText(clip);
                  return text.length > 100 ? `${text.substring(0, 100)}...` : text;
                })()}
              </p>
            </div>
            
            {/* Clip metadata */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white border-opacity-20">
              <span className="text-xs text-white opacity-50">
                Created {new Date(clip.createdAt).toLocaleDateString()}
              </span>
              <span className="text-xs text-white opacity-50">
                {clip.segments.filter(s => s.type === 'word').length} words
              </span>
            </div>
          </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={closeContextMenu}
          />
          <div
            className="fixed z-50 bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1 min-w-48"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.clipIds.length >= 2 && (
              <button
                onClick={handleMerge}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center gap-2"
                style={{ color: 'hsl(var(--text))' }}
              >
                <Scissors size={14} />
                Merge {contextMenu.clipIds.length} Clips
              </button>
            )}
            <button
              onClick={() => {
                if (contextMenu.clipIds.length === 1 && onClipDelete) {
                  onClipDelete(contextMenu.clipIds[0]);
                }
                closeContextMenu();
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
            >
              <Trash2 size={14} />
              Delete Clip{contextMenu.clipIds.length > 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ClipsPanel;