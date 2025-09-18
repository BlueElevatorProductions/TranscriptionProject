import React, { useState, useEffect } from 'react';
import { ClipStyle } from '../../types';

export interface FontSettings {
  fontFamily: string;
  fontSize: number;
}

export interface FontsPanelProps {
  initial: FontSettings;
  onChange?: (settings: FontSettings) => void;
  onClose: () => void;
}

const FontsPanel: React.FC<FontsPanelProps> = ({ 
  initial, 
  onChange, 
  onClose 
}) => {
  const [fontSettings, setFontSettings] = useState<FontSettings>(initial);

  const updateSettings = (updates: Partial<FontSettings>) => {
    const newSettings = { ...fontSettings, ...updates };
    setFontSettings(newSettings);
    onChange?.(newSettings);
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
      <div className="space-y-4">
        {/* Font Family */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'hsl(var(--text))' }}>Font</label>
          <select
            value={fontSettings.fontFamily}
            onChange={(e) => updateSettings({ fontFamily: e.target.value })}
            className="w-full px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
            style={{ 
              color: 'hsl(var(--text))', 
              backgroundColor: 'hsl(var(--text) / 0.1)',
              borderColor: 'hsl(var(--text) / 0.2)'
            }}
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
          <label className="block text-sm font-medium mb-2" style={{ color: 'hsl(var(--text))' }}>Size</label>
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
                className="w-16 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-center"
                style={{ 
                  color: 'hsl(var(--text))', 
                  backgroundColor: 'hsl(var(--text) / 0.1)',
                  borderColor: 'hsl(var(--text) / 0.2)'
                }}
              />
              <span className="text-sm opacity-70" style={{ color: 'hsl(var(--text))' }}>px</span>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};

export default FontsPanel;