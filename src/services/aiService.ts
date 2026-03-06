import { GoogleGenAI } from '@google/genai';

function getAIClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export const generateObituary = async (data: any) => {
  try {
    const ai = getAIClient();
    if (!ai) {
      return 'Servico de IA indisponivel: chave Gemini nao configurada.';
    }

    const prompt = `
      Escreva um obituario respeitoso, acolhedor e emocionante para:
      Nome: ${data.name}
      Data de Nascimento: ${data.dateOfBirth}
      Data de Falecimento: ${data.dateOfDeath}
      Cidade: ${data.city} - ${data.state}
      Profissao: ${data.profession}
      Hobbies/Paixoes: ${data.hobbies}
      Familia: ${data.familyMembers}
      Realizacoes: ${data.achievements}
      Relacao com quem comunica: ${data.relationshipType || 'Nao informado'}
      Subtitulo de homenagem: ${data.relationshipLabel || 'Nao informado'}

      O tom deve ser sereno, humano e confortante para a familia.
      Escreva em portugues do Brasil. Maximo de 3 paragrafos.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    return response.text || '';
  } catch (error: any) {
    console.error('Error generating obituary:', error);
    if (error.message && error.message.includes('API key')) {
      return 'Erro: chave de API invalida ou expirada.';
    }
    throw error;
  }
};

export const chatWithMemorialAI = async (
  history: { role: 'user' | 'model'; parts: string }[],
  message: string,
  userContext?: string
) => {
  try {
    const ai = getAIClient();
    if (!ai) {
      return 'Servico de IA indisponivel no momento.';
    }

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `Voce e o Memorial AI, um assistente virtual do sistema MemorialOS.
Seja sempre empatico, respeitoso e claro.
Voce pode ajudar com duvidas sobre comunicar obito, horarios, localizacao de jazigos e orientacoes gerais.
Nao de conselhos medicos ou juridicos definitivos.
Contexto emocional do usuario: ${userContext || 'Nao informado.'}`
      },
      history: history.map((item) => ({
        role: item.role,
        parts: [{ text: item.parts }]
      }))
    });

    const result = await chat.sendMessage({ message });
    return result.text || '';
  } catch (error) {
    console.error('Error in chat:', error);
    throw error;
  }
};

interface ManagerAgentInput {
  name: string;
  objective: string;
  prompt: string;
  modules: string[];
}

export const chatWithManagerAgent = async (
  agent: ManagerAgentInput,
  history: { role: 'user' | 'model'; parts: string }[],
  message: string,
  contextSummary: string
) => {
  try {
    const ai = getAIClient();
    if (!ai) {
      return `Assistente ${agent.name} indisponivel no momento (Gemini nao configurado).`;
    }

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `
          Voce e ${agent.name}, agente inteligente do Sistema Cemiterial Inteligente (SCI).
          Objetivo: ${agent.objective}
          Modulos autorizados: ${agent.modules.join(', ') || 'todos'}
          Instrucoes especificas: ${agent.prompt}
          Contexto operacional atual: ${contextSummary}

          Responda em portugues do Brasil, de forma executiva, clara e orientada a acao.
          Sempre aponte riscos sanitarios, ambientais e operacionais quando houver sinais no contexto.
        `
      },
      history: history.map((item) => ({
        role: item.role,
        parts: [{ text: item.parts }]
      }))
    });

    const result = await chat.sendMessage({ message });
    return result.text || '';
  } catch (error) {
    console.error('Error in manager agent chat:', error);
    throw error;
  }
};
