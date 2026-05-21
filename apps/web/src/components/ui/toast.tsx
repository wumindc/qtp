'use client';

import { Toaster as SonnerToaster, toast } from 'sonner';
import { cn } from '@/lib/cn';

export { toast };

export interface ToasterProps {
  className?: string;
  closeButton?: boolean;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  richColors?: boolean;
}

export function Toaster({ className, closeButton = true, position = 'top-right', richColors = true }: ToasterProps) {
  return (
    <SonnerToaster
      className={cn('ui-toaster', className)}
      closeButton={closeButton}
      position={position}
      richColors={richColors}
    />
  );
}
