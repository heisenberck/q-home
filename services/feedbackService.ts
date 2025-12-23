
import { collection, query, where, limit, onSnapshot, getDocs, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { FeedbackItem, FeedbackReply } from '../types';

const COLLECTION_NAME = 'feedback';

/**
 * Cư dân gửi phản hồi mới
 */
export const submitFeedback = async (feedback: Omit<FeedbackItem, 'id'>) => {
    try {
        const batch = writeBatch(db);
        const feedbackRef = doc(collection(db, COLLECTION_NAME));
        const feedbackId = feedbackRef.id;
        
        batch.set(feedbackRef, { ...feedback, id: feedbackId });

        // Tạo thông báo cho Admin
        const adminNotifRef = doc(collection(db, 'admin_notifications'));
        batch.set(adminNotifRef, {
            id: adminNotifRef.id,
            type: 'message',
            title: `Phản hồi mới từ căn ${feedback.residentId}`,
            message: feedback.subject,
            isRead: false,
            createdAt: serverTimestamp(),
            linkTo: 'feedbackManagement'
        });

        await batch.commit();
        return feedbackId;
    } catch (error) {
        console.error("Lỗi gửi phản hồi:", error);
        throw error;
    }
};

/**
 * Lắng nghe phản hồi "Đang hoạt động" (Pending/Processing)
 * Đã loại bỏ orderBy('date') để tránh lỗi thiếu Index. 
 * Sắp xếp được thực hiện phía Client.
 */
export const subscribeToActiveFeedback = (callback: (feedback: FeedbackItem[]) => void) => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('status', 'in', ['Pending', 'Processing']),
        limit(100) // Tăng limit một chút để cover đủ dữ liệu trước khi sort local
    );

    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as FeedbackItem));
        
        // Sắp xếp phía client: Mới nhất lên đầu
        const sortedItems = items.sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        callback(sortedItems);
    }, (error) => {
        console.error("Lỗi listener feedback:", error);
    });
};

/**
 * Tải phản hồi cũ (Resolved) theo tháng
 * Đã loại bỏ các filter phức tạp gây lỗi Index.
 * Thực hiện lọc theo ngày và sắp xếp phía Client.
 */
export const fetchResolvedFeedback = async (period: string): Promise<FeedbackItem[]> => {
    // Chỉ fetch theo trạng thái để sử dụng index đơn (mặc định)
    const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', 'Resolved'),
        limit(200)
    );
    
    try {
        const snap = await getDocs(q);
        const allResolved = snap.docs.map(d => ({ ...d.data(), id: d.id } as FeedbackItem));
        
        // Lọc theo tháng (period: YYYY-MM) và sắp xếp phía client
        return allResolved
            .filter(item => item.date.startsWith(period))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
        console.error("Lỗi fetch resolved feedback:", error);
        return [];
    }
};

export const replyFeedback = async (
    feedbackId: string, 
    updatedReplies: FeedbackReply[], 
    status: FeedbackItem['status'],
    residentId: string
) => {
    const batch = writeBatch(db);
    const feedbackRef = doc(db, COLLECTION_NAME, feedbackId);

    batch.update(feedbackRef, {
        replies: updatedReplies,
        status: status
    });

    const resNotifRef = doc(collection(db, 'notifications'));
    batch.set(resNotifRef, {
        userId: residentId,
        title: 'BQL đã phản hồi yêu cầu',
        body: status === 'Resolved' ? 'Yêu cầu của bạn đã hoàn thành.' : 'BQL đã gửi tin nhắn mới.',
        type: 'feedback',
        link: 'portalContact',
        isRead: false,
        createdAt: serverTimestamp()
    });

    await batch.commit();
};
