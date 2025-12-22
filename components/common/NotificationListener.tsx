
import React, { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNotification } from '../../App';
import { isProduction } from '../../utils/env';

interface NotificationListenerProps {
    userId: string;
    onNewNotification?: (data: any) => void;
}

const NotificationListener: React.FC<NotificationListenerProps> = ({ userId, onNewNotification }) => {
    const { showToast } = useNotification();
    const isFirstLoad = useRef(true);
    const IS_PROD = isProduction();

    useEffect(() => {
        if (!userId || !IS_PROD) return;

        // FIX: Gỡ bỏ orderBy và limit để tránh lỗi Firestore Index.
        // Chỉ lắng nghe các tin chưa đọc của đúng userId này.
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('isRead', '==', false)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Lần đầu load bỏ qua để tránh hiện toast cũ
            if (isFirstLoad.current) {
                isFirstLoad.current = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                // Chỉ xử lý khi có doc mới được thêm vào Firestore
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (onNewNotification) {
                        onNewNotification(data);
                    } else {
                        showToast(`🔔 ${data.title}`, 'info', 6000);
                    }
                }
            });
        }, (error) => {
            console.error("[NotificationListener] Error:", error);
        });

        return () => unsubscribe();
    }, [userId, showToast, IS_PROD, onNewNotification]);

    return null;
};

export default NotificationListener;
