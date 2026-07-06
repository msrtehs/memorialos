import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCemeteries, Cemetery } from '@/services/cemeteryService';
import { useAuth } from '@/contexts/AuthContext';
import { reportLoadError } from '@/lib/errors';

interface AdminContextType {
  selectedCemeteryId: string;
  setSelectedCemeteryId: (id: string) => void;
  selectedCemeteryName: string;
  cemeteries: Cemetery[];
  loading: boolean;
  refreshCemeteries: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

// Chave de persistência por tenant (W5-9) — evita vazar a seleção entre contas no mesmo browser.
const storageKey = (tenantId: string | null) => `memorialos.selectedCemetery.${tenantId ?? 'anon'}`;

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { tenantId } = useAuth();
  const [selectedCemeteryId, setSelectedCemeteryIdState] = useState<string>('all');
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);
  const [loading, setLoading] = useState(true);

  // Restaura a unidade salva ao trocar de tenant/login
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(tenantId));
      setSelectedCemeteryIdState(saved || 'all');
    } catch {
      setSelectedCemeteryIdState('all');
    }
  }, [tenantId]);

  const setSelectedCemeteryId = useCallback((id: string) => {
    setSelectedCemeteryIdState(id);
    try {
      localStorage.setItem(storageKey(tenantId), id);
    } catch {
      /* localStorage indisponível — persistência é best-effort */
    }
  }, [tenantId]);

  const refreshCemeteries = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getCemeteries(tenantId);
      setCemeteries(data);
    } catch (error) {
      reportLoadError('AdminContext.cemeteries', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    refreshCemeteries();
  }, [refreshCemeteries]);

  // Sanidade: se a unidade salva foi excluída, volta para 'all'
  useEffect(() => {
    if (selectedCemeteryId !== 'all' && cemeteries.length > 0
        && !cemeteries.some((c) => c.id === selectedCemeteryId)) {
      setSelectedCemeteryId('all');
    }
  }, [cemeteries, selectedCemeteryId, setSelectedCemeteryId]);

  const selectedCemeteryName =
    selectedCemeteryId === 'all'
      ? 'Todas as unidades'
      : cemeteries.find((c) => c.id === selectedCemeteryId)?.name ?? selectedCemeteryId;

  return (
    <AdminContext.Provider value={{ selectedCemeteryId, setSelectedCemeteryId, selectedCemeteryName, cemeteries, loading, refreshCemeteries }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
