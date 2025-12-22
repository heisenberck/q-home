
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { 
    XMarkIcon, BellIcon, BanknotesIcon, MegaphoneIcon, 
    ClockIcon 
} from '../ui/Icons';
import { timeAgo } from '../../utils/helpers';

interface NotificationTrayProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onNavigate: (page: string) => void;
}

const NotificationTray: React.FC<NotificationTrayProps> = ({ isOpen, onClose, userId, onNavigate }) => {
    const [notifications, setNotifications] = useState<any[]>([]);

    useEffect(() => {
        if (!userId || !isOpen) return;

        // FIX: Gỡ bỏ orderBy trong query để tránh lỗi Index.
        // Tải danh sách thô rồi sắp xếp bằng JS phía cư dân.
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(d => {
                const data = d.data();
                return { id: d.id, ...data };
            });
            
            // Sắp xếp theo thời gian giảm dần (mới nhất lên đầu)
            const sortedList = list.sort((a, b) => {
                const timeA = a.createdAt?.toMillis?.() || 0;
                const timeB = b.createdAt?.toMillis?.() || 0;
                return timeB - timeA;
            }).slice(0, 20); // Chỉ lấy 20 tin gần nhất

            setNotifications(sortedList);
        });

        return () => unsubscribe();
    }, [userId, isOpen]);

    const handleMarkAllRead = async () => {
        const unread = notifications.filter(n => !n.isRead);
        if (unread.length === 0) return;

        const batch = writeBatch(db);
        unread.forEach(n => {
            batch.update(doc(db, 'notifications', n.id), { isRead: true });
        });
        await batch.commit();
    };

    const handleItemClick = async (notif: any) => {
        if (!notif.isRead) {
            await updateDoc(doc(db, 'notifications', notif.id), { isRead: true });
        }
        if (notif.link) {
            onNavigate(notif.link);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
            
            <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-slide-up sm:animate-none sm:translate-x-0">
                <header className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <BellIcon className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-gray-800">Thông báo</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleMarkAllRead} className="text-[10px] font-bold text-primary uppercase hover:underline">Đã đọc hết</button>
                        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full"><XMarkIcon className="w-6 h-6 text-gray-400" /></button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                    {notifications.length === 0 ? (
                        <div className="py-20 text-center text-gray-400">
                            <BellIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-medium">Bạn chưa có thông báo nào</p>
                        </div>
                    ) : (
                        notifications.map(n => (
                            <div 
                                key={n.id} 
                                onClick={() => handleItemClick(n)}
                                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors relative flex gap-3 ${!n.isRead ? 'bg-primary/5 border-l-4 border-primary' : 'border-l-4 border-transparent'}`}
                            >
                                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                                    n.type === 'bill' ? 'bg-blue-100 text-blue-600' : 
                                    n.type === 'news' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {n.type === 'bill' ? <BanknotesIcon className="w-5 h-5" /> : <MegaphoneIcon className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm leading-snug ${!n.isRead ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{n.body}</p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-2 flex items-center gap-1">
                                        <ClockIcon className="w-3 h-3" />
                                        {timeAgo(n.createdAt?.toDate?.()?.toISOString())}
                                    </p>
                                </div>
                                {!n.isRead && (
                                    <div className="absolute top-4 right-4 w-2 h-2 bg-primary rounded-full"></div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationTray;
