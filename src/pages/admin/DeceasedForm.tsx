import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { createDeceasedWithPlot, getDeceased, updateDeceased } from '@/services/deceasedService';
import { validateFile } from '@/lib/fileValidation';
import { ArrowLeft, Upload, X, FileText } from 'lucide-react';
import { getCemeteryPlots, Plot } from '@/services/cemeteryService';

const schema = z.object({
  name: z.string().min(3, 'Nome obrigatorio'),
  dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), 'Data invalida'),
  dateOfDeath: z.string().refine((val) => !isNaN(Date.parse(val)), 'Data invalida'),
  cemeteryId: z.string().min(1, 'Selecione um cemiterio'),
  plotId: z.string().optional(),
  causeOfDeath: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  profession: z.string().optional(),
  familyMembers: z.string().optional()
}).refine(
  (data) => new Date(data.dateOfDeath) >= new Date(data.dateOfBirth),
  { message: 'Data de falecimento deve ser posterior ao nascimento', path: ['dateOfDeath'] }
);

type DeceasedFormType = z.infer<typeof schema>;

export default function DeceasedForm() {
  const { tenantId } = useAuth();
  const { cemeteries } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availablePlots, setAvailablePlots] = useState<Plot[]>([]);
  const [existingDocs, setExistingDocs] = useState<{ name: string; url: string }[]>([]);
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<DeceasedFormType>({
    resolver: zodResolver(schema)
  });

  const selectedCemetery = watch('cemeteryId');

  // Carregar defaults no modo edição
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const existing = await getDeceased(id);
        if (!existing) {
          toast.error('Registro não encontrado.');
          navigate('/admin/falecidos');
          return;
        }
        reset({
          name: existing.name,
          dateOfBirth: existing.dateOfBirth,
          dateOfDeath: existing.dateOfDeath,
          cemeteryId: existing.cemeteryId || '',
          plotId: existing.plotId || '',
          causeOfDeath: existing.causeOfDeath || '',
          city: existing.city || '',
          state: existing.state || '',
          profession: existing.profession || '',
          familyMembers: existing.familyMembers || '',
        });
        setExistingDocs(existing.documents || []);
      } catch {
        toast.error('Erro ao carregar o registro.');
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [id]);

  // Jazigos disponíveis do cemitério escolhido (só no modo criação — W1-14)
  useEffect(() => {
    if (isEditMode || !tenantId || !selectedCemetery) {
      setAvailablePlots([]);
      return;
    }
    getCemeteryPlots(selectedCemetery)
      .then((plots) => setAvailablePlots(plots.filter((p) => p.status === 'available')))
      .catch(() => setAvailablePlots([]));
  }, [isEditMode, tenantId, selectedCemetery]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selected = Array.from(event.target.files) as File[];
      const valid: File[] = [];
      for (const file of selected) {
        const error = validateFile(file);
        if (error) {
          toast.error(`${file.name}: ${error}`);
          continue;
        }
        valid.push(file);
      }
      if (valid.length) setFiles((prev) => [...prev, ...valid]);
      event.target.value = ''; // resetar o input
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: DeceasedFormType) => {
    if (!tenantId) return;
    setIsSubmitting(true);
    try {
      if (isEditMode && id) {
        // Edição: atualiza campos; anexos existentes são preservados.
        // plotId fica travado no modo edição (mudança de jazigo é traslado — roadmap).
        const { plotId, ...editable } = data;
        await updateDeceased(id, tenantId, editable);
        toast.success('Registro atualizado.');
        navigate(`/admin/falecidos/${id}`);
      } else {
        const newId = await createDeceasedWithPlot(
          tenantId,
          { ...data, documents: [] },
          files
        );
        toast.success('Registro salvo com sucesso.');
        navigate(`/admin/falecidos/${newId}`);
      }
    } catch (error: any) {
      const msg = error?.code === 'permission-denied'
        ? 'Sem permissão para esta operação.'
        : error?.message || 'Erro ao salvar registro.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (initialLoading) return <div className="p-8 text-slate-500">Carregando registro...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/admin/falecidos" className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditMode ? 'Editar registro de obito' : 'Novo registro de obito'}
          </h1>
          <p className="text-slate-500">Cadastro digital detalhado e anexacao documental.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 space-y-8">
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-slate-900 border-b border-slate-100 pb-2">Dados pessoais</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo</label>
            <input
              {...register('name')}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
              placeholder="Ex: Joao da Silva"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de nascimento</label>
              <input
                type="date"
                {...register('dateOfBirth')}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
              />
              {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de falecimento</label>
              <input
                type="date"
                {...register('dateOfDeath')}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
              />
              {errors.dateOfDeath && <p className="text-red-500 text-xs mt-1">{errors.dateOfDeath.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input {...register('city')} className="px-4 py-2 border border-slate-200 rounded-lg" placeholder="Cidade" />
            <input {...register('state')} className="px-4 py-2 border border-slate-200 rounded-lg" placeholder="UF" />
            <input {...register('profession')} className="px-4 py-2 border border-slate-200 rounded-lg" placeholder="Profissao" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Causa da morte (opcional)</label>
            <input
              {...register('causeOfDeath')}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
              placeholder="Ex: insuficiencia respiratoria"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Familiares</label>
            <textarea {...register('familyMembers')} className="w-full px-4 py-2 border border-slate-200 rounded-lg h-20" placeholder="Responsaveis, parentes e contatos" />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-slate-900 border-b border-slate-100 pb-2">Sepultamento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cemiterio</label>
              <select
                {...register('cemeteryId')}
                disabled={isEditMode}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Selecione...</option>
                {cemeteries.map((cemetery) => (
                  <option key={cemetery.id} value={cemetery.id}>{cemetery.name}</option>
                ))}
              </select>
              {errors.cemeteryId && <p className="text-red-500 text-xs mt-1">{errors.cemeteryId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jazigo disponível (opcional)</label>
              {isEditMode ? (
                <input
                  {...register('plotId')}
                  disabled
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-400"
                  placeholder="Alteração de jazigo é feita por traslado"
                />
              ) : (
                <select
                  {...register('plotId')}
                  disabled={!selectedCemetery}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Sem jazigo por ora</option>
                  {availablePlots.map((p) => (
                    <option key={p.id} value={p.id}>{p.code}</option>
                  ))}
                </select>
              )}
              {!isEditMode && selectedCemetery && availablePlots.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Nenhum jazigo disponível neste cemitério.</p>
              )}
            </div>
          </div>
        </div>

        {isEditMode ? (
          existingDocs.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-slate-900 border-b border-slate-100 pb-2">Documentos anexados</h3>
              <div className="flex flex-wrap gap-2">
                {existingDocs.map((doc, index) => (
                  <a
                    key={index}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-blue-600 hover:underline"
                  >
                    <FileText size={12} /> {doc.name}
                  </a>
                ))}
              </div>
              <p className="text-xs text-slate-400">Anexos existentes são preservados. Novos uploads na edição entram em fase posterior.</p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-900 border-b border-slate-100 pb-2">Documentacao</h3>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
              <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              <Upload className="mx-auto text-slate-400 mb-2" size={24} />
              <p className="text-sm text-slate-600">Arraste arquivos ou clique para selecionar</p>
              <p className="text-xs text-slate-400 mt-1">PDF, JPG ou PNG</p>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg text-sm">
                    <span className="truncate max-w-[220px]">{file.name}</span>
                    <button type="button" onClick={() => removeFile(index)} className="text-red-400 hover:text-red-600">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-4 flex justify-end gap-3">
          <Link to="/admin/falecidos" className="px-6 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium">
            Cancelar
          </Link>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium disabled:opacity-50">
            {isSubmitting ? 'Salvando...' : isEditMode ? 'Salvar alterações' : 'Salvar registro'}
          </button>
        </div>
      </form>
    </div>
  );
}
