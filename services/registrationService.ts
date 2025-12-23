
import { collection, query, where, limit, onSnapshot, getDocs, doc, updateDoc, serverTimestamp, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { ServiceRegistration, RegistrationStatus } from '../types';

const COLLECTION_NAME = 'service_registrations';

/**
 * Cư dân gửi yêu cầu đăng ký mới
 */
export const submitServiceRegistration = async (registration: Omit<ServiceRegistration, 'id'>) => {
    try {
        const batch = writeBatch(db);
        const regRef = doc(collection(db, COLLECTION_NAME));
        const regId = regRef.id;
        
        const data = { ...registration, id: regId };
        batch.set(regRef, data);

        // Thông báo cho Admin
        const adminNotifRef = doc(collection(db, 'admin_notifications'));
        const title = registration.type === 'Construction' ? 'Yêu cầu thi công mới' : 'Yêu cầu gửi xe mới';
        batch.set(adminNotifRef, {
            id: adminNotifRef.id,
            type: 'request',
            title: `${title} - Căn ${registration.residentId}`,
            message: registration.type === 'Construction' 
                ? registration.details.constructionItem 
                : `${registration.details.model} - ${registration.details.plate}`,
            isRead: false,
            createdAt: serverTimestamp(),
            linkTo: 'serviceRegistration'
        });

        await batch.commit();
        return regId;
    } catch (error) {
        console.error("Lỗi gửi đăng ký:", error);
        throw error;
    }
};

/**
 * Lắng nghe danh sách đăng ký cho Admin
 */
export const subscribeToRegistrations = (callback: (items: ServiceRegistration[]) => void) => {
    const q = query(collection(db, COLLECTION_NAME));

    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(d => ({ ...d.data() } as ServiceRegistration));
        // Sắp xếp: Pending lên đầu, sau đó mới nhất lên đầu
        const sorted = items.sort((a, b) => {
            if (a.status === 'Pending' && b.status !== 'Pending') return -1;
            if (a.status !== 'Pending' && b.status === 'Pending') return 1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        callback(sorted);
    }, (error) => {
        console.error("Lỗi listener registration:", error);
    });
};

/**
 * Xử lý duyệt/từ chối đăng ký
 */
export const processRegistrationAction = async (
    regId: string, 
    status: RegistrationStatus, 
    adminNote: string, 
    adminEmail: string,
    residentId: string
) => {
    const batch = writeBatch(db);
    const regRef = doc(db, COLLECTION_NAME, regId);

    const updateData: any = {
        status: status,
        rejectionReason: adminNote,
        processedBy: adminEmail,
        processedAt: new Date().toISOString()
    };

    batch.update(regRef, updateData);

    // Thông báo cho cư dân
    const resNotifRef = doc(collection(db, 'notifications'));
    const statusText = status === 'Approved' ? 'đã được DUYỆT' : 'bị TỪ CHỐI';
    
    batch.set(resNotifRef, {
        userId: residentId,
        title: `Yêu cầu dịch vụ ${statusText}`,
        body: adminNote || `BQL đã xử lý yêu cầu của bạn. Vui lòng kiểm tra chi tiết.`,
        type: 'system',
        link: 'portalContact', // Quay lại trang lịch sử để xem kết quả
        isRead: false,
        createdAt: serverTimestamp()
    });

    await batch.commit();
};
