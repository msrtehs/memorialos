import React, { useMemo, useState } from 'react';
import { ArrowRight, ShoppingBag, X, Plus, Minus, CreditCard, AlertTriangle } from 'lucide-react';
import { useModal } from '@/hooks/useModal';

type CatalogCategory = 'all' | 'lojas' | 'servicos' | 'setores';

interface CatalogItem {
  id: string;
  name: string;
  price: number;
  category: CatalogCategory;
  coverUrl: string;
  shortDescription: string;
  deliveryInfo: string;
}

interface CartItem {
  item: CatalogItem;
  quantity: number;
}

const catalog: CatalogItem[] = [
  {
    id: 'i1',
    name: 'Coroa de Flores Paz Serena',
    price: 350,
    category: 'lojas',
    coverUrl:
      'https://images.unsplash.com/photo-1490750967868-88aa4486c946?q=80&w=1200&auto=format&fit=crop',
    shortDescription:
      'Arranjo floral para homenagens com composição equilibrada e acabamento profissional.',
    deliveryInfo: 'Entrega no cemitério em até 4 horas após confirmação.'
  },
  {
    id: 'i2',
    name: 'Buque de Recordação',
    price: 140,
    category: 'lojas',
    coverUrl:
      'https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=1200&auto=format&fit=crop',
    shortDescription:
      'Buque delicado para momentos de visita e homenagem individual.',
    deliveryInfo: 'Retirada local ou entrega no local indicado no pedido.'
  },
  {
    id: 'i3',
    name: 'Limpeza e Conservação de Jazigo',
    price: 95,
    category: 'servicos',
    coverUrl:
      'https://images.unsplash.com/photo-1603728409365-37a3b0f6f8ba?q=80&w=1200&auto=format&fit=crop',
    shortDescription:
      'Serviço de manutenção com limpeza, polimento e revisão visual do espaço.',
    deliveryInfo: 'Execução em janela de 48h com registro fotográfico.'
  },
  {
    id: 'i4',
    name: 'Cerimônia de Lembranca',
    price: 520,
    category: 'servicos',
    coverUrl:
      'https://images.unsplash.com/photo-1511988617509-a57c8a288659?q=80&w=1200&auto=format&fit=crop',
    shortDescription:
      'Apoio para cerimônia de recordação com organização de roteiro e equipe de apoio.',
    deliveryInfo: 'Agendamento sob demanda, conforme disponibilidade.'
  },
  {
    id: 'i5',
    name: 'Vela Virtual 7 dias',
    price: 12,
    category: 'setores',
    coverUrl:
      'https://images.unsplash.com/photo-1470259078422-826894b933aa?q=80&w=1200&auto=format&fit=crop',
    shortDescription:
      'Homenagem digital vinculada ao memorial, visivel para familiares convidados.',
    deliveryInfo: 'Ativação imediata após pagamento.'
  },
  {
    id: 'i6',
    name: 'Placa de Homenagem Personalizada',
    price: 290,
    category: 'setores',
    coverUrl:
      'https://images.unsplash.com/photo-1516570161787-2fd917215a3d?q=80&w=1200&auto=format&fit=crop',
    shortDescription:
      'Placa comemorativa com texto personalizado para memorial e lembranca familiar.',
    deliveryInfo: 'Produção e entrega em até 10 dias úteis.'
  }
];

const categoryMeta = {
  all: {
    title: 'Todos os itens',
    description: 'Visão completa de produtos e serviços disponíveis no MemorialOS.'
  },
  lojas: {
    title: 'Lojas',
    description: 'Produtos fisicos para homenagens e cuidado do espaço memorial.'
  },
  servicos: {
    title: 'Serviços',
    description: 'Atendimentos executados por equipe especializada com agendamento.'
  },
  setores: {
    title: 'Outros setores',
    description: 'Soluções digitais e complementares para memória e acompanhamento.'
  }
};

const currency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ShopAndServices() {
  const [category, setCategory] = useState<CatalogCategory>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { containerRef: cartDrawerRef } = useModal(cartOpen, () => setCartOpen(false));
  const { containerRef: checkoutModalRef } = useModal(checkoutOpen, () => setCheckoutOpen(false));
  const [cart, setCart] = useState<CartItem[]>([]);

  const filtered = useMemo(
    () => (category === 'all' ? catalog : catalog.filter((item) => item.category === category)),
    [category]
  );

  const subtotal = useMemo(
    () => cart.reduce((total, cartItem) => total + cartItem.item.price * cartItem.quantity, 0),
    [cart]
  );

  const totalItems = useMemo(
    () => cart.reduce((total, cartItem) => total + cartItem.quantity, 0),
    [cart]
  );

  const addToCart = (item: CatalogItem) => {
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.item.id === item.id);
      if (existing) {
        return prev.map((cartItem) =>
          cartItem.item.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const changeQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((cartItem) =>
          cartItem.item.id === itemId
            ? { ...cartItem, quantity: Math.max(0, cartItem.quantity + delta) }
            : cartItem
        )
        .filter((cartItem) => cartItem.quantity > 0)
    );
  };

  return (
    <div className="space-y-8">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm flex items-start gap-2">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <div>
          <strong>Catálogo demonstrativo.</strong> Os produtos e serviços exibidos são exemplos —
          pedidos e pagamentos ainda não estão disponíveis. Em caso de necessidade, contate
          diretamente a administração do cemitério.
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-blue-900">Loja e Serviços</h1>
          <p className="text-slate-500 mt-2 max-w-3xl">
            Esta página organiza produtos e serviços de apoio em um único fluxo. Você pode
            entender cada oferta, adicionar ao carrinho e seguir para o pagamento sem sair do
            aplicativo.
          </p>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative bg-white p-2.5 rounded-full shadow-sm border border-blue-100 hover:bg-blue-50 transition-colors"
        >
          <ShoppingBag className="text-blue-600" size={24} />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
              {totalItems}
            </span>
          )}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">{categoryMeta[category].title}</h2>
        <p className="text-sm text-slate-500 mt-1">{categoryMeta[category].description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['all', 'lojas', 'servicos', 'setores'] as CatalogCategory[]).map((option) => (
            <button
              key={option}
              onClick={() => setCategory(option)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                category === option
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {option === 'all' ? 'Todos' : option === 'lojas' ? 'Lojas' : option === 'servicos' ? 'Serviços' : 'Outros setores'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl shadow-sm border border-blue-50 overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
          >
            <div className="h-44 overflow-hidden relative">
              <img
                src={item.coverUrl}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
              <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-medium text-slate-700 capitalize">
                {item.category === 'lojas' ? 'Loja' : item.category === 'servicos' ? 'Serviço' : 'Outros'}
              </span>
            </div>
            <div className="p-5">
              <div className="flex justify-between items-start gap-3">
                <h3 className="font-serif text-lg font-bold text-slate-900 leading-tight">{item.name}</h3>
                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg text-sm whitespace-nowrap">
                  {currency(item.price)}
                </span>
              </div>
              <p className="text-slate-600 text-sm mt-3">{item.shortDescription}</p>
              <p className="text-xs text-slate-500 mt-3">{item.deliveryInfo}</p>
              <button
                onClick={() => addToCart(item)}
                className="w-full mt-5 bg-white border-2 border-blue-100 text-blue-700 py-2.5 rounded-xl font-medium hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                Adicionar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {cartOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div ref={cartDrawerRef} role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 id="cart-drawer-title" className="font-semibold text-slate-900">Carrinho</h3>
              <button onClick={() => setCartOpen(false)} aria-label="Fechar carrinho" className="p-1 rounded hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-12 border border-dashed border-slate-300 rounded-xl">
                  Seu carrinho está vazio.
                </div>
              )}
              {cart.map((cartItem) => (
                <div key={cartItem.item.id} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{cartItem.item.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{currency(cartItem.item.price)} cada</p>
                    </div>
                    <p className="text-sm font-semibold text-blue-700">
                      {currency(cartItem.item.price * cartItem.quantity)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden">
                      <button onClick={() => changeQuantity(cartItem.item.id, -1)} aria-label="Diminuir quantidade" className="px-2 py-1 hover:bg-slate-100">
                        <Minus size={14} />
                      </button>
                      <span className="px-3 text-sm">{cartItem.quantity}</span>
                      <button onClick={() => changeQuantity(cartItem.item.id, 1)} aria-label="Aumentar quantidade" className="px-2 py-1 hover:bg-slate-100">
                        <Plus size={14} />
                      </button>
                    </div>
                    <button onClick={() => changeQuantity(cartItem.item.id, -cartItem.quantity)} className="text-xs text-rose-600 hover:underline">
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-semibold text-slate-900">{currency(subtotal)}</span>
              </div>
              <button
                onClick={() => setCheckoutOpen(true)}
                disabled={cart.length === 0}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex justify-center items-center gap-2"
              >
                <CreditCard size={16} /> Ir para pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setCheckoutOpen(false)} />
          <div ref={checkoutModalRef} role="dialog" aria-modal="true" aria-labelledby="checkout-modal-title" className="relative w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
            <h3 id="checkout-modal-title" className="text-xl font-semibold text-slate-900">Pagamento</h3>
            <p className="text-sm text-slate-500 mt-1">
              Finalize os dados para concluir seu pedido de produtos e serviços.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
              <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Nome completo" aria-label="Nome completo" />
              <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Email" aria-label="Email" />
              <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Telefone" aria-label="Telefone" />
              <select aria-label="Forma de pagamento" className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option>Pix</option>
                <option>Cartão de crédito</option>
                <option>Boleto</option>
              </select>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm flex justify-between">
              <span className="text-slate-600">Total do pedido</span>
              <span className="font-semibold text-slate-900">{currency(subtotal)}</span>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCheckoutOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">
                Voltar
              </button>
              <button
                disabled
                title="Pedidos ainda não disponíveis nesta versão" aria-label="Pedidos ainda não disponíveis nesta versão"
                className="px-4 py-2 bg-slate-300 text-slate-500 rounded-lg cursor-not-allowed"
              >
                Finalizar pedido (em breve)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
