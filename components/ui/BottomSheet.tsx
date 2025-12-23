
import React, { useEffect, useState } from 'react';
import { XMarkIcon } from './Icons';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
    const [shouldRender, setShouldRender] = useState(isOpen);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => {
                setShouldRender(false);
                document.body.style.overflow = '';
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!shouldRender) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
            {/* Backdrop */}
            <div 
                className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'opacity-0'
                }`} 
                onClick={onClose}
            />
            
            {/* Sheet Container */}
            <div 
                className={`relative w-full max-w-md bg-white rounded-t-[2.5rem] shadow-2xl transition-transform duration-300 ease-out flex flex-col max-h-[92vh] ${
                    isOpen ? 'translate-y-0' : 'translate-y-full'
                }`}
            >
                {/* Drag Handle Area */}
                <div className="pt-3 pb-2 flex justify-center cursor-pointer" onClick={onClose}>
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-6 pb-4 flex justify-between items-center border-b border-gray-50">
                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">{title}</h3>
                    <button 
                        onClick={onClose}
                        className="p-2 bg-gray-100 text-gray-500 rounded-full active:scale-90 transition-transform"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default BottomSheet;
