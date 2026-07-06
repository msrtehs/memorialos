import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit,
  startAfter,
  runTransaction,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { parseISO } from 'date-fns';
import { auth, db, storage } from '@/lib/firebase';
import { getCemeteryPlots, getTenantPlots, Plot } from '@/services/cemeteryService';
import { logAction } from '@/services/audit';
import { getCached, setCached, invalidateCache } from '@/lib/queryCache';

type RiskLevel = 'low' | 'medium' | 'high';
type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface OperationalRecord {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  type: 'burial' | 'exhumation' | 'schedule' | 'flow' | 'maintenance' | 'document_issue';
  title: string;
  description?: string;
  status: 'planned' | 'in_progress' | 'done' | 'cancelled';
  priority: Priority;
  scheduledFor?: string;
  completedAt?: string;
  responsible?: string;
  plotId?: string;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
}

export interface OccurrenceRecord {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  category: 'structural' | 'sanitary' | 'environmental' | 'security' | 'operational' | 'cleaning' | 'lighting' | 'vegetation';
  severity: Priority;
  status: 'open' | 'in_analysis' | 'resolved';
  title: string;
  description?: string;
  location?: string;
  plotId?: string;
  sectorId?: string;
  photoUrls?: string[];
  slaDeadline?: string;
  resolvedBy?: string;
  openedAt?: string;
  resolvedAt?: string;
  createdAt?: any;
  createdBy?: string;
}

export interface InternalNotification {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  title: string;
  message: string;
  audience: 'all' | 'operators' | 'environmental' | 'security' | 'management';
  level: 'info' | 'warning' | 'critical';
  status: 'draft' | 'sent' | 'archived';
  createdAt?: any;
  createdBy?: string;
}

// M7.4: SanitaryCheck e EnvironmentalCheck compartilham a mesma estrutura.
// Interface base única + aliases diferenciados por `checkType`.
export interface EnvironmentalSanitaryCheck {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  checkType: 'sanitary' | 'environmental'; // diferenciador
  area: string;
  indicator: string;
  riskLevel: RiskLevel;
  findings: string;
  recommendation: string;
  status: 'open' | 'monitoring' | 'closed';
  inspectedAt: string;
  inspector: string;
  createdAt?: any;
  createdBy?: string;
}

// Mesmas coleções separadas (sci_sanitary_checks e sci_environmental_checks),
// mas usando a mesma interface TypeScript base.
export type SanitaryCheck = EnvironmentalSanitaryCheck & { checkType: 'sanitary' };
export type EnvironmentalCheck = EnvironmentalSanitaryCheck & { checkType: 'environmental' };

export interface FinancialRecord {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  description: string;
  category: 'income' | 'expense';
  referenceType: 'burial' | 'exhumation' | 'maintenance' | 'service' | 'other';
  value: number;
  occurredAt: string;
  aiAudited?: boolean;
  createdAt?: any;
  createdBy?: string;
}

export interface StockItem {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  createdAt?: any;
  createdBy?: string;
}

export interface DigitalDocument {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  title: string;
  documentType: 'administrative' | 'legal' | 'sanitary' | 'environmental' | 'deceased' | 'financial';
  relatedEntityId?: string;
  fileName?: string;
  fileUrl?: string;
  status: 'pending' | 'validated' | 'rejected';
  notes?: string;
  issuedAt?: string;
  expiresAt?: string;
  createdAt?: any;
  createdBy?: string;
}

export interface AIAgent {
  id?: string;
  tenantId: string;
  name: string;
  mode: 'agent' | 'chatbot';
  objective: string;
  prompt: string;
  modules: string[];
  isActive: boolean;
  createdAt?: any;
  createdBy?: string;
}

export interface SCIReport {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  type: 'operational' | 'sanitary' | 'environmental' | 'administrative' | 'legal' | 'financial';
  generatedAt?: any;
  generatedBy?: string;
  summary: string;
  payload: any;
}

export interface SupportTicket {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  title: string;
  category: 'support' | 'training';
  priority: Priority;
  status: 'open' | 'in_progress' | 'done';
  details: string;
  createdAt?: any;
  createdBy?: string;
}

export interface TrainingSession {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  title: string;
  date: string;
  modality: 'online' | 'presencial';
  targetAudience: string;
  status: 'planned' | 'completed';
  notes?: string;
  createdAt?: any;
  createdBy?: string;
}

const COLS = {
  operational: 'sci_operational_records',
  occurrences: 'sci_occurrences',
  notifications: 'sci_internal_notifications',
  sanitary: 'sci_sanitary_checks',
  environmental: 'sci_environmental_checks',
  financial: 'sci_financial_records',
  stock: 'sci_stock_items',
  documents: 'sci_documents',
  agents: 'sci_ai_agents',
  reports: 'sci_reports',
  support: 'sci_support_tickets',
  trainings: 'sci_training_sessions'
} as const;

function toMillis(value: any) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
}

function sortByCreatedAtDesc<T extends Record<string, any>>(items: T[]): T[] {
  return [...items].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

async function listByTenant<T extends Record<string, any>>(collectionName: string, tenantId: string): Promise<T[]> {
  const q = query(collection(db, collectionName), where('tenantId', '==', tenantId));
  const snapshot = await getDocs(q);
  const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as unknown as T));
  return sortByCreatedAtDesc<T>(records);
}

async function createForTenant<T extends object>(
  tenantId: string,
  collectionName: string,
  action: string,
  payload: T
) {
  // A7.2: Guard contra cemeteryId inválido
  if ('cemeteryId' in payload && (payload as any).cemeteryId === 'all') {
    throw new Error('cemeteryId inválido: não é possível gravar com "all". Selecione uma unidade.');
  }

  const data = {
    ...payload,
    tenantId,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid
  };
  const docRef = await addDoc(collection(db, collectionName), data);
  await logAction(tenantId, action, collectionName, docRef.id, null, data);
  // NOTA: o plano (A3.3) lista invalidar em cada create individual
  // (createOperationalRecord, createOccurrenceRecord, createSanitaryCheck, etc.).
  // Como todas essas funções passam por createForTenant, invalidamos aqui uma única
  // vez para cobrir todas elas sem duplicação. allocateNotification invalida à parte.
  invalidateCache(`sci_snapshot:${tenantId}`);
  return docRef.id;
}

// Carimbos semânticos ao entrar em status terminal (W1-10). Reabrir (status volta a
// open/in_progress) NÃO apaga os carimbos antigos — histórico simples, comportamento aceito.
const TERMINAL_STATUS_STAMPS: Record<string, { field: string; byField?: string }> = {
  resolved: { field: 'resolvedAt', byField: 'resolvedBy' },
  done: { field: 'completedAt' },
  closed: { field: 'closedAt' },
  completed: { field: 'completedAt' },
};

export async function updateSCIRecord(
  tenantId: string,
  collectionName: string,
  id: string,
  action: string,
  payload: Record<string, any>
) {
  const refDoc = doc(db, collectionName, id);
  const oldSnap = await getDoc(refDoc);
  const oldData = oldSnap.data();
  const enriched: Record<string, any> = {
    ...payload,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid,
  };
  const stamp = payload.status ? TERMINAL_STATUS_STAMPS[payload.status] : undefined;
  if (stamp) {
    enriched[stamp.field] = serverTimestamp();
    if (stamp.byField) enriched[stamp.byField] = auth.currentUser?.uid;
  }
  await updateDoc(refDoc, enriched);
  await logAction(tenantId, action, collectionName, id, oldData, enriched);
  invalidateCache(`sci_snapshot:${tenantId}`);
}

export async function deleteSCIRecord(
  tenantId: string,
  collectionName: string,
  id: string,
  action: string
) {
  await deleteDoc(doc(db, collectionName, id));
  await logAction(tenantId, action, collectionName, id, null, { id });
  invalidateCache(`sci_snapshot:${tenantId}`);
}

// ── Parceiros credenciados (W4-3) — CRUD real na coleção sci_partners ──
export interface Partner {
  id?: string;
  tenantId: string;
  name: string;
  type: 'floricultura' | 'marmoraria' | 'funeraria' | 'seguros' | 'transporte' | 'outro';
  description?: string;
  contact?: string;
  email?: string;
  active: boolean;
  createdAt?: any;
  createdBy?: string;
}

export const listPartners = (tenantId: string) =>
  listByTenant<Partner>('sci_partners', tenantId);

// ── Movimentação de estoque (W4-8) — entrada/baixa transacional + histórico imutável ──
export interface StockMovement {
  id?: string;
  tenantId: string;
  itemId: string;
  itemName: string;
  kind: 'in' | 'out';
  quantity: number;
  reason?: string;
  createdAt?: any;
  createdBy?: string;
}

export async function moveStock(
  tenantId: string,
  itemId: string,
  kind: 'in' | 'out',
  quantity: number,
  reason?: string
): Promise<void> {
  if (quantity <= 0) throw new Error('Quantidade deve ser maior que zero.');
  const itemRef = doc(db, 'sci_stock_items', itemId);
  const movementRef = doc(collection(db, 'sci_stock_movements'));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(itemRef);
    if (!snap.exists()) throw new Error('Item de estoque não encontrado.');
    const item = snap.data() as StockItem;
    if (item.tenantId !== tenantId) throw new Error('Item não pertence a este tenant.');
    const next = kind === 'in' ? item.quantity + quantity : item.quantity - quantity;
    if (next < 0) throw new Error(`Saldo insuficiente: há ${item.quantity} ${item.unit || 'un'} em estoque.`);

    tx.update(itemRef, { quantity: next, updatedAt: serverTimestamp() });
    tx.set(movementRef, {
      tenantId, itemId, itemName: item.name, kind, quantity,
      reason: reason || null,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid,
    });
  });

  await logAction(tenantId, 'STOCK_MOVEMENT', 'sci_stock_items', itemId, null, { kind, quantity, reason });
  invalidateCache(`sci_snapshot:${tenantId}`);
}

export const listStockMovements = (tenantId: string) =>
  listByTenant<StockMovement>('sci_stock_movements', tenantId);

export const createPartner = (
  tenantId: string,
  payload: Omit<Partner, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>
) => createForTenant<typeof payload>(tenantId, 'sci_partners', 'CREATE_PARTNER', payload);

export const updatePartner = (tenantId: string, id: string, payload: Partial<Partner>) =>
  updateSCIRecord(tenantId, 'sci_partners', id, 'UPDATE_PARTNER', payload);

export function listOperationalRecords(tenantId: string) {
  return listByTenant<OperationalRecord>(COLS.operational, tenantId);
}

export function createOperationalRecord(tenantId: string, payload: Omit<OperationalRecord, 'id' | 'tenantId'>) {
  return createForTenant(tenantId, COLS.operational, 'CREATE_OPERATIONAL_RECORD', payload);
}

export function listOccurrenceRecords(tenantId: string) {
  return listByTenant<OccurrenceRecord>(COLS.occurrences, tenantId);
}

export function createOccurrenceRecord(tenantId: string, payload: Omit<OccurrenceRecord, 'id' | 'tenantId'>) {
  return createForTenant(tenantId, COLS.occurrences, 'CREATE_OCCURRENCE', payload);
}

export function listInternalNotifications(tenantId: string) {
  return listByTenant<InternalNotification>(COLS.notifications, tenantId);
}

export function createInternalNotification(tenantId: string, payload: Omit<InternalNotification, 'id' | 'tenantId'>) {
  return createForTenant(tenantId, COLS.notifications, 'CREATE_INTERNAL_NOTIFICATION', payload);
}

export function listSanitaryChecks(tenantId: string) {
  return listByTenant<SanitaryCheck>(COLS.sanitary, tenantId);
}

export function createSanitaryCheck(tenantId: string, payload: Omit<SanitaryCheck, 'id' | 'tenantId' | 'checkType'>) {
  return createForTenant(tenantId, COLS.sanitary, 'CREATE_SANITARY_CHECK', { ...payload, checkType: 'sanitary' as const });
}

export function listEnvironmentalChecks(tenantId: string) {
  return listByTenant<EnvironmentalCheck>(COLS.environmental, tenantId);
}

export function createEnvironmentalCheck(tenantId: string, payload: Omit<EnvironmentalCheck, 'id' | 'tenantId' | 'checkType'>) {
  return createForTenant(tenantId, COLS.environmental, 'CREATE_ENVIRONMENTAL_CHECK', { ...payload, checkType: 'environmental' as const });
}

export function listFinancialRecords(tenantId: string) {
  return listByTenant<FinancialRecord>(COLS.financial, tenantId);
}

export function createFinancialRecord(tenantId: string, payload: Omit<FinancialRecord, 'id' | 'tenantId'>) {
  return createForTenant(tenantId, COLS.financial, 'CREATE_FINANCIAL_RECORD', payload);
}

export function listStockItems(tenantId: string) {
  return listByTenant<StockItem>(COLS.stock, tenantId);
}

export function createStockItem(tenantId: string, payload: Omit<StockItem, 'id' | 'tenantId'>) {
  return createForTenant(tenantId, COLS.stock, 'CREATE_STOCK_ITEM', payload);
}

export async function uploadSCIDocument(file: File, tenantId?: string) {
  const fileRef = ref(storage, `sci-documents/${auth.currentUser?.uid}/${Date.now()}_${file.name}`);
  // tenantId no metadado permite ao staff do próprio tenant acessar (W2-2)
  await uploadBytes(fileRef, file, tenantId ? { customMetadata: { tenantId } } : undefined);
  return getDownloadURL(fileRef);
}

export async function createDigitalDocument(
  tenantId: string,
  payload: Omit<DigitalDocument, 'id' | 'tenantId' | 'fileName' | 'fileUrl'>,
  file?: File
) {
  let fileName: string | undefined;
  let fileUrl: string | undefined;

  if (file) {
    fileUrl = await uploadSCIDocument(file, tenantId);
    fileName = file.name;
  }

  return createForTenant(tenantId, COLS.documents, 'CREATE_DIGITAL_DOCUMENT', {
    ...payload,
    fileName,
    fileUrl
  });
}

export function listDigitalDocuments(tenantId: string) {
  return listByTenant<DigitalDocument>(COLS.documents, tenantId);
}

export function listAIAgents(tenantId: string) {
  return listByTenant<AIAgent>(COLS.agents, tenantId);
}

export function createAIAgent(tenantId: string, payload: Omit<AIAgent, 'id' | 'tenantId'>) {
  return createForTenant(tenantId, COLS.agents, 'CREATE_AI_AGENT', payload);
}

export function listSCIReports(tenantId: string) {
  return listByTenant<SCIReport>(COLS.reports, tenantId);
}

export function listSupportTickets(tenantId: string) {
  return listByTenant<SupportTicket>(COLS.support, tenantId);
}

export function createSupportTicket(tenantId: string, payload: Omit<SupportTicket, 'id' | 'tenantId'>) {
  return createForTenant(tenantId, COLS.support, 'CREATE_SUPPORT_TICKET', payload);
}

export function listTrainingSessions(tenantId: string) {
  return listByTenant<TrainingSession>(COLS.trainings, tenantId);
}

export function createTrainingSession(tenantId: string, payload: Omit<TrainingSession, 'id' | 'tenantId'>) {
  return createForTenant(tenantId, COLS.trainings, 'CREATE_TRAINING_SESSION', payload);
}

interface SciSnapshot {
  plots: Plot[];
  operational: OperationalRecord[];
  occurrences: OccurrenceRecord[];
  sanitaryChecks: SanitaryCheck[];
  environmentalChecks: EnvironmentalCheck[];
  documents: DigitalDocument[];
  financial: FinancialRecord[];
}

export interface RiskIndicator {
  code: string;
  title: string;
  level: Priority;
  score: number;
  details: string;
}

export interface ExhumationAlert {
  plotId: string;
  plotCode: string;
  sectorName: string;
  burialDate: string;
  deadlineDate: string;
  daysRemaining: number;
  // W4-9: necessários para gerar a ordem de exumação a partir do alerta
  cemeteryId: string;
  occupantName?: string;
}

export interface SciExecutiveSnapshot {
  cemeteryId: string;
  totalPlots: number;
  availablePlots: number;
  occupiedPlots: number;
  reservedPlots: number;
  blockedPlots: number;
  occupancyRate: number;
  totalBurials: number;
  totalExhumations: number;
  openOccurrences: number;
  pendingDocuments: number;
  sanitaryAlerts: number;
  environmentalAlerts: number;
  structuralFailures: number;
  totalRevenue: number;
  totalExpenses: number;
  // Capacity management
  averageAnnualBurials: number;
  saturationProjectionYears: number | null;
  // Exhumation control
  pendingExhumations: number;
  approachingExhumations: number;
  // Concession control
  expiringConcessions: number;
  priorities: RiskIndicator[];
  // Tendência mensal de sepultamentos (W5-2) — calculada dentro do snapshot cacheado
  monthlyBurialTrend: { month: string; count: number }[];
}

function filterByCemetery<T extends { cemeteryId: string }>(records: T[], cemeteryId: string) {
  if (cemeteryId === 'all') return records;
  return records.filter((item) => item.cemeteryId === cemeteryId);
}

// Paginação para plots: buscar em lotes de 500
async function getAllTenantPlotsWithPagination(tenantId: string): Promise<Plot[]> {
  const BATCH_SIZE = 500;
  const all: Plot[] = [];
  let lastDoc: QueryDocumentSnapshot | null = null;

  while (true) {
    const constraints = [
      where('tenantId', '==', tenantId),
      limit(BATCH_SIZE),
      ...(lastDoc ? [startAfter(lastDoc)] : [])
    ];
    const q = query(collection(db, 'plots'), ...constraints);
    const snap = await getDocs(q);
    if (snap.empty) break;
    all.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Plot)));
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }
  return all;
}

async function getSciSnapshot(tenantId: string, cemeteryId: string): Promise<SciSnapshot> {
  const cacheKey = `sci_snapshot:${tenantId}:${cemeteryId}`;
  const cached = getCached<SciSnapshot>(cacheKey);
  if (cached) return cached;

  const [
    plots,
    operational,
    occurrences,
    sanitaryChecks,
    environmentalChecks,
    documents,
    financial
  ] = await Promise.all([
    getAllTenantPlotsWithPagination(tenantId),
    listOperationalRecords(tenantId),
    listOccurrenceRecords(tenantId),
    listSanitaryChecks(tenantId),
    listEnvironmentalChecks(tenantId),
    listDigitalDocuments(tenantId),
    listFinancialRecords(tenantId)
  ]);

  const snapshot: SciSnapshot = {
    plots: filterByCemetery(plots, cemeteryId),
    operational: filterByCemetery(operational, cemeteryId),
    occurrences: filterByCemetery(occurrences, cemeteryId),
    sanitaryChecks: filterByCemetery(sanitaryChecks, cemeteryId),
    environmentalChecks: filterByCemetery(environmentalChecks, cemeteryId),
    documents: filterByCemetery(documents, cemeteryId),
    financial: filterByCemetery(financial, cemeteryId)
  };

  setCached(cacheKey, snapshot, 60_000); // cache por 1 minuto
  return snapshot;
}

export async function getSciExecutiveSnapshot(tenantId: string, cemeteryId: string): Promise<SciExecutiveSnapshot> {
  const data = await getSciSnapshot(tenantId, cemeteryId);
  const totalPlots = data.plots.length;
  const availablePlots = data.plots.filter((plot) => plot.status === 'available').length;
  const occupiedPlots = data.plots.filter((plot) => plot.status === 'occupied').length;
  const reservedPlots = data.plots.filter((plot) => plot.status === 'reserved').length;
  const blockedPlots = data.plots.filter((plot) => plot.status === 'blocked').length;
  const occupancyRate = totalPlots > 0 ? Math.round((occupiedPlots / totalPlots) * 100) : 0;

  const burialRecords = data.operational.filter((item) => item.type === 'burial');
  const totalBurials = burialRecords.length;
  const totalExhumations = data.operational.filter((item) => item.type === 'exhumation').length;

  // Saturation projection
  let yearsOfOperation = 1;
  if (burialRecords.length > 0) {
    const timestamps = burialRecords
      .map((r) => {
        if (r.scheduledFor) return new Date(r.scheduledFor).getTime();
        if (r.createdAt) return toMillis(r.createdAt);
        return 0;
      })
      .filter((t) => t > 0);
    if (timestamps.length > 0) {
      const earliest = Math.min(...timestamps);
      yearsOfOperation = Math.max(1, (Date.now() - earliest) / (365.25 * 24 * 60 * 60 * 1000));
    }
  }
  const averageAnnualBurials = totalBurials / yearsOfOperation;
  const saturationProjectionYears = averageAnnualBurials > 0
    ? Math.round((availablePlots / averageAnnualBurials) * 10) / 10
    : null;

  // Exhumation deadlines
  const now = Date.now();
  const SIX_MONTHS_MS = 6 * 30.44 * 24 * 60 * 60 * 1000;
  let pendingExhumations = 0;
  let approachingExhumations = 0;
  for (const plot of data.plots) {
    if (plot.status === 'occupied' && plot.burialDate) {
      const deadlineYears = plot.exhumationDeadlineYears || 3;
      const deadlineMs = parseISO(plot.burialDate).getTime() + deadlineYears * 365.25 * 24 * 60 * 60 * 1000;
      const remaining = deadlineMs - now;
      if (remaining <= 0) {
        pendingExhumations++;
      } else if (remaining <= SIX_MONTHS_MS) {
        approachingExhumations++;
      }
    }
  }

  // Expiring concessions
  let expiringConcessions = 0;
  for (const plot of data.plots) {
    if (plot.concessionType === 'temporary' && plot.concessionEndDate) {
      const endMs = new Date(plot.concessionEndDate).getTime();
      const remaining = endMs - now;
      if (remaining > 0 && remaining <= SIX_MONTHS_MS) {
        expiringConcessions++;
      }
    }
  }
  const openOccurrences = data.occurrences.filter((item) => item.status !== 'resolved').length;
  const pendingDocuments =
    data.documents.filter((item) => item.status === 'pending').length +
    data.plots.filter((plot) => plot.documentStatus === 'pending').length;

  const sanitaryAlerts =
    data.sanitaryChecks.filter((item) => item.status !== 'closed' && item.riskLevel === 'high').length +
    data.plots.filter((plot) => plot.sanitaryRisk === 'high').length;
  const environmentalAlerts =
    data.environmentalChecks.filter((item) => item.status !== 'closed' && item.riskLevel === 'high').length +
    data.plots.filter((plot) => plot.environmentalRisk === 'high').length;
  const structuralFailures =
    data.plots.filter((plot) => plot.structuralStatus === 'critical').length +
    data.occurrences.filter((item) => item.category === 'structural' && item.status !== 'resolved').length;

  const totalRevenue = data.financial
    .filter((entry) => entry.category === 'income')
    .reduce((acc, item) => acc + Number(item.value || 0), 0);
  const totalExpenses = data.financial
    .filter((entry) => entry.category === 'expense')
    .reduce((acc, item) => acc + Number(item.value || 0), 0);

  const priorities: RiskIndicator[] = [];

  if (occupancyRate >= 90) {
    priorities.push({
      code: 'SATURATION',
      title: 'Saturacao de quadras',
      level: occupancyRate >= 97 ? 'critical' : 'high',
      score: occupancyRate,
      details: `Taxa de ocupacao em ${occupancyRate}%. Planejar expansao e remanejamento.`
    });
  }

  if (sanitaryAlerts > 0) {
    priorities.push({
      code: 'SANITARY',
      title: 'Risco sanitario',
      level: sanitaryAlerts > 10 ? 'critical' : 'high',
      score: Math.min(100, sanitaryAlerts * 8),
      details: `${sanitaryAlerts} alertas sanitarios ativos exigem intervencao.`
    });
  }

  if (environmentalAlerts > 0) {
    priorities.push({
      code: 'ENVIRONMENT',
      title: 'Risco ambiental',
      level: environmentalAlerts > 8 ? 'critical' : 'high',
      score: Math.min(100, environmentalAlerts * 8),
      details: `${environmentalAlerts} alertas ambientais ativos encontrados.`
    });
  }

  if (structuralFailures > 0) {
    priorities.push({
      code: 'STRUCTURE',
      title: 'Falhas estruturais',
      level: structuralFailures > 6 ? 'critical' : 'high',
      score: Math.min(100, structuralFailures * 10),
      details: `${structuralFailures} registros de falha estrutural em aberto.`
    });
  }

  if (pendingDocuments > 0) {
    priorities.push({
      code: 'DOCUMENTS',
      title: 'Pendencias documentais',
      level: pendingDocuments > 20 ? 'critical' : 'medium',
      score: Math.min(100, pendingDocuments * 4),
      details: `${pendingDocuments} registros com documentacao pendente.`
    });
  }

  if (pendingExhumations > 0) {
    priorities.push({
      code: 'EXHUMATION',
      title: 'Exumacoes pendentes',
      level: pendingExhumations > 5 ? 'critical' : 'high',
      score: Math.min(100, pendingExhumations * 15),
      details: `${pendingExhumations} jazigos com prazo de exumacao vencido.`
    });
  }

  if (expiringConcessions > 0) {
    priorities.push({
      code: 'CONCESSION',
      title: 'Concessoes vencendo',
      level: expiringConcessions > 10 ? 'critical' : 'medium',
      score: Math.min(100, expiringConcessions * 5),
      details: `${expiringConcessions} concessoes temporarias proximas do vencimento.`
    });
  }

  return {
    cemeteryId,
    totalPlots,
    availablePlots,
    occupiedPlots,
    reservedPlots,
    blockedPlots,
    occupancyRate,
    totalBurials,
    totalExhumations,
    openOccurrences,
    pendingDocuments,
    sanitaryAlerts,
    environmentalAlerts,
    structuralFailures,
    totalRevenue,
    totalExpenses,
    averageAnnualBurials,
    saturationProjectionYears,
    pendingExhumations,
    approachingExhumations,
    expiringConcessions,
    priorities: priorities.sort((a, b) => b.score - a.score),
    monthlyBurialTrend: buildMonthlyBurialTrend(data.operational)
  };
}

export async function getExhumationAlerts(
  tenantId: string,
  cemeteryId?: string
): Promise<{ overdue: ExhumationAlert[]; approaching: ExhumationAlert[] }> {
  const allPlots = !cemeteryId || cemeteryId === 'all'
    ? await getTenantPlots(tenantId)
    : await getCemeteryPlots(cemeteryId);

  const now = Date.now();
  const SIX_MONTHS_MS = 6 * 30.44 * 24 * 60 * 60 * 1000;
  const overdue: ExhumationAlert[] = [];
  const approaching: ExhumationAlert[] = [];

  for (const plot of allPlots) {
    if (plot.status !== 'occupied' || !plot.burialDate) continue;
    const deadlineYears = plot.exhumationDeadlineYears || 3;
    const deadlineMs = new Date(plot.burialDate).getTime() + deadlineYears * 365.25 * 24 * 60 * 60 * 1000;
    const deadlineDate = new Date(deadlineMs).toISOString().slice(0, 10);
    const daysRemaining = Math.round((deadlineMs - now) / (24 * 60 * 60 * 1000));

    const alert: ExhumationAlert = {
      plotId: plot.id || '',
      plotCode: plot.code,
      sectorName: plot.sectorName || plot.sectorId,
      burialDate: plot.burialDate,
      deadlineDate,
      daysRemaining,
      cemeteryId: plot.cemeteryId,
      occupantName: plot.occupantName
    };

    if (daysRemaining <= 0) {
      overdue.push(alert);
    } else if (deadlineMs - now <= SIX_MONTHS_MS) {
      approaching.push(alert);
    }
  }

  overdue.sort((a, b) => a.daysRemaining - b.daysRemaining);
  approaching.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return { overdue, approaching };
}

// W4-9: gera ordem de exumação pré-preenchida a partir de um alerta vencido
// e bloqueia o jazigo até a conclusão do processo.
export async function createExhumationOrderFromAlert(
  tenantId: string,
  alert: ExhumationAlert
): Promise<string> {
  // 1. Ordem operacional pré-preenchida
  const orderId = await createForTenant(tenantId, 'sci_operational_records', 'CREATE_EXHUMATION_ORDER', {
    cemeteryId: alert.cemeteryId,
    type: 'exhumation',
    title: `Exumação — jazigo ${alert.plotCode}${alert.occupantName ? ` (${alert.occupantName})` : ''}`,
    description: `Ordem gerada automaticamente: prazo legal de exumação vencido em ${alert.deadlineDate}.`,
    status: 'planned',
    priority: 'high',
    plotId: alert.plotId,
  });

  // 2. Bloqueia o jazigo até a conclusão do processo
  await updateDoc(doc(db, 'plots', alert.plotId), {
    status: 'blocked',
    updatedAt: serverTimestamp(),
  });

  await logAction(tenantId, 'BLOCK_PLOT_FOR_EXHUMATION', 'plots', alert.plotId, null, { orderId });
  invalidateCache(`sci_snapshot:${tenantId}`);
  return orderId;
}

// W5-2: função PURA (sem I/O) — recebe os registros operacionais já carregados/filtrados.
export function buildMonthlyBurialTrend(operational: any[]): { month: string; count: number }[] {
  const burials = operational.filter((r) => r.type === 'burial');

  const now = new Date();
  const monthMap = new Map<string, number>();

  // Initialize last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, 0);
  }

  for (const record of burials) {
    let dateStr = record.scheduledFor;
    if (!dateStr && record.createdAt) {
      const ms = toMillis(record.createdAt);
      if (ms > 0) dateStr = new Date(ms).toISOString().slice(0, 10);
    }
    if (!dateStr) continue;
    const key = dateStr.slice(0, 7); // YYYY-MM
    if (monthMap.has(key)) {
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    }
  }

  return Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }));
}

/** @deprecated W5-2: derive de `snapshot.monthlyBurialTrend` (sem leitura extra). */
export async function getMonthlyBurialTrend(
  tenantId: string,
  cemeteryId: string
): Promise<{ month: string; count: number }[]> {
  return (await getSciExecutiveSnapshot(tenantId, cemeteryId)).monthlyBurialTrend;
}

function getReportTitle(type: SCIReport['type']) {
  const map: Record<SCIReport['type'], string> = {
    operational: 'Relatorio Operacional',
    sanitary: 'Relatorio Sanitario',
    environmental: 'Relatorio Ambiental',
    administrative: 'Relatorio Administrativo',
    legal: 'Relatorio Juridico',
    financial: 'Relatorio Financeiro'
  };
  return map[type];
}

export interface ReportPeriod { from?: string; to?: string } // YYYY-MM-DD

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// W4-6: seções distintas por tipo (antes os 6 tipos geravam o mesmo texto) + período + nome da unidade.
// DIVERGÊNCIA do plano: os campos openSanitaryChecks/highSanitaryRiskPlots não existem em
// SciExecutiveSnapshot — omitidos. Filtragem financeira por período fica como follow-up
// (o snapshot é "estado presente"); o período informado é exibido e persistido no relatório.
function buildReportSummary(
  type: SCIReport['type'],
  s: SciExecutiveSnapshot,
  opts: { cemeteryLabel: string; period?: ReportPeriod }
): string {
  const header = [
    `${getReportTitle(type)}`,
    `Unidade: ${opts.cemeteryLabel}`,
    `Período: ${opts.period?.from ?? 'início'} a ${opts.period?.to ?? 'hoje'}`,
    `Data de geração: ${new Date().toLocaleString('pt-BR')}`,
    '',
  ];

  const sections: Record<SCIReport['type'], string[]> = {
    operational: [
      `Taxa de ocupação: ${s.occupancyRate}%`,
      `Sepultamentos registrados: ${s.totalBurials}`,
      `Exumações: ${s.totalExhumations} (pendentes: ${s.pendingExhumations}, próximas: ${s.approachingExhumations})`,
      `Ocorrências em aberto: ${s.openOccurrences}`,
    ],
    sanitary: [
      `Alertas sanitários: ${s.sanitaryAlerts}`,
      `Ocorrências em aberto (todas as categorias): ${s.openOccurrences}`,
    ],
    environmental: [
      `Alertas ambientais: ${s.environmentalAlerts}`,
      `Falhas estruturais: ${s.structuralFailures}`,
    ],
    administrative: [
      `Pendências documentais: ${s.pendingDocuments}`,
      `Concessões vencendo em 6 meses: ${s.expiringConcessions}`,
    ],
    legal: [
      `Concessões vencendo: ${s.expiringConcessions}`,
      `Prazos de exumação vencidos: ${s.pendingExhumations}`,
      `Pendências documentais: ${s.pendingDocuments}`,
    ],
    financial: [
      `Receitas: ${fmtBRL(s.totalRevenue)}`,
      `Despesas: ${fmtBRL(s.totalExpenses)}`,
      `Saldo: ${fmtBRL(s.totalRevenue - s.totalExpenses)}`,
    ],
  };

  const priorities = s.priorities.length
    ? ['', 'Prioridades de intervenção:', ...s.priorities.map((p) => `- [${p.level.toUpperCase()}] ${p.title}: ${p.details}`)]
    : ['', 'Nenhuma prioridade crítica detectada.'];

  return [...header, ...(sections[type] || sections.operational), ...priorities].join('\n');
}

export async function createAutomaticReport(
  tenantId: string,
  type: SCIReport['type'],
  cemeteryId: string,
  period?: ReportPeriod,
  cemeteryName?: string
) {
  const snapshot = await getSciExecutiveSnapshot(tenantId, cemeteryId);
  const summary = buildReportSummary(type, snapshot, {
    cemeteryLabel: cemeteryName || (cemeteryId === 'all' ? 'Todas as unidades' : cemeteryId),
    period,
  });

  const payload: Omit<SCIReport, 'id' | 'tenantId'> & { periodFrom?: string | null; periodTo?: string | null } = {
    cemeteryId,
    type,
    summary,
    payload: snapshot,
    periodFrom: period?.from ?? null,
    periodTo: period?.to ?? null,
    generatedAt: serverTimestamp(),
    generatedBy: auth.currentUser?.uid
  };

  return createForTenant(tenantId, COLS.reports, 'CREATE_SCI_REPORT', payload);
}
