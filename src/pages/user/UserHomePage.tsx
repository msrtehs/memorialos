import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarHeart, Flower2, MessageCircleHeart, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

const slides = [
  {
    id: 's1',
    title: 'Um espaco para lembrar com serenidade',
    subtitle: 'Mantenha as memorias vivas com acolhimento e organizacao.',
    image:
      'https://images.unsplash.com/photo-1542037104857-ffbb0b9155fb?q=80&w=1400&auto=format&fit=crop'
  },
  {
    id: 's2',
    title: 'Fluxo digital para momentos delicados',
    subtitle: 'Comunique obito e acompanhe o processo com transparencia.',
    image:
      'https://images.unsplash.com/photo-1475503572774-15a45e5d60b9?q=80&w=1400&auto=format&fit=crop'
  },
  {
    id: 's3',
    title: 'Servicos e homenagens em um unico lugar',
    subtitle: 'Produtos, cuidados e apoio para cada etapa da jornada.',
    image:
      'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?q=80&w=1400&auto=format&fit=crop'
  }
];

const quickActions = [
  {
    title: 'Comunicar obito',
    description: 'Inicie o registro com orientacao e suporte.',
    to: '/app/comunicar-obito',
    icon: CalendarHeart
  },
  {
    title: 'Jardim de memorias',
    description: 'Acompanhe homenagens e registros da familia.',
    to: '/app/memorias',
    icon: Flower2
  },
  {
    title: 'Loja e servicos',
    description: 'Encontre produtos e servicos de apoio.',
    to: '/app/loja',
    icon: ShoppingBag
  },
  {
    title: 'Assistente virtual',
    description: 'Converse com a IA para tirar duvidas.',
    to: '/app/assistente',
    icon: MessageCircleHeart
  }
];

export default function UserHomePage() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const currentSlide = useMemo(() => slides[activeSlide], [activeSlide]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-blue-100 min-h-[340px]">
        <img
          src={currentSlide.image}
          alt={currentSlide.title}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/75 via-slate-900/45 to-slate-900/20" />

        <div className="relative z-10 p-8 md:p-10 flex flex-col justify-between h-full min-h-[340px]">
          <div>
            <p className="text-blue-100 text-sm uppercase tracking-[0.18em] font-medium">
              Inicio
            </p>
            <h1 className="text-3xl md:text-4xl font-serif text-white font-bold mt-3 max-w-2xl leading-tight">
              {currentSlide.title}
            </h1>
            <p className="text-blue-100 mt-3 max-w-xl">{currentSlide.subtitle}</p>
          </div>

          <div className="flex items-end justify-between gap-4">
            <Link
              to="/app/comunicar-obito"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-800 font-medium hover:bg-blue-50 transition-colors"
            >
              Iniciar atendimento <ArrowRight size={16} />
            </Link>
            <div className="flex gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  onClick={() => setActiveSlide(index)}
                  className={`h-2.5 rounded-full transition-all ${
                    activeSlide === index ? 'w-7 bg-white' : 'w-2.5 bg-white/45'
                  }`}
                  aria-label={`Slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {quickActions.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              to={item.to}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Icon size={19} />
              </div>
              <h2 className="text-slate-900 font-semibold mt-4">{item.title}</h2>
              <p className="text-slate-500 text-sm mt-1">{item.description}</p>
            </Link>
          );
        })}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-xl font-serif font-bold text-slate-900">Como funciona</h3>
        <div className="grid md:grid-cols-3 gap-4 mt-5">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-blue-700 font-semibold">1. Registro</p>
            <p className="text-sm text-slate-600 mt-2">
              Preencha o comunicado com os dados principais e anexos.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-blue-700 font-semibold">2. Analise</p>
            <p className="text-sm text-slate-600 mt-2">
              A equipe administrativa valida documentos e define os proximos passos.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-blue-700 font-semibold">3. Acompanhamento</p>
            <p className="text-sm text-slate-600 mt-2">
              Voce acompanha status, memorias e servicos em um unico painel.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
