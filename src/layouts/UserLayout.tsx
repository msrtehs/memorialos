import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Flower,
  PenTool,
  MessageCircleHeart,
  ShoppingBag,
  LogOut,
  Menu,
  X,
  ChevronRight,
  House,
  UserCircle2
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import AppLogo from '@/components/AppLogo';
import { getUserProfile } from '@/services/userProfileService';

export default function UserLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [profilePhoto, setProfilePhoto] = React.useState<string>('');
  const [displayName, setDisplayName] = React.useState<string>('');

  React.useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        const profile = await getUserProfile(user.uid);
        setProfilePhoto(profile?.photoUrl || user.photoURL || '');
        setDisplayName(profile?.displayName || user.displayName || 'Usuario');
      } catch (error) {
        console.error('Erro ao carregar perfil no layout:', error);
        setProfilePhoto(user.photoURL || '');
        setDisplayName(user.displayName || 'Usuario');
      }
    }
    loadProfile();
  }, [user]);

  const handleLogout = () => auth.signOut();

  const navItems = [
    { path: '/app/inicio', label: 'Inicio', icon: House },
    { path: '/app/memorias', label: 'Jardim de Memorias', icon: Flower },
    { path: '/app/comunicar-obito', label: 'Comunicar Obito', icon: PenTool },
    { path: '/app/assistente', label: 'Assistente Virtual', icon: MessageCircleHeart },
    { path: '/app/loja', label: 'Loja e Servicos', icon: ShoppingBag },
    { path: '/app/perfil', label: 'Meu Perfil', icon: UserCircle2 }
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      <div className="p-6 flex items-center gap-3 mb-6">
        <AppLogo size={34} className="shadow-lg shadow-blue-900/30 bg-transparent p-0" fallbackTextClassName="text-lg" />
        <div>
          <h1 className="text-lg font-medium text-white tracking-tight">MemorialOS</h1>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon
                  size={18}
                  className={`transition-colors ${isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-300'}`}
                  strokeWidth={isActive ? 2 : 1.5}
                />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {isActive && <ChevronRight size={14} className="text-blue-200" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 mt-auto">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center text-slate-400 font-medium text-xs border border-slate-700">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              (displayName || user?.displayName || 'U').charAt(0)
            )}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{displayName || user?.displayName || 'Usuario'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-2 py-2 text-slate-400 hover:text-red-400 w-full rounded-lg transition-colors text-xs font-medium hover:bg-red-950/30"
        >
          <LogOut size={14} /> Sair da conta
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-svh bg-slate-50 font-sans">
      <aside className="hidden md:block w-64 h-full fixed left-0 top-0 z-30 border-r border-slate-200">
        <SidebarContent />
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <AppLogo size={30} className="bg-transparent p-0" fallbackTextClassName="text-sm" />
          <span className="font-serif font-bold text-slate-900">MemorialOS</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <>
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
          />
          <div className="fixed inset-y-0 left-0 w-64 z-50 md:hidden shadow-2xl">
            <SidebarContent />
          </div>
        </>
      )}

      <main className="flex-1 md:ml-64 pt-16 md:pt-0 overflow-auto bg-slate-50/50 min-w-0">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
