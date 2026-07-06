import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, User, MapPin, Calendar } from 'lucide-react';

interface SearchResult {
  id: string;
  name: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  city?: string;
  state?: string;
  photoUrl?: string;
  cemeteryId?: string;
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim().toLowerCase();
    if (!term || term.length < 3) return;

    setLoading(true);
    setSearched(true);
    setSearchError(null);
    try {
      // Busca server-side por prefixo na projeção pública (LGPD-safe), via nameLowercase (W5-8).
      const q = query(
        collection(db, 'public_deceaseds'),
        where('nameLowercase', '>=', term),
        where('nameLowercase', '<=', term + ''),
        firestoreLimit(50)
      );
      const snapshot = await getDocs(q);
      setResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SearchResult)));
    } catch (error) {
      console.error('Erro na busca:', error);
      setResults([]);
      setSearchError('Não foi possível concluir a busca. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 4rem)' }}>
      {/* Header section */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-blue-900 mb-4">
            Busca de falecidos
          </h1>
          <p className="text-slate-500 mb-8">
            Pesquise por nome para encontrar informacoes sobre falecidos registrados no sistema.
          </p>

          <form onSubmit={handleSearch} className="flex gap-3 max-w-xl mx-auto">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite o nome do falecido (minimo 3 caracteres)"
                className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800"
              />
            </div>
            <button
              type="submit"
              disabled={loading || searchTerm.trim().length < 3}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </form>
        </div>
      </section>

      {/* Results */}
      <section className="py-10 px-4">
        <div className="max-w-4xl mx-auto">
          {searchError && (
            <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 text-sm text-center">
              {searchError}
            </div>
          )}
          {!searched ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={28} className="text-slate-400" />
              </div>
              <p className="text-slate-400">
                Digite um nome acima para iniciar a busca.
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-16">
              <p className="text-slate-400">Buscando registros...</p>
            </div>
          ) : searchError ? null : results.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={28} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-700 mb-2">Nenhum resultado encontrado</h3>
              <p className="text-slate-400 text-sm">
                Nao encontramos registros para "{searchTerm}". Verifique a grafia ou tente outro nome.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-6">
                {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''} para "{searchTerm}"
              </p>
              <div className="space-y-4">
                {results.map((person) => (
                  <Link
                    to={`/memorial/${person.id}`}
                    key={person.id}
                    className="bg-white p-5 rounded-xl border border-slate-200 hover:shadow-md transition-shadow flex items-center gap-5"
                  >
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {person.photoUrl ? (
                        <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={24} className="text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 text-lg">{person.name}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {(person.city || person.state) && (
                          <span className="flex items-center gap-1 text-sm text-slate-500">
                            <MapPin size={14} />
                            {[person.city, person.state].filter(Boolean).join(' - ')}
                          </span>
                        )}
                        {person.dateOfDeath && (
                          <span className="flex items-center gap-1 text-sm text-slate-500">
                            <Calendar size={14} />
                            Falecimento: {person.dateOfDeath}
                          </span>
                        )}
                        {person.dateOfBirth && (
                          <span className="flex items-center gap-1 text-sm text-slate-400">
                            <Calendar size={14} />
                            Nascimento: {person.dateOfBirth}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
