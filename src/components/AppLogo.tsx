import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
  fallbackTextClassName?: string;
}

export default function AppLogo({
  size = 36,
  className = '',
  fallbackTextClassName = ''
}: AppLogoProps) {
  const logoUrl = import.meta.env.VITE_APP_LOGO_URL || '/logo-flower.png';
  const [failed, setFailed] = React.useState(false);

  if (!failed) {
    return (
      <img
        src={logoUrl}
        alt="Logomarca"
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        className={`object-contain rounded-lg bg-white p-0.5 ${className}`}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-lg bg-blue-600 flex items-center justify-center text-white font-serif font-bold ${fallbackTextClassName}`}
      aria-label="MemorialOS"
    >
      M
    </div>
  );
}
