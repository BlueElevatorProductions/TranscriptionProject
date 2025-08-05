/**
 * MainLayout.tsx - New Google Docs-inspired layout with 4 regions
 * 
 * Layout Structure:
 * ┌─────────────────────────────────────────┐
 * │              HeaderRegion               │
 * ├─────────────────────────┬───────────────┤
 * │                         │               │
 * │    TranscriptRegion     │ PanelsRegion  │
 * │                         │               │
 * ├─────────────────────────┴───────────────┤
 * │              AudioRegion                │
 * └─────────────────────────────────────────┘
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

// Region components
import HeaderRegion from './HeaderRegion';
import TranscriptRegion from './TranscriptRegion';
import PanelsRegion from './PanelsRegion';
import AudioRegion from './AudioRegion';

export interface LayoutState {
  panelsVisible: boolean;
  audioSliderVisible: boolean;
  activeAudioSlider: 'player' | 'editor' | null;
  panelsWidth: number;
  audioHeight: number;
}

export interface MainLayoutProps {
  children?: React.ReactNode;
  // Optional props for gradual migration
  legacyMode?: boolean;
  // Mode state
  currentMode?: 'listen' | 'edit';
  onModeChange?: (mode: 'listen' | 'edit') => void;
  // Expose control functions for external keyboard shortcuts
  onLayoutReady?: (controls: {
    togglePanels: () => void;
    toggleAudioSlider: (type?: 'player' | 'editor') => void;
  }) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, 
  legacyMode = false,
  currentMode = 'listen',
  onModeChange,
  onLayoutReady
}) => {
  // Layout state
  const [layoutState, setLayoutState] = useState<LayoutState>({
    panelsVisible: true,
    audioSliderVisible: true,
    activeAudioSlider: 'player',
    panelsWidth: 300,
    audioHeight: 120,
  });

  // Layout control handlers
  const togglePanels = useCallback(() => {
    setLayoutState(prev => ({
      ...prev,
      panelsVisible: !prev.panelsVisible
    }));
  }, []);

  const toggleAudioSlider = useCallback((type?: 'player' | 'editor') => {
    setLayoutState(prev => {
      if (type && prev.activeAudioSlider === type) {
        // If clicking the same slider, close it
        return {
          ...prev,
          audioSliderVisible: false,
          activeAudioSlider: null
        };
      } else if (type) {
        // Switch to new slider type
        return {
          ...prev,
          audioSliderVisible: true,
          activeAudioSlider: type
        };
      } else {
        // Toggle current slider
        return {
          ...prev,
          audioSliderVisible: !prev.audioSliderVisible
        };
      }
    });
  }, []);

  const updatePanelsWidth = useCallback((width: number) => {
    setLayoutState(prev => ({
      ...prev,
      panelsWidth: Math.max(250, Math.min(500, width))
    }));
  }, []);

  const updateAudioHeight = useCallback((height: number) => {
    setLayoutState(prev => ({
      ...prev,
      audioHeight: Math.max(80, Math.min(300, height))
    }));
  }, []);

  // Expose control functions to parent component
  React.useEffect(() => {
    if (onLayoutReady) {
      onLayoutReady({
        togglePanels,
        toggleAudioSlider,
      });
    }
  }, [onLayoutReady, togglePanels, toggleAudioSlider]);

  // If in legacy mode, render children as-is for backwards compatibility
  if (legacyMode) {
    return <div className="w-full h-screen flex flex-col">{children}</div>;
  }

  // CSS custom properties for dynamic layout
  const layoutStyles = {
    '--panels-width': layoutState.panelsVisible ? `${layoutState.panelsWidth}px` : '0px',
    '--audio-height': layoutState.audioSliderVisible ? `${layoutState.audioHeight}px` : '0px',
  } as React.CSSProperties;


  return (
    <div 
      className={cn(
        "grid w-full h-screen min-w-[1200px]",
        "grid-rows-[auto_1fr_auto]",
        layoutState.panelsVisible ? "grid-cols-[1fr_300px]" : "grid-cols-1",
        "bg-background text-foreground font-sans",
        "transition-all duration-300 ease-out"
      )}
      style={layoutStyles}
      data-panels-visible={layoutState.panelsVisible}
      data-audio-visible={layoutState.audioSliderVisible}
    >
      {/* Header Region - Mode tabs + Toolbar */}
      <div className={cn(
        layoutState.panelsVisible ? "col-span-2" : "col-span-1",
        "relative z-[100]"
      )}>
        <HeaderRegion
          onTogglePanels={togglePanels}
          onToggleAudioSlider={toggleAudioSlider}
          panelsVisible={layoutState.panelsVisible}
          audioSliderVisible={layoutState.audioSliderVisible}
          activeAudioSlider={layoutState.activeAudioSlider}
          currentMode={currentMode}
          onModeChange={onModeChange}
        />
      </div>

      {/* Transcript Region - Central content area */}
      <div className="overflow-hidden bg-white relative">
        <TranscriptRegion 
          panelsVisible={layoutState.panelsVisible}
          onTogglePanels={togglePanels}
          currentMode={currentMode}
        />
      </div>

      {/* Panels Region - Right sliding panels */}
      {layoutState.panelsVisible && (
        <div className="bg-[#8fb3c7] overflow-hidden relative">
          <PanelsRegion
            visible={layoutState.panelsVisible}
            width={layoutState.panelsWidth}
            onWidthChange={updatePanelsWidth}
            onClose={() => setLayoutState(prev => ({ ...prev, panelsVisible: false }))}
          />
        </div>
      )}

      {/* Audio Region - Bottom audio sliders */}
      {layoutState.audioSliderVisible && (
        <div className={cn(
          layoutState.panelsVisible ? "col-span-2" : "col-span-1",
          "overflow-hidden relative z-10"
        )}>
          <AudioRegion
            visible={layoutState.audioSliderVisible}
            activeSlider={layoutState.activeAudioSlider}
            height={layoutState.audioHeight}
            onHeightChange={updateAudioHeight}
            onSliderChange={toggleAudioSlider}
          />
        </div>
      )}
    </div>
  );
};

export default MainLayout;