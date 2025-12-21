
import React, { useState, useEffect, useRef } from 'react';
import { 
    BellIcon, CheckCircleIcon, ClockIcon, ChatBubbleLeftRightIcon, 
    ExclamationTriangleIcon, ActionViewIcon, WarningIcon 
} from '../ui/Icons';
import { subscribeToUnreadNotifications, markAsRead, markAllAsRead } from '../../services/notificationService';
import type { AdminNotification } from '../../types';
import { timeAgo } from '../../utils/helpers';

const TypeIcon = ({ type, className }: { type: string, className: string }) => {
    switch (type) {
        case 'alert': return <ExclamationTriangleIcon className={`${className} text-red-500`} />;
        case 'message': return <ChatBubbleLeftRightIcon className={`${className} text-blue-500`} />;
        case 'request': return <ActionViewIcon className={`${className} text-orange-500`} />;
        default: return <CheckCircleIcon className={`${className} text-green-500`} />;
    }
};

const NotificationBell: React.FC = () => {
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = subscribeToUnreadNotifications(
            (data) => {
                setNotifications(data);
                setError(null);
            },
            (err) => {
                if (err.message.includes("index")) {
                    setError("MISSING_INDEX");
                } else {
                    setError("UNKNOWN");
                }
            }
        );

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

    const handleMarkAll = async () => {
        const ids = notifications.map(n => n.id);
        await markAllAsRead(ids);
    };

    const handleItemClick = async (notif: AdminNotification) => {
        await markAsRead(notif.id);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-full transition-colors ${
                    isOpen ? 'bg-gray-100 text-primary' : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
                <BellIcon className="w-6 h-6" />
                {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                        {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                )}
                {error === 'MISSING_INDEX' && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-white ring-2 ring-white" title="Lỗi Chỉ mục (Index) Firestore">
                        <WarningIcon className="w-3 h-3" />
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden animate-fade-in-down ring-1 ring-black/5">
                    <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Thông báo mới</h3>
                        {notifications.length > 0 && (
                            <button onClick={handleMarkAll} className="text-[10px] font-bold text-primary hover:underline">
                                Đọc tất cả
                            </button>
                        )}
                    </div>

                    <div className="max-h-[360px] overflow-y-auto">
                        {error === 'MISSING_INDEX' ? (
                            <div className="p-6 text-center text-orange-600">
                                <WarningIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                <p className="text-xs font-bold uppercase mb-1">Lỗi hệ thống</p>
                                <p className="text-[10px] leading-relaxed">Cần tạo chỉ mục (Index) cho Firestore. Vui lòng mở console trình duyệt để lấy link cấu hình.</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-12 px-6 text-center">
                                <CheckCircleIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                <p className="text-sm font-bold text-gray-400">Bạn đã đọc hết thông báo!</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {notifications.map((notif) => (
                                    <div 
                                        key={notif.id}
                                        onClick={() => handleItemClick(notif)}
                                        className="p-4 hover:bg-slate-50 cursor-pointer transition-colors group relative"
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
                                        <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full shadow-sm"></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {notifications.length > 0 && (
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
