import { normalizeSegmentsForImport, validateNormalizedSegments } from '../operations';
import { Segment } from '../types';

describe('normalizeSegmentsForImport', () => {
  const createWord = (id: string, start: number, end: number): Segment => ({
    type: 'word',
    id,
    start,
    end,
    text: id,
    confidence: 0.9,
    originalStart: start,
    originalEnd: end,
  });

  it('trims minor overlaps by adjusting previous end time', () => {
    const segments: Segment[] = [
      createWord('a', 0, 1.0),
      createWord('b', 0.999, 1.5),
    ];

    const result = normalizeSegmentsForImport(segments);
    expect(result.trimmedCount).toBeGreaterThan(0);
    expect(result.shiftedCount).toBe(0);
    expect(result.segments[0].end).toBeCloseTo(0.999, 3);
    expect(result.segments[1].start).toBeCloseTo(0.999, 3);

    expect(() => validateNormalizedSegments(result.segments)).not.toThrow();
  });

  it('shifts later segment when overlap exceeds threshold', () => {
    const segments: Segment[] = [
      createWord('a', 0, 1.0),
      createWord('b', 0.8, 1.4),
    ];

    const result = normalizeSegmentsForImport(segments);
    expect(result.shiftedCount).toBeGreaterThan(0);
    expect(result.segments[1].start).toBeCloseTo(1.0, 3);
    expect(result.segments[1].end).toBeGreaterThanOrEqual(result.segments[1].start);

    expect(() => validateNormalizedSegments(result.segments)).not.toThrow();
  });

  it('removes zero-duration spacers', () => {
    const segments: Segment[] = [
      {
        type: 'spacer',
        id: 'spacer-1',
        start: 1.0,
        end: 1.0,
        duration: 0,
        label: '0s',
      },
      createWord('a', 1.0, 1.5),
    ];

    const result = normalizeSegmentsForImport(segments);
    expect(result.removedCount).toBe(1);
    expect(result.segments.length).toBe(1);
    expect(result.segments[0].start).toBeCloseTo(1.0, 3);
  });
});
