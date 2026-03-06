import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { createDeceased } from '@/services/deceasedService';
import { ArrowLeft, Upload, X } from 'lucide-react';
import { Cemetery, getCemeteries } from '@/services/cemeteryService';

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
});

type DeceasedFormType = z.infer<typeof schema>;

export default function DeceasedForm() {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<DeceasedFormType>({
    resolver: zodResolver(schema)
  });

  useEffect(() => {
    async function loadCemeteries() {
      if (!tenantId) return;
      const data = await getCemeteries(tenantId);
      setCemeteries(data);
    }
    loadCemeteries();
  }, [tenantId]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles((prev) => [...prev, ...Array.from(event.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: DeceasedFormType) => {
    if (!tenantId) return;
    setIsSubmitting(true);
    try {
      await createDeceased(
        tenantId,
        {
          ...data,
          documents: []
        },
        files
      );
      navigate('/admin/falecidos');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar registro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/admin/falecidos" className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo registro de obito</h1>
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
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white"
              >
                <option value="">Selecione...</option>
                {cemeteries.map((cemetery) => (
                  <option key={cemetery.id} value={cemetery.id}>{cemetery.name}</option>
                ))}
              </select>
              {errors.cemeteryId && <p className="text-red-500 text-xs mt-1">{errors.cemeteryId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jazigo/plot ID (opcional)</label>
              <input {...register('plotId')} className="w-full px-4 py-2 border border-slate-200 rounded-lg" placeholder="Codigo do jazigo" />
            </div>
          </div>
        </div>

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

        <div className="pt-4 flex justify-end gap-3">
          <Link to="/admin/falecidos" className="px-6 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium">
            Cancelar
          </Link>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium disabled:opacity-50">
            {isSubmitting ? 'Salvando...' : 'Salvar registro'}
          </button>
        </div>
      </form>
    </div>
  );
}
