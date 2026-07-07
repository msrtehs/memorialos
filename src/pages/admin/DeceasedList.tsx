import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FileText, MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getDeceasedPage,
  searchDeceasedByName,
  deleteDeceased,
  Deceased,
  DeceasedPage,
} from '@/services/deceasedService';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { parseISO, format } from 'date-fns';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function DeceasedList() {
  const { tenantId } = useAuth();
  const { cemeteries } = useAdmin();
  const cemeteryName = (id?: string) => cemeteries.find((c) => c.id === id)?.name ?? id ?? 'Não definido';
  const [page, setPage] = useState<DeceasedPage>({ items: [], cursor: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [serverResults, setServerResults] = useState<Deceased[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Deceased | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    if (!tenantId) return;
    try {
      const first = await getDeceasedPage(tenantId);
      setPage(first);
    } catch (error: any) {
      toast.error('Erro ao carregar a lista de falecidos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const loadMore = async () => {
    if (!tenantId || !page.cursor) return;
    setLoadingMore(true);
    try {
      const next = await getDeceasedPage(tenantId, page.cursor);
      setPage({ items: [...page.items, ...next.items], cursor: next.cursor });
    } catch {
      toast.error('Erro ao carregar mais registros.');
    } finally {
      setLoadingMore(false);
    }
  };

  // Busca: com 3+ caracteres, consulta o servidor (debounce 400ms);
  // com menos, mostra a página carregada.
  useEffect(() => {
    if (!tenantId) return;
    const term = searchTerm.trim();
    if (term.length < 3) { setServerResults(null); return; }
    const t = setTimeout(async () => {
      try {
        setServerResults(await searchDeceasedByName(tenantId, term));
      } catch {
        toast.error('Erro na busca.');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm, tenantId]);

  const confirmDelete = async () => {
    if (!tenantId || !pendingDelete?.id) return;
    setDeleting(true);
    try {
      await deleteDeceased(pendingDelete.id, tenantId);
      toast.success('Registro excluído.');
      setPendingDelete(null);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao excluir registro.');
    } finally {
      setDeleting(false);
    }
  };

  const rows = serverResults ?? page.items;

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
            placeholder="Buscar por nome..." aria-label="Buscar por nome..." 
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
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum registro encontrado.</td></tr>
            ) : (
              rows.map((person) => (
                <tr key={person.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{person.name}</div>
                    <div className="text-xs text-slate-500">ID: {person.id?.slice(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {person.dateOfDeath ? format(parseISO(person.dateOfDeath), 'dd/MM/yyyy') : '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {cemeteryName(person.cemeteryId)}
                    {person.plotId && <span className="block text-xs text-slate-400">Jazigo: {person.plotId}</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-slate-500 text-sm">
                      <FileText size={14} />
                      <span>{person.documents?.length || 0} anexos</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === person.id ? null : person.id!)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200"
                        aria-label="Ações do registro"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {openMenuId === person.id && (
                        <div className="absolute right-0 top-8 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                          <Link
                            to={`/admin/falecidos/${person.id}`}
                            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            Ver detalhes
                          </Link>
                          <Link
                            to={`/admin/falecidos/${person.id}/editar`}
                            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            Editar
                          </Link>
                          <button
                            onClick={() => { setOpenMenuId(null); setPendingDelete(person); }}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!serverResults && page.cursor && (
          <div className="p-4 text-center border-t border-slate-100">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingMore ? 'Carregando...' : 'Carregar mais 50'}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        danger
        loading={deleting}
        title="Excluir registro de falecido"
        description={
          <>
            Excluir o registro de <strong>{pendingDelete?.name}</strong>
            {pendingDelete?.documents?.length
              ? <> (com {pendingDelete.documents.length} documento(s) anexado(s))</>
              : null}?
            O registro também sai da busca pública. Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir registro"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
