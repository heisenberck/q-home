
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
    const [touchStartY, setTouchStartY] = useState<number | null>(null);

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

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartY(e.touches[0].clientY);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartY === null) return;
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchEndY - touchStartY;

        // Nếu vuốt xuống hơn 70px thì đóng sheet
        if (diff > 70) {
            onClose();
        }
        setTouchStartY(null);
    };

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
                {/* Header / Swipe Area */}
                <div 
                    className="pt-3 pb-2 flex flex-col items-center cursor-pointer select-none"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Thanh kéo giả lập iOS */}
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4" />
                    
                    <div className="w-full px-6 flex justify-between items-center">
                        <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">{title}</h3>
                        {/* Nút đóng duy nhất nằm trong hàng tiêu đề */}
                        <button 
                            onClick={onClose}
                            className="p-2 bg-gray-100 text-gray-500 rounded-full active:scale-90 transition-transform flex items-center justify-center"
                            aria-label="Close"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 pt-2">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default BottomSheet;
