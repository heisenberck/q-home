import React, { useEffect } from 'react';
import { CheckCircleIcon, WarningIcon } from './Icons';

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

const InformationCircleIcon: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
);

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
  
  const toastStyles = {
    info: 'bg-blue-50 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-700',
    success: 'bg-green-50 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-700',
    warn: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700',
    error: 'bg-red-50 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-700',
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
      className={`fixed bottom-6 right-6 z-[9999] w-auto max-w-md flex items-start gap-3 p-4 font-medium border rounded-xl shadow-xl animate-slide-up ${toastStyles[toast.type]}`}
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
        onClick={onClose}
        className="-mr-1 -mt-1 p-1.5 rounded-full text-current opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default FooterToast;