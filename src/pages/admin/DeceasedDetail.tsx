import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { parseISO, format } from 'date-fns';
import { getDeceased, Deceased } from '@/services/deceasedService';

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd/MM/yyyy');
  } catch {
    return iso;
  }
}

export default function DeceasedDetail() {
  const { id } = useParams<{ id: string }>();
  const [person, setPerson] = useState<Deceased | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await getDeceased(id);
        setPerson(data);
      } catch (error) {
        console.error('Error loading deceased:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return <div className="p-8 text-slate-500">Carregando...</div>;
  }

  if (!person) {
    return (
      <div className="p-8 space-y-4">
        <Link to="/admin/falecidos" className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <p className="text-slate-500">Registro não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/admin/falecidos" className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm">
        <ArrowLeft size={16} /> Voltar para a lista
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-4">
          {person.photoUrl ? (
            <img src={person.photoUrl} alt={person.name} className="w-20 h-20 rounded-xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-slate-100" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{person.name}</h1>
            <p className="text-slate-500 text-sm">
              {formatDate(person.dateOfBirth)} — {formatDate(person.dateOfDeath)}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm">
          <div>
            <dt className="text-slate-400">Cidade / Estado</dt>
            <dd className="text-slate-800">{person.city || '—'} {person.state ? `- ${person.state}` : ''}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Profissão</dt>
            <dd className="text-slate-800">{person.profession || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Cemitério</dt>
            <dd className="text-slate-800">{person.cemeteryId || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Jazigo</dt>
            <dd className="text-slate-800">{person.plotId || '—'}</dd>
          </div>
        </dl>

        {person.obituary && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Obituário</h2>
            <p className="text-slate-600 text-sm whitespace-pre-line">{person.obituary}</p>
          </div>
        )}

        {person.documents?.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Documentos</h2>
            <div className="flex flex-wrap gap-2">
              {person.documents.map((doc, idx) => (
                <a
                  key={idx}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline border border-slate-200 rounded px-2 py-1"
                >
                  <FileText size={12} /> {doc.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
