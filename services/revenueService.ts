
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { MiscRevenue } from '../types';

const COLLECTION_NAME = 'misc_revenues';

/**
 * Thêm một khoản doanh thu GTGT mới
 */
export const addMiscRevenue = async (data: Omit<MiscRevenue, 'id' | 'createdAt'>): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...data,
            createdAt: new Date().toISOString()
        });
        // Cập nhật lại ID vào chính document vừa tạo
        const id = docRef.id;
        return id;
    } catch (error) {
        console.error("Error adding revenue:", error);
        throw error;
    }
};

/**
 * Lấy danh sách doanh thu theo tháng
 */
export const getMonthlyMiscRevenues = async (month: string): Promise<MiscRevenue[]> => {
    try {
        // Truy vấn đơn giản theo khoảng ngày để tránh yêu cầu Composite Index
        const q = query(
            collection(db, COLLECTION_NAME),
            where('date', '>=', month),
            where('date', '<=', month + '\uf8ff'),
            orderBy('date', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as MiscRevenue));
    } catch (error) {
        console.error("Error fetching revenues:", error);
        throw error;
    }
};

/**
 * Xóa một khoản doanh thu
 */
export const deleteMiscRevenue = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
        console.error("Error deleting revenue:", error);
        throw error;
    }
};
