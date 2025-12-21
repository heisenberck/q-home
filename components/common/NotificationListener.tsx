
import React, { useEffect, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNotification } from '../../App';
import { isProduction } from '../../utils/env';

interface NotificationListenerProps {
    userId: string;
}

const NotificationListener: React.FC<NotificationListenerProps> = ({ userId }) => {
    const { showToast } = useNotification();
    const isFirstLoad = useRef(true);
    const IS_PROD = isProduction();

    useEffect(() => {
        if (!userId || !IS_PROD) return;

        // Truy vấn này chỉ chạy trên Production
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('isRead', '==', false),
            orderBy('createdAt', 'desc'),
            limit(10) 
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (isFirstLoad.current) {
                isFirstLoad.current = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    showToast(`🔔 ${data.title}`, 'info', 6000);
                }
            });
        }, (error) => {
            if (error.message.includes("index")) {
                console.warn("[Production] Thiếu Index cho thông báo cư dân.");
            }
        });

        return () => unsubscribe();
    }, [userId, showToast, IS_PROD]);

    return null;
};

export default NotificationListener;
