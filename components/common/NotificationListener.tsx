
import React, { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNotification } from '../../App';

interface NotificationListenerProps {
    userId: string;
}

const NotificationListener: React.FC<NotificationListenerProps> = ({ userId }) => {
    const { showToast } = useNotification();
    const isFirstLoad = useRef(true);

    useEffect(() => {
        if (!userId) return;

        // Optimized: Query by userId only. 
        // Adding where('isRead', '==', false) and orderBy('createdAt') requires a composite index.
        // For reliability across all project tiers without manual setup, we handle filters in memory.
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId)
        );

        console.log(`[NotificationListener] Subscribing for user: ${userId}`);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (isFirstLoad.current) {
                isFirstLoad.current = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                // Only alert on newly added notifications that are unread
                if (change.type === 'added') {
                    const data = change.doc.data();
                    
                    if (data.isRead === false) {
                        let message = `🔔 ${data.title}`;
                        if (data.type === 'bill') {
                            message = `🔔 ${data.title}: ${data.body}`;
                        } else if (data.type === 'news') {
                            message = `📰 Tin mới: ${data.title}`;
                        }
                        
                        showToast(message, 'info', 6000);
                    }
                }
            });
        }, (error) => {
            console.error("[NotificationListener] Error:", error);
        });

        return () => {
            console.log(`[NotificationListener] Unsubscribing for user: ${userId}`);
            unsubscribe();
        };
    }, [userId, showToast]);

    return null;
};

export default NotificationListener;
