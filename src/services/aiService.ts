import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase'; // `app` exportado de firebase.ts

const functions = getFunctions(app);
const generateContentFn = httpsCallable<
  { prompt: string; type: string; model?: string },
  { text: string }
>(functions, 'generateContent');

export const generateObituary = async (data: any): Promise<string> => {
  const prompt = `
    Escreva um obituário respeitoso, acolhedor e emocionante para:
    Nome: ${data.name}
    Data de Nascimento: ${data.dateOfBirth}
    Data de Falecimento: ${data.dateOfDeath}
    Cidade: ${data.city} - ${data.state}
    Profissão: ${data.profession}
    Hobbies/Paixões: ${data.hobbies}
    Família: ${data.familyMembers}
    Realizações: ${data.achievements}
    Relação com quem comunica: ${data.relationshipType || 'Não informado'}
    Subtítulo de homenagem: ${data.relationshipLabel || 'Não informado'}

    O tom deve ser sereno, humano e confortante para a família.
    Escreva em português do Brasil. Máximo de 3 parágrafos.
  `;
  try {
    const result = await generateContentFn({ prompt, type: 'obituary' });
    return result.data.text;
  } catch (error: any) {
    console.error('Error generating obituary:', error);
    if (error.code === 'functions/unauthenticated') return 'Faça login para usar o gerador de obituário.';
    return 'Erro ao gerar obituário. Tente novamente.';
  }
};

export const chatWithMemorialAI = async (
  history: { role: 'user' | 'model'; parts: string }[],
  message: string,
  userContext?: string
): Promise<string> => {
  // Para chat com histórico, envie o histórico serializado no prompt
  const fullPrompt = [
    `Contexto: ${userContext || 'Não informado.'}`,
    ...history.map(h => `${h.role === 'user' ? 'Usuário' : 'Assistente'}: ${h.parts}`),
    `Usuário: ${message}`
  ].join('\n');

  const result = await generateContentFn({ prompt: fullPrompt, type: 'chat' });
  return result.data.text;
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
  const fullPrompt = [
    `Você é ${agent.name}. Objetivo: ${agent.objective}`,
    `Contexto: ${contextSummary}`,
    ...history.map(h => `${h.role === 'user' ? 'Usuário' : 'Assistente'}: ${h.parts}`),
    `Usuário: ${message}`
  ].join('\n');

  const result = await generateContentFn({ prompt: fullPrompt, type: 'manager_agent' });
  return result.data.text;
};
