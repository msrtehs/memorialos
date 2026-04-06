import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export const generateObituary = async (data: any): Promise<string> => {
  try {
    const fn = httpsCallable<any, { text: string }>(functions, 'generateObituary');
    const result = await fn(data);
    return result.data.text;
  } catch (error: any) {
    console.error('Error generating obituary:', error);
    if (error?.code === 'functions/failed-precondition') {
      return 'Servico de IA indisponivel: chave Gemini nao configurada no servidor.';
    }
    throw error;
  }
};

export const chatWithMemorialAI = async (
  history: { role: 'user' | 'model'; parts: string }[],
  message: string,
  userContext?: string
): Promise<string> => {
  try {
    const fn = httpsCallable<any, { text: string }>(functions, 'chatWithAI');
    const result = await fn({ history, message, userContext });
    return result.data.text;
  } catch (error: any) {
    console.error('Error in chat:', error);
    if (error?.code === 'functions/failed-precondition') {
      return 'Servico de IA indisponivel no momento.';
    }
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
): Promise<string> => {
  try {
    const fn = httpsCallable<any, { text: string }>(functions, 'chatWithManagerAgent');
    const result = await fn({ agent, history, message, contextSummary });
    return result.data.text;
  } catch (error: any) {
    console.error('Error in manager agent chat:', error);
    if (error?.code === 'functions/failed-precondition') {
      return `Assistente ${agent.name} indisponivel no momento.`;
    }
    throw error;
  }
};
