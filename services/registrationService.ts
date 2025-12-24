
import { collection, query, where, limit, onSnapshot, getDocs, doc, updateDoc, serverTimestamp, writeBatch, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { ServiceRegistration, RegistrationStatus } from '../types';

const COLLECTION_NAME = 'service_registrations';

export const submitServiceRegistration = async (registration: Omit<ServiceRegistration, 'id'>) => {
    try {
        const batch = writeBatch(db);
        const regRef = doc(collection(db, COLLECTION_NAME));
        const regId = regRef.id;
        
        batch.set(regRef, { ...registration, id: regId });

        const adminNotifRef = doc(collection(db, 'admin_notifications'));
        batch.set(adminNotifRef, {
            id: adminNotifRef.id,
            type: 'request',
            title: `Yêu cầu mới - Căn ${registration.residentId}`,
            message: registration.type === 'Construction' ? 'Đăng ký thi công' : 'Đăng ký phương tiện',
            isRead: false,
            createdAt: serverTimestamp(),
            linkTo: 'serviceRegistration'
        });

        await batch.commit();
        return regId;
    } catch (error) {
        throw error;
    }
};

/**
 * TỐI ƯU: Chỉ lắng nghe các yêu cầu Chưa xử lý (Pending) + 20 yêu cầu gần nhất
 */
export const subscribeToRegistrations = (callback: (items: ServiceRegistration[]) => void) => {
    // Chỉ lấy 50 mục gần nhất/đang chờ để tiết kiệm Read
    const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('date', 'desc'),
        limit(50)
    );

    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(d => ({ ...d.data() } as ServiceRegistration));
        // Sắp xếp local để đưa Pending lên đầu
        const sorted = items.sort((a, b) => {
            if (a.status === 'Pending' && b.status !== 'Pending') return -1;
            if (a.status !== 'Pending' && b.status === 'Pending') return 1;
            return 0;
        });
        callback(sorted);
    });
};

export const processRegistrationAction = async (regId: string, status: RegistrationStatus, adminNote: string, adminEmail: string, residentId: string) => {
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTION_NAME, regId), {
        status: status,
        rejectionReason: adminNote,
        processedBy: adminEmail,
        processedAt: new Date().toISOString()
    });

    const resNotifRef = doc(collection(db, 'notifications'));
    batch.set(resNotifRef, {
        userId: residentId,
        title: `Yêu cầu dịch vụ ${status === 'Approved' ? 'ĐÃ DUYỆT' : 'BỊ TỪ CHỐI'}`,
        body: adminNote || `BQL đã xử lý yêu cầu của bạn.`,
        type: 'system',
        link: 'portalContact',
        isRead: false,
        createdAt: serverTimestamp()
    });

    await batch.commit();
};
