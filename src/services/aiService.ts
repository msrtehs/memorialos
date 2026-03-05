import { GoogleGenAI } from "@google/genai";

function getAIClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export const generateObituary = async (data: any) => {
  try {
    const ai = getAIClient();
    if (!ai) {
      return "Serviço de IA indisponível: chave Gemini não configurada.";
    }

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
      
      O tom deve ser de celebração da vida, sereno e confortante para a família.
      Escreva em português do Brasil. Máximo de 3 parágrafos.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "";
  } catch (error: any) {
    console.error("Error generating obituary:", error);
    if (error.message && error.message.includes("API key")) {
      return "Erro: Chave de API inválida ou expirada. Por favor, contate o administrador.";
    }
    throw error;
  }
};

export const chatWithMemorialAI = async (history: { role: 'user' | 'model', parts: string }[], message: string) => {
  try {
    const ai = getAIClient();
    if (!ai) {
      return "Serviço de IA indisponível no momento.";
    }

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: "Você é o Memorial AI, um assistente virtual do sistema MemorialOS. Sua missão é acolher e tirar dúvidas de pessoas que podem estar passando por um momento de luto. Seja sempre empático, respeitoso, paciente e use uma linguagem suave e reconfortante. Evite termos muito técnicos ou frios. Você pode ajudar com dúvidas sobre como comunicar um óbito, horários de funcionamento do cemitério, como encontrar um jazigo, ou simplesmente oferecer uma palavra de conforto. Nunca dê conselhos médicos ou jurídicos definitivos.",
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.parts }]
      })),
    });

    const result = await chat.sendMessage({ message });
    return result.text || "";
  } catch (error) {
    console.error("Error in chat:", error);
    throw error;
  }
};
