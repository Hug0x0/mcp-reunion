#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const BASE = 'https://data.regionreunion.com/api/explore/v2.1/catalog/datasets';
const MANIFEST = new URL('../schema-expectations.json', import.meta.url);

async function fetchDatasetFields(datasetId) {
  const url = `${BASE}/${datasetId}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'mcp-reunion/schema-check',
    },
  });

  if (!response.ok) {
    throw new Error(`[${response.status}] ${await response.text()}`);
  }

  const metadata = await response.json();
  return new Set((metadata.fields ?? []).map((field) => field.name));
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const entries = Object.entries(manifest.datasets ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const failures = [];

  for (const [datasetId, expectedFields] of entries) {
    try {
      const actualFields = await fetchDatasetFields(datasetId);
      const missing = expectedFields.filter((field) => !actualFields.has(field));
      if (missing.length > 0) {
        failures.push({ datasetId, missing });
      }
    } catch (error) {
      failures.push({ datasetId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (failures.length === 0) {
    console.log(`Schema check passed for ${entries.length} datasets.`);
    return;
  }

  console.error('Schema drift detected:');
  for (const failure of failures) {
    if ('missing' in failure) {
      console.error(`- ${failure.datasetId}: missing ${failure.missing.map((field) => `\`${field}\``).join(', ')}`);
    } else {
      console.error(`- ${failure.datasetId}: ${failure.error}`);
    }
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

