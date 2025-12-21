
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
    callback: (notifications: AdminNotification[]) => void,
    onError?: (error: any) => void
) => {
    // Truy vấn này yêu cầu Composite Index: isRead (ASC), createdAt (DESC)
    // Nếu chưa tạo index, Firestore sẽ trả về lỗi kèm link trực tiếp trong console
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
        console.error("Firestore Error [admin_notifications]:", error);
        
        if (error.message.includes("requires an index")) {
            console.warn(
                "CRITICAL: Hệ thống thông báo Admin yêu cầu chỉ mục Firestore (Composite Index).\n" +
                "Vui lòng click vào link trong thông báo lỗi màu đỏ phía trên để tạo index tự động."
            );
        }
        
        if (onError) onError(error);
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
 * Đánh dấu tất cả thông báo hiện tại là đã đọc (sử dụng Batch)
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
