import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Flower2 } from 'lucide-react';

interface PublicMemorial {
  name: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  city?: string;
  state?: string;
  photoUrl?: string | null;
  cemeteryId?: string;
}

export default function MemorialPage() {
  const { id } = useParams<{ id: string }>();
  const [memorial, setMemorial] = useState<PublicMemorial | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'public_deceaseds', id));
        if (!snap.exists()) { setState('notfound'); return; }
        setMemorial(snap.data() as PublicMemorial);
        setState('ready');
      } catch {
        setState('error');
      }
    })();
  }, [id]);

  if (state === 'loading') return <div className="min-h-[50vh] flex items-center justify-center text-slate-400">Carregando memorial...</div>;
  if (state === 'notfound') return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
      <Flower2 size={40} className="text-blue-200 mb-3" />
      <h1 className="text-2xl font-serif font-bold text-blue-900 mb-2">Memorial não encontrado</h1>
      <p className="text-slate-500 mb-4">Este registro pode ter sido removido ou o endereço está incorreto.</p>
      <Link to="/buscar" className="text-blue-600 font-medium hover:underline">Buscar na página de falecidos</Link>
    </div>
  );
  if (state === 'error') return <div className="min-h-[50vh] flex items-center justify-center text-rose-600">Não foi possível carregar o memorial. Tente novamente.</div>;

  const years = [memorial?.dateOfBirth?.slice(0, 4), memorial?.dateOfDeath?.slice(0, 4)].filter(Boolean).join(' — ');

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <div className="w-40 h-40 mx-auto rounded-full overflow-hidden bg-blue-50 border-4 border-white shadow-lg mb-6">
        {memorial?.photoUrl
          ? <img src={memorial.photoUrl} alt={`Foto de ${memorial.name}`} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-blue-200"><Flower2 size={48} /></div>}
      </div>
      <h1 className="text-3xl font-serif font-bold text-blue-900">{memorial?.name}</h1>
      {years && <p className="text-slate-500 mt-1 text-lg">{years}</p>}
      {(memorial?.city || memorial?.state) && (
        <p className="text-slate-400 text-sm mt-1">{[memorial.city, memorial.state].filter(Boolean).join(' / ')}</p>
      )}
      <div className="mt-8 bg-blue-50 rounded-2xl p-6 text-blue-900/70 font-serif italic">
        "A saudade é a memória do coração."
      </div>
      <p className="mt-8 text-xs text-slate-400">
        Memorial público mantido pela administração do cemitério.
        Familiares podem solicitar alterações ou remoção pela administração municipal.
      </p>
    </div>
  );
}
