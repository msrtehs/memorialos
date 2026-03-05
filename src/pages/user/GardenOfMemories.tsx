import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyNotifications, DeathNotification } from '@/services/notificationService';
import { Calendar, MapPin, Heart, Wrench, ChevronRight, User, X, Clock, AlertCircle, Check, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function GardenOfMemories() {
  const { user, role } = useAuth();
  const [notifications, setNotifications] = useState<DeathNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<DeathNotification | null>(null);

  useEffect(() => {
    async function fetch() {
      if (user) {
        try {
          const data = await getMyNotifications();
          setNotifications(data);
        } catch (error) {
          console.error("Error fetching garden:", error);
        } finally {
          setLoading(false);
        }
      }
    }
    fetch();
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full flex items-center gap-1"><Clock size={12} /> Em Análise</span>;
      case 'reviewing':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center gap-1"><Clock size={12} /> Em Revisão</span>;
      case 'allocated':
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center gap-1"><Check size={12} /> Aprovado</span>;
      case 'rejected':
        return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full flex items-center gap-1"><AlertCircle size={12} /> Recusado</span>;
      default:
        return null;
    }
  };

  const handleDelete = async (e: React.MouseEvent, notification: DeathNotification) => {
    e.stopPropagation();
    const notificationId = notification.id;
    console.log("Delete requested for:", notificationId);
    
    if (!notificationId) {
      console.error("Invalid notification ID");
      return;
    }

    if (!canDeleteNotification(notification)) {
      alert("Apenas registros rejeitados podem ser excluídos.");
      return;
    }

    if (window.confirm("Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.")) {
      try {
        console.log("Attempting to delete document directly:", notificationId);
        await deleteDoc(doc(db, 'death_notifications', notificationId));
        console.log("Document deleted successfully");
        
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (selectedNotification?.id === notificationId) {
          setSelectedNotification(null);
        }
        alert("Registro excluído com sucesso.");
      } catch (error) {
        console.error("Error deleting notification:", error);
        alert("Erro ao excluir. Verifique se você tem permissão para realizar esta ação.");
      }
    }
  };

  const canDeleteNotification = (notification: DeathNotification) => {
    const isStaff = ['superadmin', 'gestor', 'manager', 'operador', 'operator'].includes(role || '');
    return isStaff || notification.status === 'rejected';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">Jardim de Memórias</h1>
          <p className="text-slate-500 mt-2 text-sm">Acompanhe suas solicitações e honre a memória dos seus entes queridos.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-72 bg-white rounded-xl shadow-sm animate-pulse border border-slate-100"></div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-xl border border-dashed border-slate-300">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
            <Heart size={32} />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhuma memória ainda</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-8 text-sm">
            Você ainda não cadastrou nenhum ente querido. Utilize a opção "Comunicar Óbito" para adicionar alguém ao seu jardim.
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
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-80"></div>
                
                <div className="absolute top-4 left-4 z-10">
                  <button 
                    onClick={(e) => handleDelete(e, notification)}
                    disabled={!canDeleteNotification(notification)}
                    className={`p-2 text-white rounded-full backdrop-blur-md transition-colors ${
                      canDeleteNotification(notification)
                        ? 'bg-black/20 hover:bg-red-600'
                        : 'bg-black/10 cursor-not-allowed opacity-60'
                    }`}
                    title={canDeleteNotification(notification) ? "Excluir registro" : "Somente registros rejeitados podem ser excluídos"}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="absolute top-4 right-4">
                  {getStatusBadge(notification.status)}
                </div>
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <h3 className="font-serif text-2xl font-bold leading-tight mb-1">{notification.deceased.name}</h3>
                  <p className="text-sm text-slate-200 font-medium tracking-wide opacity-90">
                    {notification.deceased.dateOfBirth && format(new Date(notification.deceased.dateOfBirth), 'yyyy')} — {notification.deceased.dateOfDeath && format(new Date(notification.deceased.dateOfDeath), 'yyyy')}
                  </p>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-4 uppercase tracking-wider">
                  <MapPin size={14} className="text-blue-500" />
                  <span className="truncate">
                    {notification.status === 'allocated' && notification.allocation 
                      ? `Jazigo ${notification.allocation.plotCode}` 
                      : 'Local em definição'}
                  </span>
                </div>
                <p className="text-slate-600 text-sm line-clamp-3 mb-6 italic leading-relaxed">
                  "{notification.deceased.epitaph || 'Saudades eternas...'}"
                </p>
                <div className="flex items-center justify-between pt-5 border-t border-slate-50">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider group-hover:underline decoration-2 underline-offset-4">Ver Detalhes</span>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedNotification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div 
              onClick={() => setSelectedNotification(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            />
            <div 
              className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col md:flex-row animate-fade-in-up"
            >
              <button 
                onClick={() => setSelectedNotification(null)}
                className="absolute top-4 right-4 z-20 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors md:hidden"
              >
                <X size={20} />
              </button>

              {/* Sidebar / Photo */}
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:hidden"></div>
                  <div className="absolute bottom-6 left-6 text-white md:hidden pr-12">
                    <h2 className="font-serif text-2xl font-bold leading-tight">{selectedNotification.deceased.name}</h2>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto bg-white">
                <div className="p-8 md:p-10">
                  <div className="flex justify-between items-start mb-8">
                    <div className="hidden md:block">
                      <h2 className="font-serif text-4xl font-bold text-slate-900 mb-2">{selectedNotification.deceased.name}</h2>
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <MapPin size={16} />
                        {selectedNotification.deceased.city}, {selectedNotification.deceased.state}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => handleDelete(e, selectedNotification)}
                        disabled={!canDeleteNotification(selectedNotification)}
                        className={`hidden md:flex p-2 rounded-full transition-colors ${
                          canDeleteNotification(selectedNotification)
                            ? 'bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700'
                            : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        }`}
                        title={canDeleteNotification(selectedNotification) ? "Excluir registro" : "Somente registros rejeitados podem ser excluídos"}
                      >
                        <Trash2 size={20} />
                      </button>
                      <button 
                        onClick={() => setSelectedNotification(null)}
                        className="hidden md:flex p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-8">
                     {getStatusBadge(selectedNotification.status)}
                     {selectedNotification.status === 'rejected' && (
                       <p className="text-red-600 text-sm mt-2 bg-red-50 p-3 rounded-lg border border-red-100">
                         Motivo: {selectedNotification.rejectionReason}
                       </p>
                     )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 pb-10 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Nascimento & Falecimento</h4>
                      <div className="flex items-center gap-3 text-slate-700 font-medium">
                        <Calendar size={18} className="text-blue-500" />
                        <span>
                          {selectedNotification.deceased.dateOfBirth && format(new Date(selectedNotification.deceased.dateOfBirth), 'dd/MM/yyyy')} — {selectedNotification.deceased.dateOfDeath && format(new Date(selectedNotification.deceased.dateOfDeath), 'dd/MM/yyyy')}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Profissão</h4>
                      <p className="text-slate-700 font-medium">{selectedNotification.deceased.profession || 'Não informada'}</p>
                    </div>
                  </div>

                  <div className="space-y-10">
                    {selectedNotification.deceased.obituary && (
                      <div>
                        <h3 className="font-serif text-2xl font-bold text-slate-900 mb-4">Obituário</h3>
                        <div className="prose prose-slate prose-sm max-w-none text-slate-600 leading-relaxed">
                          <p className="whitespace-pre-line">{selectedNotification.deceased.obituary}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {selectedNotification.deceased.hobbies && (
                        <div>
                          <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <Heart size={16} className="text-blue-500" /> Hobbies e Paixões
                          </h4>
                          <p className="text-slate-600 text-sm leading-relaxed">{selectedNotification.deceased.hobbies}</p>
                        </div>
                      )}
                      {selectedNotification.deceased.achievements && (
                        <div>
                          <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <User size={16} className="text-blue-500" /> Realizações
                          </h4>
                          <p className="text-slate-600 text-sm leading-relaxed">{selectedNotification.deceased.achievements}</p>
                        </div>
                      )}
                    </div>

                    {selectedNotification.deceased.familyMembers && (
                      <div className="bg-slate-50 rounded-xl p-6">
                        <h4 className="font-bold text-slate-900 mb-3">Família</h4>
                        <p className="text-slate-600 text-sm">{selectedNotification.deceased.familyMembers}</p>
                      </div>
                    )}

                    {selectedNotification.status === 'allocated' && selectedNotification.allocation && (
                      <div className="bg-blue-50 rounded-xl p-6 border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-blue-900 mb-1 flex items-center gap-2">
                            <MapPin size={16} /> Local de Sepultamento Confirmado
                          </h4>
                          <p className="text-sm text-blue-700">Cemitério ID: {selectedNotification.allocation.cemeteryId}</p>
                          <p className="text-xs text-blue-500 mt-1 font-medium bg-blue-100 inline-block px-2 py-1 rounded">
                            Setor: {selectedNotification.allocation.sectorId} | Jazigo: {selectedNotification.allocation.plotCode}
                          </p>
                        </div>
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
