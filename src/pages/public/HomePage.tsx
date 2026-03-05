import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Search, Heart, MapPin, ArrowRight, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center justify-center bg-blue-50 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1444837881208-4d46d5c1f127?q=80&w=2545&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto text-center px-4">
          <div className="inline-block p-2 px-4 rounded-full bg-blue-100 text-blue-700 font-medium text-sm mb-6 animate-fade-in-up">
            MemorialOS - Gestão e Memória
          </div>
          <h1 
            className="text-5xl md:text-7xl font-serif text-blue-900 mb-6 tracking-tight animate-fade-in-up delay-100"
          >
            Memórias que <span className="italic text-blue-600">permanecem</span>
          </h1>
          <p 
            className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto animate-fade-in-up delay-200 leading-relaxed"
          >
            Um espaço de respeito, serenidade e tecnologia para honrar a história daqueles que amamos e facilitar o cuidado com quem partiu.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
            <Link 
              to="/login" 
              className="bg-blue-600 text-white px-8 py-4 rounded-full font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 hover:-translate-y-1"
            >
              <User size={20} />
              Acessar Área da Família
            </Link>
            <Link 
              to="/buscar" 
              className="bg-white text-blue-900 border border-blue-100 px-8 py-4 rounded-full font-medium hover:bg-blue-50 transition-all flex items-center gap-2"
            >
              <Search size={20} />
              Buscar Falecido
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif text-blue-900 mb-4">Cuidado e Respeito em Cada Detalhe</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">Nossa plataforma une a gestão eficiente com o acolhimento necessário para as famílias.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-blue-50/50 border border-blue-100 hover:shadow-md transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-6 text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                <Heart size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-serif mb-3 text-blue-900 font-bold">Jardim de Memórias</h3>
              <p className="text-slate-600 leading-relaxed">
                Crie memoriais digitais eternos com fotos, biografias e mensagens de carinho, preservando o legado para as futuras gerações.
              </p>
            </div>
            <div className="p-8 rounded-3xl bg-blue-50/50 border border-blue-100 hover:shadow-md transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-6 text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                <MapPin size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-serif mb-3 text-blue-900 font-bold">Localização Fácil</h3>
              <p className="text-slate-600 leading-relaxed">
                Encontre a localização exata de jazigos e sepulturas através do nosso mapa interativo e rotas guiadas dentro do cemitério.
              </p>
            </div>
            <div className="p-8 rounded-3xl bg-blue-50/50 border border-blue-100 hover:shadow-md transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-6 text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                <Search size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-serif mb-3 text-blue-900 font-bold">Transparência</h3>
              <p className="text-slate-600 leading-relaxed">
                Acesse informações sobre sepultamentos recentes, obituários e solicite serviços de manutenção diretamente pela plataforma.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Obituaries (Mock) */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-serif text-blue-900 font-bold">Sepultamentos Recentes</h2>
            <Link to="/buscar" className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              Ver todos <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group border border-slate-100">
                <div className="h-56 bg-slate-200 relative overflow-hidden">
                   <img 
                    src={`https://picsum.photos/seed/person${i}/400/400?grayscale`} 
                    alt="Foto" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <div className="p-6">
                  <h3 className="font-serif text-lg text-slate-900 mb-1 font-bold">Nome do Falecido {i}</h3>
                  <p className="text-xs text-blue-500 uppercase tracking-wider mb-3 font-medium">1945 - 2024</p>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                    Amado pai, avô e bisavô. Deixa saudades eternas em todos que o conheceram.
                  </p>
                  <Link to={`/memorial/${i}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    Visitar Memorial <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
