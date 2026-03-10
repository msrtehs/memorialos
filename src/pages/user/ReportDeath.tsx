import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Sparkles, ChevronRight, ChevronLeft, Check, FileText } from 'lucide-react';
import { generateObituary } from '@/services/aiService';
import { createDeathNotification } from '@/services/notificationService';
import { getAllCemeteries, getCemetery, Cemetery } from '@/services/cemeteryService';
import { useNavigate } from 'react-router-dom';

const step1Schema = z.object({
  name: z.string().min(3, 'Nome obrigatorio'),
  dateOfBirth: z.string().min(1, 'Data de nascimento obrigatoria'),
  dateOfDeath: z.string().min(1, 'Data de falecimento obrigatoria'),
  city: z.string().min(2, 'Cidade obrigatoria'),
  state: z.string().min(2, 'Estado obrigatorio'),
  profession: z.string().optional(),
  hobbies: z.string().optional(),
  familyMembers: z.string().optional(),
  achievements: z.string().optional(),
  relationshipType: z.string().min(1, 'Selecione o nivel de proximidade'),
  relationshipCustom: z.string().optional()
});

const step3Schema = z.object({
  epitaph: z.string().max(100, 'Maximo de 100 caracteres').optional()
});

const relationshipOptions = [
  'filho',
  'filha',
  'pai',
  'mae',
  'irmao',
  'irma',
  'avo',
  'avoa',
  'primo',
  'prima',
  'amigo',
  'amiga',
  'esposo',
  'esposa',
  'outro'
];

const relationshipLabelMap: Record<string, string> = {
  filho: 'Filho amado',
  filha: 'Filha querida',
  pai: 'Grande pai',
  mae: 'Grande mae',
  irmao: 'Irmao inesquecivel',
  irma: 'Irma inesquecivel',
  avo: 'Avo querido',
  avozinho: 'Avo querido',
  avoa: 'Avo querida',
  primo: 'Primo querido',
  prima: 'Prima querida',
  amigo: 'Grande amigo',
  amiga: 'Grande amiga',
  esposo: 'Companheiro eterno',
  esposa: 'Companheira eterna'
};

const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => (
  <div className="flex items-center justify-center mb-8">
    {Array.from({ length: totalSteps }).map((_, i) => (
      <React.Fragment key={i}>
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${
            i + 1 <= currentStep ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-300'
          }`}
        >
          {i + 1 < currentStep ? <Check size={20} /> : i + 1}
        </div>
        {i < totalSteps - 1 && (
          <div className={`w-12 h-1 mx-2 rounded-full ${i + 1 < currentStep ? 'bg-blue-600' : 'bg-blue-100'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

function getRelationshipLabel(relationshipType?: string, relationshipCustom?: string) {
  if (!relationshipType) return '';
  if (relationshipType === 'outro') {
    return relationshipCustom ? relationshipCustom.trim() : 'Pessoa querida';
  }
  return relationshipLabelMap[relationshipType] || 'Pessoa querida';
}

export default function ReportDeath() {
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

  const form1 = useForm({ resolver: zodResolver(step1Schema) });
  const form3 = useForm({ resolver: zodResolver(step3Schema) });

  const relationshipPreview = useMemo(() => {
    const values = form1.getValues();
    return getRelationshipLabel(values.relationshipType, values.relationshipCustom);
  }, [form1.watch('relationshipType'), form1.watch('relationshipCustom')]);

  const handleNext = (data: any) => {
    setFormData((prev: any) => ({ ...prev, ...data }));
    setStep((prev) => prev + 1);
  };

  const handleBack = () => setStep((prev) => prev - 1);

  const handleGenerateObituary = async () => {
    setIsGenerating(true);
    try {
      const values = form1.getValues();
      const currentData = {
        ...formData,
        ...values,
        relationshipLabel: getRelationshipLabel(values.relationshipType, values.relationshipCustom)
      };
      const text = await generateObituary(currentData);
      setObituaryText(text);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar obituario. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalSubmit = async () => {
    try {
      if (!selectedCemeteryId) {
        alert('Selecione um cemiterio.');
        return;
      }

      const cemetery = await getCemetery(selectedCemeteryId);
      if (!cemetery || !cemetery.tenantId) {
        alert('Erro ao identificar a prefeitura responsavel pelo cemiterio.');
        return;
      }

      const relationshipType = formData.relationshipType;
      const relationshipLabel = getRelationshipLabel(
        relationshipType,
        formData.relationshipCustom
      );

      const finalData = {
        ...formData,
        obituary: obituaryText,
        cemeteryId: selectedCemeteryId,
        relationshipType,
        relationshipLabel
      };

      await createDeathNotification(cemetery.tenantId, finalData, docFiles, photoFile || undefined);

      alert('Obito comunicado com sucesso. Um gestor vai analisar sua solicitacao.');
      navigate('/app/memorias');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar. Verifique os dados e tente novamente.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-serif font-bold text-blue-900">Comunicar Obito</h1>
        <p className="text-slate-500 mt-2">
          Preencha as informacoes com cuidado para facilitar atendimento e homenagem.
        </p>
      </div>

      <StepIndicator currentStep={step} totalSteps={4} />

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-blue-50">
        {step === 1 && (
          <form onSubmit={form1.handleSubmit(handleNext)} className="space-y-6">
            <h2 className="text-xl font-bold text-blue-900">Dados do ente querido</h2>

            <div className="flex justify-center">
              <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center border-2 border-dashed border-blue-200 cursor-pointer relative overflow-hidden hover:bg-blue-100 transition-colors">
                {photoFile ? (
                  <img src={URL.createObjectURL(photoFile)} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-2">
                    <Upload className="mx-auto text-blue-400 mb-1" size={24} />
                    <span className="text-xs text-blue-500 font-medium">Adicionar foto</span>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Cemiterio de preferencia</label>
                <select
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white"
                  value={selectedCemeteryId}
                  onChange={(e) => setSelectedCemeteryId(e.target.value)}
                  required
                >
                  <option value="">Selecione um cemiterio...</option>
                  {cemeteries.map((cemetery) => (
                    <option key={cemetery.id} value={cemetery.id}>
                      {cemetery.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo</label>
                <input
                  {...form1.register('name')}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg"
                  placeholder="Ex: Maria Silva"
                />
                {form1.formState.errors.name && (
                  <p className="text-red-500 text-xs mt-1">
                    {String(form1.formState.errors.name.message)}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nivel de proximidade</label>
                <select
                  {...form1.register('relationshipType')}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Selecione...</option>
                  {relationshipOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                {form1.formState.errors.relationshipType && (
                  <p className="text-red-500 text-xs mt-1">
                    {String(form1.formState.errors.relationshipType.message)}
                  </p>
                )}
                {relationshipPreview && (
                  <p className="text-xs text-blue-700 mt-2">
                    Subtitulo sugerido no Jardim de Memorias: <strong>{relationshipPreview}</strong>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Se for "outro", descreva
                </label>
                <input
                  {...form1.register('relationshipCustom')}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg"
                  placeholder="Ex: Mentor querido"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nascimento</label>
                <input type="date" {...form1.register('dateOfBirth')} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Falecimento</label>
                <input type="date" {...form1.register('dateOfDeath')} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                <input
                  {...form1.register('city')}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg"
                  placeholder="Ex: Salvador"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                <input
                  {...form1.register('state')}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg"
                  placeholder="Ex: BA"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Profissao</label>
              <input
                {...form1.register('profession')}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg"
                placeholder="Ex: Professor"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hobbies e paixoes</label>
              <textarea
                {...form1.register('hobbies')}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg h-24"
                placeholder="Ex: Jardinagem, leitura e musica."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Familia</label>
              <textarea
                {...form1.register('familyMembers')}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg h-24"
                placeholder="Ex: Esposa Maria, filhos Joao e Ana."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Realizacoes importantes</label>
              <textarea
                {...form1.register('achievements')}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg h-24"
                placeholder="Ex: Fundou uma escola comunitaria."
              />
            </div>

            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/50">
              <label className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-700">
                <FileText size={16} /> Anexar documentos
              </label>
              <input
                type="file"
                multiple
                onChange={(e) => e.target.files && setDocFiles(Array.from(e.target.files))}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
              />
              <p className="text-xs text-slate-500 mt-1">Formatos aceitos: PDF, JPG, PNG.</p>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 inline-flex items-center gap-2">
                Proximo <ChevronRight size={18} />
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-blue-900">Obituario</h2>
            <p className="text-slate-600">
              Escreva a homenagem manualmente ou gere um rascunho com IA. O nivel de proximidade informado sera considerado no tom da mensagem.
            </p>

            <button
              onClick={handleGenerateObituary}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 disabled:opacity-60"
            >
              <Sparkles size={18} />
              {isGenerating ? 'Gerando...' : 'Gerar com IA'}
            </button>

            <textarea
              value={obituaryText}
              onChange={(e) => setObituaryText(e.target.value)}
              className="w-full h-64 p-4 border border-slate-300 rounded-xl text-slate-700 leading-relaxed"
              placeholder="Escreva aqui o obituario..."
            />

            <div className="flex justify-between">
              <button onClick={handleBack} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 inline-flex items-center gap-2">
                <ChevronLeft size={18} /> Voltar
              </button>
              <button onClick={() => handleNext({})} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 inline-flex items-center gap-2">
                Proximo <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={form3.handleSubmit(handleNext)} className="space-y-6">
            <h2 className="text-xl font-bold text-blue-900">Frase da lapide</h2>
            <p className="text-slate-600">Uma frase breve para permanecer no memorial.</p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Frase (max 100 caracteres)</label>
              <input
                {...form3.register('epitaph')}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-center text-lg font-serif italic"
                placeholder="Ex: Saudade eterna e gratidao infinita."
              />
              {form3.formState.errors.epitaph && (
                <p className="text-red-500 text-xs mt-1">
                  {String(form3.formState.errors.epitaph.message)}
                </p>
              )}
            </div>

            <div className="flex justify-between">
              <button type="button" onClick={handleBack} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 inline-flex items-center gap-2">
                <ChevronLeft size={18} /> Voltar
              </button>
              <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 inline-flex items-center gap-2">
                Proximo <ChevronRight size={18} />
              </button>
            </div>
          </form>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-blue-900">Revisao final</h2>
            <p className="text-slate-600">Confira os dados antes de finalizar.</p>

            <div className="bg-blue-50 rounded-xl p-6 space-y-4 text-sm text-slate-700">
              <div className="flex gap-4">
                {photoFile && (
                  <img src={URL.createObjectURL(photoFile)} className="w-16 h-16 rounded-full object-cover" />
                )}
                <div>
                  <p className="font-bold text-lg text-blue-900">{formData.name}</p>
                  <p>
                    {formData.city} - {formData.state}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">{getRelationshipLabel(formData.relationshipType, formData.relationshipCustom)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-blue-100">
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
                <span className="font-bold block text-blue-800 mb-1">Obituario</span>
                <p className="line-clamp-3 italic opacity-80">{obituaryText}</p>
              </div>
              <div className="pt-4 border-t border-blue-100">
                <p className="text-xs text-slate-500 italic">
                  O local de sepultamento sera definido pelo gestor apos a analise da documentacao.
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={handleBack} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 inline-flex items-center gap-2">
                <ChevronLeft size={18} /> Voltar
              </button>
              <button onClick={handleFinalSubmit} className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-green-700 inline-flex items-center gap-2">
                Comunicar obito <Check size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
