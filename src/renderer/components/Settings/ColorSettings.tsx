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
    name: 'Light Mode',
    value: 'light',
    preview: '#f5f5f5'
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    value: 'dark', 
    preview: '#1e293b'
  }
];

const ColorSettings: React.FC<ColorSettingsProps> = ({ currentColor, onColorChange, onClose }) => {
  const [selectedColor, setSelectedColor] = useState(currentColor);

  const applyTheme = (themeValue: string) => {
    const root = document.documentElement;
    
    if (themeValue === 'light') {
      // Light mode colors
      root.style.setProperty('--bg', '0 0% 98%');           // Very light gray background
      root.style.setProperty('--surface', '0 0% 96%');      // Light gray surface - f5f5f5
      root.style.setProperty('--sidebar', '0 0% 96%');      // Light sidebar - f5f5f5
      root.style.setProperty('--text', '220 13% 15%');      // Dark text
      root.style.setProperty('--text-muted', '220 13% 40%'); // Muted dark text
      root.style.setProperty('--border', '220 13% 85%');    // Light border
      root.style.setProperty('--hover-bg', '220 13% 90%');  // Light hover
      // Playback panel colors (light)
      root.style.setProperty('--glass-surface', '0 0% 96% / 1');  // Light playback panel
      root.style.setProperty('--glass-text', '220 13% 15%');      // Dark text for playback
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
    }
  };

  // Apply the current theme when component mounts
  useEffect(() => {
    if (currentColor) {
      applyTheme(currentColor);
    }
  }, []);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    onColorChange(color);
    
    // Apply the theme by updating CSS custom properties
    applyTheme(color);
  };

  return (
    <div>
      <p className="text-sm text-white opacity-80 mb-4">
        Choose your preferred app color theme. Changes apply immediately.
      </p>
      
      <div className="space-y-3">
        <label className="block text-sm font-medium text-white mb-3">Theme Color</label>
        
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
                  <Check size={16} className="text-white" />
                )}
              </div>
              
              {/* Color Name */}
              <div className="flex-1">
                <div className="text-white font-medium">{option.name}</div>
                <div className="text-white opacity-60 text-xs">{option.value}</div>
              </div>
              
              {/* Selection Indicator */}
              {selectedColor === option.value && (
                <div className="w-2 h-2 bg-white rounded-full opacity-80"></div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-white border-opacity-20">
        <p className="text-xs text-white opacity-60">
          Color settings are saved globally and will persist across all projects.
        </p>
      </div>
    </div>
  );
};

export default ColorSettings;