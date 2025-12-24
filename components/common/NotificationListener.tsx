
import React, { useEffect, useRef, memo } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNotification, useAuth } from '../../App';
import { isProduction } from '../../utils/env';
import type { ResidentNotification } from '../../types';

interface NotificationListenerProps {
    userId: string;
    onUpdateList?: (list: ResidentNotification[]) => void;
}

const NotificationListener: React.FC<NotificationListenerProps> = memo(({ userId, onUpdateList }) => {
    const { showToast } = useNotification();
    const { user } = useAuth();
    const isFirstLoad = useRef(true);
    const lastSubId = useRef("");
    const IS_PROD = isProduction();

    useEffect(() => {
        // Chỉ Resident mới cần lắng nghe real-time notifications cá nhân
        // Admin đã có NotificationBell riêng
        if (!userId || !IS_PROD || user?.Role !== 'Resident' || lastSubId.current === userId) return;

        lastSubId.current = userId;
        
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('isRead', '==', false),
            orderBy('createdAt', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: ResidentNotification[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ResidentNotification));

            if (onUpdateList) onUpdateList(list);

            if (isFirstLoad.current) {
                isFirstLoad.current = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data() as ResidentNotification;
                    const icons: any = { bill: '💰', news: '📢', feedback: '💬' };
                    showToast(`${icons[data.type] || '🔔'} ${data.title}`, 'info', 6000);
                }
            });
        }, (error) => {
            console.error("Quota/Listener Error:", error);
        });

        return () => {
            unsubscribe();
            lastSubId.current = "";
        };
    }, [userId, IS_PROD, user?.Role]);

    return null;
});

export default NotificationListener;
