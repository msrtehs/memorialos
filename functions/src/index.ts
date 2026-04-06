import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';

initializeApp();

const geminiApiKey = defineSecret('GEMINI_API_KEY');

function generateTenantId(name: string): string {
  return `tenant_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
}

// ─── createManagerAccount ─────────────────────────────────────────────────────
// Creates the FIRST manager user for a brand-new tenant (prefecture).
// Generates tenantId, creates Auth user, sets custom claims, writes
// tenant + profile documents.
export const createManagerAccount = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { prefectureName, managerEmail, temporaryPassword } = request.data as {
    prefectureName: string;
    managerEmail: string;
    temporaryPassword: string;
  };

  if (!prefectureName || !managerEmail || !temporaryPassword) {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  const tenantId = generateTenantId(prefectureName);

  const user = await auth.createUser({
    email: managerEmail,
    password: temporaryPassword,
  });

  await auth.setCustomUserClaims(user.uid, {
    role: 'manager',
    tenantId,
  });

  await db.collection('tenants').doc(tenantId).set({
    name: prefectureName,
    active: true,
    managerEmail,
    managerUid: user.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.collection('profiles').doc(user.uid).set({
    email: managerEmail,
    role: 'manager',
    tenantId,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// ─── addUserToTenant ──────────────────────────────────────────────────────────
// Adds an additional manager login to an EXISTING tenant (prefecture).
// Does NOT create a new tenant document — only creates Auth user + profile.
export const addUserToTenant = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { tenantId, email, password } = request.data as {
    tenantId: string;
    email: string;
    password: string;
  };

  if (!tenantId || !email || !password) {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  const tenantDoc = await db.collection('tenants').doc(tenantId).get();
  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', 'Prefeitura não encontrada');
  }

  const user = await auth.createUser({ email, password });

  await auth.setCustomUserClaims(user.uid, {
    role: 'manager',
    tenantId,
  });

  await db.collection('profiles').doc(user.uid).set({
    email,
    role: 'manager',
    tenantId,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true, uid: user.uid };
});

// ─── toggleManagerStatus ──────────────────────────────────────────────────────
// Disables or re-enables the PRIMARY manager's Auth account and updates
// the tenant's active flag. Used for whole-tenant activation / deactivation.
export const toggleManagerStatus = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { managerUid, disabled } = request.data as {
    managerUid: string;
    disabled: boolean;
  };

  if (!managerUid || typeof disabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  await auth.updateUser(managerUid, { disabled });

  const profileSnap = await db.collection('profiles').doc(managerUid).get();
  if (profileSnap.exists) {
    const tenantId = profileSnap.data()?.tenantId as string | undefined;
    if (tenantId) {
      await db.collection('tenants').doc(tenantId).update({ active: !disabled });
    }
  }

  return { success: true };
});

// ─── disableTenantUser ────────────────────────────────────────────────────────
// Toggles a single user's Auth disabled flag and mirrors the active field
// in their profile. Does NOT affect the tenant document.
export const disableTenantUser = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { uid, disabled } = request.data as { uid: string; disabled: boolean };

  if (!uid || typeof disabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  await auth.updateUser(uid, { disabled });
  await db.collection('profiles').doc(uid).update({ active: !disabled });

  return { success: true };
});

// ─── deleteManagerAccount ─────────────────────────────────────────────────────
// Removes the PRIMARY manager from Firebase Auth and deletes the associated
// profile AND tenant documents. Use to delete an entire prefecture.
export const deleteManagerAccount = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { managerUid, tenantId } = request.data as {
    managerUid: string;
    tenantId: string;
  };

  if (!managerUid || !tenantId) {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  // Delete all profiles that belong to this tenant
  const profilesSnap = await db
    .collection('profiles')
    .where('tenantId', '==', tenantId)
    .get();

  const deleteProfiles = profilesSnap.docs.map(async (doc) => {
    try {
      await auth.deleteUser(doc.id);
    } catch (_) {
      // User may already be deleted; continue
    }
    await doc.ref.delete();
  });

  await Promise.all(deleteProfiles);

  await db.collection('tenants').doc(tenantId).delete();

  return { success: true };
});

// ─── deleteTenantUser ─────────────────────────────────────────────────────────
// Removes a SINGLE user from a tenant. Deletes only Auth user + profile.
// The tenant document and other users are NOT affected.
export const deleteTenantUser = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { uid } = request.data as { uid: string };

  if (!uid) {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  await auth.deleteUser(uid);
  await db.collection('profiles').doc(uid).delete();

  return { success: true };
});

// ─── AI Functions (Gemini) ───────────────────────────────────────────────────

function getAI(): GoogleGenAI {
  const key = geminiApiKey.value();
  if (!key) throw new HttpsError('failed-precondition', 'Gemini API key not configured');
  return new GoogleGenAI({ apiKey: key });
}

// Generate obituary text
export const generateObituary = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario');

  const data = request.data as Record<string, string>;
  const ai = getAI();

  const prompt = `
    Escreva um obituario respeitoso, acolhedor e emocionante para:
    Nome: ${data.name || ''}
    Data de Nascimento: ${data.dateOfBirth || ''}
    Data de Falecimento: ${data.dateOfDeath || ''}
    Cidade: ${data.city || ''} - ${data.state || ''}
    Profissao: ${data.profession || ''}
    Hobbies/Paixoes: ${data.hobbies || ''}
    Familia: ${data.familyMembers || ''}
    Realizacoes: ${data.achievements || ''}
    Relacao com quem comunica: ${data.relationshipType || 'Nao informado'}
    Subtitulo de homenagem: ${data.relationshipLabel || 'Nao informado'}

    O tom deve ser sereno, humano e confortante para a familia.
    Escreva em portugues do Brasil. Maximo de 3 paragrafos.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return { text: response.text || '' };
});

// Chat with Memorial AI (citizen virtual assistant)
export const chatWithAI = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario');

  const { history, message, userContext } = request.data as {
    history: { role: string; parts: string }[];
    message: string;
    userContext?: string;
  };

  if (!message) throw new HttpsError('invalid-argument', 'Mensagem vazia');

  const ai = getAI();

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `Voce e o Memorial AI, um assistente virtual do sistema MemorialOS.
Seja sempre empatico, respeitoso e claro.
Voce pode ajudar com duvidas sobre comunicar obito, horarios, localizacao de jazigos e orientacoes gerais.
Nao de conselhos medicos ou juridicos definitivos.
Contexto emocional do usuario: ${userContext || 'Nao informado.'}`,
    },
    history: (history || []).map((item) => ({
      role: item.role as 'user' | 'model',
      parts: [{ text: item.parts }],
    })),
  });

  const result = await chat.sendMessage({ message });
  return { text: result.text || '' };
});

// Chat with Manager Agent (admin AI agents)
export const chatWithManagerAgent = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario');

  const { agent, history, message, contextSummary } = request.data as {
    agent: { name: string; objective: string; prompt: string; modules: string[] };
    history: { role: string; parts: string }[];
    message: string;
    contextSummary: string;
  };

  if (!message || !agent) throw new HttpsError('invalid-argument', 'Dados invalidos');

  const ai = getAI();

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `
        Voce e ${agent.name}, agente inteligente do Sistema Cemiterial Inteligente (SCI).
        Objetivo: ${agent.objective}
        Modulos autorizados: ${(agent.modules || []).join(', ') || 'todos'}
        Instrucoes especificas: ${agent.prompt}
        Contexto operacional atual: ${contextSummary || ''}

        Responda em portugues do Brasil, de forma executiva, clara e orientada a acao.
        Sempre aponte riscos sanitarios, ambientais e operacionais quando houver sinais no contexto.
      `,
    },
    history: (history || []).map((item) => ({
      role: item.role as 'user' | 'model',
      parts: [{ text: item.parts }],
    })),
  });

  const result = await chat.sendMessage({ message });
  return { text: result.text || '' };
});
