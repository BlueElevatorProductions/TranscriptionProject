import React, { useState, useEffect } from 'react';
import { ClipStyle } from '../../types';

export interface FontSettings {
  fontFamily: string;
  fontSize: number;
}

export interface FontsPanelProps {
  initial: FontSettings;
  onChange?: (settings: FontSettings) => void;
  selectedClipIds?: string[];
  onClipStyleChange?: (clipId: string, style: ClipStyle) => void;
  onClose: () => void;
}

const FontsPanel: React.FC<FontsPanelProps> = ({ 
  initial, 
  onChange, 
  selectedClipIds = [], 
  onClipStyleChange, 
  onClose 
}) => {
  const [fontSettings, setFontSettings] = useState<FontSettings>(initial);
  const [formattingState, setFormattingState] = useState<ClipStyle>({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    highlightColor: '#ffff00'
  });

  const updateSettings = (updates: Partial<FontSettings>) => {
    const newSettings = { ...fontSettings, ...updates };
    setFontSettings(newSettings);
    onChange?.(newSettings);
  };

  // Handle formatting changes for selected clips
  const toggleFormatting = (formatType: keyof ClipStyle, value?: any) => {
    if (!onClipStyleChange || selectedClipIds.length === 0) return;
    
    const newState = { ...formattingState };
    if (formatType === 'highlightColor') {
      newState[formatType] = value;
    } else {
      newState[formatType] = !newState[formatType];
    }
    
    setFormattingState(newState);
    
    // Apply to all selected clips
    selectedClipIds.forEach(clipId => {
      onClipStyleChange(clipId, { [formatType]: newState[formatType] });
    });
  };

  const fontOptions = [
    'Avenir',
    'Inter', 
    'Arial',
    'Georgia',
    'Times New Roman',
    'Helvetica',
    'Courier New',
    'Verdana',
    'System UI'
  ];

  return (
    <div>
      <p className="text-sm text-white opacity-80 mb-4">
        Configure the font and size for the entire transcript. Changes apply immediately.
      </p>
      
      <div className="space-y-4">
        {/* Font Family */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Font Family</label>
          <select
            value={fontSettings.fontFamily}
            onChange={(e) => updateSettings({ fontFamily: e.target.value })}
            className="w-full px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
          >
            {fontOptions.map(font => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>
        </div>

        {/* Font Size */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Font Size</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="12"
              max="72"
              value={fontSettings.fontSize}
              onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
              className="flex-1"
            />
            <div className="flex items-center gap-2 min-w-[100px]">
              <input
                type="number"
                min="12"
                max="72"
                value={fontSettings.fontSize}
                onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) || 12 })}
                className="w-16 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 text-white rounded text-center"
              />
              <span className="text-sm text-white opacity-70">px</span>
            </div>
          </div>
        </div>

        {/* Text Formatting Controls */}
        <div>
          <label className="block text-sm font-medium text-white mb-3">Text Formatting</label>
          {selectedClipIds.length === 0 ? (
            <p className="text-sm text-white opacity-60 mb-3">
              Select clips to apply formatting
            </p>
          ) : (
            <p className="text-sm text-white opacity-80 mb-3">
              Formatting {selectedClipIds.length} selected clip{selectedClipIds.length !== 1 ? 's' : ''}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {/* Bold */}
            <button
              onClick={() => toggleFormatting('bold')}
              disabled={selectedClipIds.length === 0}
              className={`px-3 py-2 text-sm font-bold rounded border transition-colors ${
                formattingState.bold
                  ? 'bg-white bg-opacity-20 border-white border-opacity-50 text-white'
                  : 'bg-white bg-opacity-10 border-white border-opacity-20 text-white hover:bg-opacity-15'
              } ${selectedClipIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <strong>B</strong>
            </button>

            {/* Italic */}
            <button
              onClick={() => toggleFormatting('italic')}
              disabled={selectedClipIds.length === 0}
              className={`px-3 py-2 text-sm italic rounded border transition-colors ${
                formattingState.italic
                  ? 'bg-white bg-opacity-20 border-white border-opacity-50 text-white'
                  : 'bg-white bg-opacity-10 border-white border-opacity-20 text-white hover:bg-opacity-15'
              } ${selectedClipIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <em>I</em>
            </button>

            {/* Underline */}
            <button
              onClick={() => toggleFormatting('underline')}
              disabled={selectedClipIds.length === 0}
              className={`px-3 py-2 text-sm underline rounded border transition-colors ${
                formattingState.underline
                  ? 'bg-white bg-opacity-20 border-white border-opacity-50 text-white'
                  : 'bg-white bg-opacity-10 border-white border-opacity-20 text-white hover:bg-opacity-15'
              } ${selectedClipIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <u>U</u>
            </button>

            {/* Strikethrough */}
            <button
              onClick={() => toggleFormatting('strikethrough')}
              disabled={selectedClipIds.length === 0}
              className={`px-3 py-2 text-sm line-through rounded border transition-colors ${
                formattingState.strikethrough
                  ? 'bg-white bg-opacity-20 border-white border-opacity-50 text-white'
                  : 'bg-white bg-opacity-10 border-white border-opacity-20 text-white hover:bg-opacity-15'
              } ${selectedClipIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <s>S</s>
            </button>
          </div>
        </div>

        {/* Highlighting Controls */}
        <div>
          <label className="block text-sm font-medium text-white mb-3">Text Highlighting</label>
          
          {/* Color Picker */}
          <div className="mb-3">
            <label className="block text-xs text-white opacity-70 mb-2">Highlight Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formattingState.highlightColor || '#ffff00'}
                onChange={(e) => toggleFormatting('highlightColor', e.target.value)}
                disabled={selectedClipIds.length === 0}
                className={`w-8 h-8 rounded border border-white border-opacity-20 bg-transparent cursor-pointer ${
                  selectedClipIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              <input
                type="text"
                value={formattingState.highlightColor || '#ffff00'}
                onChange={(e) => toggleFormatting('highlightColor', e.target.value)}
                disabled={selectedClipIds.length === 0}
                className={`flex-1 px-2 py-1 text-xs bg-white bg-opacity-10 border border-white border-opacity-20 text-white rounded ${
                  selectedClipIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                placeholder="#ffff00"
              />
            </div>
          </div>

          {/* Highlight Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => toggleFormatting('highlightColor', formattingState.highlightColor)}
              disabled={selectedClipIds.length === 0}
              className={`flex-1 px-3 py-2 text-sm bg-yellow-500 bg-opacity-80 text-black rounded hover:bg-opacity-90 transition-colors font-medium ${
                selectedClipIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Highlight
            </button>
            <button
              onClick={() => toggleFormatting('highlightColor', undefined)}
              disabled={selectedClipIds.length === 0}
              className={`px-3 py-2 text-sm bg-white bg-opacity-10 border border-white border-opacity-20 text-white rounded hover:bg-opacity-15 transition-colors ${
                selectedClipIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Remove
            </button>
          </div>
        </div>

        {/* Quick Highlight Colors */}
        <div>
          <label className="block text-xs text-white opacity-70 mb-2">Quick Colors</label>
          <div className="flex gap-2">
            {[
              '#ffff00', // Yellow
              '#00ff00', // Green
              '#ff00ff', // Magenta
              '#00ffff', // Cyan
              '#ffa500', // Orange
              '#ff69b4', // Hot Pink
            ].map(color => (
              <button
                key={color}
                onClick={() => toggleFormatting('highlightColor', color)}
                disabled={selectedClipIds.length === 0}
                className="w-6 h-6 rounded border border-white border-opacity-30 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={`Apply ${color} highlight`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FontsPanel;