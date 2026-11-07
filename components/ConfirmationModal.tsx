"use client";

import { useEffect, useId, useRef } from 'react';
import { Info, TriangleAlert, X } from 'lucide-react';
import { Portal } from './Portal';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

function ConfirmationDialog({onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'danger'}: ConfirmationModalProps) {
  const titleId = useId(), descriptionId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancel.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  const Icon = variant === 'info' ? Info : TriangleAlert;
  return <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto p-4">
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
    <div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="relative glass-card rounded-2xl max-w-md w-full mx-auto p-6">
      <div className="flex items-center gap-4">
        <div className="surface-alt flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><Icon size={20} className={variant === 'danger' ? 'text-[var(--destructive)]' : 'text-secondary'} aria-hidden="true" /></div>
        <h3 id={titleId} className="flex-1 text-lg font-semibold text-primary">{title}</h3>
        <button type="button" onClick={onClose} className="outline-icon-button" aria-label="Close confirmation"><X size={17} aria-hidden="true" /></button>
      </div>
      <p id={descriptionId} className="py-6 text-secondary leading-relaxed">{message}</p>
      <div className="flex gap-3">
        <button ref={cancel} type="button" onClick={onClose} className="glass-btn flex-1 px-4 py-2.5 text-sm font-medium">{cancelText}</button>
        <button type="button" onClick={() => {onConfirm(); onClose();}} className={`${variant === 'danger' ? 'danger-button' : 'glass-btn'} flex-1 px-4 py-2.5 text-sm font-medium`}>{confirmText}</button>
      </div>
    </div>
  </div>;
}

export function ConfirmationModal(props: ConfirmationModalProps) {
  return props.isOpen ? <Portal><ConfirmationDialog {...props} /></Portal> : null;
}
