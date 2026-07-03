import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCemeteries, Cemetery } from '@/services/cemeteryService';
import { useAuth } from '@/contexts/AuthContext';

interface AdminContextType {
  selectedCemeteryId: string;
  setSelectedCemeteryId: (id: string) => void;
  cemeteries: Cemetery[];
  loading: boolean;
  refreshCemeteries: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { tenantId } = useAuth();
  const [selectedCemeteryId, setSelectedCemeteryId] = useState<string>('all');
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);
  const [loading, setLoading] = useState(true);

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
      console.error('Failed to load cemeteries', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    refreshCemeteries();
  }, [refreshCemeteries]);

  return (
    <AdminContext.Provider value={{ selectedCemeteryId, setSelectedCemeteryId, cemeteries, loading, refreshCemeteries }}>
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
