import React, { useId } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

interface QRCodeGeneratorProps {
  value: string;
  label?: string;
  size?: number;
}

export default function QRCodeGenerator({ value, label, size = 128 }: QRCodeGeneratorProps) {
  const canvasId = useId();

  const downloadQR = () => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `qr-memorial-${(label || 'memorial').replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100 w-fit print:shadow-none print:border-0">
      <div className="bg-white p-2 rounded-lg">
        <QRCodeCanvas id={canvasId} value={value} size={size} level="H" marginSize={2} />
      </div>
      {label && <p className="text-sm font-medium text-slate-900 text-center">{label}</p>}
      <div className="flex gap-3 print:hidden">
        <button onClick={downloadQR} className="text-xs text-blue-600 hover:underline">
          Baixar PNG
        </button>
        <button onClick={() => window.print()} className="text-xs text-slate-600 hover:underline">
          Imprimir QR
        </button>
      </div>
    </div>
  );
}
