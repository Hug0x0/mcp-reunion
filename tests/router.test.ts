import { describe, expect, it } from 'vitest';
import { findRelevantTools } from '../src/modules/router.js';

describe('findRelevantTools', () => {
  it('routes transport questions to transport tools', () => {
    const suggestions = findRelevantTools('Quels bus Car Jaune desservent Saint-Denis ?');
    expect(suggestions[0].topic).toBe('transport');
    expect(suggestions[0].tools).toContain('reunion_list_car_jaune_routes');
  });

  it('routes election questions to election tools', () => {
    const suggestions = findRelevantTools('Compare les élections législatives 2024 à La Réunion');
    expect(suggestions[0].topic).toBe('elections');
    expect(suggestions[0].tools).toContain('reunion_get_legislative_2024_round1');
  });

  it('falls back to catalog discovery', () => {
    const suggestions = findRelevantTools('Question très spécifique sans mot-clé évident');
    expect(suggestions[0].topic).toBe('catalog discovery');
    expect(suggestions[0].tools).toContain('reunion_search_catalog');
  });
});

