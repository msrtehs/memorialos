import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FileText, MoreHorizontal } from 'lucide-react';
import { getDeceasedList, Deceased } from '@/services/deceasedService';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DeceasedList() {
  const { tenantId } = useAuth();
  const [deceaseds, setDeceaseds] = useState<Deceased[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetch() {
      if (tenantId) {
        try {
          const data = await getDeceasedList(tenantId);
          setDeceaseds(data);
        } catch (error) {
          console.error("Error fetching deceased list:", error);
        } finally {
          setLoading(false);
        }
      }
    }
    fetch();
  }, [tenantId]);

  const filteredDeceaseds = deceaseds.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Falecidos</h1>
          <p className="text-slate-500">Gerenciamento de registros de óbito e sepultamento.</p>
        </div>
        <Link 
          to="/admin/falecidos/novo" 
          className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-800 transition-colors"
        >
          <Plus size={18} /> Novo Registro
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
        {/* Add more filters here if needed */}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-medium text-slate-600 text-sm">Nome</th>
              <th className="px-6 py-4 font-medium text-slate-600 text-sm">Data de Falecimento</th>
              <th className="px-6 py-4 font-medium text-slate-600 text-sm">Local</th>
              <th className="px-6 py-4 font-medium text-slate-600 text-sm">Documentos</th>
              <th className="px-6 py-4 font-medium text-slate-600 text-sm text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Carregando...</td></tr>
            ) : filteredDeceaseds.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum registro encontrado.</td></tr>
            ) : (
              filteredDeceaseds.map((person) => (
                <tr key={person.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{person.name}</div>
                    <div className="text-xs text-slate-500">ID: {person.id?.slice(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {person.dateOfDeath ? format(new Date(person.dateOfDeath), 'dd/MM/yyyy') : '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {person.cemeteryId || 'Não definido'}
                    {person.plotId && <span className="block text-xs text-slate-400">Jazigo: {person.plotId}</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-slate-500 text-sm">
                      <FileText size={14} />
                      <span>{person.documents?.length || 0} anexos</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200">
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
