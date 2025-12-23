
import React, { useEffect } from 'react';
import { CheckCircleIcon, WarningIcon, InformationCircleIcon } from './Icons';

export type ToastType = 'info' | 'success' | 'warn' | 'error';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
}

const ToastItem: React.FC<{ toast: ToastMessage; onClose: (id: number) => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration || 3000); // Default duration set to 3000ms
    return () => clearTimeout(timer);
  }, [toast, onClose]);
  
  const toastStyles = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    warn: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    error: 'bg-red-50 text-red-800 border-red-200',
  };
  
  const getIcon = (type: ToastType) => {
    switch (type) {
        case 'success':
            return <CheckCircleIcon className="w-6 h-6 text-green-500" />;
        case 'error':
            return <WarningIcon className="w-6 h-6 text-red-500" />;
        case 'warn':
            return <WarningIcon className="w-6 h-6 text-yellow-500" />;
        case 'info':
            return <InformationCircleIcon className="w-6 h-6 text-blue-500" />;
        default:
            return null;
    }
  };

  return (
    <div
      className={`w-full max-w-md flex items-start gap-3 p-4 font-medium border rounded-xl shadow-xl animate-slide-up ${toastStyles[toast.type]}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex-shrink-0 pt-0.5">
          {getIcon(toast.type)}
      </div>
      <div className="flex-grow text-sm">
          <span>{toast.message}</span>
      </div>
      <button 
        aria-label="Đóng" 
        onClick={() => onClose(toast.id)}
        className="-mr-1 -mt-1 p-1.5 rounded-full text-current opacity-60 hover:opacity-100 hover:bg-black/10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

interface FooterToastProps {
  toasts: ToastMessage[];
  onClose: (id: number) => void;
  onClearAll: () => void;
}

const FooterToast: React.FC<FooterToastProps> = ({ toasts, onClose, onClearAll }) => {
  if (toasts.length === 0) {
    return null;
  }

  const visibleToasts = toasts.slice(-5); // Limit to 5 visible toasts

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-auto max-w-md flex flex-col items-end gap-3">
        {visibleToasts.length > 1 && (
            <button
                onClick={onClearAll}
                className="px-3 py-1 text-xs font-semibold text-gray-600 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-full shadow-md hover:bg-gray-200"
            >
                Xóa tất cả
            </button>
        )}
        {visibleToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onClose={onClose} />
        ))}
    </div>
  );
};

export default FooterToast;
