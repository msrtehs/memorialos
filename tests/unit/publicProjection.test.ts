import { describe, it, expect } from 'vitest';
import { PUBLIC_FIELDS } from '@/services/deceasedService';

describe('projeção pública (LGPD)', () => {
  it('whitelist NUNCA contém campos sensíveis', () => {
    const forbidden = ['causeOfDeath', 'familyMembers', 'documents', 'createdBy', 'plotId'];
    for (const field of forbidden) {
      expect(PUBLIC_FIELDS).not.toContain(field);
    }
  });
});
