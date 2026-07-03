/**
 * Cloud Functions for MemorialOS
 * 
 * Note: This file is for reference/deployment to Firebase Cloud Functions.
 * It is not executed in the browser environment.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// 1. Set User Role (SuperAdmin only)
exports.setUserRole = functions.https.onCall(async (data, context) => {
  // Check if request is made by an authenticated user
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  // Check if the caller is a SuperAdmin
  const callerUid = context.auth.uid;
  const callerUser = await admin.auth().getUser(callerUid);
  if (callerUser.customClaims?.role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Only SuperAdmins can set roles.');
  }

  const { targetUid, role, tenantId } = data;

  if (!['manager', 'operator', 'citizen'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
  }

  // Set custom claims
  await admin.auth().setCustomUserClaims(targetUid, { 
    role,
    tenantId 
  });

  return { message: `Success! User ${targetUid} is now ${role} for tenant ${tenantId}.` };
});

// 2. Create Memorial (Triggered when Deceased is created or manually)
// This could automate the creation of a memorial page when a burial is registered
exports.onDeceasedCreated = functions.firestore
  .document('deceaseds/{deceasedId}')
  .onCreate(async (snap, context) => {
    const deceasedData = snap.data();
    const deceasedId = context.params.deceasedId;

    // Create a corresponding Memorial document
    await admin.firestore().collection('memorials').add({
      deceasedId: deceasedId,
      tenantId: deceasedData.tenantId,
      name: deceasedData.name,
      privacyLevel: 'private', // Default to private until family claims it
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      managers: [] // No managers yet
    });
  });

// 2b. Generate Content (AI proxy — mantém a chave Gemini fora do bundle público)
// DIVERGÊNCIA (C4): o plano indicava require('@google/generative-ai'), mas a chamada
// usada abaixo (ai.models.generateContent) é a API do pacote @google/genai — o mesmo
// já usado no frontend. Usamos @google/genai para o código funcionar em runtime.
const { GoogleGenAI } = require('@google/genai');

exports.generateContent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  // Rate limiting básico por UID (pode ser sofisticado com Firestore counter)
  const { prompt, model = 'gemini-2.5-flash', type } = data;
  const allowedTypes = ['obituary', 'chat', 'manager_agent'];
  if (!allowedTypes.includes(type)) {
    throw new functions.https.HttpsError('invalid-argument', 'Tipo de geração inválido.');
  }

  const apiKey = functions.config().gemini?.api_key
                 || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new functions.https.HttpsError('internal', 'Serviço de IA não configurado.');
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });
    return { text: response.text || '' };
  } catch (error) {
    console.error('Gemini error:', error);
    throw new functions.https.HttpsError('internal', 'Erro ao gerar conteúdo.');
  }
});

// 3. Moderate Tribute (AI or Manual)
exports.moderateTribute = functions.firestore
  .document('memorials/{memorialId}/tributes/{tributeId}')
  .onCreate(async (snap, context) => {
    const tribute = snap.data();
    
    // Simple keyword filter (Mock AI)
    const badWords = ['spam', 'offensive'];
    const isClean = !badWords.some(word => tribute.text.toLowerCase().includes(word));

    if (isClean) {
      return snap.ref.update({ status: 'approved' });
    } else {
      return snap.ref.update({ status: 'flagged' });
    }
  });
