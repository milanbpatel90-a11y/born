import { describe, it, expect } from 'vitest';
import {
  clamp,
  lerp,
  degToRad,
  radToDeg,
  distance,
  angleBetweenPoints,
  smoothEMA,
  formatBytes,
  formatTime,
  generateId,
  deepClone,
  isEmpty,
} from '../helpers.js';

describe('clamp', () => {
  it('returns the value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min when value is below', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('clamps to max when value is above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('handles equal min and max', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

describe('lerp', () => {
  it('returns start when factor is 0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns end when factor is 1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint when factor is 0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });
});

describe('degToRad / radToDeg', () => {
  it('converts 180 degrees to PI radians', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
  });

  it('converts 0 degrees to 0 radians', () => {
    expect(degToRad(0)).toBe(0);
  });

  it('converts PI radians to 180 degrees', () => {
    expect(radToDeg(Math.PI)).toBeCloseTo(180);
  });

  it('round-trips correctly', () => {
    expect(radToDeg(degToRad(45))).toBeCloseTo(45);
  });
});

describe('distance', () => {
  it('calculates 2D distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });

  it('calculates 3D distance', () => {
    expect(distance({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 2 })).toBeCloseTo(3);
  });

  it('returns 0 for same point', () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe('angleBetweenPoints', () => {
  it('returns PI for a straight line (180 degrees)', () => {
    const p1 = { x: -1, y: 0 };
    const p2 = { x: 0, y: 0 };
    const p3 = { x: 1, y: 0 };
    expect(angleBetweenPoints(p1, p2, p3)).toBeCloseTo(Math.PI);
  });

  it('returns PI/2 for a right angle', () => {
    const p1 = { x: 1, y: 0 };
    const p2 = { x: 0, y: 0 };
    const p3 = { x: 0, y: 1 };
    expect(angleBetweenPoints(p1, p2, p3)).toBeCloseTo(Math.PI / 2);
  });

  it('returns 0 when a point has zero magnitude', () => {
    const p = { x: 0, y: 0 };
    expect(angleBetweenPoints(p, p, p)).toBe(0);
  });
});

describe('smoothEMA', () => {
  it('returns current when factor is 0', () => {
    expect(smoothEMA(10, 20, 0)).toBe(10);
  });

  it('returns target when factor is 1', () => {
    expect(smoothEMA(10, 20, 1)).toBe(20);
  });

  it('moves toward target with fractional factor', () => {
    const result = smoothEMA(10, 20, 0.5);
    expect(result).toBe(15);
  });
});

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 Bytes');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });
});

describe('formatTime', () => {
  it('formats milliseconds', () => {
    expect(formatTime(500)).toBe('500ms');
  });

  it('formats seconds', () => {
    expect(formatTime(2500)).toBe('2.5s');
  });

  it('formats minutes', () => {
    expect(formatTime(90000)).toBe('1.5m');
  });

  it('formats hours', () => {
    expect(formatTime(5400000)).toBe('1.5h');
  });
});

describe('generateId', () => {
  it('generates a string with the default prefix', () => {
    const id = generateId();
    expect(id).toMatch(/^id_/);
  });

  it('generates a string with a custom prefix', () => {
    const id = generateId('test');
    expect(id).toMatch(/^test_/);
  });

  it('generates unique IDs', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });
});

describe('deepClone', () => {
  it('clones primitives', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(null)).toBe(null);
  });

  it('clones arrays', () => {
    const arr = [1, 2, { a: 3 }];
    const cloned = deepClone(arr);
    expect(cloned).toEqual(arr);
    expect(cloned).not.toBe(arr);
    expect(cloned[2]).not.toBe(arr[2]);
  });

  it('clones nested objects', () => {
    const obj = { a: 1, b: { c: 2 } };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned.b).not.toBe(obj.b);
  });

  it('clones Date objects', () => {
    const date = new Date('2024-01-01');
    const cloned = deepClone(date);
    expect(cloned.getTime()).toBe(date.getTime());
    expect(cloned).not.toBe(date);
  });
});

describe('isEmpty', () => {
  it('returns true for null and undefined', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isEmpty('')).toBe(true);
  });

  it('returns false for non-empty string', () => {
    expect(isEmpty('hello')).toBe(false);
  });

  it('returns true for empty array', () => {
    expect(isEmpty([])).toBe(true);
  });

  it('returns false for non-empty array', () => {
    expect(isEmpty([1])).toBe(false);
  });

  it('returns true for empty object', () => {
    expect(isEmpty({})).toBe(true);
  });

  it('returns false for non-empty object', () => {
    expect(isEmpty({ a: 1 })).toBe(false);
  });
});
