import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { createDeceased } from '@/services/deceasedService';
import { ArrowLeft, Upload, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const schema = z.object({
  name: z.string().min(3, 'Nome é obrigatório'),
  dateOfBirth: z.string().refine(val => !isNaN(Date.parse(val)), 'Data inválida'),
  dateOfDeath: z.string().refine(val => !isNaN(Date.parse(val)), 'Data inválida'),
  cemeteryId: z.string().min(1, 'Selecione um cemitério'),
  causeOfDeath: z.string().optional(),
});

type DeceasedFormType = z.infer<typeof schema>;

export default function DeceasedForm() {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<DeceasedFormType>({
    resolver: zodResolver(schema),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: DeceasedFormType) => {
    if (!tenantId) return;
    setIsSubmitting(true);
    try {
      await createDeceased(tenantId, {
        ...data,
        documents: [] // Handled by service
      }, files);
      navigate('/admin/falecidos');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar registro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/admin/falecidos" className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Registro de Óbito</h1>
          <p className="text-slate-500">Preencha os dados oficiais do falecido.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 space-y-8">
        
        {/* Dados Pessoais */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-slate-900 border-b border-slate-100 pb-2">Dados Pessoais</h3>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
              <input 
                {...register('name')}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
                placeholder="Ex: João da Silva"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento</label>
              <input 
                type="date"
                {...register('dateOfBirth')}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
              />
              {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de Falecimento</label>
              <input 
                type="date"
                {...register('dateOfDeath')}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
              />
              {errors.dateOfDeath && <p className="text-red-500 text-xs mt-1">{errors.dateOfDeath.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Causa da Morte (Opcional)</label>
            <input 
              {...register('causeOfDeath')}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
              placeholder="Ex: Insuficiência respiratória"
            />
          </div>
        </div>

        {/* Localização */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-slate-900 border-b border-slate-100 pb-2">Sepultamento</h3>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cemitério</label>
            <select 
              {...register('cemeteryId')}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white"
            >
              <option value="">Selecione...</option>
              <option value="cemiterio-central">Cemitério Central</option>
              <option value="cemiterio-parque">Cemitério Parque das Flores</option>
            </select>
            {errors.cemeteryId && <p className="text-red-500 text-xs mt-1">{errors.cemeteryId.message}</p>}
          </div>
        </div>

        {/* Documentos */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-slate-900 border-b border-slate-100 pb-2">Documentação</h3>
          
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
            <input 
              type="file" 
              multiple 
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="mx-auto text-slate-400 mb-2" size={24} />
            <p className="text-sm text-slate-600">Arraste arquivos ou clique para selecionar</p>
            <p className="text-xs text-slate-400 mt-1">PDF, JPG ou PNG (Max 5MB)</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg text-sm">
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <button 
                    type="button" 
                    onClick={() => removeFile(index)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Link 
            to="/admin/falecidos"
            className="px-6 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
          >
            Cancelar
          </Link>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Registro'}
          </button>
        </div>

      </form>
    </div>
  );
}
