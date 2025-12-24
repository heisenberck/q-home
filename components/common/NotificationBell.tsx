
import React, { useState, useEffect, useRef } from 'react';
import { 
    BellIcon, CheckCircleIcon, ClockIcon, ChatBubbleLeftRightIcon, 
    ExclamationTriangleIcon, ActionViewIcon 
} from '../ui/Icons';
import { subscribeToUnreadNotifications, markAsRead, markAllAsRead } from '../../services/notificationService';
import type { AdminNotification } from '../../types';
import { timeAgo } from '../../utils/helpers';

const TypeIcon = ({ type, className }: { type: string, className: string }) => {
    switch (type) {
        case 'alert':
            return <ExclamationTriangleIcon className={`${className} text-red-500`} />;
        case 'message':
            return <ChatBubbleLeftRightIcon className={`${className} text-blue-500`} />;
        case 'request':
            return <ActionViewIcon className={`${className} text-orange-500`} />;
        default:
            return <CheckCircleIcon className={`${className} text-green-500`} />;
    }
};

const NotificationBell: React.FC = () => {
    const [realtimeUnread, setRealtimeUnread] = useState<AdminNotification[]>([]);
    const [displayList, setDisplayList] = useState<AdminNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 1. Lắng nghe dữ liệu Real-time
    useEffect(() => {
        const unsubscribe = subscribeToUnreadNotifications((data) => {
            setRealtimeUnread(data);
        });

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            unsubscribe();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // 2. Xử lý mở Dropdown & Freeze dữ liệu
    const handleToggle = async () => {
        const nextState = !isOpen;
        setIsOpen(nextState);

        if (nextState) {
            // "Freeze" danh sách hiện tại để user đọc
            setDisplayList(realtimeUnread);
            
            // Xử lý background: Đánh dấu tất cả là đã đọc
            if (realtimeUnread.length > 0) {
                const ids = realtimeUnread.map(n => n.id);
                try {
                    await markAllAsRead(ids);
                    // Sau lệnh này, realtimeUnread sẽ sớm trở về [] thông qua listener
                } catch (error) {
                    console.error("Lỗi cập nhật thông báo:", error);
                }
            }
        }
    };

    const handleItemClick = (notif: AdminNotification) => {
        // Logic điều hướng nếu cần (notif.linkTo)
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Nút chuông */}
            <button 
                onClick={handleToggle}
                className={`relative p-2 rounded-full transition-colors ${
                    isOpen ? 'bg-gray-100 text-primary' : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
                <BellIcon className="w-6 h-6" />
                {realtimeUnread.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
                        {realtimeUnread.length > 9 ? '9+' : realtimeUnread.length}
                    </span>
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden animate-fade-in-down ring-1 ring-black/5">
                    <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Thông báo mới</h3>
                        <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-100">
                            {displayList.length} tin
                        </span>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto">
                        {displayList.length === 0 ? (
                            <div className="py-12 px-6 text-center">
                                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <CheckCircleIcon className="w-6 h-6 text-gray-200" />
                                </div>
                                <p className="text-sm font-bold text-gray-400">Bạn đã đọc hết thông báo!</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {displayList.map((notif) => (
                                    <div 
                                        key={notif.id}
                                        onClick={() => handleItemClick(notif)}
                                        className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors group relative border-l-4 ${
                                            notif.type === 'alert' ? 'border-red-500' : 
                                            notif.type === 'request' ? 'border-orange-500' : 'border-blue-500'
                                        }`}
                                    >
                                        <div className="flex gap-3">
                                            <div className="shrink-0 mt-1">
                                                <TypeIcon type={notif.type} className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-gray-800 leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                                                    {notif.title}
                                                </p>
                                                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">
                                                    {notif.message}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-gray-400">
                                                    <ClockIcon className="w-3 h-3" />
                                                    {timeAgo(notif.createdAt?.toDate?.()?.toISOString() || new Date().toISOString())}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Chấm xanh hiển thị trạng thái "Mới" tạm thời */}
                                        <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full shadow-sm"></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {displayList.length > 0 && (
                        <div className="p-2 border-t border-gray-50 bg-gray-50/30 text-center">
                            <p className="text-[10px] font-bold text-gray-400">Chỉ hiển thị tối đa 20 tin chưa đọc</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
