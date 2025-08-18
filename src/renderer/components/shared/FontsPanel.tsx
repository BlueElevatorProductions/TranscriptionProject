import React, { useState } from 'react';

export interface FontSettings {
  fontFamily: string;
  fontSize: number;
}

export interface FontsPanelProps {
  initial: FontSettings;
  onChange?: (settings: FontSettings) => void;
  onClose: () => void;
}

const FontsPanel: React.FC<FontsPanelProps> = ({ initial, onChange, onClose }) => {
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
      </div>
    </div>
  );
};

export default FontsPanel;