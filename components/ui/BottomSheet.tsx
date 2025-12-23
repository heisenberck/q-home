
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
    const [touchStartY, setTouchStartY] = useState<number | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

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

    // Xử lý vuốt xuống từ Header
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartY(e.touches[0].clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartY === null) return;
        
        const currentY = e.touches[0].clientY;
        const diff = currentY - touchStartY;

        // Nếu đang cuộn nội dung, chỉ cho phép vuốt đóng nếu đang ở đỉnh (scrollTop === 0)
        if (contentRef.current && contentRef.current.scrollTop > 0 && diff > 0) {
            return;
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartY === null) return;
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchEndY - touchStartY;

        // Ngưỡng vuốt xuống để đóng (70px)
        if (diff > 70) {
            onClose();
        }
        setTouchStartY(null);
    };

    if (!shouldRender) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
            {/* Backdrop với độ mờ nhẹ */}
            <div 
                className={`absolute inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity duration-300 ${
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
                {/* Vùng Header mở rộng: Nhận diện kéo xuống tốt hơn */}
                <div 
                    className="pt-2 pb-4 flex flex-col items-center cursor-grab active:cursor-grabbing select-none touch-none"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Thanh kéo iOS Style - To và dễ thấy hơn */}
                    <div className="w-14 h-1.5 bg-gray-200 rounded-full mt-2 mb-4" />
                    
                    <div className="w-full px-6 flex justify-between items-center">
                        <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight leading-none">
                            {title}
                        </h3>
                        
                        {/* Nút đóng được tinh chỉnh: Thấp hơn, diện tích chạm lớn */}
                        <button 
                            onClick={onClose}
                            className="p-3 bg-gray-100 text-gray-500 rounded-full active:scale-90 active:bg-gray-200 transition-all flex items-center justify-center shadow-sm"
                            aria-label="Đóng"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Vùng nội dung: Nếu vuốt từ đây khi đang ở top cũng sẽ đóng */}
                <div 
                    ref={contentRef}
                    className="flex-1 overflow-y-auto p-6 pt-0"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

export default BottomSheet;
