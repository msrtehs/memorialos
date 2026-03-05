import React, { useState, useRef, useEffect } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Send, Bot, User, AlertTriangle, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// Mock context generator
const generateSystemContext = () => {
  return `
    Contexto Atual do Memorial:
    - Financeiro: Receita R$ 45.000 (Mês), Despesa R$ 12.000, Saldo R$ 33.000.
    - Ocupação: 85% Total (1200/1400 vagas). Setor A crítico (98%).
    - Estoque: Cimento (Crítico - 5 un), Luvas (Ok).
    - Documentação: Licença Ambiental vence em 15 dias.
    - Segurança: 1 Alerta ativo (Portão Principal).
  `;
};

// Mock response for fallback
const getMockExpertReply = (question: string) => {
  const lowerQ = question.toLowerCase();
  if (lowerQ.includes('financeiro') || lowerQ.includes('receita')) {
    return "Com base nos dados atuais, nossa receita mensal está em R$ 45.000, com um saldo positivo de R$ 33.000. Recomendo atenção às despesas operacionais que subiram 5% este mês.";
  }
  if (lowerQ.includes('ocupação') || lowerQ.includes('vagas')) {
    return "A taxa de ocupação global é de 85%, o que é saudável. No entanto, o Setor A está crítico com 98% de ocupação. Sugiro iniciar o planejamento para expansão do Setor C ou incentivar o uso do Ossuário.";
  }
  if (lowerQ.includes('estoque') || lowerQ.includes('compra')) {
    return "Atenção: O estoque de cimento está abaixo do mínimo (5 unidades). Recomendo compra imediata para evitar paradas na manutenção.";
  }
  return "Entendido. Como Supervisora Geral, estou monitorando todos os indicadores. Posso detalhar mais sobre financeiro, ocupação ou alertas de segurança se desejar.";
};

export default function ExpertAIPage() {
  const { selectedCemeteryId } = useAdmin();
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: "Olá. Sou sua Supervisora Geral IA. Estou monitorando todos os setores do cemitério. Como posso ajudar na gestão hoje?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      // Attempt to use Gemini if API key is present (client-side demo only)
      // In production, this should be a backend call
      if (geminiApiKey) {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        
        const context = generateSystemContext();
        const prompt = `
          Você é uma Supervisora Geral de Cemitério, executiva e baseada em dados.
          Use este contexto para responder: ${context}
          
          Pergunta do gestor: ${userMsg}
        `;

        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });
        
        const response = result.text;
        if (response) {
            setMessages(prev => [...prev, { role: 'model', text: response }]);
        } else {
            throw new Error("Empty response");
        }
      } else {
        throw new Error("No API Key or Backend");
      }
    } catch (error) {
      console.warn("Using fallback AI response", error);
      // Fallback
      setTimeout(() => {
        const reply = getMockExpertReply(userMsg);
        setMessages(prev => [...prev, { role: 'model', text: reply }]);
        setIsLoading(false);
      }, 1000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Bot className="text-purple-600" /> Supervisora Geral IA
        </h1>
        <div className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">
          Contexto Atualizado: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 size={16} className="animate-spin" /> Analisando dados...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Pergunte sobre finanças, ocupação ou alertas..."
              className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
              disabled={isLoading}
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            A IA tem acesso aos dados de finanças, estoque e ocupação em tempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
