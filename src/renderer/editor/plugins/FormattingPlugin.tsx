/**
 * FormattingPlugin - Bridge between FontsPanel and Lexical editor
 * Handles text formatting commands from the existing FontsPanel
 */

import React, { useEffect, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  $getSelection, 
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  TextFormatType,
  $createRangeSelection,
  $setSelection
} from 'lexical';
import { $patchStyleText } from '@lexical/selection';

interface FormattingPluginProps {
  fontFamily?: string;
  fontSize?: number;
  onFormattingChange?: (formatting: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    highlight: boolean;
    highlightColor: string;
  }) => void;
}

export default function FormattingPlugin({
  fontFamily,
  fontSize,
  onFormattingChange,
}: FormattingPluginProps) {
  const [editor] = useLexicalComposerContext();

  // Apply font family changes to the entire editor
  useEffect(() => {
    if (!fontFamily) return;

    editor.update(() => {
      const editorElement = editor.getRootElement();
      if (editorElement) {
        editorElement.style.fontFamily = fontFamily;
      }
    });
  }, [editor, fontFamily]);

  // Apply font size changes to the entire editor
  useEffect(() => {
    if (!fontSize) return;

    editor.update(() => {
      const editorElement = editor.getRootElement();
      if (editorElement) {
        editorElement.style.fontSize = `${fontSize}px`;
      }
    });
  }, [editor, fontSize]);

  // Handle formatting commands
  const handleFormatting = useCallback((formatType: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, formatType);
  }, [editor]);

  // Handle highlight color changes
  const handleHighlightColor = useCallback((color: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, {
          'background-color': color,
        });
      }
    });
  }, [editor]);

  // Remove highlighting
  const removeHighlight = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, {
          'background-color': '',
        });
      }
    });
  }, [editor]);

  // Listen for formatting events from FontsPanel
  useEffect(() => {
    const handleBoldToggle = () => handleFormatting('bold');
    const handleItalicToggle = () => handleFormatting('italic');
    const handleUnderlineToggle = () => handleFormatting('underline');
    const handleStrikethroughToggle = () => handleFormatting('strikethrough');
    
    const handleHighlight = (event: CustomEvent) => {
      const { color } = event.detail;
      handleHighlightColor(color);
    };

    const handleRemoveHighlight = () => removeHighlight();

    // Font formatting events
    window.addEventListener('format-bold', handleBoldToggle);
    window.addEventListener('format-italic', handleItalicToggle);
    window.addEventListener('format-underline', handleUnderlineToggle);
    window.addEventListener('format-strikethrough', handleStrikethroughToggle);
    window.addEventListener('format-highlight', handleHighlight as EventListener);
    window.addEventListener('format-remove-highlight', handleRemoveHighlight);

    return () => {
      window.removeEventListener('format-bold', handleBoldToggle);
      window.removeEventListener('format-italic', handleItalicToggle);
      window.removeEventListener('format-underline', handleUnderlineToggle);
      window.removeEventListener('format-strikethrough', handleStrikethroughToggle);
      window.removeEventListener('format-highlight', handleHighlight as EventListener);
      window.removeEventListener('format-remove-highlight', handleRemoveHighlight);
    };
  }, [handleFormatting, handleHighlightColor, removeHighlight]);

  // Track current selection formatting state
  useEffect(() => {
    const updateFormattingState = () => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const formatting = {
            bold: selection.hasFormat('bold'),
            italic: selection.hasFormat('italic'),
            underline: selection.hasFormat('underline'),
            strikethrough: selection.hasFormat('strikethrough'),
            highlight: false,
            highlightColor: '#ffffff'
          };

          // Check for highlight styling
          const nodes = selection.getNodes();
          if (nodes.length > 0) {
            const firstNode = nodes[0];
            const element = editor.getElementByKey(firstNode.getKey());
            if (element) {
              const backgroundColor = window.getComputedStyle(element).backgroundColor;
              if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
                formatting.highlight = true;
                formatting.highlightColor = backgroundColor;
              }
            }
          }

          onFormattingChange?.(formatting);
          
          // Emit formatting state change event for FontsPanel
          window.dispatchEvent(new CustomEvent('formatting-state-change', { 
            detail: formatting 
          }));
        }
      });
    };

    // Listen for selection changes to update formatting state
    const removeListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateFormattingState();
      });
    });

    return removeListener;
  }, [editor, onFormattingChange]);

  // Handle keyboard shortcuts for formatting
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when editor has focus
      const editorElement = editor.getRootElement();
      if (!editorElement || !editorElement.contains(document.activeElement)) {
        return;
      }

      // Standard formatting shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'b':
            event.preventDefault();
            handleFormatting('bold');
            break;
          case 'i':
            event.preventDefault();
            handleFormatting('italic');
            break;
          case 'u':
            event.preventDefault();
            handleFormatting('underline');
            break;
          case 'h':
            if (event.shiftKey) {
              event.preventDefault();
              handleHighlightColor('#ffff00'); // Default yellow highlight
            }
            break;
        }
      }
    };

    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('keydown', handleKeyDown);
      
      return () => {
        editorElement.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [editor, handleFormatting, handleHighlightColor]);

  // Handle text styling commands for clipboard operations
  useEffect(() => {
    // Custom command for applying text styles
    const handleTextStyleCommand = (payload: {
      styleProperty: string;
      styleValue: string;
    }) => {
      const { styleProperty, styleValue } = payload;
      
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, {
            [styleProperty]: styleValue,
          });
        }
      });
      
      return true;
    };

    const removeCommand = editor.registerCommand(
      'APPLY_TEXT_STYLE' as any,
      handleTextStyleCommand,
      1
    );

    return removeCommand;
  }, [editor]);

  // Enhanced clipboard handling for formatted text
  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && !selection.isCollapsed()) {
          const htmlString = selection.getNodes()
            .map(node => {
              if (node.getTextContent) {
                const text = node.getTextContent();
                const element = editor.getElementByKey(node.getKey());
                
                if (element) {
                  // Get computed styles
                  const styles = window.getComputedStyle(element);
                  const formatStyles: string[] = [];
                  
                  if (styles.fontWeight === 'bold' || parseInt(styles.fontWeight) >= 600) {
                    formatStyles.push('font-weight: bold');
                  }
                  
                  if (styles.fontStyle === 'italic') {
                    formatStyles.push('font-style: italic');
                  }
                  
                  if (styles.textDecoration.includes('underline')) {
                    formatStyles.push('text-decoration: underline');
                  }
                  
                  if (styles.backgroundColor && styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                    formatStyles.push(`background-color: ${styles.backgroundColor}`);
                  }

                  if (formatStyles.length > 0) {
                    return `<span style="${formatStyles.join('; ')}">${text}</span>`;
                  }
                }
                
                return text;
              }
              return '';
            })
            .join('');

          if (htmlString && event.clipboardData) {
            event.clipboardData.setData('text/html', htmlString);
            event.clipboardData.setData('text/plain', selection.getTextContent());
            event.preventDefault();
          }
        }
      });
    };

    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('copy', handleCopy);
      
      return () => {
        editorElement.removeEventListener('copy', handleCopy);
      };
    }
  }, [editor]);

  // This plugin doesn't render anything
  return null;
}

// Helper function to emit formatting events (for use by FontsPanel)
export const emitFormattingEvent = (type: string, data?: any) => {
  window.dispatchEvent(new CustomEvent(`format-${type}`, { detail: data }));
};

// Helper functions for common formatting operations
export const toggleBold = () => emitFormattingEvent('bold');
export const toggleItalic = () => emitFormattingEvent('italic');
export const toggleUnderline = () => emitFormattingEvent('underline');
export const toggleStrikethrough = () => emitFormattingEvent('strikethrough');
export const applyHighlight = (color: string) => emitFormattingEvent('highlight', { color });
export const removeHighlight = () => emitFormattingEvent('remove-highlight');