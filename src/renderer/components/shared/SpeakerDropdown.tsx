/**
 * SpeakerDropdown.tsx - Styled dropdown for speaker selection and clip operations
 * 
 * Features:
 * - Speaker name selection from project speakers
 * - Merge with clip above/below
 * - Delete clip functionality
 * - Dark theme styling matching macOS design patterns
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, User, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import './SpeakerDropdown.css';

interface Speaker {
  id: string;
  name: string;
}

interface SpeakerDropdownProps {
  // Current speaker
  currentSpeakerId: string;
  displayName: string;
  
  // Available speakers from the speakers panel
  availableSpeakers: Speaker[];
  
  // Clip position info for merge operations
  clipIndex: number;
  totalClips: number;
  
  // Event handlers
  onSpeakerChange: (speakerId: string) => void;
  onMergeAbove?: () => void;
  onMergeBelow?: () => void;
  onDeleteClip?: () => void;
  
  // UI state
  disabled?: boolean;
}

export const SpeakerDropdown: React.FC<SpeakerDropdownProps> = ({
  currentSpeakerId,
  displayName,
  availableSpeakers,
  clipIndex,
  totalClips,
  onSpeakerChange,
  onMergeAbove,
  onMergeBelow,
  onDeleteClip,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleToggleDropdown = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  }, [disabled]);

  const handleSpeakerSelect = useCallback((speakerId: string) => {
    onSpeakerChange(speakerId);
    setIsOpen(false);
  }, [onSpeakerChange]);

  const handleMergeAbove = useCallback(() => {
    onMergeAbove?.();
    setIsOpen(false);
  }, [onMergeAbove]);

  const handleMergeBelow = useCallback(() => {
    onMergeBelow?.();
    setIsOpen(false);
  }, [onMergeBelow]);

  const handleDeleteClip = useCallback(() => {
    onDeleteClip?.();
    setIsOpen(false);
  }, [onDeleteClip]);

  const canMergeAbove = clipIndex > 0;
  const canMergeBelow = clipIndex < totalClips - 1;

  return (
    <div className="speaker-dropdown-container" ref={dropdownRef}>
      <button
        className={`speaker-dropdown-button ${isOpen ? 'open' : ''}`}
        onClick={handleToggleDropdown}
        disabled={disabled}
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Speaker selection: ${displayName}`}
      >
        <span className="speaker-dropdown-name">{displayName}</span>
        <ChevronLeft 
          className={`speaker-dropdown-arrow ${isOpen ? 'open' : ''}`}
          size={14}
        />
      </button>

      {isOpen && (
        <div className="speaker-dropdown-menu" ref={menuRef}>
          {/* Speaker Selection Section */}
          {availableSpeakers.length > 0 && (
            <div className="speaker-dropdown-section">
              {availableSpeakers.map((speaker) => (
                <button
                  key={speaker.id}
                  className={`speaker-dropdown-item ${
                    speaker.id === currentSpeakerId ? 'selected' : ''
                  }`}
                  onClick={() => handleSpeakerSelect(speaker.id)}
                  type="button"
                >
                  <User className="speaker-dropdown-icon" size={16} />
                  <span>{speaker.name}</span>
                  {speaker.id === currentSpeakerId && (
                    <span className="speaker-dropdown-checkmark">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Clip Operations Section */}
          <div className="speaker-dropdown-section">
            <button
              className={`speaker-dropdown-item ${!canMergeAbove ? 'disabled' : ''}`}
              onClick={canMergeAbove ? handleMergeAbove : undefined}
              disabled={!canMergeAbove}
              type="button"
              title={canMergeAbove ? 'Merge with clip above' : 'No clip above to merge with'}
            >
              <ArrowUp className="speaker-dropdown-icon" size={16} />
              <span>Merge with clip above</span>
            </button>
            
            <button
              className={`speaker-dropdown-item ${!canMergeBelow ? 'disabled' : ''}`}
              onClick={canMergeBelow ? handleMergeBelow : undefined}
              disabled={!canMergeBelow}
              type="button"
              title={canMergeBelow ? 'Merge with clip below' : 'No clip below to merge with'}
            >
              <ArrowDown className="speaker-dropdown-icon" size={16} />
              <span>Merge with clip below</span>
            </button>
          </div>

          {/* Delete Section */}
          <div className="speaker-dropdown-section">
            <button
              className="speaker-dropdown-item destructive"
              onClick={handleDeleteClip}
              type="button"
              title="Delete this clip"
            >
              <Trash2 className="speaker-dropdown-icon" size={16} />
              <span>Delete clip</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpeakerDropdown;