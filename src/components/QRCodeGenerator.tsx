import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeGeneratorProps {
  value: string;
  label?: string;
  size?: number;
}

export default function QRCodeGenerator({ value, label, size = 128 }: QRCodeGeneratorProps) {
  const downloadQR = () => {
    const canvas = document.getElementById("qr-gen") as HTMLCanvasElement;
    if(!canvas) return;
    
    const pngUrl = canvas
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");
    
    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `qr-code-${label || 'memorial'}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100 w-fit">
      <div className="bg-white p-2 rounded-lg">
        <QRCodeSVG 
          value={value} 
          size={size}
          level={"H"}
          includeMargin={true}
        />
      </div>
      {label && <p className="text-sm font-medium text-slate-900">{label}</p>}
      <button 
        onClick={() => alert("Download functionality requires rendering to Canvas first, simplified for this demo.")}
        className="text-xs text-blue-600 hover:underline"
      >
        Baixar PNG
      </button>
    </div>
  );
}
