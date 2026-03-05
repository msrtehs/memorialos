import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Sparkles, ChevronRight, ChevronLeft, Check, FileText } from 'lucide-react';
import { generateObituary } from '@/services/aiService';
import { createDeceased } from '@/services/deceasedService';
import { getCemeteries, Cemetery } from '@/services/cemeteryService';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// --- Schemas ---

const step1Schema = z.object({
  name: z.string().min(3, 'Nome é obrigatório'),
  dateOfBirth: z.string().min(1, 'Data de nascimento obrigatória'),
  dateOfDeath: z.string().min(1, 'Data de falecimento obrigatória'),
  city: z.string().min(2, 'Cidade obrigatória'),
  state: z.string().min(2, 'Estado obrigatório'),
  profession: z.string().optional(),
  hobbies: z.string().optional(),
  familyMembers: z.string().optional(),
  achievements: z.string().optional(),
});

const step3Schema = z.object({
  epitaph: z.string().max(100, 'Máximo de 100 caracteres').optional(),
});

const step4Schema = z.object({
  cemeteryId: z.string().min(1, 'Selecione um cemitério'),
  plotId: z.string().min(1, 'Informe o Jazigo/Setor'),
  wakeDate: z.string().min(1, 'Data do velório obrigatória'),
  wakeTime: z.string().min(1, 'Horário do velório obrigatório'),
});

// --- Components ---

const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number, totalSteps: number }) => (
  <div className="flex items-center justify-center mb-8">
    {Array.from({ length: totalSteps }).map((_, i) => (
      <React.Fragment key={i}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${
          i + 1 <= currentStep ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-400'
        }`}>
          {i + 1 < currentStep ? <Check size={20} /> : i + 1}
        </div>
        {i < totalSteps - 1 && (
          <div className={`w-12 h-1 mx-2 rounded-full ${
            i + 1 < currentStep ? 'bg-slate-800' : 'bg-slate-200'
          }`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

export default function AdminReportDeath() {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [obituaryText, setObituaryText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);

  // Forms
  const form1 = useForm({ resolver: zodResolver(step1Schema) });
  const form3 = useForm({ resolver: zodResolver(step3Schema) });
  const form4 = useForm({ resolver: zodResolver(step4Schema) });

  useEffect(() => {
    async function loadCemeteries() {
      if (tenantId) {
        const data = await getCemeteries(tenantId);
        setCemeteries(data);
      }
    }
    loadCemeteries();
  }, [tenantId]);

  const handleNext = (data: any) => {
    setFormData((prev: any) => ({ ...prev, ...data }));
    setStep(prev => prev + 1);
  };

  const handleBack = () => setStep(prev => prev - 1);

  const handleGenerateObituary = async () => {
    setIsGenerating(true);
    try {
      const text = await generateObituary(formData);
      setObituaryText(text);
    } catch (e) {
      alert("Erro ao gerar obituário. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalSubmit = async () => {
    try {
      const finalData = {
        ...formData,
        obituary: obituaryText,
      };
      
      await createDeceased(tenantId, finalData, docFiles, photoFile || undefined);
      
      navigate('/admin/falecidos'); // Redirect to Admin Deceased List
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar. Verifique os dados e tente novamente.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-800">Comunicar Óbito (Admin)</h1>
        <p className="text-slate-500 mt-2">Registro oficial de falecimento e sepultamento.</p>
      </div>

      <StepIndicator currentStep={step} totalSteps={5} />

      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        
        {/* STEP 1: Dados Pessoais */}
        {step === 1 && (
          <form onSubmit={form1.handleSubmit(handleNext)} className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Dados do Falecido</h2>
            
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-300 cursor-pointer relative overflow-hidden hover:bg-slate-100 transition-colors">
                {photoFile ? (
                  <img src={URL.createObjectURL(photoFile)} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-2">
                    <Upload className="mx-auto text-slate-400 mb-1" size={24} />
                    <span className="text-xs text-slate-500 font-medium">Foto</span>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => e.target.files && setPhotoFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                <input {...form1.register('name')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                {form1.formState.errors.name && <p className="text-red-500 text-xs mt-1">{String(form1.formState.errors.name.message)}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nascimento</label>
                  <input type="date" {...form1.register('dateOfBirth')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Falecimento</label>
                  <input type="date" {...form1.register('dateOfDeath')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                <input {...form1.register('city')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                <input {...form1.register('state')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Profissão</label>
              <input {...form1.register('profession')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hobbies e Paixões</label>
              <textarea {...form1.register('hobbies')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none h-24" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Família</label>
              <textarea {...form1.register('familyMembers')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none h-24" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Realizações</label>
              <textarea {...form1.register('achievements')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none h-24" />
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <label className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-700">
                <FileText size={16} /> Anexar Documentos
              </label>
              <input 
                type="file" 
                multiple
                onChange={(e) => e.target.files && setDocFiles(Array.from(e.target.files))}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300"
              />
            </div>

            <div className="flex justify-end pt-4">
              <button type="submit" className="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2">
                Próximo <ChevronRight size={18} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Obituário */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Obituário</h2>
            <p className="text-slate-600">Gere ou escreva o obituário oficial.</p>

            <div className="flex gap-4 mb-4">
              <button 
                onClick={handleGenerateObituary}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors disabled:opacity-50"
              >
                <Sparkles size={18} />
                {isGenerating ? 'Gerando...' : 'Gerar com IA'}
              </button>
            </div>

            <textarea 
              value={obituaryText}
              onChange={(e) => setObituaryText(e.target.value)}
              className="w-full h-64 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none text-slate-700 leading-relaxed"
              placeholder="Texto do obituário..."
            />

            <div className="flex justify-between pt-4">
              <button onClick={handleBack} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                <ChevronLeft size={18} /> Voltar
              </button>
              <button onClick={() => handleNext({})} className="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2">
                Próximo <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Frase (Epitáfio) */}
        {step === 3 && (
          <form onSubmit={form3.handleSubmit(handleNext)} className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Epitáfio</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Frase da Lápide</label>
              <input 
                {...form3.register('epitaph')} 
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-center text-lg font-serif italic" 
                placeholder="Ex: Saudades eternas..." 
              />
              {form3.formState.errors.epitaph && <p className="text-red-500 text-xs mt-1">{String(form3.formState.errors.epitaph.message)}</p>}
            </div>

            <div className="flex justify-between pt-4">
              <button type="button" onClick={handleBack} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                <ChevronLeft size={18} /> Voltar
              </button>
              <button type="submit" className="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2">
                Próximo <ChevronRight size={18} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: Sepultamento e Velório */}
        {step === 4 && (
          <form onSubmit={form4.handleSubmit(handleNext)} className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Dados do Sepultamento</h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cemitério</label>
              <select {...form4.register('cemeteryId')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none mb-3">
                <option value="">Selecione...</option>
                {cemeteries.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {form4.formState.errors.cemeteryId && <p className="text-red-500 text-xs mt-1">{String(form4.formState.errors.cemeteryId.message)}</p>}
              
              <label className="block text-sm font-medium text-slate-700 mb-1 mt-3">Jazigo / Setor</label>
              <input 
                {...form4.register('plotId')} 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" 
                placeholder="Identificação do local" 
              />
              {form4.formState.errors.plotId && <p className="text-red-500 text-xs mt-1">{String(form4.formState.errors.plotId.message)}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data do Velório</label>
                <input type="date" {...form4.register('wakeDate')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                {form4.formState.errors.wakeDate && <p className="text-red-500 text-xs mt-1">{String(form4.formState.errors.wakeDate.message)}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horário</label>
                <input type="time" {...form4.register('wakeTime')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                {form4.formState.errors.wakeTime && <p className="text-red-500 text-xs mt-1">{String(form4.formState.errors.wakeTime.message)}</p>}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button type="button" onClick={handleBack} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                <ChevronLeft size={18} /> Voltar
              </button>
              <button type="submit" className="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2">
                Próximo <ChevronRight size={18} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 5: Revisão */}
        {step === 5 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Revisão Final</h2>
            <p className="text-slate-600 mb-6">Confira os dados antes de registrar.</p>

            <div className="bg-slate-50 rounded-xl p-6 space-y-4 text-sm text-slate-700 border border-slate-200">
              <div className="flex gap-4">
                {photoFile && <img src={URL.createObjectURL(photoFile)} className="w-16 h-16 rounded-full object-cover" />}
                <div>
                  <p className="font-bold text-lg text-slate-900">{formData.name}</p>
                  <p>{formData.city} - {formData.state}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div>
                  <span className="font-bold block text-slate-800">Nascimento</span>
                  {formData.dateOfBirth}
                </div>
                <div>
                  <span className="font-bold block text-slate-800">Falecimento</span>
                  {formData.dateOfDeath}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <span className="font-bold block text-slate-800 mb-1">Sepultamento</span>
                <p>Cemitério: {cemeteries.find(c => c.id === formData.cemeteryId)?.name || formData.cemeteryId}</p>
                <p>Jazigo: {formData.plotId}</p>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={handleBack} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                <ChevronLeft size={18} /> Voltar
              </button>
              <button onClick={handleFinalSubmit} className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm">
                Registrar Óbito <Check size={18} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
