import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
}

export function Portal({ children }: PortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Bloquear scroll do body quando o portal estiver montado
    document.body.style.overflow = 'hidden';

    return () => {
      // Restaurar scroll quando desmontar
      document.body.style.overflow = '';
    };
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(children, document.body);
}
