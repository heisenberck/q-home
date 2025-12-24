
import React, { useState, useEffect, useRef, memo } from 'react';
import { 
    BellIcon, CheckCircleIcon, ClockIcon, ChatBubbleLeftEllipsisIcon, 
    BanknotesIcon, MegaphoneIcon, UserIcon, SparklesIcon, XMarkIcon
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

const ResidentNotificationBell: React.FC<ResidentNotificationBellProps> = memo(({ residentId, onNavigate }) => {
    const [unreadList, setUnreadList] = useState<ResidentNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!residentId) return;

        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', residentId),
            where('isRead', '==', false),
            orderBy('createdAt', 'desc'),
            limit(15)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUnreadList(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ResidentNotification)));
        });

        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            unsubscribe();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [residentId]);

    const handleClearAll = async () => {
        if (unreadList.length === 0) return;
        const batch = writeBatch(db);
        unreadList.forEach(n => batch.update(doc(db, 'notifications', n.id), { isRead: true }));
        await batch.commit();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className={`relative p-2 rounded-full transition-all active:scale-90 ${isOpen ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'}`}>
                <BellIcon className="w-6 h-6" />
                {unreadList.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-primary animate-bounce">{unreadList.length}</span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden animate-fade-in-down text-gray-800">
                    <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Thông báo mới</h3>
                        {unreadList.length > 0 && (
                            <button onClick={handleClearAll} className="text-[9px] font-black text-primary uppercase hover:underline">Đã đọc hết</button>
                        )}
                    </div>

                    <div className="max-h-[320px] overflow-y-auto">
                        {unreadList.length === 0 ? (
                            <div className="py-12 text-center text-gray-400">
                                <CheckCircleIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-xs font-bold uppercase tracking-tight">Hộp thư trống</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {unreadList.map(n => (
                                    <div key={n.id} onClick={() => { setIsOpen(false); onNavigate(n.link as any); }} className="p-4 hover:bg-slate-50 cursor-pointer flex gap-3 transition-colors">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0 shadow-sm"></div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-800 leading-tight line-clamp-1">{n.title}</p>
                                            <p className="text-xs text-gray-500 line-clamp-2 mt-1">{n.body}</p>
                                            <p className="text-[9px] font-bold text-gray-300 uppercase mt-2">{timeAgo(n.createdAt?.toDate?.()?.toISOString())}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

export default ResidentNotificationBell;
