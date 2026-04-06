import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Building2, CheckCircle } from 'lucide-react';
import AppLogo from '@/components/AppLogo';

const loginSchema = z.object({
  email: z.string().email('E-mail invalido'),
  password: z.string().min(6, 'A senha deve ter no minimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [showInstitutional, setShowInstitutional] = React.useState(false);
  const [showResetPassword, setShowResetPassword] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState('');
  const [resetStatus, setResetStatus] = React.useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resetError, setResetError] = React.useState('');

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetStatus('sending');
    setResetError('');
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetStatus('sent');
    } catch (error: any) {
      setResetStatus('error');
      const code = error?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        setResetError('E-mail nao encontrado.');
      } else {
        setResetError('Erro ao enviar. Tente novamente.');
      }
    }
  };

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
    } catch (error: any) {
      console.error(error);
      const code = error?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setError('root', { message: 'E-mail ou senha incorretos.' });
      } else if (code === 'auth/too-many-requests') {
        setError('root', { message: 'Muitas tentativas. Aguarde alguns minutos.' });
      } else if (code === 'auth/network-request-failed') {
        setError('root', { message: 'Erro de conexao. Verifique sua internet.' });
      } else {
        setError('root', { message: 'Credenciais invalidas ou erro no servidor.' });
      }
    }
  };

  return (
    <div className="flex items-center justify-center bg-blue-50 px-4 py-12" style={{ minHeight: 'calc(100vh - 4rem)' }}>
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
            <div className="text-right mt-1">
              <button
                type="button"
                onClick={() => { setShowResetPassword(!showResetPassword); setResetStatus('idle'); setResetError(''); }}
                className="text-xs text-blue-600 hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
          </div>

          {showResetPassword && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
              {resetStatus === 'sent' ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle size={16} />
                  <span>E-mail de recuperacao enviado para <strong>{resetEmail}</strong>. Verifique sua caixa de entrada.</span>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-2">
                  <p className="text-xs text-slate-600">Digite seu e-mail para receber o link de recuperacao:</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    />
                    <button
                      type="submit"
                      disabled={resetStatus === 'sending'}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {resetStatus === 'sending' ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                  {resetError && <p className="text-red-500 text-xs">{resetError}</p>}
                </form>
              )}
            </div>
          )}

          {errors.root && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
              {errors.root.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-200"
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>Nao tem uma conta? <Link to="/cadastro" className="text-blue-600 font-medium hover:underline">Cadastre-se</Link></p>
        </div>

        {/* Acesso institucional discreto */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={() => setShowInstitutional(!showInstitutional)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-500 transition-colors"
          >
            <Building2 size={12} />
            Acesso institucional
          </button>

          {showInstitutional && (
            <p className="mt-3 text-xs text-slate-400 text-center leading-relaxed">
              Gestores e administradores devem utilizar o formulario acima com as credenciais fornecidas pela administracao do sistema. O redirecionamento e automatico conforme o perfil.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
