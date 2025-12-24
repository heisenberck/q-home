
import { 
    collection, query, where, orderBy, limit, 
    onSnapshot, doc, updateDoc, writeBatch 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { AdminNotification } from '../types';

const COLLECTION_NAME = 'admin_notifications';

/**
 * Lắng nghe thông báo chưa đọc (Real-time) cho Admin
 * Giới hạn 20 mục để tối ưu hiệu năng và chi phí Firestore
 */
export const subscribeToUnreadNotifications = (
    callback: (notifications: AdminNotification[]) => void
) => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('isRead', '==', false),
        orderBy('createdAt', 'desc'),
        limit(20)
    );

    return onSnapshot(q, (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AdminNotification));
        callback(notifications);
    }, (error) => {
        console.warn("Permission Error in Admin Notifications:", error.message);
        callback([]);
    });
};

/**
 * Đánh dấu một thông báo là đã đọc
 */
export const markAsRead = async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return updateDoc(docRef, { isRead: true });
};

/**
 * Đánh dấu tất cả thông báo hiện tại là đã đọc (sử dụng Batch để tiết kiệm network)
 */
export const markAllAsRead = async (notificationIds: string[]) => {
    if (notificationIds.length === 0) return;
    
    const batch = writeBatch(db);
    notificationIds.forEach(id => {
        const docRef = doc(db, COLLECTION_NAME, id);
        batch.update(docRef, { isRead: true });
    });
    
    return batch.commit();
};
