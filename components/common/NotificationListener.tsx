
import React, { useEffect, useRef, memo } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useNotification } from '../../App';
import { isProduction } from '../../utils/env';
import type { ResidentNotification } from '../../types';

interface NotificationListenerProps {
    userId: string;
    onUpdateList?: (list: ResidentNotification[]) => void;
}

const NotificationListener: React.FC<NotificationListenerProps> = memo(({ userId, onUpdateList }) => {
    const { showToast } = useNotification();
    const isFirstLoad = useRef(true);
    const IS_PROD = isProduction();

    useEffect(() => {
        // QUAN TRỌNG: Chỉ chạy listener nếu có user ID và Firebase đã login thành công
        if (!userId || !IS_PROD || !auth.currentUser) {
            return;
        }
        
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('isRead', '==', false),
            orderBy('createdAt', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, {
            next: (snapshot) => {
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
            },
            error: (err) => {
                // Xử lý lỗi quyền êm đẹp, không throw uncaught error
                if (err.code === 'permission-denied') {
                    console.warn("[NotificationListener] Waiting for proper permissions...");
                } else {
                    console.error("[NotificationListener] Error:", err);
                }
            }
        });

        return () => unsubscribe();
    }, [userId, IS_PROD]);

    return null;
});

export default NotificationListener;
