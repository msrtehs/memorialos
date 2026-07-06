import { parseISO, format } from 'date-fns';

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatDate = (isoDate?: string | null): string => {
  if (!isoDate) return '—';
  try {
    return format(parseISO(isoDate), 'dd/MM/yyyy');
  } catch {
    return isoDate;
  }
};

export const formatDateTime = (isoDateTime?: string | null): string => {
  if (!isoDateTime) return '—';
  try {
    return format(parseISO(isoDateTime), 'dd/MM/yyyy HH:mm');
  } catch {
    return isoDateTime;
  }
};
