import React, { useState } from 'react';
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
    value: '#003223',
    preview: '#003223'
  },
  {
    id: 'blue',
    name: 'Blue', 
    value: '#005d7f',
    preview: '#005d7f'
  }
];

const ColorSettings: React.FC<ColorSettingsProps> = ({ currentColor, onColorChange, onClose }) => {
  const [selectedColor, setSelectedColor] = useState(currentColor);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    onColorChange(color);
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