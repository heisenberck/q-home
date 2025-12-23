
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { OperationalExpense, ExpenseCategory } from '../types';

const COLLECTION_NAME = 'operational_expenses';

/**
 * Thêm một khoản chi phí mới
 */
export const addExpense = async (data: Omit<OperationalExpense, 'id' | 'createdAt'>): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...data,
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding expense:", error);
        throw error;
    }
};

/**
 * Lấy danh sách chi phí theo tháng
 */
export const getExpensesByMonth = async (month: string): Promise<OperationalExpense[]> => {
    try {
        // Query format: date starts with "YYYY-MM"
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
        } as OperationalExpense));
    } catch (error) {
        console.error("Error fetching expenses:", error);
        throw error;
    }
};

/**
 * Xóa một khoản chi phí
 */
export const deleteExpense = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
        console.error("Error deleting expense:", error);
        throw error;
    }
};
