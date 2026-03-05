import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  DollarSign, 
  Wrench, 
  ShieldCheck, 
  Bot, 
  Handshake, 
  Leaf, 
  Building2, 
  LogOut,
  FilePlus
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { AdminProvider, useAdmin } from '@/contexts/AdminContext';

const SidebarLink = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
        isActive 
          ? 'bg-blue-600 text-white' 
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={18} /> {label}
    </Link>
  );
};

const AdminHeader = () => {
  const { selectedCemeteryId, setSelectedCemeteryId, cemeteries } = useAdmin();
  
  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8">
      <h2 className="text-lg font-medium text-slate-700">Área Administrativa</h2>
      <div className="flex items-center gap-4">
        <select 
          value={selectedCemeteryId}
          onChange={(e) => setSelectedCemeteryId(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
        >
          <option value="all">Todas as Unidades</option>
          {cemeteries.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    </header>
  );
};

const AdminLayoutContent = () => {
  const { user, role } = useAuth();
  const handleLogout = () => auth.signOut();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold tracking-tight">MemorialOS <span className="text-xs font-normal text-slate-400">Admin</span></h1>
          <p className="text-xs text-slate-500 mt-1">{user?.email}</p>
          <span className="text-[10px] uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded text-slate-300 mt-2 inline-block">
            {role}
          </span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <SidebarLink to="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <SidebarLink to="/admin/inventario" icon={MapIcon} label="Inventário / Mapa" />
          <SidebarLink to="/admin/financeiro" icon={DollarSign} label="Financeiro" />
          <SidebarLink to="/admin/manutencao" icon={Wrench} label="Manutenção" />
          <SidebarLink to="/admin/seguranca" icon={ShieldCheck} label="Segurança" />
          <SidebarLink to="/admin/ia" icon={Bot} label="Supervisora IA" />
          <SidebarLink to="/admin/parceiros" icon={Handshake} label="Parceiros" />
          <SidebarLink to="/admin/ambiental" icon={Leaf} label="Ambiental" />
          <SidebarLink to="/admin/cemiterios" icon={Building2} label="Cemitérios" />
          
          <div className="pt-4 mt-4 border-t border-slate-800">
            <SidebarLink to="/admin/obitos-comunicados" icon={FilePlus} label="Óbitos Comunicados" />
            <SidebarLink to="/admin/comunicar-obito" icon={FilePlus} label="Novo Óbito (Admin)" />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-slate-800 w-full rounded-md transition-colors text-sm">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <AdminHeader />
        <div className="p-8 flex-1">
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
