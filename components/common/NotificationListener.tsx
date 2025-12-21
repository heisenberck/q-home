
import React, { useEffect, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNotification } from '../../App';

interface NotificationListenerProps {
    userId: string;
}

// FIX: Added React import to resolve "Cannot find namespace 'React'" error
const NotificationListener: React.FC<NotificationListenerProps> = ({ userId }) => {
    const { showToast } = useNotification();
    const isFirstLoad = useRef(true);

    useEffect(() => {
        if (!userId) return;

        // Truy vấn này yêu cầu Composite Index: userId (ASC), isRead (ASC), createdAt (DESC)
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
                    let message = `🔔 ${data.title}`;
                    if (data.type === 'bill') {
                        message = `🔔 ${data.title}: ${data.body}`;
                    } else if (data.type === 'news') {
                        message = `📰 Tin mới: ${data.title}`;
                    }
                    showToast(message, 'info', 6000);
                }
            });
        }, (error) => {
            console.error("[NotificationListener] Firestore Error:", error);
            if (error.message.includes("requires an index")) {
                console.warn(
                    "NOTICE: Hệ thống thông báo Cư dân yêu cầu chỉ mục Firestore. Click vào link trong lỗi console để tạo."
                );
            }
        });

        return () => unsubscribe();
    }, [userId, showToast]);

    return null;
};

export default NotificationListener;
