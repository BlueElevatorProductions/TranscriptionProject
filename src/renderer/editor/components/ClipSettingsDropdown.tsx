/**
 * ClipSettingsDropdown - Advanced dropdown menu for clip operations
 * Provides speaker selection, merge operations, and deletion with undo support
 */

import React, { useCallback } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDownIcon, UserIcon, ArrowUpIcon, ArrowDownIcon, TrashIcon, SettingsIcon } from 'lucide-react';

interface ClipSettingsDropdownProps {
  clipId: string;
  speakerId: string;
  availableSpeakers: { id: string; name: string }[];
  clipIndex: number;
  totalClips: number;
  onSpeakerChange: (clipId: string, speakerId: string) => void;
  onMergeAbove: (clipId: string) => void;
  onMergeBelow: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
}

export const ClipSettingsDropdown: React.FC<ClipSettingsDropdownProps> = ({
  clipId,
  speakerId,
  availableSpeakers,
  clipIndex,
  totalClips,
  onSpeakerChange,
  onMergeAbove,
  onMergeBelow,
  onDeleteClip,
}) => {
  const canMergeAbove = clipIndex > 0;
  const canMergeBelow = clipIndex < totalClips - 1;

  const handleSpeakerChange = useCallback((selectedSpeakerId: string) => {
    if (selectedSpeakerId !== speakerId) {
      onSpeakerChange(clipId, selectedSpeakerId);
    }
  }, [clipId, speakerId, onSpeakerChange]);

  const handleMergeAbove = useCallback(() => {
    if (canMergeAbove) {
      onMergeAbove(clipId);
    }
  }, [clipId, canMergeAbove, onMergeAbove]);

  const handleMergeBelow = useCallback(() => {
    if (canMergeBelow) {
      onMergeBelow(clipId);
    }
  }, [clipId, canMergeBelow, onMergeBelow]);

  const handleDeleteClip = useCallback(() => {
    onDeleteClip(clipId);
  }, [clipId, onDeleteClip]);

  return (
    <div className="clip-settings-dropdown">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button 
            className="clip-settings-trigger"
            onClick={(e) => e.stopPropagation()}
            title="Clip Settings"
          >
            <SettingsIcon className="h-4 w-4 text-gray-500 hover:text-gray-700" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Content 
          className="clip-settings-menu"
          align="end"
          sideOffset={5}
        >
            {/* Speaker Selection Section */}
            <div className="py-1">
              <DropdownMenu.Label className="px-4 py-2 text-sm font-medium text-gray-300">
                Speaker
              </DropdownMenu.Label>
              <DropdownMenu.RadioGroup 
                value={speakerId} 
                onValueChange={handleSpeakerChange}
              >
                {availableSpeakers.map((speaker) => (
                  <DropdownMenu.RadioItem
                    key={speaker.id}
                    value={speaker.id}
                    className="relative flex cursor-pointer select-none items-center px-4 py-2 text-sm text-gray-300 outline-none hover:bg-white/5 focus:bg-white/5 data-[state=checked]:bg-white/10 data-[state=checked]:text-white"
                  >
                    <DropdownMenu.ItemIndicator className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-current" />
                    </DropdownMenu.ItemIndicator>
                    <div className="flex items-center gap-2 pl-6">
                      <UserIcon className="h-4 w-4" />
                      {speaker.name}
                    </div>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </div>

            <DropdownMenu.Separator className="my-1 h-px bg-white/10" />

            {/* Merge Operations Section */}
            <div className="py-1">
              <DropdownMenu.Item
                className={`flex items-center gap-2 px-4 py-2 text-sm ${
                  canMergeAbove
                    ? 'text-gray-300 hover:bg-white/5 focus:bg-white/5 focus:text-white cursor-pointer'
                    : 'text-gray-500 cursor-not-allowed'
                }`}
                onSelect={canMergeAbove ? handleMergeAbove : undefined}
                disabled={!canMergeAbove}
              >
                <ArrowUpIcon className="h-4 w-4" />
                Merge Clip Above
              </DropdownMenu.Item>
              
              <DropdownMenu.Item
                className={`flex items-center gap-2 px-4 py-2 text-sm ${
                  canMergeBelow
                    ? 'text-gray-300 hover:bg-white/5 focus:bg-white/5 focus:text-white cursor-pointer'
                    : 'text-gray-500 cursor-not-allowed'
                }`}
                onSelect={canMergeBelow ? handleMergeBelow : undefined}
                disabled={!canMergeBelow}
              >
                <ArrowDownIcon className="h-4 w-4" />
                Merge Clip Below
              </DropdownMenu.Item>
            </div>

            <DropdownMenu.Separator className="my-1 h-px bg-white/10" />

            {/* Delete Section */}
            <div className="py-1">
              <DropdownMenu.Item
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 focus:bg-red-900/20 focus:text-red-300 cursor-pointer"
                onSelect={handleDeleteClip}
              >
                <TrashIcon className="h-4 w-4" />
                Delete Clip
              </DropdownMenu.Item>
            </div>
          </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
};

export default ClipSettingsDropdown;