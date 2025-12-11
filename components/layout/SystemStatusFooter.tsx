
import React, { useState, useEffect } from 'react';
import { useSmartSystemData } from '../../hooks/useSmartData';
import { LockClosedIcon, LockOpenIcon, ArrowPathIcon } from '../ui/Icons';
import { useNotification } from '../../App';

const SystemStatusFooter: React.FC = () => {
    const { lastUpdated, refreshSystemData, isRefreshing } = useSmartSystemData(true); // Skip initial fetch
    const { showToast } = useNotification();
    const [isLocked, setIsLocked] = useState(true);
    const [isShaking, setIsShaking] = useState(false);
    const [timeDisplay, setTimeDisplay] = useState('');
    const [statusColor, setStatusColor] = useState('bg-gray-300');

    // Update time display and color status
    useEffect(() => {
        const updateStatus = () => {
            if (!lastUpdated) {
                setTimeDisplay('--:--');
                setStatusColor('bg-gray-300');
                return;
            }

            const now = new Date();
            const diffMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / 60000);
            
            // Format: 14:30 - 12/12
            const hours = lastUpdated.getHours().toString().padStart(2, '0');
            const minutes = lastUpdated.getMinutes().toString().padStart(2, '0');
            const day = lastUpdated.getDate().toString().padStart(2, '0');
            const month = (lastUpdated.getMonth() + 1).toString().padStart(2, '0');
            
            setTimeDisplay(`${hours}:${minutes} - ${day}/${month}`);

            if (isRefreshing) {
                setStatusColor('bg-yellow-400 animate-pulse');
            } else if (diffMinutes < 60) {
                setStatusColor('bg-green-500');
            } else {
                setStatusColor('bg-orange-500'); // Warning color for stale data
            }
        };

        updateStatus();
        const interval = setInterval(updateStatus, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [lastUpdated, isRefreshing]);

    const handleClick = () => {
        if (isRefreshing) return;

        if (isLocked) {
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 400);
            // Optionally show a tooltip or small hint here
        } else {
            refreshSystemData(true); // Force refresh
            setIsLocked(true); // Re-lock after action
        }
    };

    const handleDoubleClick = () => {
        if (isRefreshing) return;
        setIsLocked(false);
        showToast("Hệ thống đã mở khóa. Nhấn để cập nhật dữ liệu.", 'info');
    };

    return (
        <div 
            className={`
                flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 
                cursor-pointer select-none transition-all duration-200
                ${isShaking ? 'animate-shake ring-2 ring-red-100' : ''}
                ${!isLocked ? 'ring-2 ring-blue-100 border-blue-300 bg-blue-50' : 'hover:bg-gray-100'}
            `}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            title={isLocked ? "Nhấn đúp để mở khóa cập nhật" : "Nhấn để cập nhật ngay"}
        >
            <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${statusColor} shadow-sm`}></div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase font-bold leading-none tracking-wider">
                        {isRefreshing ? 'Đang đồng bộ...' : 'Dữ liệu'}
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-gray-700 leading-tight">
                        {timeDisplay}
                    </span>
                </div>
            </div>

            <div className="text-gray-400">
                {isRefreshing ? (
                    <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-blue-500" />
                ) : isLocked ? (
                    <LockClosedIcon className="w-3.5 h-3.5" />
                ) : (
                    <LockOpenIcon className="w-3.5 h-3.5 text-blue-500" />
                )}
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-2px); }
                    75% { transform: translateX(2px); }
                }
                .animate-shake {
                    animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
                }
            `}</style>
        </div>
    );
};

export default SystemStatusFooter;
