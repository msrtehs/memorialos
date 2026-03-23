import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  role: string | null;
  tenantId: string | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  tenantId: null,
  loading: true,
  error: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setError("Configuração do Firebase ausente. Verifique o arquivo .env.");
      setLoading(false);
      return;
    }

    if (!auth) {
      setError("Erro ao inicializar Firebase Auth.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const tokenResult = await getIdTokenResult(currentUser);
          let userRole = (tokenResult.claims.role as string) || 'citizen';
          
          // DEMO OVERRIDE: Allow specific email to access manager area
          if (currentUser.email === 'admin@memorial.com' || currentUser.email === 'gestor@memorial.com') {
            userRole = 'gestor';
          }
          
          setRole(userRole);
          // Use UID as default tenantId to ensure data ownership/isolation in demo mode
          setTenantId((tokenResult.claims.tenantId as string) || currentUser.uid);
        } catch (e) {
          console.error("Error fetching claims", e);
        }
      } else {
        setRole(null);
        setTenantId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, tenantId, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};
