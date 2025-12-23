
import React, { useState, useEffect, useRef } from 'react';
import { 
    BellIcon, CheckCircleIcon, ClockIcon, ChatBubbleLeftEllipsisIcon, 
    BanknotesIcon, MegaphoneIcon, UserIcon, SparklesIcon
} from '../ui/Icons';
import { collection, query, where, orderBy, limit, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import type { ResidentNotification } from '../../types';
import { timeAgo } from '../../utils/helpers';
import { PortalPage } from '../layout/ResidentLayout';

interface ResidentNotificationBellProps {
    residentId: string;
    onNavigate: (page: PortalPage) => void;
}

const TypeIcon = ({ type, className }: { type: string, className: string }) => {
    switch (type) {
        case 'bill':
            return <BanknotesIcon className={`${className} text-emerald-500`} />;
        case 'news':
            return <MegaphoneIcon className={`${className} text-blue-500`} />;
        case 'feedback':
            return <ChatBubbleLeftEllipsisIcon className={`${className} text-orange-500`} />;
        case 'profile':
            return <UserIcon className={`${className} text-purple-500`} />;
        default:
            return <SparklesIcon className={`${className} text-gray-400`} />;
    }
};

const ResidentNotificationBell: React.FC<ResidentNotificationBellProps> = ({ residentId, onNavigate }) => {
    const [unreadList, setUnreadList] = useState<ResidentNotification[]>([]);
    const [displayList, setDisplayList] = useState<ResidentNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 1. Lắng nghe thông báo chưa đọc thời gian thực
    useEffect(() => {
        if (!residentId) return;

        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', residentId),
            where('isRead', '==', false),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ResidentNotification));
            setUnreadList(list);
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
    }, [residentId]);

    // 2. Xử lý mở chuông: Đóng băng danh sách hiển thị và đánh dấu tất cả đã đọc
    const handleToggle = async () => {
        const nextState = !isOpen;
        setIsOpen(nextState);

        if (nextState) {
            setDisplayList(unreadList);
            
            if (unreadList.length > 0) {
                const batch = writeBatch(db);
                unreadList.forEach(n => {
                    batch.update(doc(db, 'notifications', n.id), { isRead: true });
                });
                try {
                    await batch.commit();
                } catch (e) {
                    console.error("Lỗi cập nhật trạng thái thông báo:", e);
                }
            }
        }
    };

    const handleItemClick = (n: ResidentNotification) => {
        setIsOpen(false);
        if (n.link) {
            onNavigate(n.link as PortalPage);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Nút Chuông */}
            <button 
                onClick={handleToggle}
                className={`relative p-2 rounded-full transition-all active:scale-90 ${
                    isOpen ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'
                }`}
            >
                <BellIcon className="w-6 h-6" />
                {unreadList.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-primary animate-bounce">
                        {unreadList.length}
                    </span>
                )}
            </button>

            {/* Dropdown Tray */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden animate-fade-in-down ring-1 ring-black/5 text-gray-800">
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
                                <p className="text-xs font-bold text-gray-400">Bạn không có thông báo mới nào!</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {displayList.map((notif) => (
                                    <div 
                                        key={notif.id}
                                        onClick={() => handleItemClick(notif)}
                                        className="p-4 hover:bg-slate-50 cursor-pointer transition-colors group relative flex gap-3"
                                    >
                                        <div className="shrink-0 mt-1">
                                            <TypeIcon type={notif.type} className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-gray-800 leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                                                {notif.title}
                                            </p>
                                            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">
                                                {notif.body}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-gray-400">
                                                <ClockIcon className="w-3 h-3" />
                                                {timeAgo(notif.createdAt?.toDate?.()?.toISOString() || new Date().toISOString())}
                                            </div>
                                        </div>
                                        {/* Chấm xanh trang trí để biết mục này vừa xuất hiện */}
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-1.5"></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-3 border-t border-gray-50 bg-gray-50/30 text-center">
                        <button 
                            onClick={() => { setIsOpen(false); onNavigate('portalNews'); }}
                            className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                        >
                            Xem tất cả tin tức
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResidentNotificationBell;
