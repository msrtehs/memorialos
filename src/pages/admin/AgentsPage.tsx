import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Bot, Plus, Send, User } from 'lucide-react';
import { reportError, reportLoadError } from '@/lib/errors';
import { formatCurrency } from '@/lib/formatters';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { chatWithManagerAgent } from '@/services/aiService';
import { createAIAgent, getSciExecutiveSnapshot, listAIAgents, updateSCIRecord, SciExecutiveSnapshot } from '@/services/sciService';

export default function AgentsPage() {
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingReply, setLoadingReply] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'Painel de agentes IA pronto. Selecione um agente ou crie um novo chatbot para iniciar.' }
  ]);
  const [snapshot, setSnapshot] = useState<SciExecutiveSnapshot | null>(null);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    mode: 'agent',
    objective: '',
    prompt: '',
    modules: 'operacional,sanitario,ambiental,financeiro',
    isActive: true
  });

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) || null,
    [agents, selectedAgentId]
  );

  const loadData = async () => {
    if (!tenantId) return;
    try {
      const [agentData, execSnapshot] = await Promise.all([
        listAIAgents(tenantId),
        getSciExecutiveSnapshot(tenantId, selectedCemeteryId)
      ]);
      setAgents(agentData);
      setSnapshot(execSnapshot);
      if (!selectedAgentId && agentData.length > 0) {
        setSelectedAgentId(agentData[0].id);
      }
    } catch (error) {
      reportLoadError('AgentsPage.load', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, selectedCemeteryId]);

  const handleCreateAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !form.name || !form.objective || !form.prompt) return;
    try {
      await createAIAgent(tenantId, {
        name: form.name,
        mode: form.mode as any,
        objective: form.objective,
        prompt: form.prompt,
        modules: form.modules.split(',').map((item) => item.trim()).filter(Boolean),
        isActive: form.isActive
      });
      toast.success(`Agente "${form.name}" criado.`);
      setForm({
        name: '',
        mode: 'agent',
        objective: '',
        prompt: '',
        modules: 'operacional,sanitario,ambiental,financeiro',
        isActive: true
      });
      await loadData();
    } catch (error) {
      reportError('AgentsPage.create', error);
    }
  };

  const toggleAgent = async (id: string, currentValue: boolean) => {
    if (!tenantId) return;
    try {
      await updateSCIRecord(tenantId, 'sci_ai_agents', id, 'TOGGLE_AI_AGENT', { isActive: !currentValue });
      toast.success(currentValue ? 'Agente desativado.' : 'Agente ativado.');
      await loadData();
    } catch (error) {
      reportError('AgentsPage.toggle', error);
    }
  };

  const hasChatHistory = messages.some((m) => m.role === 'user');

  const handleSelectAgent = (agentId: string) => {
    if (agentId === selectedAgentId) return;
    // B3: se há histórico ativo, confirmar antes de limpar (sem window.confirm)
    if (hasChatHistory) {
      setPendingAgentId(agentId);
      return;
    }
    setSelectedAgentId(agentId);
  };

  const confirmSwitchAndClear = () => {
    if (!pendingAgentId) return;
    setMessages([
      { role: 'model', text: 'Painel de agentes IA pronto. Selecione um agente ou crie um novo chatbot para iniciar.' }
    ]);
    setSelectedAgentId(pendingAgentId);
    setPendingAgentId(null);
  };

  const buildContext = () => {
    if (!snapshot) return 'Sem contexto executivo disponivel.';
    return [
      `Taxa de ocupacao: ${snapshot.occupancyRate}%`,
      `Sepultamentos: ${snapshot.totalBurials}`,
      `Exumacoes: ${snapshot.totalExhumations}`,
      `Ocorrencias abertas: ${snapshot.openOccurrences}`,
      `Riscos sanitarios: ${snapshot.sanitaryAlerts}`,
      `Riscos ambientais: ${snapshot.environmentalAlerts}`,
      `Falhas estruturais: ${snapshot.structuralFailures}`,
      `Pendencias documentais: ${snapshot.pendingDocuments}`,
      `Receita: ${formatCurrency(snapshot.totalRevenue)}`,
      `Despesa: ${formatCurrency(snapshot.totalExpenses)}`
    ].join(' | ');
  };

  const sendMessage = async () => {
    if (!selectedAgent || !input.trim()) return;
    const userText = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setLoadingReply(true);

    try {
      const history = messages.map((message) => ({ role: message.role, parts: message.text }));
      const reply = await chatWithManagerAgent(
        selectedAgent,
        history,
        userText,
        buildContext()
      );
      setMessages((prev) => [...prev, { role: 'model', text: reply }]);
    } catch (error: any) {
      console.error('Erro no chat do agente:', error);
      const friendly = error?.code === 'functions/resource-exhausted'
        ? 'Limite de uso de IA atingido por hoje. Tente novamente amanhã.'
        : 'Serviço de IA indisponível no momento. Tente novamente em instantes ou contate o suporte.';
      setMessages((prev) => [...prev, { role: 'model', text: friendly }]);
    } finally {
      setLoadingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Agentes inteligentes e chatbots</h1>
        <p className="text-sm text-slate-500">Crie agentes especializados por modulo e teste respostas com contexto operacional em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold text-slate-800 mb-3">Novo agente/chatbot</h2>
          <form onSubmit={handleCreateAgent} className="space-y-3">
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Nome do agente" required />
            <select value={form.mode} onChange={(e) => setForm((prev) => ({ ...prev, mode: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="agent">Agente inteligente</option>
              <option value="chatbot">Chatbot inteligente</option>
            </select>
            <input value={form.objective} onChange={(e) => setForm((prev) => ({ ...prev, objective: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Objetivo principal" required />
            <textarea value={form.prompt} onChange={(e) => setForm((prev) => ({ ...prev, prompt: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm h-20" placeholder="Instrucoes personalizadas" required />
            <input value={form.modules} onChange={(e) => setForm((prev) => ({ ...prev, modules: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Modulos separados por virgula" />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
              Ativar agente apos criar
            </label>
            <button type="submit" className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
              <Plus size={14} /> Criar
            </button>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold text-slate-800 mb-3">Agentes cadastrados</h2>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {agents.map((agent) => (
              <div key={agent.id} className={`border rounded-lg p-3 ${selectedAgentId === agent.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                <button onClick={() => handleSelectAgent(agent.id)} className="w-full text-left">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-slate-800">{agent.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{agent.mode}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full ${agent.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {agent.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{agent.objective}</p>
                </button>
                <div className="mt-2">
                  <button onClick={() => toggleAgent(agent.id, !!agent.isActive)} className="text-xs text-blue-700 hover:underline">
                    {agent.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
            {agents.length === 0 && (
              <div className="text-sm text-slate-500 p-3 border border-dashed border-slate-300 rounded-lg text-center">
                Nenhum agente cadastrado.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col h-[520px]">
          <h2 className="font-semibold text-slate-800 mb-3">Console de teste IA</h2>
          <div className="flex-1 overflow-y-auto space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
            {messages.map((message, index) => (
              <div key={index} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${message.role === 'user' ? 'bg-blue-600 text-white order-2' : 'bg-indigo-600 text-white'}`}>
                  {message.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={`max-w-[85%] text-xs p-3 rounded-xl ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                  {message.text}
                </div>
              </div>
            ))}
            {loadingReply && (
              <div className="text-xs text-slate-500">Agente analisando contexto...</div>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder={selectedAgent ? 'Pergunte ao agente selecionado...' : 'Selecione um agente para conversar'}
              disabled={!selectedAgent || loadingReply}
            />
            <button onClick={sendMessage} disabled={!selectedAgent || loadingReply || !input.trim()} className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60">
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {pendingAgentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Trocar de agente</h3>
            <p className="text-sm text-slate-600 mb-6">
              Você tem uma conversa em andamento. Ao trocar de agente, o histórico atual será limpo. Deseja continuar?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPendingAgentId(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSwitchAndClear}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                Limpar e trocar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
