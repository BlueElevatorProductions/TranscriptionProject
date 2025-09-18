import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface ColorOption {
  id: string;
  name: string;
  value: string;
  preview: string;
}

interface ColorSettingsProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  currentTranscriptTheme?: 'light' | 'dark';
  onTranscriptThemeChange?: (theme: 'light' | 'dark') => void;
  onClose: () => void;
}

const colorOptions: ColorOption[] = [
  {
    id: 'green',
    name: 'Green',
    value: '#007552',
    preview: '#007552'
  },
  {
    id: 'blue',
    name: 'Blue', 
    value: '#0086bf',
    preview: '#0086bf'
  },
  {
    id: 'light',
    name: 'White',
    value: 'light',
    preview: '#f5f5f5'
  },
  {
    id: 'dark',
    name: 'Black',
    value: 'dark', 
    preview: '#1e293b'
  }
];

const ColorSettings: React.FC<ColorSettingsProps> = ({ 
  currentColor, 
  onColorChange, 
  currentTranscriptTheme = 'dark',
  onTranscriptThemeChange,
  onClose 
}) => {
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [transcriptTheme, setTranscriptTheme] = useState<'light' | 'dark'>(currentTranscriptTheme);

  const applyTheme = (themeValue: string) => {
    const root = document.documentElement;
    
    if (themeValue === 'light') {
      // White mode colors - cream backgrounds (#fff8e9) with dark gray text
      root.style.setProperty('--bg', '43 100% 97%');        // Cream background (#fff8e9)
      root.style.setProperty('--surface', '43 100% 97%');   // Cream surface 
      root.style.setProperty('--sidebar', '43 100% 97%');   // Cream sidebar
      root.style.setProperty('--text', '220 15% 15%');      // Dark gray text (matches dark transcript bg)
      root.style.setProperty('--text-muted', '220 15% 40%'); // Muted dark gray text
      root.style.setProperty('--border', '43 30% 85%');     // Warm light border
      root.style.setProperty('--hover-bg', '43 60% 92%');   // Light cream hover
      // Header/topbar colors
      root.style.setProperty('--glass-surface', '43 100% 97% / 1');  // Cream topbar
      root.style.setProperty('--glass-text', '220 15% 15%');         // Dark gray text for topbar
      root.style.setProperty('--glass-border-subtle', '220 15% 15% / 1'); // Dark border for White theme
      // Update opacity levels for more transparency
      root.style.setProperty('--sidebar-bg-opacity', '0.8');  // 80% transparency
      root.style.setProperty('--panel-bg-opacity', '0.8');    // 80% transparency
    } else if (themeValue === 'dark') {
      // Dark mode colors  
      root.style.setProperty('--bg', '220 15% 10%');        // Very dark background
      root.style.setProperty('--surface', '220 15% 15%');   // Dark surface
      root.style.setProperty('--sidebar', '220 13% 20%');   // Dark sidebar
      root.style.setProperty('--text', '50 100% 95%');      // Light text
      root.style.setProperty('--text-muted', '240 5% 65%'); // Muted light text
      root.style.setProperty('--border', '220 15% 25%');    // Dark border
      root.style.setProperty('--hover-bg', '220 15% 20%');  // Dark hover
      // Playback panel colors (white text/buttons)
      root.style.setProperty('--glass-surface', '220 15% 15% / 1');  // Dark playback panel
      root.style.setProperty('--glass-text', '0 0% 100%');           // White text for playback
      // Reset opacity levels to default
      root.style.setProperty('--sidebar-bg-opacity', '0.3');  // Default transparency
      root.style.setProperty('--panel-bg-opacity', '0.2');    // Default transparency
    } else if (themeValue === '#0086bf') {
      // Blue mode - lighter blue (0086bf)
      root.style.setProperty('--bg', '220 15% 15%');        // Dark background
      root.style.setProperty('--surface', '200 100% 37%');  // Blue surface (#0086bf)
      root.style.setProperty('--sidebar', '200 100% 37%');  // Blue sidebar (#0086bf)
      root.style.setProperty('--text', '50 100% 95%');      // Light text
      root.style.setProperty('--text-muted', '240 5% 65%'); // Muted light text
      root.style.setProperty('--border', '220 15% 100%');   // Light border
      root.style.setProperty('--hover-bg', '200 100% 42%'); // Lighter blue hover
      // Playback panel colors (same as light mode)
      root.style.setProperty('--glass-surface', '0 0% 96% / 1');  // Light playback panel
      root.style.setProperty('--glass-text', '220 13% 15%');      // Dark text for playback
      // Reset opacity levels to default
      root.style.setProperty('--sidebar-bg-opacity', '0.3');  // Default transparency
      root.style.setProperty('--panel-bg-opacity', '0.2');    // Default transparency
    } else if (themeValue === '#007552') {
      // Green mode - 007552
      root.style.setProperty('--bg', '220 15% 15%');        // Dark background
      root.style.setProperty('--surface', '160 100% 23%');  // Green surface (#007552)
      root.style.setProperty('--sidebar', '160 100% 23%');  // Green sidebar (#007552)  
      root.style.setProperty('--text', '50 100% 95%');      // Light text
      root.style.setProperty('--text-muted', '240 5% 65%'); // Muted light text
      root.style.setProperty('--border', '220 15% 100%');   // Light border
      root.style.setProperty('--hover-bg', '160 100% 28%'); // Lighter green hover
      // Playback panel colors (same as light mode)
      root.style.setProperty('--glass-surface', '0 0% 96% / 1');  // Light playback panel
      root.style.setProperty('--glass-text', '220 13% 15%');      // Dark text for playback
      // Reset opacity levels to default
      root.style.setProperty('--sidebar-bg-opacity', '0.3');  // Default transparency
      root.style.setProperty('--panel-bg-opacity', '0.2');    // Default transparency
    } else {
      // Fallback - original theme
      root.style.setProperty('--bg', '220 15% 15%');
      root.style.setProperty('--surface', '220 15% 20%');
      root.style.setProperty('--sidebar', '220 13% 50%');
      root.style.setProperty('--text', '50 100% 95%');
      root.style.setProperty('--text-muted', '240 5% 65%');
      root.style.setProperty('--border', '220 15% 100%');
      root.style.setProperty('--hover-bg', '220 15% 25%');
      // Default playback panel
      root.style.setProperty('--glass-surface', '240 8% 8% / 1');
      root.style.setProperty('--glass-text', '0 0% 60%');
      // Reset opacity levels to default
      root.style.setProperty('--sidebar-bg-opacity', '0.3');  // Default transparency
      root.style.setProperty('--panel-bg-opacity', '0.2');    // Default transparency
    }
  };

  const applyTranscriptTheme = (theme: 'light' | 'dark') => {
    const root = document.documentElement;
    
    if (theme === 'light') {
      // Light transcript theme - white background with black text
      root.style.setProperty('--transcript-bg', '0 0% 100%');     // White background
      root.style.setProperty('--transcript-text', '0 0% 0%');     // Black text
    } else {
      // Dark transcript theme - dark grey background with white text  
      root.style.setProperty('--transcript-bg', '220 15% 15%');   // Dark grey background
      root.style.setProperty('--transcript-text', '0 0% 95%');    // White text
    }
  };

  // Apply the current themes when component mounts
  useEffect(() => {
    if (currentColor) {
      applyTheme(currentColor);
    }
    applyTranscriptTheme(transcriptTheme);
  }, []);

  // Apply transcript theme when it changes
  useEffect(() => {
    applyTranscriptTheme(transcriptTheme);
  }, [transcriptTheme]);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    onColorChange(color);
    
    // Apply the theme by updating CSS custom properties
    applyTheme(color);
  };

  const handleTranscriptThemeSelect = (theme: 'light' | 'dark') => {
    setTranscriptTheme(theme);
    onTranscriptThemeChange?.(theme);
    applyTranscriptTheme(theme);
  };

  return (
    <div>
      <div className="space-y-3">
        <label className="block text-sm font-medium mb-3" style={{ color: 'hsl(var(--text))' }}>Theme Color</label>
        
        <div className="space-y-3">
          {colorOptions.map((option) => (
            <div
              key={option.id}
              className={`
                flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                ${selectedColor === option.value 
                  ? 'bg-white bg-opacity-20 border border-white border-opacity-40' 
                  : 'bg-white bg-opacity-10 border border-white border-opacity-20 hover:bg-opacity-15'
                }
              `}
              onClick={() => handleColorSelect(option.value)}
            >
              {/* Color Preview Circle */}
              <div 
                className="w-8 h-8 rounded-full border-2 border-white border-opacity-30 flex items-center justify-center"
                style={{ backgroundColor: option.preview }}
              >
                {selectedColor === option.value && (
                  <Check size={16} style={{ color: 'hsl(var(--text))' }} />
                )}
              </div>
              
              {/* Color Name */}
              <div className="flex-1">
                <div className="font-medium" style={{ color: 'hsl(var(--text))' }}>{option.name}</div>
                <div className="opacity-60 text-xs" style={{ color: 'hsl(var(--text))' }}>{option.value}</div>
              </div>
              
              {/* Selection Indicator */}
              {selectedColor === option.value && (
                <div className="w-2 h-2 bg-white rounded-full opacity-80"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Highlight Color Section */}
      <div className="mt-6 pt-4 border-t border-white border-opacity-20">
        <label className="block text-sm font-medium mb-3" style={{ color: 'hsl(var(--text))' }}>Highlight Color</label>
        <p className="text-xs opacity-70 mb-3" style={{ color: 'hsl(var(--text))' }}>
          Choose the word highlight color for playback. Text color adjusts automatically for readability.
        </p>

        <HighlightColorSelector />
      </div>

      {/* Transcript Theme Section */}
      <div className="mt-6 pt-4 border-t border-white border-opacity-20">
        <label className="block text-sm font-medium mb-3" style={{ color: 'hsl(var(--text))' }}>Transcript Theme</label>
        <p className="text-xs opacity-70 mb-3" style={{ color: 'hsl(var(--text))' }}>
          Choose the background and text color for the transcript area.
        </p>
        
        <div className="space-y-2">
          {/* Light Mode Option */}
          <div
            className={`
              flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
              ${transcriptTheme === 'light' 
                ? 'bg-white bg-opacity-20 border border-white border-opacity-40' 
                : 'bg-white bg-opacity-10 border border-white border-opacity-20 hover:bg-opacity-15'
              }
            `}
            onClick={() => handleTranscriptThemeSelect('light')}
          >
            <div 
              className="w-8 h-8 rounded border-2 border-white border-opacity-30 flex items-center justify-center"
              style={{ backgroundColor: '#ffffff' }}
            >
              {transcriptTheme === 'light' && (
                <Check size={16} className="text-black" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-white font-medium">Light Mode</div>
              <div className="text-white opacity-60 text-xs">White background, black text</div>
            </div>
            {transcriptTheme === 'light' && (
              <div className="w-2 h-2 bg-white rounded-full opacity-80"></div>
            )}
          </div>

          {/* Dark Mode Option */}
          <div
            className={`
              flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
              ${transcriptTheme === 'dark' 
                ? 'bg-white bg-opacity-20 border border-white border-opacity-40' 
                : 'bg-white bg-opacity-10 border border-white border-opacity-20 hover:bg-opacity-15'
              }
            `}
            onClick={() => handleTranscriptThemeSelect('dark')}
          >
            <div 
              className="w-8 h-8 rounded border-2 border-white border-opacity-30 flex items-center justify-center"
              style={{ backgroundColor: '#374151' }}
            >
              {transcriptTheme === 'dark' && (
                <Check size={16} className="text-white" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-white font-medium">Dark Mode</div>
              <div className="text-white opacity-60 text-xs">Dark grey background, white text</div>
            </div>
            {transcriptTheme === 'dark' && (
              <div className="w-2 h-2 bg-white rounded-full opacity-80"></div>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-white border-opacity-20">
        <p className="text-xs opacity-60" style={{ color: 'hsl(var(--text))' }}>
          Color settings are saved globally and will persist across all projects.
        </p>
      </div>
    </div>
  );
};

export default ColorSettings;

// --- Inline component: HighlightColorSelector ---

const HL_OPTIONS: Array<{ id: string; name: string; hex: string }> = [
  { id: 'yellow', name: 'Soft Yellow', hex: '#fef3c7' },
  { id: 'orange', name: 'Amber', hex: '#fde68a' },
  { id: 'lime', name: 'Lime', hex: '#d9f99d' },
  { id: 'cyan', name: 'Cyan', hex: '#a5f3fc' },
  { id: 'pink', name: 'Pink', hex: '#fbcfe8' },
  { id: 'violet', name: 'Violet', hex: '#e9d5ff' },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max - min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const srgb = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function setHighlightCssFromHex(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const root = document.documentElement;
  // Update background
  root.style.setProperty('--highlight-bg', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
  // Auto text color: black for light backgrounds, white for dark
  const lum = relativeLuminance(rgb);
  const textHsl = lum > 0.6 ? '0 0% 0%' : '0 0% 98%';
  root.style.setProperty('--highlight-text', textHsl);
  // Outline: slightly darker/lighter variant
  const outlineL = Math.max(0, Math.min(100, lum > 0.5 ? hsl.l - 20 : hsl.l + 20));
  root.style.setProperty('--highlight-outline', `${hsl.h} ${Math.max(30, hsl.s)}% ${outlineL}%`);
}

const HighlightColorSelector: React.FC = () => {
  const [selected, setSelected] = useState<string>(() => {
    return localStorage.getItem('transcript-highlight-color') || HL_OPTIONS[0].hex;
  });

  useEffect(() => {
    // Apply stored value on mount
    setHighlightCssFromHex(selected);
  }, []);

  const handlePick = (hex: string) => {
    setSelected(hex);
    try { localStorage.setItem('transcript-highlight-color', hex); } catch {}
    setHighlightCssFromHex(hex);
  };

  return (
    <div className="space-y-3">
      {HL_OPTIONS.map(opt => (
        <div
          key={opt.id}
          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${selected === opt.hex ? 'bg-white bg-opacity-20 border border-white border-opacity-40' : 'bg-white bg-opacity-10 border border-white border-opacity-20 hover:bg-opacity-15'}`}
          onClick={() => handlePick(opt.hex)}
        >
          <div
            className="w-8 h-8 rounded border-2 border-white border-opacity-30 flex items-center justify-center"
            style={{ backgroundColor: opt.hex }}
          >
            {selected === opt.hex && <Check size={16} style={{ color: 'hsl(var(--text))' }} />}
          </div>
          <div className="flex-1">
            <div className="font-medium" style={{ color: 'hsl(var(--text))' }}>{opt.name}</div>
            <div className="opacity-60 text-xs" style={{ color: 'hsl(var(--text))' }}>{opt.hex}</div>
          </div>
          {selected === opt.hex && <div className="w-2 h-2 bg-white rounded-full opacity-80"></div>}
        </div>
      ))}
    </div>
  );
};
