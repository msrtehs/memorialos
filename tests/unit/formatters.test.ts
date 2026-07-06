import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/formatters';

describe('formatters', () => {
  it('data ISO exibe dd/MM/yyyy sem deslocar o dia', () =>
    expect(formatDate('2024-03-15')).toBe('15/03/2024'));
  it('data vazia exibe travessão', () => expect(formatDate('')).toBe('—'));
  it('datetime ISO exibe dd/MM/yyyy HH:mm', () =>
    expect(formatDateTime('2024-03-15T09:30')).toBe('15/03/2024 09:30'));
  it('moeda pt-BR', () => expect(formatCurrency(1234.56)).toMatch(/R\$\s?1\.234,56/));
});
