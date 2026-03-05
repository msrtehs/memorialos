import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Layouts
import PublicLayout from '@/layouts/PublicLayout';
import AdminLayout from '@/layouts/AdminLayout';
import UserLayout from '@/layouts/UserLayout';

// Pages - Public
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';

// Pages - Admin
import AdminDashboard from '@/pages/admin/AdminDashboard';
import DeceasedList from '@/pages/admin/DeceasedList';
import DeceasedForm from '@/pages/admin/DeceasedForm';
import CemeteryList from '@/pages/admin/CemeteryList';
import CemeteryDetail from '@/pages/admin/CemeteryDetail';
import InventoryPage from '@/pages/admin/InventoryPage';
import FinancialPage from '@/pages/admin/FinancialPage';
import MaintenancePage from '@/pages/admin/MaintenancePage';
import SecurityPage from '@/pages/admin/SecurityPage';
import ExpertAIPage from '@/pages/admin/ExpertAIPage';
import PartnersPage from '@/pages/admin/PartnersPage';
import EnvironmentalPage from '@/pages/admin/EnvironmentalPage';
import AdminReportDeath from '@/pages/admin/AdminReportDeath';
import CommunicatedDeaths from '@/pages/admin/CommunicatedDeaths';

// Pages - User (Family)
import GardenOfMemories from '@/pages/user/GardenOfMemories';
import ReportDeath from '@/pages/user/ReportDeath';
import VirtualAssistant from '@/pages/user/VirtualAssistant';
import ShopAndServices from '@/pages/user/ShopAndServices';

// Placeholders for missing pages to prevent build errors
const Placeholder = ({ title }: { title: string }) => (
  <div className="p-8">
    <h1 className="text-2xl font-bold mb-4">{title}</h1>
    <p className="text-gray-500">Em desenvolvimento...</p>
  </div>
);

const AppContent = () => {
  const { error } = useAuth();
  const normalizedBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/';
  const Router = import.meta.env.PROD ? HashRouter : BrowserRouter;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-red-100 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Configuração Necessária</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="text-left bg-gray-50 p-4 rounded-lg text-sm text-gray-700 font-mono overflow-x-auto">
            <p className="mb-2 font-bold">Adicione ao seu .env:</p>
            VITE_FIREBASE_API_KEY=...<br/>
            VITE_FIREBASE_AUTH_DOMAIN=...<br/>
            VITE_FIREBASE_PROJECT_ID=...<br/>
            ...
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router basename={import.meta.env.PROD ? undefined : normalizedBase}>
      <Routes>
        {/* Public Routes - Login is now default */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/buscar" element={<Placeholder title="Busca de Falecidos" />} />
          <Route path="/memorial/:id" element={<Placeholder title="Memorial" />} />
          <Route path="/servicos" element={<Placeholder title="Serviços Públicos" />} />
          <Route path="/minha-conta" element={<Navigate to="/app/memorias" replace />} />
        </Route>

        {/* User Routes (Family/Citizen) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<UserLayout />}>
            <Route index element={<Navigate to="/app/memorias" replace />} />
            <Route path="memorias" element={<GardenOfMemories />} />
            <Route path="comunicar-obito" element={<ReportDeath />} />
            <Route path="assistente" element={<VirtualAssistant />} />
            <Route path="loja" element={<ShopAndServices />} />
          </Route>
        </Route>

        {/* Admin Routes - Protected */}
        <Route element={<ProtectedRoute allowedRoles={['gestor', 'superadmin', 'operador']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="inventario" element={<InventoryPage />} />
            <Route path="financeiro" element={<FinancialPage />} />
            <Route path="manutencao" element={<MaintenancePage />} />
            <Route path="seguranca" element={<SecurityPage />} />
            <Route path="ia" element={<ExpertAIPage />} />
            <Route path="parceiros" element={<PartnersPage />} />
            <Route path="ambiental" element={<EnvironmentalPage />} />
            <Route path="cemiterios" element={<CemeteryList />} />
            <Route path="cemiterios/:id" element={<CemeteryDetail />} />
            <Route path="falecidos" element={<DeceasedList />} />
            <Route path="falecidos/novo" element={<DeceasedForm />} />
            <Route path="obitos-comunicados" element={<CommunicatedDeaths />} />
            <Route path="comunicar-obito" element={<AdminReportDeath />} />
            <Route path="solicitacoes" element={<Placeholder title="Central de Solicitações" />} />
            <Route path="configuracoes" element={<Placeholder title="Configurações" />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
