import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function UnauthorizedPage() {
  const { role } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-red-100">
        <ShieldOff className="mx-auto mb-4 text-red-400" size={48} />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Acesso negado</h1>
        <p className="text-slate-500 mb-2">
          Você não tem permissão para acessar esta área.
        </p>
        {role && (
          <p className="text-xs text-slate-400 mb-6">
            Seu perfil atual: <span className="font-mono bg-slate-100 px-1 rounded">{role}</span>
          </p>
        )}
        <Link
          to="/app/inicio"
          className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
