
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface NotificationItem {
    id: string;
    userId: string;
    type: 'bill' | 'news' | 'system';
    title: string;
    body: string;
    isRead: boolean;
    createdAt: any;
    link?: string;
    chargeId?: string;
}

export const useNotifications = (userId: string | undefined) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        // Optimized: Removed 'orderBy' from the server query to avoid requiring a composite index.
        // Single-field index on 'userId' is automatically created by Firestore.
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as NotificationItem[];

            // Handle sorting in memory to bypass index constraints
            const sortedItems = items.sort((a, b) => {
                const timeA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
                const timeB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
                return timeB - timeA;
            });

            setNotifications(sortedItems);
            setLoading(false);
        }, (err) => {
            console.error("Notifications listener error:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    const markAsRead = async (id: string) => {
        try {
            await updateDoc(doc(db, 'notifications', id), { isRead: true });
        } catch (e) {
            console.error("Failed to mark read", e);
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return { notifications, unreadCount, loading, markAsRead };
};
