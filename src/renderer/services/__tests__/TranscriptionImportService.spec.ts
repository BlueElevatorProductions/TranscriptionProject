import { TranscriptionImportService } from '../TranscriptionImportService';
import { EDLBuilderService } from '../EDLBuilderService';
import { TranscriptionResult } from '../../../shared/types';

describe('TranscriptionImportService spacer handling', () => {
  const sampleTranscription: TranscriptionResult = {
    language: 'en',
    segments: [
      {
        id: 1,
        start: 0,
        end: 4,
        text: 'Hello ... World',
        speaker: 'Speaker 1',
        words: [
          { start: 0, end: 1, word: 'Hello', score: 0.92, speaker: 'Speaker 1' },
          { start: 3, end: 4, word: 'World', score: 0.94, speaker: 'Speaker 1' }
        ]
      }
    ],
    speakers: {
      'Speaker 1': 'Speaker 1'
    },
    speakerSegments: []
  };

  it('creates spacer segments for pauses that exceed the threshold', () => {
    const project = TranscriptionImportService.importTranscription(
      sampleTranscription,
      '/tmp/hello-world.wav',
      { duration: 10 }
    );

    const clips = project.clips.clips;
    expect(clips).toHaveLength(1);

    const [clip] = clips;
    expect(clip.segments).toHaveLength(3);

    const [first, spacer, last] = clip.segments;
    expect(first).toMatchObject({
      type: 'word',
      text: 'Hello',
      start: 0,
      end: 1,
      originalStart: 0,
      originalEnd: 1
    });
    expect(spacer).toMatchObject({
      type: 'spacer',
      start: 1,
      end: 3,
      label: '2.0s'
    });
    expect(last).toMatchObject({
      type: 'word',
      text: 'World',
      start: 3,
      end: 4,
      originalStart: 3,
      originalEnd: 4
    });

    const edl = EDLBuilderService.buildEDL(clips);
    expect(edl.metadata.clipCount).toBe(1);
    expect(edl.metadata.segmentCount).toBe(3);

    const edlClip = edl.clips[0];
    expect(edlClip.segments).toBeDefined();
    expect(edlClip.segments?.length).toBe(3);

    const edlSegments = edlClip.segments!;
    expect(edlSegments[0]).toMatchObject({
      type: 'word',
      text: 'Hello',
      startSec: 0,
      endSec: 1,
      originalStartSec: 0,
      originalEndSec: 1
    });
    expect(edlSegments[1]).toMatchObject({
      type: 'spacer',
      startSec: 1,
      endSec: 3
    });
    expect(edlSegments[2]).toMatchObject({
      type: 'word',
      text: 'World',
      startSec: 3,
      endSec: 4,
      originalStartSec: 3,
      originalEndSec: 4
    });

    const spacerCount = edlSegments.filter(segment => segment.type === 'spacer').length;
    const wordCount = edlSegments.filter(segment => segment.type === 'word').length;

    expect(spacerCount).toBe(1);
    expect(wordCount).toBe(2);
  });
});
