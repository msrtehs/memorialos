import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { getTenantPlots, Plot } from '@/services/cemeteryService';
import { logAction } from '@/services/audit';

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
  category: 'structural' | 'sanitary' | 'environmental' | 'security' | 'operational';
  severity: Priority;
  status: 'open' | 'in_analysis' | 'resolved';
  title: string;
  description?: string;
  location?: string;
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

export interface SanitaryCheck {
  id?: string;
  tenantId: string;
  cemeteryId: string;
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

export interface EnvironmentalCheck {
  id?: string;
  tenantId: string;
  cemeteryId: string;
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
  const data = {
    ...payload,
    tenantId,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid
  };
  const docRef = await addDoc(collection(db, collectionName), data);
  await logAction(tenantId, action, collectionName, docRef.id, null, data);
  return docRef.id;
}

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
  await updateDoc(refDoc, {
    ...payload,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid
  });
  await logAction(tenantId, action, collectionName, id, oldData, payload);
}

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

export function createSanitaryCheck(tenantId: string, payload: Omit<SanitaryCheck, 'id' | 'tenantId'>) {
  return createForTenant(tenantId, COLS.sanitary, 'CREATE_SANITARY_CHECK', payload);
}

export function listEnvironmentalChecks(tenantId: string) {
  return listByTenant<EnvironmentalCheck>(COLS.environmental, tenantId);
}

export function createEnvironmentalCheck(tenantId: string, payload: Omit<EnvironmentalCheck, 'id' | 'tenantId'>) {
  return createForTenant(tenantId, COLS.environmental, 'CREATE_ENVIRONMENTAL_CHECK', payload);
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

export async function uploadSCIDocument(file: File) {
  const fileRef = ref(storage, `sci-documents/${auth.currentUser?.uid}/${Date.now()}_${file.name}`);
  await uploadBytes(fileRef, file);
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
    fileUrl = await uploadSCIDocument(file);
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

export interface SciExecutiveSnapshot {
  cemeteryId: string;
  totalPlots: number;
  availablePlots: number;
  occupiedPlots: number;
  reservedPlots: number;
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
  priorities: RiskIndicator[];
}

function filterByCemetery<T extends { cemeteryId: string }>(records: T[], cemeteryId: string) {
  if (cemeteryId === 'all') return records;
  return records.filter((item) => item.cemeteryId === cemeteryId);
}

async function getSciSnapshot(tenantId: string, cemeteryId: string): Promise<SciSnapshot> {
  const [
    plots,
    operational,
    occurrences,
    sanitaryChecks,
    environmentalChecks,
    documents,
    financial
  ] = await Promise.all([
    getTenantPlots(tenantId),
    listOperationalRecords(tenantId),
    listOccurrenceRecords(tenantId),
    listSanitaryChecks(tenantId),
    listEnvironmentalChecks(tenantId),
    listDigitalDocuments(tenantId),
    listFinancialRecords(tenantId)
  ]);

  return {
    plots: filterByCemetery(plots, cemeteryId),
    operational: filterByCemetery(operational, cemeteryId),
    occurrences: filterByCemetery(occurrences, cemeteryId),
    sanitaryChecks: filterByCemetery(sanitaryChecks, cemeteryId),
    environmentalChecks: filterByCemetery(environmentalChecks, cemeteryId),
    documents: filterByCemetery(documents, cemeteryId),
    financial: filterByCemetery(financial, cemeteryId)
  };
}

export async function getSciExecutiveSnapshot(tenantId: string, cemeteryId: string): Promise<SciExecutiveSnapshot> {
  const data = await getSciSnapshot(tenantId, cemeteryId);
  const totalPlots = data.plots.length;
  const availablePlots = data.plots.filter((plot) => plot.status === 'available').length;
  const occupiedPlots = data.plots.filter((plot) => plot.status === 'occupied').length;
  const reservedPlots = data.plots.filter((plot) => plot.status === 'reserved').length;
  const occupancyRate = totalPlots > 0 ? Math.round((occupiedPlots / totalPlots) * 100) : 0;

  const totalBurials = data.operational.filter((item) => item.type === 'burial').length;
  const totalExhumations = data.operational.filter((item) => item.type === 'exhumation').length;
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

  return {
    cemeteryId,
    totalPlots,
    availablePlots,
    occupiedPlots,
    reservedPlots,
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
    priorities: priorities.sort((a, b) => b.score - a.score)
  };
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

function buildReportSummary(type: SCIReport['type'], snapshot: SciExecutiveSnapshot) {
  const title = getReportTitle(type);
  const lines = [
    `${title} - SCI`,
    `Cemiterio: ${snapshot.cemeteryId}`,
    `Data de geracao: ${new Date().toLocaleString('pt-BR')}`,
    '',
    `Taxa de ocupacao: ${snapshot.occupancyRate}%`,
    `Sepultamentos: ${snapshot.totalBurials}`,
    `Exumacoes: ${snapshot.totalExhumations}`,
    `Ocorrencias em aberto: ${snapshot.openOccurrences}`,
    `Pendencias documentais: ${snapshot.pendingDocuments}`,
    `Alertas sanitarios: ${snapshot.sanitaryAlerts}`,
    `Alertas ambientais: ${snapshot.environmentalAlerts}`,
    `Falhas estruturais: ${snapshot.structuralFailures}`,
    `Receita total: R$ ${snapshot.totalRevenue.toFixed(2)}`,
    `Despesas totais: R$ ${snapshot.totalExpenses.toFixed(2)}`,
    '',
    'Prioridades de intervencao:',
    ...(snapshot.priorities.length
      ? snapshot.priorities.map((item, index) => `${index + 1}. [${item.level.toUpperCase()}] ${item.title} - ${item.details}`)
      : ['Nenhuma prioridade critica detectada.'])
  ];
  return lines.join('\n');
}

export async function createAutomaticReport(
  tenantId: string,
  type: SCIReport['type'],
  cemeteryId: string
) {
  const snapshot = await getSciExecutiveSnapshot(tenantId, cemeteryId);
  const summary = buildReportSummary(type, snapshot);

  const payload: Omit<SCIReport, 'id' | 'tenantId'> = {
    cemeteryId,
    type,
    summary,
    payload: snapshot,
    generatedAt: serverTimestamp(),
    generatedBy: auth.currentUser?.uid
  };

  return createForTenant(tenantId, COLS.reports, 'CREATE_SCI_REPORT', payload);
}
