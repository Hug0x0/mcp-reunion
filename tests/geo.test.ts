import { describe, expect, it } from 'vitest';
import { distanceMeters, withinRadius } from '../src/utils/geo.js';

describe('geo helpers', () => {
  it('computes distance in meters', () => {
    const distance = distanceMeters(
      { lat: -20.887712, lon: 55.451452 },
      { lat: -20.887712, lon: 55.461452 }
    );

    expect(distance).toBeGreaterThan(1000);
    expect(distance).toBeLessThan(1100);
  });

  it('filters and sorts records within a radius', () => {
    const records = [
      { name: 'far', lat: -20.9, lon: 55.5 },
      { name: 'near', lat: -20.8878, lon: 55.4515 },
      { name: 'missing' },
    ];

    const result = withinRadius(records, { lat: -20.887712, lon: 55.451452 }, 100);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('near');
    expect(result[0].distance_m).toBeGreaterThanOrEqual(0);
  });
});

