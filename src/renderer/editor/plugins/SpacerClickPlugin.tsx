/**
 * SpacerClickPlugin - Handles spacer click behavior in Edit Mode
 * Intercepts clicks on spacer pills and positions cursor before the spacer
 * for proper Enter key splitting behavior.
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, $createRangeSelection, $setSelection } from 'lexical';
import { $isSpacerNode } from '../nodes/SpacerNode';
import { $isWordNode } from '../nodes/WordNode';

interface SpacerClickPluginProps {
  readOnly?: boolean;
}

export default function SpacerClickPlugin({ readOnly = false }: SpacerClickPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Only active in Edit mode
    if (readOnly) return;

    const editorElement = editor.getRootElement();
    if (!editorElement) return;

    const handleSpacerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if clicked on spacer element or its children
      const spacerEl = target.classList.contains('lexical-spacer-node')
        ? target
        : target.closest('.lexical-spacer-node') as HTMLElement;

      if (spacerEl) {
        console.log('[SpacerClickPlugin] Spacer clicked, positioning cursor before spacer');

        // Prevent default behavior to avoid normal cursor positioning
        e.preventDefault();
        e.stopPropagation();

        // Get the spacer node key
        const nodeKey = spacerEl.getAttribute('data-lexical-node-key');

        if (nodeKey) {
          // First, verify the spacer exists before making any changes
          const spacerExists = editor.getEditorState().read(() => {
            const node = $getNodeByKey(nodeKey);
            return node && $isSpacerNode(node);
          });

          if (!spacerExists) {
            console.log('[SpacerClickPlugin] Warning: Spacer node not found with key:', nodeKey);
            return;
          }

          console.log('[SpacerClickPlugin] Spacer node confirmed, proceeding with cursor positioning');

          editor.update(() => {
            try {
              // Re-verify spacer node exists in update context
              const spacerNode = $getNodeByKey(nodeKey);

              if (!spacerNode || !$isSpacerNode(spacerNode)) {
                console.log('[SpacerClickPlugin] Warning: Spacer node disappeared during update, key:', nodeKey);
                return;
              }

              console.log('[SpacerClickPlugin] Found spacer node in update, positioning cursor');

              // Store spacer's clipId for EditingPlugin to use in Enter handler
              const spacerClipId = (spacerNode as any).__clipId;
              if (spacerClipId) {
                // Store in editor's metadata for EditingPlugin access
                editor.getEditorState().data.lastClickedSpacerClipId = spacerClipId;
                console.log('[SpacerClickPlugin] Stored spacer clipId for Enter handler:', spacerClipId);
              }

              // Find the paragraph container (should be spacer's parent or grandparent)
              let paragraphNode = spacerNode.getParent();
              while (paragraphNode && paragraphNode.getType() !== 'paragraph') {
                paragraphNode = paragraphNode.getParent();
              }

              if (!paragraphNode) {
                console.log('[SpacerClickPlugin] Warning: Could not find paragraph parent');
                return;
              }

              console.log('[SpacerClickPlugin] Found paragraph container');

              // Find spacer position within the paragraph
              const paragraphChildren = paragraphNode.getChildren();
              let spacerIndex = -1;
              let actualSpacerNode = null;

              // Find the spacer in the paragraph's children (could be direct or nested)
              const findSpacerInChildren = (children: any[], targetKey: string): number => {
                try {
                  for (let i = 0; i < children.length; i++) {
                    const child = children[i];

                    // Defensive check: ensure child has required methods
                    if (!child || typeof child.getKey !== 'function') {
                      continue;
                    }

                    if (child.getKey() === targetKey) {
                      actualSpacerNode = child;
                      return i;
                    }

                    // Check if spacer is nested within this child
                    if (typeof child.getChildren === 'function') {
                      try {
                        const childChildren = child.getChildren();
                        if (Array.isArray(childChildren)) {
                          const nestedIndex = childChildren.findIndex((c: any) => {
                            try {
                              return c && typeof c.getKey === 'function' && c.getKey() === targetKey;
                            } catch {
                              return false;
                            }
                          });
                          if (nestedIndex !== -1) {
                            actualSpacerNode = childChildren[nestedIndex];
                            return i; // Return parent's index, but we'll position within it
                          }
                        }
                      } catch (nestedError) {
                        console.log('[SpacerClickPlugin] Warning: Error accessing nested children:', nestedError);
                        // Continue to next child
                      }
                    }
                  }
                } catch (searchError) {
                  console.error('[SpacerClickPlugin] Error searching for spacer in children:', searchError);
                }
                return -1;
              };

              spacerIndex = findSpacerInChildren(paragraphChildren, nodeKey);

              if (spacerIndex === -1) {
                console.log('[SpacerClickPlugin] Warning: Could not find spacer in paragraph');
                return;
              }

              console.log('[SpacerClickPlugin] Spacer index in paragraph:', spacerIndex, 'total children:', paragraphChildren.length);

              // Create a proper Lexical range selection positioned before the spacer
              try {
                const selection = $createRangeSelection();

                if (spacerIndex > 0) {
                  // Position cursor at end of previous element in paragraph
                  const prevNode = paragraphChildren[spacerIndex - 1];

                  // Defensive check: ensure prevNode has required methods
                  if (!prevNode || typeof prevNode.getType !== 'function' || typeof prevNode.getKey !== 'function') {
                    console.log('[SpacerClickPlugin] Warning: Previous node invalid, using paragraph fallback');
                    selection.anchor.set(paragraphNode.getKey(), spacerIndex, 'element');
                    selection.focus.set(paragraphNode.getKey(), spacerIndex, 'element');
                  } else {
                    const prevNodeType = prevNode.getType();
                    console.log('[SpacerClickPlugin] Positioning cursor after previous paragraph child:', prevNodeType);

                    if ($isWordNode(prevNode)) {
                      // For word nodes, position at end of text content
                      try {
                        const textContent = prevNode.getTextContent();
                        selection.anchor.set(prevNode.getKey(), textContent.length, 'text');
                        selection.focus.set(prevNode.getKey(), textContent.length, 'text');
                      } catch (wordError) {
                        console.log('[SpacerClickPlugin] Warning: Error accessing word content, using paragraph fallback');
                        selection.anchor.set(paragraphNode.getKey(), spacerIndex, 'element');
                        selection.focus.set(paragraphNode.getKey(), spacerIndex, 'element');
                      }
                    } else if (prevNodeType === 'text') {
                      // For text nodes, position at end
                      try {
                        const textContent = prevNode.getTextContent();
                        selection.anchor.set(prevNode.getKey(), textContent.length, 'text');
                        selection.focus.set(prevNode.getKey(), textContent.length, 'text');
                      } catch (textError) {
                        console.log('[SpacerClickPlugin] Warning: Error accessing text content, using paragraph fallback');
                        selection.anchor.set(paragraphNode.getKey(), spacerIndex, 'element');
                        selection.focus.set(paragraphNode.getKey(), spacerIndex, 'element');
                      }
                    } else {
                      // For element nodes, try to position at end of last child
                      if (typeof prevNode.getChildren === 'function') {
                        try {
                          const children = prevNode.getChildren();
                          if (children && children.length > 0) {
                            const lastChild = children[children.length - 1];
                            if ($isWordNode(lastChild) && typeof lastChild.getTextContent === 'function') {
                              try {
                                const textContent = lastChild.getTextContent();
                                selection.anchor.set(lastChild.getKey(), textContent.length, 'text');
                                selection.focus.set(lastChild.getKey(), textContent.length, 'text');
                              } catch (lastChildError) {
                                console.log('[SpacerClickPlugin] Warning: Error with last child, using paragraph fallback');
                                selection.anchor.set(paragraphNode.getKey(), spacerIndex, 'element');
                                selection.focus.set(paragraphNode.getKey(), spacerIndex, 'element');
                              }
                            } else {
                              // Fallback: position at paragraph level before spacer
                              selection.anchor.set(paragraphNode.getKey(), spacerIndex, 'element');
                              selection.focus.set(paragraphNode.getKey(), spacerIndex, 'element');
                            }
                          } else {
                            // Empty element, position at paragraph level
                            selection.anchor.set(paragraphNode.getKey(), spacerIndex, 'element');
                            selection.focus.set(paragraphNode.getKey(), spacerIndex, 'element');
                          }
                        } catch (childrenError) {
                          console.log('[SpacerClickPlugin] Warning: Error accessing children, using paragraph fallback');
                          selection.anchor.set(paragraphNode.getKey(), spacerIndex, 'element');
                          selection.focus.set(paragraphNode.getKey(), spacerIndex, 'element');
                        }
                      } else {
                        // Fallback: position at paragraph level before spacer
                        selection.anchor.set(paragraphNode.getKey(), spacerIndex, 'element');
                        selection.focus.set(paragraphNode.getKey(), spacerIndex, 'element');
                      }
                    }
                  }
                } else {
                  // Spacer is first child, select at start of paragraph
                  console.log('[SpacerClickPlugin] Spacer is first child, selecting paragraph start');
                  selection.anchor.set(paragraphNode.getKey(), 0, 'element');
                  selection.focus.set(paragraphNode.getKey(), 0, 'element');
                }

                // Apply the selection
                $setSelection(selection);
                console.log('[SpacerClickPlugin] Selection positioned successfully in paragraph context');

                // Final verification that spacer still exists after selection
                const spacerStillExists = $getNodeByKey(nodeKey);
                if (!spacerStillExists || !$isSpacerNode(spacerStillExists)) {
                  console.error('[SpacerClickPlugin] CRITICAL: Spacer disappeared after selection change!');
                } else {
                  console.log('[SpacerClickPlugin] Spacer verified to still exist after selection');
                }

              } catch (selectionError) {
                console.error('[SpacerClickPlugin] Error creating/setting selection:', selectionError);
                // Don't throw - just log the error and continue
              }

            } catch (error) {
              console.error('[SpacerClickPlugin] Error in spacer click handling:', error);
              // Don't rethrow - prevent state corruption
            }
          });
        } else {
          console.log('[SpacerClickPlugin] Warning: Spacer element has no node key');
        }
      }
    };

    // Use capture phase to intercept before other handlers
    console.log('[SpacerClickPlugin] Registering spacer click handler');
    editorElement.addEventListener('click', handleSpacerClick, true);

    return () => {
      console.log('[SpacerClickPlugin] Unregistering spacer click handler');
      editorElement.removeEventListener('click', handleSpacerClick, true);
    };
  }, [editor, readOnly]);

  return null;
}