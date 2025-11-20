import React, { useEffect } from 'react';

export type ToastType = 'info' | 'success' | 'warn' | 'error';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
}

interface FooterToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

const FooterToast: React.FC<FooterToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        onClose();
      }, toast.duration || 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) {
    return null;
  }

  const icons: Record<ToastType, string> = {
    info: 'ℹ️',
    success: '✅',
    warn: '⚠️',
    error: '⛔',
  };

  return (
    <div
      id="footerToast"
      className={`footer-toast ${toast.type}`}
      role="status"
      aria-live="polite"
    >
      <span id="ftIcon">{icons[toast.type]}</span>
      <span id="ftMessage">{toast.message}</span>
      <button id="ftClose" aria-label="Đóng" onClick={onClose}>✕</button>
    </div>
  );
};

export default FooterToast;
