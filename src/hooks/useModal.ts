import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function useModal(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Ref evita que um onClose inline (nova identidade a cada render) re-execute o
  // efeito enquanto o usuário digita — o que roubaria o foco para o 1º elemento.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      // Focus trap: Tab/Shift+Tab circulam apenas dentro do modal
      if (e.key === 'Tab' && containerRef.current) {
        const focusables: HTMLElement[] = Array.prototype.slice.call(
          containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !containerRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !containerRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    // Focus no primeiro elemento focável
    containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  return { containerRef };
}
