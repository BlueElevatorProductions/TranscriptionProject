/**
 * NewLayoutView.tsx - Test view for the new Google Docs-inspired layout
 * 
 * This view demonstrates the new layout system and can be toggled
 * alongside the existing interface for comparison during development.
 */

import React, { useState, useCallback } from 'react';
import { MainLayout } from '../components/Layout';
import { useLayoutKeyboard } from '../hooks/useLayoutKeyboard';
import type { AppMode, AudioSliderType } from '../components/Layout/HeaderRegion';

export interface NewLayoutViewProps {
  onBack?: () => void;
}

const NewLayoutView: React.FC<NewLayoutViewProps> = ({ onBack }) => {
  // Layout state
  const [currentMode, setCurrentMode] = useState<AppMode>('listen');
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [audioSliderVisible, setAudioSliderVisible] = useState(true);
  const [activeAudioSlider, setActiveAudioSlider] = useState<AudioSliderType>('player');

  // Layout control handlers
  const togglePanels = useCallback(() => {
    setPanelsVisible(prev => !prev);
  }, []);

  const toggleAudioSlider = useCallback((type?: AudioSliderType) => {
    if (type && activeAudioSlider === type) {
      // If clicking the same slider, close it
      setAudioSliderVisible(false);
      setActiveAudioSlider(null);
    } else if (type) {
      // Switch to new slider type
      setAudioSliderVisible(true);
      setActiveAudioSlider(type);
    } else {
      // Toggle current slider
      setAudioSliderVisible(prev => !prev);
    }
  }, [activeAudioSlider]);

  const handleModeChange = useCallback((mode: AppMode) => {
    setCurrentMode(mode);
    console.log(`Switched to ${mode} mode`);
  }, []);

  // Keyboard shortcuts
  useLayoutKeyboard({
    onTogglePanels: togglePanels,
    onTogglePlayer: () => toggleAudioSlider('player'),
    onToggleEditor: () => toggleAudioSlider('editor'),
    onSwitchToListen: () => handleModeChange('listen'),
    onSwitchToEdit: () => handleModeChange('edit'),
  });

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
    }}>
      {/* Optional back button for testing */}
      {onBack && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 1000,
        }}>
          <button
            onClick={onBack}
            style={{
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px',
            }}
          >
            ← Back to Current UI
          </button>
        </div>
      )}

      {/* Status indicator */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        zIndex: 1000,
        fontFamily: 'monospace',
      }}>
        Mode: {currentMode} | Panels: {panelsVisible ? 'ON' : 'OFF'} | Audio: {activeAudioSlider || 'OFF'}
      </div>

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '12px',
        borderRadius: '6px',
        fontSize: '11px',
        maxWidth: '300px',
        zIndex: 1000,
        fontFamily: 'monospace',
        lineHeight: '1.4',
      }}>
        <strong>Keyboard Shortcuts:</strong><br />
        P - Toggle panels<br />
        Shift+P - Toggle player<br />
        Shift+E - Toggle editor<br />
        1 - Listen mode<br />
        2 - Edit mode
      </div>

      {/* Main Layout */}
      <MainLayout
        legacyMode={false}
      />
    </div>
  );
};

export default NewLayoutView;