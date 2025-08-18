import React, { useEffect, useRef } from 'react';
import { Edit3, Trash2, Scissors } from 'lucide-react';

interface ContextMenuItem {
  label: string;
  action?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  isSeparator?: boolean;
  className?: string;
}

interface ModernContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  visible: boolean;
}

const ModernContextMenu: React.FC<ModernContextMenuProps> = ({
  x,
  y,
  items,
  onClose,
  visible
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [visible, onClose]);

  useEffect(() => {
    // Adjust position if menu would go off-screen
    if (visible && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      let adjustedX = x;
      let adjustedY = y;

      // Adjust horizontal position
      if (x + rect.width > viewport.width) {
        adjustedX = x - rect.width;
      }

      // Adjust vertical position
      if (y + rect.height > viewport.height) {
        adjustedY = y - rect.height;
      }

      menu.style.left = `${adjustedX}px`;
      menu.style.top = `${adjustedY}px`;
    }
  }, [visible, x, y]);

  if (!visible) return null;

  const handleItemClick = (item: ContextMenuItem) => {
    if (!item.disabled && item.action) {
      item.action();
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[160px]"
      style={{
        left: x,
        top: y,
      }}
    >
      {items.map((item, index) => {
        if (item.isSeparator) {
          return (
            <div 
              key={index} 
              className="border-t border-gray-100 my-1" 
            />
          );
        }
        
        return (
          <button
            key={index}
            className={`
              w-full flex items-center gap-3 px-4 py-2 text-left text-sm
              hover:bg-gray-50 transition-colors duration-150
              ${item.disabled 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-gray-700 hover:text-gray-900 cursor-pointer'
              }
              ${item.className || ''}
            `}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
          >
            {item.icon && (
              <span className="flex-shrink-0 w-4 h-4 text-gray-500">
                {item.icon}
              </span>
            )}
            <span className="flex-1">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// Helper function to create context menu items with proper icons
export const createContextMenuItem = (
  label: string, 
  action: () => void, 
  type: 'edit' | 'delete' | 'split' | 'restore',
  disabled = false
): ContextMenuItem => {
  const iconMap = {
    edit: <Edit3 size={16} />,
    delete: <Trash2 size={16} />,
    split: <Scissors size={16} />,
    restore: <Edit3 size={16} />
  };

  return {
    label,
    action,
    icon: iconMap[type],
    disabled
  };
};

export default ModernContextMenu;