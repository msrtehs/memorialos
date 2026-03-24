import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import AppLogo from '@/components/AppLogo';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [superAdminError, setSuperAdminError] = React.useState('');

  // Redirect if already logged in
  React.useEffect(() => {
    if (user && role) {
      if (role === 'superadmin') {
        navigate('/superadmin');
      } else if (['gestor', 'manager', 'operador'].includes(role)) {
        navigate('/admin/dashboard');
      } else {
        navigate('/app');
      }
    }
  }, [user, role, navigate]);

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // Navigation is handled by useEffect based on role
    } catch (error) {
      console.error(error);
      setError('root', { message: 'Credenciais inválidas ou erro no servidor.' });
    }
  };

  const handleManagerAccess = async () => {
    try {
      // Silent login for demo purposes
      await signInWithEmailAndPassword(auth, 'admin@memorial.com', 'admin123');
      // Navigation is handled by useEffect based on role
    } catch (error) {
      console.error("Erro no acesso de gestor:", error);
    }
  };

  const handleSuperAdminAccess = async () => {
    setSuperAdminError('');
    try {
      const credential = await signInWithEmailAndPassword(auth, 'superadmin@memorial.com', '12345678');
      const token = await credential.user.getIdTokenResult();
      if (token.claims.role !== 'superadmin') {
        await auth.signOut();
        setSuperAdminError('Acesso não autorizado. Verifique as custom claims do usuário no Firebase.');
        return;
      }
      // Navigation is handled by useEffect based on role
    } catch (error: any) {
      console.error("Erro no acesso SuperAdmin:", error);
      setSuperAdminError('Credenciais inválidas ou usuário não configurado.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-blue-100">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-fit">
            <AppLogo size={48} className="bg-transparent p-0" fallbackTextClassName="text-xl" />
          </div>
          <h1 className="text-2xl font-serif text-blue-900 font-bold">Bem-vindo de volta</h1>
          <p className="text-slate-500 mt-2">Acesse sua conta para gerenciar memoriais</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input
              {...register('email')}
              type="email"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="seu@email.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
            <input
              {...register('password')}
              type="password"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {errors.root && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{errors.root.message}</div>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-200"
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>Não tem uma conta? <Link to="/cadastro" className="text-blue-600 font-medium hover:underline">Cadastre-se</Link></p>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 space-y-2">
          <button
            onClick={handleManagerAccess}
            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <ShieldCheck size={16} />
            Acesso para Gestores
          </button>

          <button
            onClick={handleSuperAdminAccess}
            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <ShieldAlert size={16} />
            Entrar como SuperAdmin
          </button>

          {superAdminError && (
            <p className="text-red-500 text-xs text-center px-2">{superAdminError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
