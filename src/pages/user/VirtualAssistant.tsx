import React, { useState, useRef, useEffect } from 'react';
import { chatWithMemorialAI } from '@/services/aiService';
import { Send, MessageCircleHeart, User, Bot } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export default function VirtualAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: 'Olá. Eu sou o Memorial AI. Sinto muito pela sua perda. Estou aqui para ajudar você com dúvidas sobre o cemitério, documentação ou apenas para conversar. Como posso ajudar hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Prepare history for API
      const history = messages.map(m => ({ role: m.role, parts: m.text }));
      const responseText = await chatWithMemorialAI(history, userMsg.text);
      
      const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: responseText };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      const errorMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: 'Desculpe, estou tendo dificuldades para responder agora. Poderia tentar novamente?' };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white rounded-3xl shadow-sm border border-blue-50 overflow-hidden">
      {/* Header */}
      <div className="bg-blue-50 p-6 border-b border-blue-100 flex items-center gap-4">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm">
          <MessageCircleHeart size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-blue-900">Memorial AI</h1>
          <p className="text-sm text-blue-500">Assistente Virtual de Apoio</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8FAFC]">
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-100'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white text-slate-700 border border-blue-50 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-3">
             <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-blue-600 border border-blue-100">
              <Bot size={16} />
            </div>
            <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-blue-50 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-150"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-blue-50">
        <form onSubmit={handleSend} className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..." 
            className="flex-1 px-6 py-3 bg-slate-50 border border-blue-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || loading}
            className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-200"
          >
            <Send size={20} className={loading ? 'opacity-0' : 'ml-0.5'} />
          </button>
        </form>
      </div>
    </div>
  );
}
