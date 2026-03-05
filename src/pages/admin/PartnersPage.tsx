import React from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Handshake, Phone, Mail, Globe, Plus } from 'lucide-react';

export default function PartnersPage() {
  const { selectedCemeteryId } = useAdmin();

  const partners = [
    { id: 1, name: 'Floricultura Jardim da Paz', type: 'Floricultura', description: 'Fornecedor oficial de coroas e arranjos.', contact: '(11) 99999-8888', email: 'contato@floricultura.com' },
    { id: 2, name: 'Marmoraria São Pedro', type: 'Marmoraria', description: 'Confecção de lápides e manutenção de túmulos.', contact: '(11) 98888-7777', email: 'vendas@saopedro.com' },
    { id: 3, name: 'Seguradora Vida Tranquila', type: 'Seguros', description: 'Planos funerários e assistência familiar.', contact: '0800 123 456', email: 'sac@vidatranquila.com' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Parceiros</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-200">
          <Plus size={18} /> Novo Parceiro
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {partners.map(partner => (
          <div key={partner.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                <Handshake size={24} />
              </div>
              <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                {partner.type}
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-slate-800 mb-1">{partner.name}</h3>
            <p className="text-sm text-slate-500 mb-6 flex-1">{partner.description}</p>
            
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone size={14} className="text-slate-400" /> {partner.contact}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail size={14} className="text-slate-400" /> {partner.email}
              </div>
            </div>

            <button className="mt-4 w-full border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium py-2 rounded-lg transition-colors text-sm">
              Ver Detalhes
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
