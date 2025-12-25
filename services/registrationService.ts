
import { collection, query, where, limit, getDocs, doc, serverTimestamp, writeBatch, orderBy } from 'firebase/firestore';
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
 * TỐI ƯU: Sử dụng getDocs thay vì onSnapshot. 
 * Đăng ký dịch vụ không cần cập nhật tức thời theo giây, giúp tiết kiệm chi phí Firestore đáng kể.
 */
export const fetchRegistrations = async (): Promise<ServiceRegistration[]> => {
    const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('date', 'desc'),
        limit(50)
    );

    try {
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(d => ({ ...d.data() } as ServiceRegistration));
        
        return items.sort((a, b) => {
            if (a.status === 'Pending' && b.status !== 'Pending') return -1;
            if (a.status !== 'Pending' && b.status === 'Pending') return 1;
            return 0;
        });
    } catch (error) {
        console.error("Lỗi fetch registrations:", error);
        return [];
    }
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
