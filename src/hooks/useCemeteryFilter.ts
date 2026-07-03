import { useMemo } from 'react';
import { useAdmin } from '@/contexts/AdminContext';

export function useCemeteryFilter<T extends { cemeteryId: string }>(items: T[]) {
  const { selectedCemeteryId } = useAdmin();
  return useMemo(
    () => selectedCemeteryId === 'all'
      ? items
      : items.filter(item => item.cemeteryId === selectedCemeteryId),
    [items, selectedCemeteryId]
  );
}
