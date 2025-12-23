
import React, { useEffect, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNotification } from '../../App';
import { isProduction } from '../../utils/env';
import type { ResidentNotification } from '../../types';

interface NotificationListenerProps {
    userId: string;
    onNewNotification?: (notif: ResidentNotification) => void;
    onUpdateList?: (list: ResidentNotification[]) => void;
}

const NotificationListener: React.FC<NotificationListenerProps> = ({ userId, onNewNotification, onUpdateList }) => {
    const { showToast } = useNotification();
    const isFirstLoad = useRef(true);
    const IS_PROD = isProduction();

    useEffect(() => {
        if (!userId || !IS_PROD) return;

        // Optimized Query: Only fetch UNREAD notifications to save quota
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('isRead', '==', false),
            orderBy('createdAt', 'desc'),
            limit(10) // Resident only needs a small snapshot of unread items
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: ResidentNotification[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ResidentNotification));

            if (onUpdateList) {
                onUpdateList(list);
            }

            // Detect new arrivals for Toast
            if (isFirstLoad.current) {
                isFirstLoad.current = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data() as ResidentNotification;
                    if (onNewNotification) {
                        onNewNotification(data);
                    }
                    // Visual feedback
                    const icons: any = { bill: '💰', news: '📢', feedback: '💬', profile: '👤' };
                    showToast(`${icons[data.type] || '🔔'} ${data.title}`, 'info', 6000);
                }
            });
        }, (error) => {
            console.error("Notification listener error:", error);
        });

        return () => unsubscribe();
    }, [userId, showToast, IS_PROD, onNewNotification, onUpdateList]);

    return null;
};

export default NotificationListener;
