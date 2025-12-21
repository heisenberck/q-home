
import { collection, addDoc, serverTimestamp, query, orderBy, limit, startAfter, getDocs, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

export type LogAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN';
const LOCAL_LOGS_KEY = 'local_activity_logs';

export interface ActivityLogEntry {
    id: string;
    actionType: LogAction;
    module: string;
    description: string;
    timestamp: any; // Date hoặc Firestore Timestamp
    isOptimistic?: boolean; // Đánh dấu bản ghi chưa lên server
    performedBy: {
        uid: string;
        name: string;
        email: string;
    };
}

/**
 * Ghi nhật ký với cơ chế Optimistic UI (Local First)
 */
export const logActivity = async (actionType: LogAction, module: string, description: string) => {
    try {
        const user = auth.currentUser;
        if (!user) return;

        // 1. Tạo Log Object tức thì
        const logId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const optimisticLog: ActivityLogEntry = {
            id: logId,
            actionType,
            module,
            description,
            timestamp: new Date(), // Local time for instant UI
            isOptimistic: true,
            performedBy: {
                uid: user.uid,
                name: user.displayName || 'Nhân viên HUD3',
                email: user.email || ''
            }
        };

        // 2. Lưu vào localStorage (Lưu tối đa 50 logs gần nhất)
        const localLogsRaw = localStorage.getItem(LOCAL_LOGS_KEY);
        let localLogs: ActivityLogEntry[] = localLogsRaw ? JSON.parse(localLogsRaw) : [];
        localLogs = [optimisticLog, ...localLogs].slice(0, 50);
        localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(localLogs));

        // 3. Phát sự kiện để UI cập nhật ngay lập tức
        window.dispatchEvent(new CustomEvent('NEW_LOG_ADDED', { detail: optimisticLog }));

        // 4. Ghi vào Firestore (Background process)
        await addDoc(collection(db, 'activity_logs'), {
            actionType,
            module,
            description,
            timestamp: serverTimestamp(),
            performedBy: optimisticLog.performedBy
        });

    } catch (error) {
        console.error("Lỗi khi ghi nhật ký:", error);
    }
};

/**
 * Lấy danh sách nhật ký từ server
 */
export const fetchLogs = async (lastVisible: QueryDocumentSnapshot<DocumentData> | null = null) => {
    try {
        let q = query(
            collection(db, 'activity_logs'),
            orderBy('timestamp', 'desc'),
            limit(20)
        );

        if (lastVisible) {
            q = query(
                collection(db, 'activity_logs'),
                orderBy('timestamp', 'desc'),
                startAfter(lastVisible),
                limit(20)
            );
        }

        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ActivityLogEntry[];

        return {
            logs,
            lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
            count: snapshot.docs.length
        };
    } catch (error) {
        console.error("Lỗi khi tải nhật ký:", error);
        throw error;
    }
};
