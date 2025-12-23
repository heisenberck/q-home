
import { collection, addDoc, getDocs, query, where, updateDoc, doc, serverTimestamp, writeBatch, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { FeedbackItem, FeedbackReply } from '../types';

const FEEDBACK_COL = 'feedback';
const ADMIN_NOTIF_COL = 'admin_notifications';
const RESIDENT_NOTIF_COL = 'notifications';

/**
 * Cư dân gửi phản hồi mới
 * Tạo feedback + Gửi thông báo cho Admin
 */
export const submitFeedback = async (feedback: Omit<FeedbackItem, 'id'>) => {
    try {
        const batch = writeBatch(db);
        
        // 1. Tạo bản ghi feedback
        const feedbackRef = doc(collection(db, FEEDBACK_COL));
        const feedbackId = feedbackRef.id;
        batch.set(feedbackRef, { ...feedback, id: feedbackId });

        // 2. Tạo thông báo cho Admin (để rung chuông)
        const adminNotifRef = doc(collection(db, ADMIN_NOTIF_COL));
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
 * Admin cập nhật trạng thái hoặc trả lời phản hồi
 * Cập nhật feedback + Gửi thông báo cho Cư dân
 */
export const replyFeedback = async (
    feedbackId: string, 
    updatedReplies: FeedbackReply[], 
    status: FeedbackItem['status'],
    residentId: string
) => {
    try {
        const batch = writeBatch(db);
        const feedbackRef = doc(db, FEEDBACK_COL, feedbackId);

        // 1. Cập nhật dữ liệu trả lời
        batch.update(feedbackRef, {
            replies: updatedReplies,
            status: status
        });

        // 2. Thông báo cho cư dân trong App
        const resNotifRef = doc(collection(db, RESIDENT_NOTIF_COL));
        batch.set(resNotifRef, {
            userId: residentId,
            title: 'Phản hồi từ Ban Quản Lý',
            body: status === 'Resolved' ? 'Yêu cầu của bạn đã được giải quyết.' : 'BQL đã trả lời tin nhắn của bạn.',
            type: 'feedback',
            link: 'portalContact',
            isRead: false,
            createdAt: serverTimestamp()
        });

        await batch.commit();
    } catch (error) {
        console.error("Lỗi trả lời phản hồi:", error);
        throw error;
    }
};

export const fetchAllFeedback = async (): Promise<FeedbackItem[]> => {
    const q = query(collection(db, FEEDBACK_COL), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as FeedbackItem);
};
