import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyNotifications, DeathNotification } from '@/services/notificationService';
import {
  Calendar,
  MapPin,
  Heart,
  ChevronRight,
  User,
  X,
  Clock,
  AlertCircle,
  Check,
  Trash2,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

function getStatusBadge(status: string) {
  switch (status) {
    case 'submitted':
      return (
        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <Clock size={12} /> Em analise
        </span>
      );
    case 'reviewing':
      return (
        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <Clock size={12} /> Em revisao
        </span>
      );
    case 'allocated':
      return (
        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <Check size={12} /> Aprovado
        </span>
      );
    case 'rejected':
      return (
        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <AlertCircle size={12} /> Recusado
        </span>
      );
    default:
      return null;
  }
}

function getRelationshipSubtitle(notification: DeathNotification) {
  return (
    notification.deceased.relationshipLabel ||
    notification.deceased.relationshipType ||
    'Pessoa querida'
  );
}

export default function GardenOfMemories() {
  const { role } = useAuth();
  const [notifications, setNotifications] = useState<DeathNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<DeathNotification | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getMyNotifications();
        setNotifications(data);
      } catch (error) {
        console.error('Erro ao carregar jardim de memorias:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const canDeleteNotification = (notification: DeathNotification) => {
    const isStaff = ['superadmin', 'gestor', 'manager', 'operador', 'operator'].includes(role || '');
    return isStaff || notification.status === 'rejected';
  };

  const handleDelete = async (event: React.MouseEvent, notification: DeathNotification) => {
    event.stopPropagation();
    if (!notification.id) return;
    if (!canDeleteNotification(notification)) {
      alert('Somente registros rejeitados podem ser excluidos.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
      await deleteDoc(doc(db, 'death_notifications', notification.id));
      setNotifications((prev) => prev.filter((item) => item.id !== notification.id));
      if (selectedNotification?.id === notification.id) {
        setSelectedNotification(null);
      }
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
      alert('Nao foi possivel excluir o registro.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">
            Jardim de Memorias
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Acompanhe solicitacoes e mantenha viva a historia dos seus entes queridos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((index) => (
          <Link
            key={`cta-${index}`}
            to="/app/comunicar-obito"
            className="bg-white border border-dashed border-blue-300 rounded-2xl p-6 hover:bg-blue-50/60 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Plus size={24} />
            </div>
            <h2 className="mt-4 font-semibold text-slate-900">Comunicar obito</h2>
            <p className="text-sm text-slate-500 mt-1">
              Inicie um novo comunicado e adicione uma memoria ao seu jardim.
            </p>
            <div className="mt-4 text-blue-700 text-sm font-medium inline-flex items-center gap-1 group-hover:underline">
              Ir para formulario <ChevronRight size={14} />
            </div>
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-72 bg-white rounded-xl shadow-sm animate-pulse border border-slate-100" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-400">
            <Heart size={30} />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Sem memorias registradas ainda</h3>
          <p className="text-slate-500 max-w-md mx-auto text-sm">
            Use os cards acima para iniciar o primeiro comunicado de obito.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => setSelectedNotification(notification)}
              className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden cursor-pointer hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="h-64 bg-slate-100 relative overflow-hidden">
                {notification.photoUrl ? (
                  <img
                    src={notification.photoUrl}
                    alt={notification.deceased.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300">
                    <User size={64} strokeWidth={1} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-80" />

                <div className="absolute top-4 left-4 z-10">
                  <button
                    onClick={(event) => handleDelete(event, notification)}
                    disabled={!canDeleteNotification(notification)}
                    className={`p-2 text-white rounded-full backdrop-blur-md transition-colors ${
                      canDeleteNotification(notification)
                        ? 'bg-black/20 hover:bg-red-600'
                        : 'bg-black/10 cursor-not-allowed opacity-60'
                    }`}
                    title={
                      canDeleteNotification(notification)
                        ? 'Excluir registro'
                        : 'Somente registros rejeitados podem ser excluidos'
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="absolute top-4 right-4">{getStatusBadge(notification.status)}</div>
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <h3 className="font-serif text-2xl font-bold leading-tight mb-1">
                    {notification.deceased.name}
                  </h3>
                  <p className="text-xs text-slate-200">{getRelationshipSubtitle(notification)}</p>
                  <p className="text-sm text-slate-200 font-medium tracking-wide opacity-90 mt-1">
                    {notification.deceased.dateOfBirth &&
                      format(new Date(notification.deceased.dateOfBirth), 'yyyy')}{' '}
                    -{' '}
                    {notification.deceased.dateOfDeath &&
                      format(new Date(notification.deceased.dateOfDeath), 'yyyy')}
                  </p>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-4 uppercase tracking-wider">
                  <MapPin size={14} className="text-blue-500" />
                  <span className="truncate">
                    {notification.status === 'allocated' && notification.allocation
                      ? `Jazigo ${notification.allocation.plotCode}`
                      : 'Local em definicao'}
                  </span>
                </div>
                <p className="text-slate-600 text-sm line-clamp-3 mb-6 italic leading-relaxed">
                  "{notification.deceased.epitaph || 'Saudade eterna.'}"
                </p>
                <div className="flex items-center justify-between pt-5 border-t border-slate-50">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider group-hover:underline">
                    Ver detalhes
                  </span>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            onClick={() => setSelectedNotification(null)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col md:flex-row">
            <button
              onClick={() => setSelectedNotification(null)}
              className="absolute top-4 right-4 z-20 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors md:hidden"
            >
              <X size={20} />
            </button>

            <div className="w-full md:w-2/5 bg-slate-100 relative">
              <div className="h-72 md:h-full relative">
                {selectedNotification.photoUrl ? (
                  <img
                    src={selectedNotification.photoUrl}
                    alt={selectedNotification.deceased.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
                    <User size={96} strokeWidth={1} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:hidden" />
                <div className="absolute bottom-6 left-6 text-white md:hidden pr-12">
                  <h2 className="font-serif text-2xl font-bold leading-tight">
                    {selectedNotification.deceased.name}
                  </h2>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white">
              <div className="p-8 md:p-10">
                <div className="flex justify-between items-start mb-8">
                  <div className="hidden md:block">
                    <h2 className="font-serif text-4xl font-bold text-slate-900 mb-2">
                      {selectedNotification.deceased.name}
                    </h2>
                    <div className="text-xs text-slate-500 mb-2">
                      {getRelationshipSubtitle(selectedNotification)}
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <MapPin size={16} />
                      {selectedNotification.deceased.city}, {selectedNotification.deceased.state}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNotification(null)}
                    className="hidden md:flex p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="mb-8">
                  {getStatusBadge(selectedNotification.status)}
                  {selectedNotification.status === 'rejected' && (
                    <p className="text-red-600 text-sm mt-2 bg-red-50 p-3 rounded-lg border border-red-100">
                      Motivo: {selectedNotification.rejectionReason}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      Nascimento e falecimento
                    </h4>
                    <div className="flex items-center gap-3 text-slate-700 font-medium">
                      <Calendar size={18} className="text-blue-500" />
                      <span>
                        {selectedNotification.deceased.dateOfBirth &&
                          format(new Date(selectedNotification.deceased.dateOfBirth), 'dd/MM/yyyy')}{' '}
                        -{' '}
                        {selectedNotification.deceased.dateOfDeath &&
                          format(new Date(selectedNotification.deceased.dateOfDeath), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      Profissao
                    </h4>
                    <p className="text-slate-700 font-medium">
                      {selectedNotification.deceased.profession || 'Nao informada'}
                    </p>
                  </div>
                </div>

                <div className="space-y-8">
                  {selectedNotification.deceased.obituary && (
                    <div>
                      <h3 className="font-serif text-2xl font-bold text-slate-900 mb-4">Obituario</h3>
                      <p className="whitespace-pre-line text-slate-600 leading-relaxed text-sm">
                        {selectedNotification.deceased.obituary}
                      </p>
                    </div>
                  )}

                  {selectedNotification.status === 'allocated' && selectedNotification.allocation && (
                    <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                      <h4 className="font-bold text-blue-900 mb-1 flex items-center gap-2">
                        <MapPin size={16} /> Local de sepultamento confirmado
                      </h4>
                      <p className="text-sm text-blue-700">
                        Setor: {selectedNotification.allocation.sectorId} | Jazigo:{' '}
                        {selectedNotification.allocation.plotCode}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
