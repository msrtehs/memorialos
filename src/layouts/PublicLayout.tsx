import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Menu, User } from 'lucide-react';

export default function PublicLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-serif font-bold">M</div>
            <span className="font-serif text-xl tracking-tight text-blue-900 font-bold">MemorialOS</span>
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/app" className="text-sm font-medium text-blue-900 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors">
                Minha Conta
              </Link>
            ) : (
              <Link to="/login" className="text-sm font-medium text-white bg-blue-900 px-6 py-2.5 rounded-full hover:bg-blue-800 transition-colors shadow-sm shadow-blue-200">
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white font-serif font-bold text-xs">M</div>
              <h3 className="text-white font-serif text-lg font-bold">MemorialOS</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Preservando memórias e histórias com dignidade, respeito e tecnologia.
            </p>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4">Serviços</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/buscar" className="hover:text-white transition-colors">Busca de Jazigos</Link></li>
              <li><Link to="/servicos" className="hover:text-white transition-colors">Manutenção</Link></li>
              <li><Link to="/planos" className="hover:text-white transition-colors">Planos Funerários</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4">Suporte</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/ajuda" className="hover:text-white transition-colors">Central de Ajuda</Link></li>
              <li><Link to="/contato" className="hover:text-white transition-colors">Fale Conosco</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacidade" className="hover:text-white transition-colors">Privacidade</Link></li>
              <li><Link to="/termos" className="hover:text-white transition-colors">Termos de Uso</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-slate-800 text-xs text-center text-slate-500">
          &copy; {new Date().getFullYear()} MemorialOS. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
