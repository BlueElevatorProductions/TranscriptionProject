/**
 * ClipNode - Lexical DecoratorNode for displaying clips as styled boxes
 * Shows clip content with Material Tailwind styling
 */

import React, { useCallback, useState } from 'react';
import { 
  DecoratorNode, 
  NodeKey, 
  LexicalNode, 
  SerializedLexicalNode,
  EditorConfig
} from 'lexical';
import { Card, CardBody, Typography, IconButton, Chip } from '@material-tailwind/react';
import { PlayIcon, PencilIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';

export interface SerializedClipNode extends SerializedLexicalNode {
  clipId: string;
  title: string;
  text: string;
  startTime: number;
  endTime: number;
  speakerId: string;
  type: 'user-created' | 'auto-generated' | 'highlight';
}

export interface ClipComponentProps {
  clipId: string;
  title: string;
  text: string;
  startTime: number;
  endTime: number;
  speakerId: string;
  type: 'user-created' | 'auto-generated' | 'highlight';
  onPlay?: (startTime: number) => void;
  onEdit?: (clipId: string) => void;
  onDelete?: (clipId: string) => void;
  nodeKey: NodeKey;
}

function ClipComponent({
  clipId,
  title,
  text,
  startTime,
  endTime,
  speakerId,
  type,
  onPlay,
  onEdit,
  onDelete,
}: ClipComponentProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handlePlay = useCallback(() => {
    onPlay?.(startTime);
  }, [startTime, onPlay]);

  const handleEdit = useCallback(() => {
    onEdit?.(clipId);
  }, [clipId, onEdit]);

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this clip?')) {
      onDelete?.(clipId);
    }
  }, [clipId, onDelete]);

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const duration = endTime - startTime;

  // Color scheme based on clip type
  const getColorScheme = () => {
    switch (type) {
      case 'user-created':
        return {
          card: 'bg-blue-50 border-blue-200',
          chip: 'bg-blue-100 text-blue-800',
          text: 'text-blue-900'
        };
      case 'auto-generated':
        return {
          card: 'bg-green-50 border-green-200',
          chip: 'bg-green-100 text-green-800',
          text: 'text-green-900'
        };
      case 'highlight':
        return {
          card: 'bg-yellow-50 border-yellow-200',
          chip: 'bg-yellow-100 text-yellow-800',
          text: 'text-yellow-900'
        };
      default:
        return {
          card: 'bg-gray-50 border-gray-200',
          chip: 'bg-gray-100 text-gray-800',
          text: 'text-gray-900'
        };
    }
  };

  const colorScheme = getColorScheme();

  return (
    <div 
      className="lexical-clip-node my-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      contentEditable={false}
      suppressContentEditableWarning={true}
    >
      <Card className={`${colorScheme.card} border transition-all duration-200 hover:shadow-md`}>
        <CardBody className="p-4">
          {/* Header with title and actions */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <Typography variant="h6" className={`${colorScheme.text} font-medium mb-1`}>
                {title}
              </Typography>
              <div className="flex items-center gap-2 mb-2">
                <Chip
                  size="sm"
                  value={type.replace('-', ' ')}
                  className={colorScheme.chip}
                />
                <div className="flex items-center text-sm text-gray-600">
                  <ClockIcon className="w-4 h-4 mr-1" />
                  {formatTime(startTime)} - {formatTime(endTime)} ({formatTime(duration)})
                </div>
              </div>
            </div>
            
            {/* Action buttons - show on hover */}
            <div className={`flex gap-1 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
              <IconButton
                size="sm"
                variant="text"
                color="blue"
                onClick={handlePlay}
                className="hover:bg-blue-50"
              >
                <PlayIcon className="w-4 h-4" />
              </IconButton>
              <IconButton
                size="sm"
                variant="text"
                color="gray"
                onClick={handleEdit}
                className="hover:bg-gray-50"
              >
                <PencilIcon className="w-4 h-4" />
              </IconButton>
              <IconButton
                size="sm"
                variant="text"
                color="red"
                onClick={handleDelete}
                className="hover:bg-red-50"
              >
                <TrashIcon className="w-4 h-4" />
              </IconButton>
            </div>
          </div>

          {/* Clip content */}
          <Typography className={`${colorScheme.text} leading-relaxed`}>
            {text}
          </Typography>

          {/* Footer with speaker info */}
          {speakerId && (
            <div className="mt-3 pt-2 border-t border-gray-200">
              <Typography variant="small" className="text-gray-600">
                Speaker: <span className="font-medium">{speakerId}</span>
              </Typography>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export class ClipNode extends DecoratorNode<React.JSX.Element> {
  __clipId: string;
  __title: string;
  __text: string;
  __startTime: number;
  __endTime: number;
  __speakerId: string;
  __type: 'user-created' | 'auto-generated' | 'highlight';

  static getType(): string {
    return 'clip';
  }

  static clone(node: ClipNode): ClipNode {
    return new ClipNode(
      node.__clipId,
      node.__title,
      node.__text,
      node.__startTime,
      node.__endTime,
      node.__speakerId,
      node.__type,
      node.__key
    );
  }

  constructor(
    clipId: string,
    title: string,
    text: string,
    startTime: number,
    endTime: number,
    speakerId: string,
    type: 'user-created' | 'auto-generated' | 'highlight' = 'user-created',
    key?: NodeKey
  ) {
    super(key);
    this.__clipId = clipId;
    this.__title = title;
    this.__text = text;
    this.__startTime = startTime;
    this.__endTime = endTime;
    this.__speakerId = speakerId;
    this.__type = type;
  }

  // Getters
  getClipId(): string {
    return this.__clipId;
  }

  getTitle(): string {
    return this.__title;
  }

  getText(): string {
    return this.__text;
  }

  getStartTime(): number {
    return this.__startTime;
  }

  getEndTime(): number {
    return this.__endTime;
  }

  getSpeakerId(): string {
    return this.__speakerId;
  }

  getClipType(): 'user-created' | 'auto-generated' | 'highlight' {
    return this.__type;
  }

  // Setters
  setTitle(title: string): ClipNode {
    const writable = this.getWritable();
    writable.__title = title;
    return writable;
  }

  setText(text: string): ClipNode {
    const writable = this.getWritable();
    writable.__text = text;
    return writable;
  }

  setTiming(startTime: number, endTime: number): ClipNode {
    const writable = this.getWritable();
    writable.__startTime = startTime;
    writable.__endTime = endTime;
    return writable;
  }

  setSpeaker(speakerId: string): ClipNode {
    const writable = this.getWritable();
    writable.__speakerId = speakerId;
    return writable;
  }

  setType(type: 'user-created' | 'auto-generated' | 'highlight'): ClipNode {
    const writable = this.getWritable();
    writable.__type = type;
    return writable;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    element.classList.add('lexical-clip-node-container');
    element.setAttribute('data-clip-id', this.__clipId);
    element.setAttribute('data-clip-type', this.__type);
    return element;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(): React.JSX.Element {
    return (
      <ClipComponent
        clipId={this.__clipId}
        title={this.__title}
        text={this.__text}
        startTime={this.__startTime}
        endTime={this.__endTime}
        speakerId={this.__speakerId}
        type={this.__type}
        nodeKey={this.__key}
      />
    );
  }

  isInline(): boolean {
    return false;
  }

  isTopLevel(): boolean {
    return true;
  }

  // Selection behavior
  canBeEmpty(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  // Serialization
  exportJSON(): SerializedClipNode {
    return {
      clipId: this.__clipId,
      title: this.__title,
      text: this.__text,
      startTime: this.__startTime,
      endTime: this.__endTime,
      speakerId: this.__speakerId,
      clipType: this.__type,
      type: 'clip',
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedClipNode): ClipNode {
    const {
      clipId,
      title,
      text,
      startTime,
      endTime,
      speakerId,
      type,
    } = serializedNode;
    return new ClipNode(clipId, title, text, startTime, endTime, speakerId, type);
  }

  // Text representation for copy/paste and export
  getTextContent(): string {
    return `[CLIP: ${this.__title}]\n${this.__text}\n[END CLIP]\n`;
  }
}

export function $createClipNode(
  clipId: string,
  title: string,
  text: string,
  startTime: number,
  endTime: number,
  speakerId: string,
  type: 'user-created' | 'auto-generated' | 'highlight' = 'user-created'
): ClipNode {
  return new ClipNode(clipId, title, text, startTime, endTime, speakerId, type);
}

export function $isClipNode(node: LexicalNode | null | undefined): node is ClipNode {
  return node instanceof ClipNode;
}