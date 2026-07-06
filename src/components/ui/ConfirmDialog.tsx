import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useModal } from '@/hooks/useModal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Quando definido, o usuário precisa digitar exatamente este texto para habilitar a confirmação. */
  requireText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  danger = false, requireText, loading = false,
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const { containerRef } = useModal(open, onCancel);

  useEffect(() => { if (open) setTyped(''); }, [open]);

  if (!open) return null;
  const confirmDisabled = loading || (requireText ? typed !== requireText : false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl"
      >
        <div className="flex items-start gap-3 mb-4">
          {danger && (
            <div className="p-2 bg-red-50 text-red-600 rounded-full shrink-0">
              <AlertTriangle size={20} />
            </div>
          )}
          <div>
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-900">{title}</h2>
            <div className="text-sm text-slate-500 mt-1">{description}</div>
          </div>
        </div>

        {requireText && (
          <div className="mb-4">
            <label htmlFor="confirm-dialog-input" className="block text-xs text-slate-500 mb-1">
              Digite <span className="font-mono font-semibold text-slate-700">{requireText}</span> para confirmar:
            </label>
            <input
              id="confirm-dialog-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
              autoComplete="off"
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Excluindo...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
