import { z } from 'zod';

// dateRangeSchema removido (W4-12): era código morto — a coerência de datas do
// DeceasedForm é coberta pelo zod local do próprio formulário.

export const operationalRecordSchema = z.object({
  cemeteryId: z.string().min(1, 'Selecione um cemitério').refine(v => v !== 'all', 'Selecione uma unidade'),
  type: z.enum(['burial', 'exhumation', 'schedule', 'flow', 'maintenance', 'document_issue']),
  title: z.string().min(3, 'Título muito curto').max(200, 'Título muito longo'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['planned', 'in_progress', 'done', 'cancelled']),
  scheduledFor: z.string().optional().refine(
    (val) => !val || new Date(val) >= new Date(new Date().setHours(0, 0, 0, 0)),
    'Data agendada não pode ser no passado'
  ),
});
