import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import PublicLayout from '@/layouts/PublicLayout';
import AdminLayout from '@/layouts/AdminLayout';
import UserLayout from '@/layouts/UserLayout';

import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';

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
import OperationalPage from '@/pages/admin/OperationalPage';
import ReportsPage from '@/pages/admin/ReportsPage';
import AgentsPage from '@/pages/admin/AgentsPage';
import DocumentsCenterPage from '@/pages/admin/DocumentsCenterPage';
import SupportPage from '@/pages/admin/SupportPage';

import SuperAdminPage from '@/pages/superadmin/SuperAdminPage';
import MonitoringDashboard from '@/pages/superadmin/MonitoringDashboard';
import LandingPage from '@/pages/public/LandingPage';
import SearchPage from '@/pages/public/SearchPage';
import GardenOfMemories from '@/pages/user/GardenOfMemories';
import UserHomePage from '@/pages/user/UserHomePage';
import ReportDeath from '@/pages/user/ReportDeath';
import VirtualAssistant from '@/pages/user/VirtualAssistant';
import ShopAndServices from '@/pages/user/ShopAndServices';
import ProfilePage from '@/pages/user/ProfilePage';

const Placeholder = ({ title }: { title: string }) => (
  <div className="p-8">
    <h1 className="text-2xl font-bold mb-4">{title}</h1>
    <p className="text-gray-500">Em desenvolvimento...</p>
  </div>
);

const AppContent = () => {
  const { error } = useAuth();
  const normalizedBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/';

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-red-100 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Configuracao necessaria</h2>
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
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/buscar" element={<SearchPage />} />
          <Route path="/memorial/:id" element={<Placeholder title="Memorial" />} />
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

        <Route element={<ProtectedRoute allowedRoles={['gestor', 'manager', 'superadmin', 'operador']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="operacional" element={<OperationalPage />} />
            <Route path="inventario" element={<InventoryPage />} />
            <Route path="financeiro" element={<FinancialPage />} />
            <Route path="manutencao" element={<MaintenancePage />} />
            <Route path="seguranca" element={<SecurityPage />} />
            <Route path="ia" element={<ExpertAIPage />} />
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
            <Route path="obitos-comunicados" element={<CommunicatedDeaths />} />
            <Route path="comunicar-obito" element={<AdminReportDeath />} />
            <Route path="solicitacoes" element={<Placeholder title="Central de Solicitacoes" />} />
            <Route path="configuracoes" element={<Placeholder title="Configuracoes" />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
          <Route path="/superadmin" element={<SuperAdminPage />} />
          <Route path="/superadmin/monitoring" element={<MonitoringDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
