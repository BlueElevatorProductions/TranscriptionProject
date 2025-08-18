import React, { useState, useEffect, useRef } from "react";

export type Speaker = { id: string; name: string };

export type SpeakersPanelProps = {
  initial: Speaker[];
  onChange?: (next: Speaker[]) => void;
  onClose: () => void;
};

const SpeakersPanel: React.FC<SpeakersPanelProps> = ({ initial, onChange, onClose }) => {
  const [speakers, setSpeakers] = useState<Speaker[]>(initial || []);
  const hasLocalChanges = useRef(false);
  
  // Update local state when initial prop changes, but only if we don't have uncommitted local changes
  useEffect(() => {
    const newSpeakers = initial || [];
    
    // Don't overwrite local changes that haven't been committed yet
    if (!hasLocalChanges.current) {
      setSpeakers(newSpeakers);
    }
  }, [initial]);

  const commit = (next: Speaker[]) => {
    setSpeakers(next);
    onChange?.(next);
    hasLocalChanges.current = false; // Clear the flag after committing
  };

  const update = (id: string, name: string) => {
    hasLocalChanges.current = true; // Mark that we have local changes
    const updatedSpeakers = speakers.map(s => (s.id === id ? { ...s, name } : s));
    setSpeakers(updatedSpeakers); // Update local state immediately
    onChange?.(updatedSpeakers); // Also commit immediately
    hasLocalChanges.current = false; // Clear flag since we committed
  };

  // Add a new speaker with a proper SPEAKER_XX ID format
  const add = () => {
    
    // Find the next available SPEAKER_XX ID
    const existingNumbers = speakers
      .map(s => s.id.match(/SPEAKER_(\d+)/)?.[1])
      .filter(n => n !== undefined)
      .map(n => parseInt(n!));
    
    const nextNumber = existingNumbers.length > 0 
      ? Math.max(...existingNumbers) + 1 
      : speakers.length;
    
    const newSpeakerId = `SPEAKER_${nextNumber.toString().padStart(2, '0')}`;
    const newSpeaker = {
      id: newSpeakerId,
      name: `Speaker ${nextNumber + 1}`
    };
    
    const updatedSpeakers = [...speakers, newSpeaker];
    commit(updatedSpeakers);
  };

  
  return (
    <div>
      <p className="text-sm text-white opacity-80 mb-3">
        Edit speaker names. Changes apply immediately.
      </p>
      <div className="space-y-3">
        {speakers.length === 0 && (
          <div className="text-sm text-white opacity-60 p-4 text-center">
            No speakers found. Click "Add speaker" to create one.
          </div>
        )}
        {speakers.map((s, i) => {
          return (
          <div key={s.id} className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-3 flex items-center gap-3">
            <span className="text-sm text-white opacity-70 min-w-[5.5rem]">Speaker {i + 1}:</span>
            <input
              value={s.name}
              onChange={(e) => update(s.id, e.target.value)}
              className="flex-1 rounded-md border border-white border-opacity-20 bg-white bg-opacity-10 text-white px-2 py-1 placeholder-white placeholder-opacity-50"
            />
          </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-4">
        <button className="rounded px-3 py-1.5 bg-white bg-opacity-20 text-white hover:bg-opacity-30" onClick={add}>
          Add speaker
        </button>
      </div>
    </div>
  );
};

export default SpeakersPanel;
