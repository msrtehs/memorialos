import React from 'react';
import { ShoppingBag, Heart, Spade, Calendar, ArrowRight } from 'lucide-react';

const products = [
  {
    id: 1,
    name: 'Coroa de Flores "Paz Eterna"',
    price: 'R$ 350,00',
    category: 'Flores',
    image: 'https://images.unsplash.com/photo-1596627689688-464879574d53?q=80&w=800&auto=format&fit=crop', // Wreath/Flowers
    description: 'Lírios brancos e rosas, simbolizando a paz e o amor eterno.'
  },
  {
    id: 2,
    name: 'Buquê "Saudade"',
    price: 'R$ 120,00',
    category: 'Flores',
    image: 'https://images.unsplash.com/photo-1563241527-3004b7be025b?q=80&w=800&auto=format&fit=crop', // Bouquet
    description: 'Um arranjo delicado para expressar carinho e lembrança.'
  },
  {
    id: 3,
    name: 'Manutenção e Limpeza',
    price: 'R$ 80,00',
    category: 'Serviços',
    image: 'https://images.unsplash.com/photo-1635321360079-58352667104d?q=80&w=800&auto=format&fit=crop', // Cleaning/Maintenance (stone cleaning)
    description: 'Limpeza completa da lápide, polimento e remoção de ervas daninhas.'
  },
  {
    id: 4,
    name: 'Cerimônia de Lembrança',
    price: 'R$ 500,00',
    category: 'Cerimônias',
    image: 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?q=80&w=800&auto=format&fit=crop', // Ceremony/Gathering
    description: 'Organização de pequena cerimônia no local com música e celebrante.'
  },
  {
    id: 5,
    name: 'Vela Virtual (7 dias)',
    price: 'R$ 10,00',
    category: 'Digital',
    image: 'https://images.unsplash.com/photo-1602606346738-29562325372c?q=80&w=800&auto=format&fit=crop', // Candle
    description: 'Acenda uma vela virtual no perfil do memorial por 7 dias.'
  },
  {
    id: 6,
    name: 'Placa de Homenagem',
    price: 'R$ 250,00',
    category: 'Personalização',
    image: 'https://images.unsplash.com/photo-1533630762944-7724ebdb7956?q=80&w=800&auto=format&fit=crop', // Plaque/Stone
    description: 'Placa em bronze personalizada com frase e foto.'
  }
];

export default function ShopAndServices() {
  const handlePurchase = (productName: string) => {
    alert(`Você selecionou: ${productName}. Em breve você será redirecionado para o pagamento.`);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-blue-900">Loja e Serviços</h1>
          <p className="text-slate-500 mt-2">Homenagens, cuidados e serviços para honrar a memória.</p>
        </div>
        <div className="bg-white p-2 rounded-full shadow-sm border border-blue-50">
          <ShoppingBag className="text-blue-600" size={24} />
        </div>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['Flores', 'Serviços', 'Cerimônias', 'Digital'].map((cat) => (
          <button key={cat} className="bg-white p-4 rounded-xl border border-blue-50 text-blue-900 font-medium hover:bg-blue-50 transition-colors text-center shadow-sm">
            {cat}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div 
            key={product.id}
            className="bg-white rounded-2xl shadow-sm border border-blue-50 overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
          >
            <div className="h-48 overflow-hidden relative">
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-blue-900 shadow-sm">
                {product.category}
              </div>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-serif text-lg font-bold text-slate-900 leading-tight">{product.name}</h3>
                <span className="font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-lg text-sm whitespace-nowrap">
                  {product.price}
                </span>
              </div>
              <p className="text-slate-500 text-sm mb-6 line-clamp-2">
                {product.description}
              </p>
              <button 
                onClick={() => handlePurchase(product.name)}
                className="w-full bg-white border-2 border-blue-100 text-blue-700 py-2.5 rounded-xl font-medium hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                Adicionar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Special Service Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="relative z-10 max-w-lg">
          <h2 className="text-2xl md:text-3xl font-serif font-bold mb-4">Plano de Manutenção Anual</h2>
          <p className="text-blue-100 mb-8 leading-relaxed">
            Garanta que o local de descanso do seu ente querido esteja sempre impecável. Inclui limpeza mensal, troca de flores e polimento da lápide.
          </p>
          <button className="bg-white text-blue-900 px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg">
            Saber Mais
          </button>
        </div>
      </div>
    </div>
  );
}
