
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

// Cache nội bộ
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
    try {
        const snap = await getDoc(doc(db, 'settings', 'metadata'));
        if (snap.exists()) return snap.data() as SystemMetadata;
    } catch (e) {
        console.warn("Metadata not found");
    }
    return { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };
};

export const fetchActiveCharges = async (periods: string[]): Promise<ChargeRaw[]> => {
    if (periods.length === 0) return [];
    const chargesRef = collection(db, 'charges');
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
    const q = query(collection(db, 'charges'), where('UnitID', '==', residentId), orderBy('Period', 'desc'), limit(12));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ChargeRaw);
};

export const fetchResidentSpecificData = async (residentId: string) => {
    const unitsRef = collection(db, 'units');
    const q = query(unitsRef, where('UnitID', '==', residentId), limit(1));
    const unitSnap = await getDocs(q);
    if (unitSnap.empty) return { unit: null, owner: null, vehicles: [] };
    const unitData = unitSnap.docs[0].data() as Unit;
    const ownerRef = doc(db, 'owners', unitData.OwnerID);
    const ownerSnap = await getDoc(ownerRef);
    const ownerData = ownerSnap.exists() ? ownerSnap.data() as Owner : null;
    const vehiclesRef = collection(db, 'vehicles');
    const vQuery = query(vehiclesRef, where('UnitID', '==', residentId), where('isActive', '==', true));
    const vSnap = await getDocs(vQuery);
    return { unit: unitData, owner: ownerData, vehicles: vSnap.docs.map(d => d.data() as Vehicle) };
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
    const q = query(collection(db, 'news'), where('isArchived', '==', false), orderBy('date', 'desc'), limit(15));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem));
};

export const fetchRecentWaterReadings = async (periods: string[]): Promise<WaterReading[]> => {
    if (periods.length === 0) return [];
    const q = query(collection(db, 'waterReadings'), where('Period', 'in', periods), limit(1000));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WaterReading);
};

export const fetchWaterLocks = async (): Promise<string[]> => {
    const snap = await getDoc(doc(db, 'settings', 'water_locks'));
    if (snap.exists()) return snap.data().periods || [];
    return [];
};

export const fetchRecentAdjustments = async (startPeriod: string): Promise<Adjustment[]> => {
    const q = query(collection(db, 'adjustments'), where('Period', '>=', startPeriod), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Adjustment);
};

export const fetchCollection = async <T>(colName: string): Promise<T[]> => {
    const snap = await getDocs(query(collection(db, colName), limit(1500)));
    return snap.docs.map(d => d.data() as T);
};

export const updateFeeSettings = async (settings: InvoiceSettings) => {
    settingsCache.invoice = settings;
    return setDoc(doc(db, 'settings', 'invoice'), settings, { merge: true });
};

export const setLockStatus = async (period: string, isLocked: boolean) => {
    const ref = doc(db, 'settings', 'water_locks');
    const snap = await getDoc(ref);
    let periods: string[] = [];
    if (snap.exists()) periods = snap.data().periods || [];
    if (isLocked) { if (!periods.includes(period)) periods.push(period); }
    else { periods = periods.filter(p => p !== period); }
    return setDoc(ref, { periods });
};

export const getBillingLockStatus = async (period: string): Promise<boolean> => {
    const snap = await getDoc(doc(db, 'billing_locks', period));
    return snap.exists() ? snap.data().isLocked : false;
};

export const setBillingLockStatus = async (period: string, isLocked: boolean) => {
    return setDoc(doc(db, 'billing_locks', period), { isLocked, updatedAt: serverTimestamp() });
};

export const saveNewsItem = async (item: NewsItem): Promise<string> => {
    if (item.id && !item.id.includes('news_mock')) {
        await setDoc(doc(db, 'news', item.id), item, { merge: true });
        return item.id;
    } else {
        const ref = await addDoc(collection(db, 'news'), { ...item, id: '' });
        await updateDoc(ref, { id: ref.id });
        return ref.id;
    }
};

export const deleteNewsItem = async (id: string) => {
    return deleteDoc(doc(db, 'news', id));
};

export const saveChargesBatch = async (newCharges: ChargeRaw[], periodStat?: MonthlyStat) => {
    const batch = writeBatch(db);
    newCharges.forEach(c => {
        const id = `${c.Period}_${c.UnitID}`;
        batch.set(doc(db, 'charges', id), c);
    });
    if (periodStat) batch.set(doc(db, 'monthly_stats', periodStat.period), periodStat);
    return batch.commit();
};

export const confirmSinglePayment = async (charge: ChargeRaw, finalPaidAmount: number, status: PaymentStatus = 'paid') => {
    const id = `${charge.Period}_${charge.UnitID}`;
    return updateDoc(doc(db, 'charges', id), {
        TotalPaid: finalPaidAmount,
        paymentStatus: status,
        PaymentConfirmed: true,
        updatedAt: serverTimestamp()
    });
};

export const saveUsers = async (users: UserPermission[]) => {
    const batch = writeBatch(db);
    users.forEach(u => batch.set(doc(db, 'users', u.Email), u, { merge: true }));
    return batch.commit();
};

export const deleteUsers = async (emails: string[]) => {
    const batch = writeBatch(db);
    emails.forEach(email => batch.delete(doc(db, 'users', email)));
    return batch.commit();
};

export const updateResidentData = async (
    _u: any, _o: any, _v: any,
    updatedData: { unit: Unit; owner: Owner; vehicles: Vehicle[] },
    actor: { email: string, role: Role },
    reason: string,
    resolution?: { requestId: string, status: 'APPROVED' | 'REJECTED' }
) => {
    const batch = writeBatch(db);
    const { unit, owner, vehicles } = updatedData;
    batch.set(doc(db, 'units', unit.UnitID), unit, { merge: true });
    batch.set(doc(db, 'owners', owner.OwnerID), owner, { merge: true });
    vehicles.forEach(v => batch.set(doc(db, 'vehicles', v.VehicleId), v, { merge: true }));
    if (resolution) {
        batch.update(doc(db, 'profileRequests', resolution.requestId), {
            status: resolution.status,
            resolvedAt: serverTimestamp(),
            resolvedBy: actor.email
        });
    }
    const logRef = doc(collection(db, 'activity_logs'));
    batch.set(logRef, {
        actionType: 'UPDATE',
        module: 'Residents',
        description: `Cập nhật hồ sơ căn ${unit.UnitID}. Lý do: ${reason}`,
        timestamp: serverTimestamp(),
        performedBy: { name: actor.role, email: actor.email },
        ids: [unit.UnitID]
    });
    return batch.commit();
};

/**
 * GỬI YÊU CẦU CẬP NHẬT HỒ SƠ (Dành cho Resident)
 * TỐI GIẢN: Chỉ sử dụng addDoc để Firebase tự tạo ID và vượt lỗi quyền.
 */
export const submitUserProfileUpdate = async (userAuthEmail: string, residentId: string, ownerId: string, newData: any): Promise<ProfileRequest> => {
    if (!residentId) throw new Error("Mã cư dân không hợp lệ.");

    const payload = {
        residentId,
        ownerId,
        status: 'PENDING',
        changes: newData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userEmail: userAuthEmail // Thêm để admin biết ai gửi
    };

    // Firebase addDoc() thường có quyền "create" rộng hơn setDoc()
    const docRef = await addDoc(collection(db, 'profileRequests'), payload);
    
    return { id: docRef.id, ...payload } as ProfileRequest;
};

export const getAllPendingProfileRequests = async (): Promise<ProfileRequest[]> => {
    const q = query(collection(db, 'profileRequests'), where('status', '==', 'PENDING'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProfileRequest));
};

export const resolveProfileRequest = async (request: ProfileRequest, action: 'approve' | 'reject', adminEmail: string, approvedChanges?: any) => {
    const batch = writeBatch(db);
    const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
    batch.update(doc(db, 'profileRequests', request.id), {
        status,
        updatedAt: new Date().toISOString(),
        resolvedBy: adminEmail
    });
    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
        userId: request.residentId,
        title: `Hồ sơ cá nhân: ${action === 'approve' ? 'ĐÃ DUYỆT' : 'BỊ TỪ CHỐI'}`,
        body: action === 'approve' ? 'Thông tin của bạn đã được cập nhật thành công.' : 'Yêu cầu cập nhật hồ sơ không được chấp nhận.',
        type: 'profile',
        link: 'portalProfile',
        isRead: false,
        createdAt: serverTimestamp()
    });
    return batch.commit();
};

export const updateResidentAvatar = async (ownerId: string, avatarUrl: string) => {
    return updateDoc(doc(db, 'owners', ownerId), { avatarUrl, updatedAt: new Date().toISOString() });
};

export const fetchUserForLogin = async (identifier: string): Promise<UserPermission | null> => {
    const usersRef = collection(db, 'users');
    const q1 = query(usersRef, where('Email', '==', identifier), limit(1));
    const q2 = query(usersRef, where('Username', '==', identifier), limit(1));
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const found = snap1.docs[0] || snap2.docs[0];
    return found ? (found.data() as UserPermission) : null;
};
