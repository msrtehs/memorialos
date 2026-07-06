export const occurrenceStatusLabel: Record<string, string> = {
  open: 'Aberto',
  in_analysis: 'Em análise',
  monitoring: 'Em monitoramento',
  resolved: 'Resolvido',
};

export const notificationStatusLabel: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  archived: 'Arquivado',
};

export const operationalStatusLabel: Record<string, string> = {
  planned: 'Planejado',
  in_progress: 'Em andamento',
  done: 'Concluído',
  cancelled: 'Cancelado',
};

export const checkStatusLabel: Record<string, string> = {
  open: 'Aberto',
  monitoring: 'Em monitoramento',
  closed: 'Encerrado',
};

export const documentStatusLabel: Record<string, string> = {
  pending: 'Pendente',
  validated: 'Validado',
  rejected: 'Rejeitado',
};

export const ticketStatusLabel: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  done: 'Resolvido',
};

export const trainingStatusLabel: Record<string, string> = {
  planned: 'Agendado',
  completed: 'Concluído',
};

export const priorityLabel: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

export const severityLabel: Record<string, string> = priorityLabel;

export const riskLevelLabel: Record<string, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
};

export const audienceLabel: Record<string, string> = {
  all: 'Todos',
  managers: 'Gestores',
  operators: 'Operadores',
};

export const levelLabel: Record<string, string> = {
  info: 'Informativo',
  warning: 'Atenção',
  critical: 'Crítico',
};

export const plotStatusLabel: Record<string, string> = {
  available: 'Disponível',
  occupied: 'Ocupado',
  reserved: 'Reservado',
  blocked: 'Bloqueado',
};

/** Fallback seguro: retorna o label ou o valor cru (nunca undefined na UI). */
export const label = (map: Record<string, string>, value?: string | null): string =>
  (value && map[value]) || value || '—';
