import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Heart, Shield, Clock, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-blue-900 leading-tight">
            Preservando memorias com dignidade e tecnologia
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            O MemorialOS e a plataforma completa para gestao de cemiterios e memoriais digitais.
            Conectamos familias, gestores e prefeituras em um so lugar.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="px-8 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 flex items-center gap-2"
            >
              Acessar minha conta
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/cadastro"
              className="px-8 py-3 border border-blue-200 text-blue-700 rounded-full font-medium hover:bg-blue-50 transition-colors"
            >
              Criar conta gratuita
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 text-center mb-4">
            Tudo que voce precisa em um so sistema
          </h2>
          <p className="text-slate-500 text-center mb-14 max-w-xl mx-auto">
            Funcionalidades pensadas para familias que desejam honrar seus entes queridos e gestores que precisam de eficiencia.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Search size={24} />}
              title="Busca publica"
              description="Encontre informacoes sobre jazigos e localizacao de falecidos em cemiterios cadastrados."
            />
            <FeatureCard
              icon={<Heart size={24} />}
              title="Memoriais digitais"
              description="Crie paginas de homenagem com fotos, historias e mensagens de carinho para quem partiu."
            />
            <FeatureCard
              icon={<Shield size={24} />}
              title="Gestao completa"
              description="Controle de quadras, jazigos, financeiro, estoque e operacoes do cemiterio em tempo real."
            />
            <FeatureCard
              icon={<Clock size={24} />}
              title="Comunicacao de obito"
              description="Comunique um falecimento de forma digital e acompanhe o processo de alocacao de jazigo."
            />
          </div>
        </div>
      </section>

      {/* CTA busca */}
      <section className="bg-slate-900 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mb-4">
            Procurando um ente querido?
          </h2>
          <p className="text-slate-400 mb-8">
            Use nossa busca publica para encontrar informacoes sobre falecidos e localizacao de jazigos. Nao precisa de cadastro.
          </p>
          <Link
            to="/buscar"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-slate-900 rounded-full font-medium hover:bg-slate-100 transition-colors"
          >
            <Search size={18} />
            Buscar falecidos
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 text-center mb-14">
            Como funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <StepCard
              number="1"
              title="Crie sua conta"
              description="Cadastre-se gratuitamente e acesse sua area pessoal para gerenciar memoriais e comunicar obitos."
            />
            <StepCard
              number="2"
              title="Comunique ou homenageie"
              description="Envie comunicacoes de obito ou crie memoriais digitais para preservar a historia de quem voce ama."
            />
            <StepCard
              number="3"
              title="Acompanhe tudo"
              description="Receba atualizacoes sobre alocacoes, status e servicos disponibilizados pela prefeitura."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-100 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
        {number}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}
