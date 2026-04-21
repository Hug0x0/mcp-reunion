// src/utils/helpers.ts

import { RecordObject, ToolResult } from '../types.js';

/**
 * Format data as JSON tool result
 */
export function jsonResult(data: unknown): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Format error as tool result
 */
export function errorResult(message: string): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: message }, null, 2),
      },
    ],
  };
}

/**
 * Build ODSQL WHERE clause from conditions
 */
export function buildWhere(
  conditions: Array<string | undefined | null | false>
): string | undefined {
  const valid = conditions.filter((condition): condition is string => Boolean(condition));
  return valid.length > 0 ? valid.join(' AND ') : undefined;
}

/**
 * Escape a string literal for ODSQL
 */
export function escapeOdSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Quote an ODSQL string literal
 */
export function quote(value: string): string {
  return `'${escapeOdSqlString(value)}'`;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function today(): string {
  return formatDate(new Date());
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Pick the first defined value from a record
 */
export function pickValue<T = unknown>(
  record: RecordObject,
  candidates: string[]
): T | undefined {
  for (const candidate of candidates) {
    if (candidate in record) {
      const value = record[candidate];
      if (value !== undefined && value !== null) {
        return value as T;
      }
    }
  }
  return undefined;
}

/**
 * Pick the first string-like value from a record
 */
export function pickString(
  record: RecordObject,
  candidates: string[]
): string | undefined {
  const value = pickValue(record, candidates);
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

/**
 * Pick the first numeric value from a record
 */
export function pickNumber(
  record: RecordObject,
  candidates: string[]
): number | undefined {
  const value = pickValue(record, candidates);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Pick the first boolean-like value from a record
 */
export function pickBoolean(
  record: RecordObject,
  candidates: string[]
): boolean | undefined {
  const value = pickValue(record, candidates);
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'oui', 'yes'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'non', 'no'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
}

/**
 * Normalize a string for case-insensitive comparisons
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
