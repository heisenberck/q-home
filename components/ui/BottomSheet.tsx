
import React, { useEffect, useState, useRef } from 'react';
import { XMarkIcon } from './Icons';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isDragging, setIsDragging] = useState(false);
    const [translateY, setTranslateY] = useState(0);
    const touchStartRef = useRef<{ y: number; time: number }>({ y: 0, time: 0 });
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setTranslateY(0);
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
        touchStartRef.current = {
            y: e.touches[0].clientY,
            time: Date.now()
        };
        setIsDragging(false);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const currentY = e.touches[0].clientY;
        const diffY = currentY - touchStartRef.current.y;
        const scrollTop = contentRef.current?.scrollTop || 0;

        // Chỉ kích hoạt kéo đóng nếu:
        // 1. Đang kéo xuống (diffY > 0)
        // 2. Nội dung đang ở đỉnh (scrollTop <= 0)
        if (diffY > 0 && scrollTop <= 0) {
            // Ngăn chặn cuộn mặc định của trình duyệt để xử lý kéo thẻ
            if (e.cancelable) e.preventDefault();
            setIsDragging(true);
            setTranslateY(diffY);
        } else if (isDragging) {
            // Nếu đang trong trạng thái dragging mà kéo ngược lên
            setTranslateY(Math.max(0, diffY));
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!isDragging) return;

        const diffY = translateY;
        const diffTime = Date.now() - touchStartRef.current.time;
        const velocity = diffY / diffTime; // Tốc độ kéo

        // Điều kiện đóng: Kéo xuống hơn 30% chiều cao HOẶC vuốt nhanh (velocity > 0.5)
        const threshold = window.innerHeight * 0.3;
        
        if (diffY > threshold || velocity > 0.8) {
            onClose();
        } else {
            // Reset về vị trí cũ với animation
            setTranslateY(0);
        }
        setIsDragging(false);
    };

    if (!shouldRender) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-hidden">
            {/* Backdrop */}
            <div 
                className={`absolute inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity duration-300 ${
                    isOpen && !isDragging ? 'opacity-100' : 'opacity-0'
                }`} 
                style={{ opacity: isDragging ? Math.max(0, 1 - translateY / 500) : undefined }}
                onClick={onClose}
            />
            
            {/* Sheet Container */}
            <div 
                className={`relative w-full max-w-md bg-white rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[92vh] select-none ${
                    !isDragging ? 'transition-transform duration-300 ease-out' : ''
                }`}
                style={{ 
                    transform: `translateY(${isOpen ? translateY : '100'}px)`,
                    touchAction: 'none' // Chặn pull-to-refresh của trình duyệt
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Header Area */}
                <div className="pt-2 pb-4 flex flex-col items-center shrink-0">
                    <div className="w-14 h-1.5 bg-gray-200 rounded-full mt-2 mb-4" />
                    
                    <div className="w-full px-6 flex justify-between items-center">
                        <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight leading-none">
                            {title}
                        </h3>
                        
                        <button 
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="p-3 bg-gray-100 text-gray-500 rounded-full active:scale-90 transition-all flex items-center justify-center shadow-sm"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content Area - Cho phép cuộn bên trong */}
                <div 
                    ref={contentRef}
                    className="flex-1 overflow-y-auto p-6 pt-0 overscroll-contain"
                    style={{ touchAction: isDragging ? 'none' : 'pan-y' }}
                    onScroll={(e) => {
                        // Nếu đang dragging thì không cho phép scroll
                        if (isDragging) {
                            e.currentTarget.scrollTop = 0;
                        }
                    }}
                >
                    <div className="pointer-events-auto">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BottomSheet;
