import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Construction } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ADMIN_ROUTE_ROLES } from '@/lib/roles';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Estáticos (rota de entrada, leves — first paint):
import PublicLayout from '@/layouts/PublicLayout';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import UnauthorizedPage from '@/pages/auth/UnauthorizedPage';
import LandingPage from '@/pages/public/LandingPage';
import SearchPage from '@/pages/public/SearchPage';
import MemorialPage from '@/pages/public/MemorialPage';

// Lazy por área (W5-1) — chunks separados carregados sob demanda:
const AdminLayout = lazy(() => import('@/layouts/AdminLayout'));
const UserLayout = lazy(() => import('@/layouts/UserLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const DeceasedList = lazy(() => import('@/pages/admin/DeceasedList'));
const DeceasedDetail = lazy(() => import('@/pages/admin/DeceasedDetail'));
const DeceasedForm = lazy(() => import('@/pages/admin/DeceasedForm'));
const CemeteryList = lazy(() => import('@/pages/admin/CemeteryList'));
const CemeteryDetail = lazy(() => import('@/pages/admin/CemeteryDetail'));
const InventoryPage = lazy(() => import('@/pages/admin/InventoryPage'));
const FinancialPage = lazy(() => import('@/pages/admin/FinancialPage'));
const MaintenancePage = lazy(() => import('@/pages/admin/MaintenancePage'));
const SecurityPage = lazy(() => import('@/pages/admin/SecurityPage'));
const PartnersPage = lazy(() => import('@/pages/admin/PartnersPage'));
const EnvironmentalPage = lazy(() => import('@/pages/admin/EnvironmentalPage'));
const AdminReportDeath = lazy(() => import('@/pages/admin/AdminReportDeath'));
const CommunicatedDeaths = lazy(() => import('@/pages/admin/CommunicatedDeaths'));
const OperationalPage = lazy(() => import('@/pages/admin/OperationalPage'));
const ReportsPage = lazy(() => import('@/pages/admin/ReportsPage'));
const AgentsPage = lazy(() => import('@/pages/admin/AgentsPage'));
const DocumentsCenterPage = lazy(() => import('@/pages/admin/DocumentsCenterPage'));
const SupportPage = lazy(() => import('@/pages/admin/SupportPage'));
const SuperAdminPage = lazy(() => import('@/pages/superadmin/SuperAdminPage'));
const MonitoringDashboard = lazy(() => import('@/pages/superadmin/MonitoringDashboard'));
const GardenOfMemories = lazy(() => import('@/pages/user/GardenOfMemories'));
const UserHomePage = lazy(() => import('@/pages/user/UserHomePage'));
const ReportDeath = lazy(() => import('@/pages/user/ReportDeath'));
const VirtualAssistant = lazy(() => import('@/pages/user/VirtualAssistant'));
const ShopAndServices = lazy(() => import('@/pages/user/ShopAndServices'));
const ProfilePage = lazy(() => import('@/pages/user/ProfilePage'));

const Placeholder = ({ title }: { title: string }) => (
  <div className="p-8">
    <h1 className="text-2xl font-bold mb-4">{title}</h1>
    <p className="text-gray-500">Em desenvolvimento...</p>
  </div>
);

const ComingSoon = ({ title, eta }: { title: string; eta?: string }) => (
  <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
    <Construction className="text-slate-300 mb-4" size={48} />
    <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
    <p className="text-slate-500">
      {eta ? `Disponível em ${eta}` : 'Em desenvolvimento — disponível em breve.'}
    </p>
  </div>
);

const AppContent = () => {
  const { error } = useAuth();
  const normalizedBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/';

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-red-100 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Configuração necessária</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="text-left bg-gray-50 p-4 rounded-lg text-sm text-gray-700 font-mono overflow-x-auto">
            <p className="mb-2 font-bold">Adicione no seu .env:</p>
            VITE_FIREBASE_API_KEY=...<br />
            VITE_FIREBASE_AUTH_DOMAIN=...<br />
            VITE_FIREBASE_PROJECT_ID=...<br />
            ...
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter basename={normalizedBase}>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner text="Carregando módulo..." /></div>}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/buscar" element={<SearchPage />} />
          <Route path="/memorial/:id" element={<MemorialPage />} />
          <Route path="/servicos" element={<Placeholder title="Servicos Publicos" />} />
          <Route path="/minha-conta" element={<Navigate to="/app/inicio" replace />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<UserLayout />}>
            <Route index element={<Navigate to="/app/inicio" replace />} />
            <Route path="inicio" element={<UserHomePage />} />
            <Route path="memorias" element={<GardenOfMemories />} />
            <Route path="comunicar-obito" element={<ReportDeath />} />
            <Route path="assistente" element={<VirtualAssistant />} />
            <Route path="loja" element={<ShopAndServices />} />
            <Route path="perfil" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[...ADMIN_ROUTE_ROLES]} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="operacional" element={<OperationalPage />} />
            <Route path="inventario" element={<InventoryPage />} />
            <Route path="financeiro" element={<FinancialPage />} />
            <Route path="manutencao" element={<MaintenancePage />} />
            <Route path="seguranca" element={<SecurityPage />} />
            <Route path="agentes" element={<AgentsPage />} />
            <Route path="parceiros" element={<PartnersPage />} />
            <Route path="ambiental" element={<EnvironmentalPage />} />
            <Route path="relatorios" element={<ReportsPage />} />
            <Route path="documentos" element={<DocumentsCenterPage />} />
            <Route path="suporte" element={<SupportPage />} />
            <Route path="cemiterios" element={<CemeteryList />} />
            <Route path="cemiterios/:id" element={<CemeteryDetail />} />
            <Route path="falecidos" element={<DeceasedList />} />
            <Route path="falecidos/novo" element={<DeceasedForm />} />
            <Route path="falecidos/:id" element={<DeceasedDetail />} />
            <Route path="falecidos/:id/editar" element={<DeceasedForm />} />
            <Route path="obitos-comunicados" element={<CommunicatedDeaths />} />
            <Route path="comunicar-obito" element={<AdminReportDeath />} />
            <Route path="solicitacoes" element={<ComingSoon title="Central de Solicitações" />} />
            <Route path="configuracoes" element={<ComingSoon title="Configurações do Sistema" />} />
          </Route>
        </Route>

        <Route path="/acesso-negado" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
          <Route path="/superadmin" element={<SuperAdminPage />} />
          <Route path="/superadmin/monitoring" element={<MonitoringDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default function App() {
  return (
    <>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          success: { style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' } },
          error: { style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }, duration: 6000 },
        }}
      />
    </>
  );
}
