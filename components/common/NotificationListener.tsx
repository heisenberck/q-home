
import React, { useEffect, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
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

        // OPTIMIZATION: Limit to 10 to prevent quota explosion
        // Only fetch UNREAD notifications to keep the active set small
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('isRead', '==', false),
            orderBy('createdAt', 'desc'),
            limit(10) 
        );

        console.log(`[NotificationListener] Subscribing for user: ${userId}`);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Handle first load to avoid spamming toasts for existing unread messages
            if (isFirstLoad.current) {
                isFirstLoad.current = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    
                    // Customize message based on type
                    let message = `🔔 ${data.title}`;
                    if (data.type === 'bill') {
                        // Special format for bills
                        message = `🔔 ${data.title}: ${data.body}`;
                    } else if (data.type === 'news') {
                        message = `📰 Tin mới: ${data.title}`;
                    }
                    
                    showToast(message, 'info', 6000);
                }
            });
        }, (error) => {
            console.error("[NotificationListener] Error:", error);
            if (error.message.includes("indexes")) {
                console.warn("FIRESTORE INDEX MISSING: Click the link in the console error above to create the required composite index.");
            }
        });

        // CRITICAL: Cleanup function to prevent infinite loops
        return () => {
            unsubscribe();
        };
    }, [userId, showToast]); // Strict dependency array

    return null; // Headless component
};

export default NotificationListener;
