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
      <p className="text-sm text-text-muted mb-4">
        Configure the font and size for the entire transcript. Changes apply immediately.
      </p>
      
      <div className="space-y-4">
        {/* Font Family */}
        <div>
          <label className="block text-sm font-medium mb-2">Font Family</label>
          <select
            value={fontSettings.fontFamily}
            onChange={(e) => updateSettings({ fontFamily: e.target.value })}
            className="w-full px-3 py-2 bg-surface border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
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
          <label className="block text-sm font-medium mb-2">Font Size</label>
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
                className="w-16 px-2 py-1 bg-surface border border-border rounded text-center"
              />
              <span className="text-sm text-text-muted">px</span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium mb-2">Preview</label>
          <div 
            className="p-3 bg-gray-50 border border-border rounded-md"
            style={{
              fontFamily: fontSettings.fontFamily,
              fontSize: `${fontSettings.fontSize}px`,
              lineHeight: 1.4
            }}
          >
            This is how your transcript text will appear with the selected font and size.
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-6">
        <button 
          className="rounded px-3 py-1.5 hover:bg-hover-bg" 
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default FontsPanel;