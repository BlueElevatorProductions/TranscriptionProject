/**
 * ContentPopulationPlugin - Populates the editor with clips content
 *
 * This plugin handles converting clips data to Lexical nodes and updating
 * the editor state when clips change.
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';

import { $createWordNodeV2 } from '../nodes/WordNodeV2';
import { $createSpacerNodeV2 } from '../nodes/SpacerNodeV2';
import { $createClipNodeV2 } from '../nodes/ClipNodeV2';
import { Clip } from '../../../shared/types';

export interface ContentPopulationPluginProps {
  clips: Clip[];
  isReadOnly?: boolean;
}

export default function ContentPopulationPlugin({
  clips,
  isReadOnly = false
}: ContentPopulationPluginProps) {
  const [editor] = useLexicalComposerContext();

  // Populate editor with clips content
  useEffect(() => {
    if (clips.length > 0) {
      console.log('📝 ContentPopulationPlugin: Populating editor with clips:', clips.length);

      editor.update(() => {
        const root = $getRoot();
        root.clear();

        // Sort clips by order
        const sortedClips = [...clips]
          .filter(clip => clip.status === 'active')
          .sort((a, b) => a.order - b.order);

        for (const clip of sortedClips) {
          const clipNode = $createClipNodeV2({
            clipId: clip.id,
            speaker: clip.speaker,
            displayName: clip.speaker,
            startTime: clip.startTime,
            endTime: clip.endTime,
            readOnly: isReadOnly
          });

          // Add segments to clip
          const paragraph = $createParagraphNode();

          for (let i = 0; i < clip.segments.length; i++) {
            const segment = clip.segments[i];

            if (segment.type === 'word') {
              const wordSegment = segment as any;
              const wordNode = $createWordNodeV2({
                word: wordSegment.text,
                start: clip.startTime + segment.start,
                end: clip.startTime + segment.end,
                originalStart: clip.startTime + segment.start, // Keep same for now
                originalEnd: clip.startTime + segment.end,     // Keep same for now
                confidence: wordSegment.confidence || 1.0,
                clipId: clip.id,
                segmentIndex: i
              });

              paragraph.append(wordNode);

              // Add space after word (except for last word in clip)
              if (i < clip.segments.length - 1) {
                paragraph.append($createTextNode(' '));
              }
            } else if (segment.type === 'spacer') {
              const spacerSegment = segment as any;
              console.log(`🔲 Rendering spacer segment: ${(segment.end - segment.start).toFixed(1)}s`);

              const spacerNode = $createSpacerNodeV2({
                duration: segment.end - segment.start,
                startTime: clip.startTime + segment.start,
                endTime: clip.startTime + segment.end,
                clipId: clip.id,
                segmentIndex: i,
                label: spacerSegment.label || `${(segment.end - segment.start).toFixed(1)}s`
              });

              paragraph.append(spacerNode);

              // Add space after spacer (except for last segment in clip)
              if (i < clip.segments.length - 1) {
                paragraph.append($createTextNode(' '));
              }
            }
          }

          clipNode.append(paragraph);
          root.append(clipNode);
        }

        console.log('✅ ContentPopulationPlugin: Editor content populated successfully');
        console.log('📊 Root children count:', root.getChildrenSize());
      });
    } else {
      // Clear editor when no clips
      editor.update(() => {
        const root = $getRoot();
        root.clear();
      });
    }
  }, [clips, editor, isReadOnly]);

  return null; // This plugin doesn't render anything
}