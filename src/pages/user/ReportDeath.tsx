import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Sparkles, ChevronRight, ChevronLeft, Check, FileText } from 'lucide-react';
import { generateObituary } from '@/services/aiService';
import { createDeathNotification } from '@/services/notificationService';
import { getCemeteries, getAllCemeteries, getCemetery, Cemetery } from '@/services/cemeteryService';
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

// Step 4 removed for users

// --- Components ---

const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number, totalSteps: number }) => (
  <div className="flex items-center justify-center mb-8">
    {Array.from({ length: totalSteps }).map((_, i) => (
      <React.Fragment key={i}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${
          i + 1 <= currentStep ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-300'
        }`}>
          {i + 1 < currentStep ? <Check size={20} /> : i + 1}
        </div>
        {i < totalSteps - 1 && (
          <div className={`w-12 h-1 mx-2 rounded-full ${
            i + 1 < currentStep ? 'bg-blue-600' : 'bg-blue-100'
          }`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

export default function ReportDeath() {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [obituaryText, setObituaryText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);
  const [selectedCemeteryId, setSelectedCemeteryId] = useState('');

  useEffect(() => {
    getAllCemeteries().then(setCemeteries);
  }, []);

  // Forms
  const form1 = useForm({ resolver: zodResolver(step1Schema) });
  const form3 = useForm({ resolver: zodResolver(step3Schema) });

  const handleNext = (data: any) => {
    setFormData((prev: any) => ({ ...prev, ...data }));
    setStep(prev => prev + 1);
  };

  const handleBack = () => setStep(prev => prev - 1);

  const handleGenerateObituary = async () => {
    setIsGenerating(true);
    try {
      // Pass current form data to AI service
      const currentData = { ...formData, ...form1.getValues() };
      const text = await generateObituary(currentData);
      setObituaryText(text);
    } catch (e) {
      alert("Erro ao gerar obituário. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalSubmit = async () => {
    try {
      if (!selectedCemeteryId) {
        alert("Por favor, selecione um cemitério.");
        return;
      }

      const cemetery = await getCemetery(selectedCemeteryId);
      if (!cemetery || !cemetery.tenantId) {
        alert("Erro ao identificar a prefeitura responsável pelo cemitério.");
        return;
      }

      const finalData = {
        ...formData,
        obituary: obituaryText,
        cemeteryId: selectedCemeteryId,
      };
      
      await createDeathNotification(cemetery.tenantId, finalData, docFiles, photoFile || undefined);
      
      alert("Óbito comunicado com sucesso. Um gestor entrará em contato.");
      navigate('/app/memorias');
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar. Verifique os dados e tente novamente.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-serif font-bold text-blue-900">Comunicar Óbito</h1>
        <p className="text-slate-500 mt-2">Preencha as informações com carinho para honrar a memória.</p>
      </div>

      <StepIndicator currentStep={step} totalSteps={4} />

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-blue-50">
        
        {/* STEP 1: Dados Pessoais */}
        {step === 1 && (
          <form onSubmit={form1.handleSubmit(handleNext)} className="space-y-6">
            <h2 className="text-xl font-bold text-blue-900 mb-4">Dados do Ente Querido</h2>
            
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center border-2 border-dashed border-blue-200 cursor-pointer relative overflow-hidden hover:bg-blue-100 transition-colors">
                {photoFile ? (
                  <img src={URL.createObjectURL(photoFile)} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-2">
                    <Upload className="mx-auto text-blue-400 mb-1" size={24} />
                    <span className="text-xs text-blue-500 font-medium">Adicionar Foto</span>
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
                <label className="label">Cemitério de Preferência</label>
                <select 
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white shadow-sm"
                  value={selectedCemeteryId}
                  onChange={(e) => setSelectedCemeteryId(e.target.value)}
                  required
                >
                  <option value="">Selecione um cemitério...</option>
                  {cemeteries.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Nome Completo</label>
                <input {...form1.register('name')} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white shadow-sm" placeholder="Ex: Maria Silva" />
                {form1.formState.errors.name && <p className="error">{String(form1.formState.errors.name.message)}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Nascimento</label>
                  <input type="date" {...form1.register('dateOfBirth')} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white shadow-sm" />
                </div>
                <div>
                  <label className="label">Falecimento</label>
                  <input type="date" {...form1.register('dateOfDeath')} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white shadow-sm" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Cidade</label>
                <input {...form1.register('city')} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white shadow-sm" />
              </div>
              <div>
                <label className="label">Estado</label>
                <input {...form1.register('state')} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white shadow-sm" />
              </div>
            </div>

            <div>
              <label className="label">Profissão</label>
              <input {...form1.register('profession')} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white shadow-sm" placeholder="Ex: Professor de Matemática" />
            </div>

            <div>
              <label className="label">Hobbies e Paixões</label>
              <textarea {...form1.register('hobbies')} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white shadow-sm h-24" placeholder="Ex: Jardinagem, música clássica, jogar xadrez..." />
            </div>

            <div>
              <label className="label">Família (Cônjuge, Filhos...)</label>
              <textarea {...form1.register('familyMembers')} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white shadow-sm h-24" placeholder="Ex: Viúva de João, mãe de Pedro e Ana..." />
            </div>

            <div>
              <label className="label">Realizações Importantes</label>
              <textarea {...form1.register('achievements')} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white shadow-sm h-24" placeholder="Ex: Fundou a escola local, ganhou prêmio de..." />
            </div>

            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/50">
              <label className="label flex items-center gap-2 mb-2">
                <FileText size={16} /> Anexar Documentos (Atestado de Óbito / Guia de Sepultamento)
              </label>
              <input 
                type="file" 
                multiple
                onChange={(e) => e.target.files && setDocFiles(Array.from(e.target.files))}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
              />
              <p className="text-xs text-slate-500 mt-1">Formatos aceitos: PDF, JPG, PNG.</p>
            </div>

            <div className="flex justify-end pt-4">
              <button type="submit" className="btn-primary">
                Próximo <ChevronRight size={18} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Obituário */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-blue-900 mb-4">Obituário</h2>
            <p className="text-slate-600">Conte a história de vida. Você pode escrever manualmente ou deixar nossa IA criar um rascunho baseada nos dados anteriores.</p>

            <div className="flex gap-4 mb-4">
              <button 
                onClick={handleGenerateObituary}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors disabled:opacity-50"
              >
                <Sparkles size={18} />
                {isGenerating ? 'Escrevendo...' : 'Escrever com IA'}
              </button>
            </div>

            <textarea 
              value={obituaryText}
              onChange={(e) => setObituaryText(e.target.value)}
              className="w-full h-64 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 leading-relaxed bg-white shadow-sm"
              placeholder="Escreva aqui a homenagem..."
            />

            <div className="flex justify-between pt-4">
              <button onClick={handleBack} className="btn-secondary">
                <ChevronLeft size={18} /> Voltar
              </button>
              <button onClick={() => handleNext({})} className="btn-primary">
                Próximo <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Frase (Epitáfio) */}
        {step === 3 && (
          <form onSubmit={form3.handleSubmit(handleNext)} className="space-y-6">
            <h2 className="text-xl font-bold text-blue-900 mb-4">Frase da Lápide</h2>
            <p className="text-slate-600">Uma frase curta que ficará marcada no local de descanso.</p>

            <div>
              <label className="label">Frase (Máx 100 caracteres)</label>
              <input 
                {...form3.register('epitaph')} 
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white shadow-sm text-center text-lg font-serif italic" 
                placeholder="Ex: Saudades eternas..." 
              />
              {form3.formState.errors.epitaph && <p className="error">{String(form3.formState.errors.epitaph.message)}</p>}
            </div>

            <div className="flex justify-between pt-4">
              <button type="button" onClick={handleBack} className="btn-secondary">
                <ChevronLeft size={18} /> Voltar
              </button>
              <button type="submit" className="btn-primary">
                Próximo <ChevronRight size={18} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: Revisão (Final Step for User) */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-blue-900 mb-4">Revisão</h2>
            <p className="text-slate-600 mb-6">Confira os dados antes de finalizar o comunicado.</p>

            <div className="bg-blue-50 rounded-xl p-6 space-y-4 text-sm text-slate-700">
              <div className="flex gap-4">
                {photoFile && <img src={URL.createObjectURL(photoFile)} className="w-16 h-16 rounded-full object-cover" />}
                <div>
                  <p className="font-bold text-lg text-blue-900">{formData.name}</p>
                  <p>{formData.city} - {formData.state}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-100">
                <div>
                  <span className="font-bold block text-blue-800">Nascimento</span>
                  {formData.dateOfBirth}
                </div>
                <div>
                  <span className="font-bold block text-blue-800">Falecimento</span>
                  {formData.dateOfDeath}
                </div>
              </div>
              <div className="pt-4 border-t border-blue-100">
                <span className="font-bold block text-blue-800 mb-1">Obituário</span>
                <p className="line-clamp-3 italic opacity-80">{obituaryText}</p>
              </div>
              <div className="pt-4 border-t border-blue-100">
                <p className="text-xs text-slate-500 italic">
                  * O local de sepultamento será definido pelo gestor após a análise da documentação.
                </p>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={handleBack} className="btn-secondary">
                <ChevronLeft size={18} /> Voltar
              </button>
              <button onClick={handleFinalSubmit} className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm shadow-green-200">
                Comunicar Óbito <Check size={18} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
