import { describe, it, expect } from 'vitest';
import {
  buildWhere,
  escapeOdSqlString,
  quote,
  normalizeText,
  pickString,
  pickNumber,
  pickBoolean,
  pickValue,
} from '../src/utils/helpers.js';

describe('quote / escapeOdSqlString', () => {
  it('wraps value in single quotes', () => {
    expect(quote('hello')).toBe("'hello'");
  });

  it("doubles embedded single quotes to prevent ODSQL injection", () => {
    expect(quote("L'Hermitage")).toBe("'L''Hermitage'");
    expect(escapeOdSqlString("it's 'mine'")).toBe("it''s ''mine''");
  });
});

describe('buildWhere', () => {
  it('joins truthy conditions with AND', () => {
    expect(buildWhere(['a = 1', 'b = 2', 'c = 3'])).toBe('a = 1 AND b = 2 AND c = 3');
  });

  it('filters out undefined/null/false entries (the conditional-filter pattern used everywhere)', () => {
    expect(buildWhere(['a = 1', undefined, false, null, 'b = 2'])).toBe('a = 1 AND b = 2');
  });

  it('returns undefined when no conditions are truthy', () => {
    expect(buildWhere([undefined, null, false])).toBeUndefined();
    expect(buildWhere([])).toBeUndefined();
  });
});

describe('normalizeText', () => {
  it('strips accents and lowercases', () => {
    expect(normalizeText('Réunion')).toBe('reunion');
    expect(normalizeText('  CAFÉ  ')).toBe('cafe');
  });
});

describe('pickValue / pickString / pickNumber / pickBoolean', () => {
  const row = {
    name: 'Saint-Denis',
    population: 149337,
    pct: '12.5',
    active: 1,
    empty_str: '',
    null_val: null,
  } as Record<string, unknown>;

  it('pickValue returns first defined candidate', () => {
    expect(pickValue(row, ['missing', 'name'])).toBe('Saint-Denis');
    expect(pickValue(row, ['null_val', 'name'])).toBe('Saint-Denis'); // null skipped
    expect(pickValue(row, ['missing'])).toBeUndefined();
  });

  it('pickString coerces numbers to strings', () => {
    expect(pickString(row, ['population'])).toBe('149337');
    expect(pickString(row, ['name'])).toBe('Saint-Denis');
    expect(pickString(row, ['missing'])).toBeUndefined();
  });

  it('pickNumber parses numeric strings and rejects non-finite', () => {
    expect(pickNumber(row, ['population'])).toBe(149337);
    expect(pickNumber(row, ['pct'])).toBe(12.5);
    expect(pickNumber(row, ['name'])).toBeUndefined(); // non-numeric string
    expect(pickNumber(row, ['empty_str'])).toBeUndefined();
  });

  it('pickBoolean understands French / numeric truth values', () => {
    expect(pickBoolean(row, ['active'])).toBe(true);
    expect(pickBoolean({ v: 'Oui' }, ['v'])).toBe(true);
    expect(pickBoolean({ v: 'non' }, ['v'])).toBe(false);
    expect(pickBoolean({ v: 0 }, ['v'])).toBe(false);
    expect(pickBoolean({ v: 'maybe' }, ['v'])).toBeUndefined();
  });
});
