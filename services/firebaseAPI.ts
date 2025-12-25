
import { 
    doc, getDoc, setDoc, collection, getDocs, writeBatch, query, 
    deleteDoc, updateDoc, limit, orderBy, where, serverTimestamp, 
    addDoc, Timestamp, getCountFromServer, or, and
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { 
    InvoiceSettings, Unit, Owner, Vehicle, WaterReading, 
    ChargeRaw, Adjustment, UserPermission, ActivityLog, 
    AllData, PaymentStatus, MonthlyStat, SystemMetadata, 
    ProfileRequest, TariffCollection, AdminNotification,
    Role, NewsItem
} from '../types';

// Tăng tốc độ đọc bằng cách sử dụng bộ nhớ đệm nội bộ cho các cấu hình ít thay đổi
let settingsCache: { invoice?: InvoiceSettings, tariffs?: TariffCollection } = {};

export const fetchInvoiceSettings = async (): Promise<InvoiceSettings | null> => {
    if (settingsCache.invoice) return settingsCache.invoice;
    const snap = await getDoc(doc(db, 'settings', 'invoice'));
    if (snap.exists()) {
        settingsCache.invoice = snap.data() as InvoiceSettings;
        return settingsCache.invoice;
    }
    return null;
};

export const fetchTariffsData = async (): Promise<TariffCollection> => {
    if (settingsCache.tariffs) return settingsCache.tariffs;
    const snap = await getDoc(doc(db, 'settings', 'tariffs'));
    const data = snap.exists() ? snap.data() as TariffCollection : { service: [], parking: [], water: [] };
    settingsCache.tariffs = data;
    return data;
};

export const getSystemMetadata = async (): Promise<SystemMetadata> => {
    const snap = await getDoc(doc(db, 'settings', 'metadata'));
    if (snap.exists()) return snap.data() as SystemMetadata;
    return { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };
};

// Luôn sử dụng LIMIT để bảo vệ quota
export const fetchActiveCharges = async (periods: string[]): Promise<ChargeRaw[]> => {
    if (periods.length === 0) return [];
    const chargesRef = collection(db, 'charges');
    // Chỉ lấy các kỳ đang yêu cầu hoặc các kỳ nợ đọng
    const q = query(
        chargesRef, 
        or(
            where('Period', 'in', periods), 
            where('paymentStatus', 'in', ['unpaid', 'reconciling', 'pending'])
        ),
        limit(500) 
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ChargeRaw);
};

export const fetchChargesForResident = async (residentId: string): Promise<ChargeRaw[]> => {
    // Chỉ lấy tối đa 6 tháng gần nhất cho portal cư dân để tiết kiệm read
    const q = query(collection(db, 'charges'), where('UnitID', '==', residentId), orderBy('Period', 'desc'), limit(6));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ChargeRaw);
};

export const fetchLatestLogs = async (limitCount: number = 20): Promise<ActivityLog[]> => {
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return { 
            id: d.id, 
            ts: data.timestamp instanceof Timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString(), 
            actor_email: data.performedBy?.email || 'system', 
            summary: data.description || '', 
            module: data.module || 'System', 
            action: data.actionType || 'UPDATE' 
        } as any;
    });
};

export const fetchNews = async (): Promise<NewsItem[]> => {
    // Chỉ lấy các tin tức chưa lưu trữ để giảm payload
    const q = query(collection(db, 'news'), where('isArchived', '==', false), orderBy('date', 'desc'), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem));
};

export const fetchRecentWaterReadings = async (periods: string[]): Promise<WaterReading[]> => {
    if (periods.length === 0) return [];
    const q = query(collection(db, 'waterReadings'), where('Period', 'in', periods), limit(1000));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WaterReading);
};

export const fetchCollection = async <T>(colName: string): Promise<T[]> => {
    // Giới hạn số lượng bản ghi tối đa khi fetch toàn bộ collection (Safety limit)
    const snap = await getDocs(query(collection(db, colName), limit(1000)));
    return snap.docs.map(d => d.data() as T);
};

export const updateFeeSettings = async (settings: InvoiceSettings) => {
    settingsCache.invoice = settings; // Update local cache
    return setDoc(doc(db, 'settings', 'invoice'), settings, { merge: true });
};
