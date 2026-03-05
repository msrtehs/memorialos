import React from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Leaf, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function EnvironmentalPage() {
  const { selectedCemeteryId } = useAdmin();

  const documents = [
    { id: 1, name: 'Licença de Operação (LO)', status: 'valid', expiration: '2025-12-31', issuer: 'CETESB' },
    { id: 2, name: 'Alvará de Funcionamento', status: 'expired', expiration: '2023-10-01', issuer: 'Prefeitura' },
    { id: 3, name: 'Plano de Gerenciamento de Resíduos', status: 'pending', expiration: '2024-06-15', issuer: 'ANVISA' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Ambiental / Documentação</h1>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
          <Leaf size={14} className="text-green-600" />
          Gestão Ambiental
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documents.map(doc => (
          <div key={doc.id} className={`p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow relative overflow-hidden ${
            doc.status === 'valid' ? 'bg-white border-green-200' :
            doc.status === 'expired' ? 'bg-white border-red-200' :
            'bg-white border-yellow-200'
          }`}>
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 ${
              doc.status === 'valid' ? 'bg-green-500' :
              doc.status === 'expired' ? 'bg-red-500' :
              'bg-yellow-500'
            }`}></div>

            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`p-2 rounded-lg ${
                doc.status === 'valid' ? 'bg-green-50 text-green-600' :
                doc.status === 'expired' ? 'bg-red-50 text-red-600' :
                'bg-yellow-50 text-yellow-600'
              }`}>
                <FileText size={24} />
              </div>
              <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full border ${
                doc.status === 'valid' ? 'bg-green-50 text-green-700 border-green-100' :
                doc.status === 'expired' ? 'bg-red-50 text-red-700 border-red-100' :
                'bg-yellow-50 text-yellow-700 border-yellow-100'
              }`}>
                {doc.status === 'valid' ? 'Vigente' : doc.status === 'expired' ? 'Vencido' : 'Pendente'}
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-1 relative z-10">{doc.name}</h3>
            <p className="text-sm text-slate-500 mb-4 relative z-10">Emissor: {doc.issuer}</p>

            <div className="flex items-center gap-2 text-sm font-mono text-slate-600 pt-4 border-t border-slate-100 relative z-10">
              <Clock size={14} className="text-slate-400" />
              Vencimento: {doc.expiration}
            </div>

            {doc.status === 'expired' && (
              <button className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded-lg transition-colors shadow-sm relative z-10">
                Renovar Agora
              </button>
            )}
            
            {doc.status === 'pending' && (
              <button className="mt-4 w-full bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium py-2 rounded-lg transition-colors shadow-sm relative z-10">
                Acompanhar Processo
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
