import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bot,
  Building2,
  DollarSign,
  FileBarChart2,
  FilePlus,
  FileText,
  Handshake,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Map as MapIcon,
  ShieldCheck,
  X,
  Wrench,
  Workflow,
  LifeBuoy
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { AdminProvider, useAdmin } from '@/contexts/AdminContext';

const SidebarLink = ({
  to,
  icon: Icon,
  label,
  onClick
}: {
  to: string;
  icon: any;
  label: string;
  onClick?: () => void;
}) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
        isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={18} /> {label}
    </Link>
  );
};

const AdminHeader = () => {
  const { selectedCemeteryId, setSelectedCemeteryId, cemeteries } = useAdmin();

  return (
    <header className="bg-white border-b border-slate-200 min-h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-8 py-3 sm:py-0 gap-3">
      <h2 className="text-base sm:text-lg font-medium text-slate-700">Area Administrativa SCI</h2>
      <div className="flex items-center gap-4 w-full sm:w-auto">
        <select
          value={selectedCemeteryId}
          onChange={(event) => setSelectedCemeteryId(event.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 w-full sm:w-auto"
        >
          <option value="all">Todas as unidades</option>
          {cemeteries.map((cemetery) => (
            <option key={cemetery.id} value={cemetery.id}>
              {cemetery.name}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
};

const AdminLayoutContent = () => {
  const { user, role } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const handleLogout = () => auth.signOut();

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight">
          MemorialOS <span className="text-xs font-normal text-slate-400">SCI Admin</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">{user?.email}</p>
        <span className="text-[10px] uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded text-slate-300 mt-2 inline-block">
          {role}
        </span>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        <SidebarLink to="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={onNavigate} />
        <SidebarLink to="/admin/operacional" icon={Workflow} label="Operacional" onClick={onNavigate} />
        <SidebarLink to="/admin/inventario" icon={MapIcon} label="Inventario / Mapa" onClick={onNavigate} />
        <SidebarLink to="/admin/financeiro" icon={DollarSign} label="Financeiro" onClick={onNavigate} />
        <SidebarLink to="/admin/manutencao" icon={Wrench} label="Manutencao" onClick={onNavigate} />
        <SidebarLink to="/admin/seguranca" icon={ShieldCheck} label="Seguranca" onClick={onNavigate} />
        <SidebarLink to="/admin/agentes" icon={Bot} label="Agentes IA" onClick={onNavigate} />
        <SidebarLink to="/admin/ambiental" icon={Leaf} label="Sanitario / Ambiental" onClick={onNavigate} />
        <SidebarLink to="/admin/relatorios" icon={FileBarChart2} label="Relatorios" onClick={onNavigate} />
        <SidebarLink to="/admin/documentos" icon={FileText} label="Documentos" onClick={onNavigate} />
        <SidebarLink to="/admin/suporte" icon={LifeBuoy} label="Suporte / Treino" onClick={onNavigate} />
        <SidebarLink to="/admin/cemiterios" icon={Building2} label="Cemiterios" onClick={onNavigate} />
        <SidebarLink to="/admin/parceiros" icon={Handshake} label="Parceiros" onClick={onNavigate} />

        <div className="pt-4 mt-4 border-t border-slate-800">
          <SidebarLink to="/admin/falecidos" icon={FileText} label="Falecidos" onClick={onNavigate} />
          <SidebarLink to="/admin/obitos-comunicados" icon={FilePlus} label="Obitos Comunicados" onClick={onNavigate} />
          <SidebarLink to="/admin/comunicar-obito" icon={FilePlus} label="Novo Obito (Admin)" onClick={onNavigate} />
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={() => {
            onNavigate?.();
            handleLogout();
          }}
          className="flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-slate-800 w-full rounded-md transition-colors text-sm"
        >
          <LogOut size={18} /> Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-svh bg-slate-50">
      <aside className="hidden md:flex w-72 bg-slate-900 text-white flex-col">
        <SidebarContent />
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between px-4 z-40">
        <h1 className="text-sm font-semibold tracking-wide">MemorialOS SCI</h1>
        <button onClick={() => setIsMobileMenuOpen((prev) => !prev)} className="p-2 rounded-md hover:bg-slate-800">
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <>
          <button
            type="button"
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="md:hidden fixed inset-y-0 left-0 w-72 bg-slate-900 text-white flex flex-col z-50">
            <SidebarContent onNavigate={() => setIsMobileMenuOpen(false)} />
          </aside>
        </>
      )}

      <main className="flex-1 min-w-0 overflow-auto flex flex-col pt-14 md:pt-0">
        <AdminHeader />
        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default function AdminLayout() {
  return (
    <AdminProvider>
      <AdminLayoutContent />
    </AdminProvider>
  );
}
