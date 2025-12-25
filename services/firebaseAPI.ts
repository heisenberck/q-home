
import { 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    getDocs, 
    writeBatch, 
    query, 
    deleteDoc, 
    updateDoc, 
    limit, 
    orderBy, 
    where, 
    serverTimestamp, 
    addDoc,
    Timestamp,
    getCountFromServer,
    or,
    and
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { 
    InvoiceSettings, Unit, Owner, Vehicle, WaterReading, 
    ChargeRaw, Adjustment, UserPermission, ActivityLog, 
    AllData, PaymentStatus, MonthlyStat, SystemMetadata, 
    ProfileRequest, TariffCollection, AdminNotification,
    Role, NewsItem
} from '../types';

const METADATA_DOC_ID = 'metadata';
const SETTINGS_COLLECTION = 'settings';

export const getSystemMetadata = async (): Promise<SystemMetadata> => {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, METADATA_DOC_ID));
    if (snap.exists()) return snap.data() as SystemMetadata;
    return { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };
};

const bumpVersion = (batch: any, field: keyof SystemMetadata) => {
    const metaRef = doc(db, SETTINGS_COLLECTION, METADATA_DOC_ID);
    batch.set(metaRef, { [field]: Date.now() }, { merge: true });
};

const injectLogAndNotif = (batch: any, log: any) => {
    const logRef = doc(collection(db, 'activity_logs'));
    const logData = { 
        id: logRef.id, 
        actionType: log.action || 'UPDATE', 
        module: log.module || 'System', 
        description: log.summary || '', 
        timestamp: serverTimestamp(), 
        performedBy: { 
            email: log.actor_email || 'system', 
            name: log.actor_name || 'Quản trị viên', 
            uid: 'system' 
        } 
    };
    batch.set(logRef, logData);

    const notifRef = doc(collection(db, 'admin_notifications'));
    const notifData: AdminNotification = { 
        id: notifRef.id, 
        type: log.type || 'system', 
        title: log.title || 'Cập nhật hệ thống', 
        message: log.summary || '', 
        isRead: false, 
        createdAt: serverTimestamp(),
        linkTo: log.linkTo || '' // Fix: Đảm bảo không undefined
    };
    batch.set(notifRef, notifData);
};

export const fetchActiveCharges = async (periods: string[]): Promise<ChargeRaw[]> => {
    const chargesRef = collection(db, 'charges');
    const q = query(chargesRef, or(where('Period', 'in', periods), where('paymentStatus', '==', 'unpaid'), where('paymentStatus', '==', 'reconciling')));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ChargeRaw);
};

export const getDashboardCounts = async () => {
    const unitsRef = collection(db, 'units');
    const vehiclesRef = collection(db, 'vehicles');
    const [unitsSnap, vehiclesSnap, waitingVehiclesSnap] = await Promise.all([
        getCountFromServer(unitsRef),
        getCountFromServer(query(vehiclesRef, where('isActive', '==', true))),
        getCountFromServer(query(vehiclesRef, and(where('isActive', '==', true), where('parkingStatus', '==', 'Xếp lốt'))))
    ]);
    return { totalUnits: unitsSnap.data().count, activeVehicles: vehiclesSnap.data().count, waitingVehicles: waitingVehiclesSnap.data().count };
};

export const fetchUserForLogin = async (identifier: string): Promise<UserPermission | null> => {
    const cleanId = identifier.trim().toLowerCase();
    const qUsername = query(collection(db, 'users'), where('Username', '==', cleanId), limit(1));
    const snapUsername = await getDocs(qUsername);
    if (!snapUsername.empty) return snapUsername.docs[0].data() as UserPermission;
    const qEmail = query(collection(db, 'users'), where('Email', '==', cleanId), limit(1));
    const snapEmail = await getDocs(qEmail);
    if (!snapEmail.empty) return snapEmail.docs[0].data() as UserPermission;
    const qContact = query(collection(db, 'users'), where('contact_email', '==', cleanId), limit(1));
    const snapContact = await getDocs(qContact);
    if (!snapContact.empty) return snapContact.docs[0].data() as UserPermission;
    return null;
};

export const fetchChargesForResident = async (residentId: string): Promise<ChargeRaw[]> => {
    const q = query(collection(db, 'charges'), where('UnitID', '==', residentId), orderBy('Period', 'desc'), limit(12));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ChargeRaw);
};

export const fetchResidentSpecificData = async (residentId: string) => {
    const unitSnap = await getDoc(doc(db, 'units', residentId));
    if (!unitSnap.exists()) return { unit: null, owner: null, vehicles: [] };
    const unit = unitSnap.data() as Unit;
    const ownerSnap = await getDoc(doc(db, 'owners', unit.OwnerID));
    const owner = ownerSnap.exists() ? ownerSnap.data() as Owner : null;
    const vq = query(collection(db, 'vehicles'), where('UnitID', '==', residentId), where('isActive', '==', true));
    const vSnap = await getDocs(vq);
    const vehicles = vSnap.docs.map(d => d.data() as Vehicle);
    return { unit, owner, vehicles };
};

export const fetchNews = async (): Promise<NewsItem[]> => {
    const q = query(collection(db, 'news'), orderBy('date', 'desc'), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem));
};

export const saveNewsItem = async (item: NewsItem): Promise<string> => {
    const { id, ...data } = item;
    if (id && !id.startsWith('news_mock')) { await setDoc(doc(db, 'news', id), data, { merge: true }); return id; }
    else { const docRef = await addDoc(collection(db, 'news'), data); return docRef.id; }
};

export const deleteNewsItem = async (id: string): Promise<void> => { await deleteDoc(doc(db, 'news', id)); };
export const updateUserProfile = async (email: string, updates: Partial<UserPermission>) => { const userRef = doc(db, 'users', email); await updateDoc(userRef, updates); };

/**
 * Hàm cập nhật dữ liệu cư dân hợp nhất: 
 * Xử lý Unit, Owner, Vehicles và đóng ProfileRequest (resolution) trong cùng một Batch.
 */
export const updateResidentData = async (
    currentUnits: Unit[], 
    currentOwners: Owner[], 
    currentVehicles: Vehicle[], 
    data: { unit: Unit; owner: Owner; vehicles: Vehicle[] }, 
    actor?: { email: string, role: Role }, 
    reason?: string,
    resolution?: { requestId: string, status: 'APPROVED' | 'REJECTED' }
) => {
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    // 1. Cập nhật Unit & Owner
    batch.set(doc(db, 'units', data.unit.UnitID), data.unit, { merge: true });
    batch.set(doc(db, 'owners', data.owner.OwnerID), data.owner, { merge: true });

    // 2. Cập nhật Phương tiện
    const activeIds = new Set<string>();
    data.vehicles.forEach(v => {
        let vId = v.VehicleId;
        let vSave = { ...v, isActive: true, updatedAt: now };
        if (!vId || vId.startsWith('VEH_NEW_')) { 
            const newRef = doc(collection(db, "vehicles")); 
            vSave.VehicleId = newRef.id; 
            batch.set(newRef, vSave); 
            activeIds.add(newRef.id); 
        } else { 
            batch.set(doc(db, 'vehicles', vId), vSave, { merge: true }); 
            activeIds.add(vId); 
        }
    });
    currentVehicles.filter(v => v.UnitID === data.unit.UnitID && v.isActive && !activeIds.has(v.VehicleId)).forEach(v => { 
        batch.update(doc(db, 'vehicles', v.VehicleId), { isActive: false, updatedAt: now }); 
    });

    // 3. Đóng ProfileRequest - QUAN TRỌNG ĐỂ XÓA DẤU HIỆU PENDING
    if (resolution) {
        batch.update(doc(db, 'profileRequests', resolution.requestId), { 
            status: resolution.status, 
            updatedAt: now 
        });

        // Gửi thông báo chuông cho cư dân
        batch.set(doc(collection(db, 'notifications')), {
            userId: data.unit.UnitID,
            title: resolution.status === 'APPROVED' ? 'Yêu cầu cập nhật đã được duyệt' : 'Yêu cầu cập nhật bị từ chối',
            body: resolution.status === 'APPROVED' ? 'Thông tin cá nhân của bạn đã được BQL cập nhật chính thức.' : 'Rất tiếc, yêu cầu thay đổi thông tin của bạn không được phê duyệt.',
            type: 'profile',
            link: 'portalProfile',
            isRead: false,
            createdAt: serverTimestamp()
        });
    }

    // 4. Nhật ký & Bump Versions
    const logSummary = `${resolution ? `[Duyệt] ` : ''}Cập nhật Căn ${data.unit.UnitID}. ${reason || ''}`;
    injectLogAndNotif(batch, { 
        actor_email: actor?.email, 
        module: 'Cư dân', 
        action: 'UPDATE', 
        title: `Cập nhật Căn ${data.unit.UnitID}`, 
        summary: logSummary, 
        type: resolution ? 'request' : 'system',
        linkTo: 'residents' 
    });
    bumpVersion(batch, 'units_version'); 
    bumpVersion(batch, 'owners_version'); 
    bumpVersion(batch, 'vehicles_version');

    await batch.commit(); 
    return true; 
};

export const saveVehicles = async (d: Vehicle[], actor?: { email: string, role: Role }, reason?: string) => {
    if (d.length === 0) return;
    const batch = writeBatch(db);
    const unitId = d[0].UnitID;
    d.forEach(v => { batch.set(doc(db, 'vehicles', v.VehicleId), v, { merge: true }); });
    injectLogAndNotif(batch, { actor_email: actor?.email, module: 'Phương tiện', action: 'UPDATE', title: `Cập nhật Căn ${unitId}`, summary: `Căn ${unitId}: Cập nhật xe${reason ? `. Lý do: ${reason}` : ''}`, type: 'system', linkTo: 'vehicles' });
    bumpVersion(batch, 'vehicles_version'); return batch.commit();
};

export const fetchCollection = async <T>(colName: string): Promise<T[]> => {
    const snap = await getDocs(collection(db, colName));
    return snap.docs.map(d => d.data() as T);
};

export const fetchLatestLogs = async (limitCount: number = 20): Promise<ActivityLog[]> => {
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        let tsString = new Date().toISOString();
        if (data.timestamp instanceof Timestamp) tsString = data.timestamp.toDate().toISOString();
        return { id: d.id, ts: tsString, actor_email: data.performedBy?.email || 'system', summary: data.description || '', module: data.module || 'System', action: data.actionType || 'UPDATE' } as any;
    });
};

export const fetchWaterLocks = async (): Promise<string[]> => {
    const snap = await getDocs(collection(db, 'water_locks'));
    return snap.docs.filter(d => d.data().isLocked === true).map(d => d.id);
};

export const loadAllData = async (): Promise<AllData & { hasData: boolean }> => {
    const [units, owners, vehicles, waterReadings, tariffsDoc, adjustments, monthlyStats, lockedWaterPeriods] = await Promise.all([
        fetchCollection<Unit>('units'), fetchCollection<Owner>('owners'), fetchCollection<Vehicle>('vehicles'), fetchCollection<WaterReading>('waterReadings'), getDoc(doc(db, 'settings', 'tariffs')), fetchCollection<Adjustment>('adjustments'), fetchCollection<MonthlyStat>('monthly_stats'), fetchWaterLocks()
    ]);
    const activityLogs = await fetchLatestLogs(100);
    const tariffs = tariffsDoc.exists() ? tariffsDoc.data() as TariffCollection : { service: [], parking: [], water: [] };
    return { units, owners, vehicles, waterReadings, tariffs, adjustments, activityLogs, monthlyStats, lockedWaterPeriods, hasData: units.length > 0 };
};

export const fetchRecentAdjustments = async (startPeriod: string): Promise<Adjustment[]> => {
    const q = query(collection(db, 'adjustments'), where('Period', '>=', startPeriod));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Adjustment);
};

export const fetchRecentWaterReadings = async (periods: string[]): Promise<WaterReading[]> => {
    if (periods.length === 0) return [];
    const q = query(collection(db, 'waterReadings'), where('Period', 'in', periods));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WaterReading);
};

export const updateFeeSettings = (settings: InvoiceSettings) => setDoc(doc(db, 'settings', 'invoice'), settings, { merge: true });
export const saveChargesBatch = (charges: ChargeRaw[], periodStat?: MonthlyStat) => { if (charges.length === 0 && !periodStat) return Promise.resolve(); const batch = writeBatch(db); charges.forEach(charge => batch.set(doc(db, 'charges', `${charge.Period}_${charge.UnitID}`), charge, { merge: true })); if (periodStat) { batch.set(doc(db, 'monthly_stats', periodStat.period), periodStat, { merge: true }); } return batch.commit(); };
export const updateChargeStatuses = (period: string, unitIds: string[], updates: { isPrinted?: boolean; isSent?: boolean }) => { if (unitIds.length === 0) return Promise.resolve(); const batch = writeBatch(db); unitIds.forEach(id => batch.update(doc(db, 'charges', `${period}_${id}`), updates)); return batch.commit(); };
export const updateChargePayments = (period: string, paymentUpdates: Map<string, number>) => { if (paymentUpdates.size === 0) return Promise.resolve(); const batch = writeBatch(db); paymentUpdates.forEach((amount, id) => batch.update(doc(db, 'charges', `${period}_${id}`), { TotalPaid: amount, paymentStatus: 'reconciling', PaymentConfirmed: false })); return batch.commit(); };
export const confirmSinglePayment = async (charge: ChargeRaw, finalPaidAmount: number, status: PaymentStatus = 'paid') => { const batch = writeBatch(db); batch.update(doc(db, 'charges', `${charge.Period}_${charge.UnitID}`), { TotalPaid: finalPaidAmount, paymentStatus: status, PaymentConfirmed: true }); const diff = finalPaidAmount - charge.TotalDue; if (diff !== 0) { const nextPeriod = new Date(charge.Period + '-02'); nextPeriod.setMonth(nextPeriod.getMonth() + 1); const nextPeriodStr = nextPeriod.toISOString().slice(0, 7); const adj: Adjustment = { UnitID: charge.UnitID, Period: nextPeriodStr, Amount: -diff, Description: 'Công nợ kỳ trước', SourcePeriod: charge.Period }; batch.set(doc(db, 'adjustments', `ADJ_${nextPeriodStr}_${charge.UnitID}`), adj, { merge: true }); } return batch.commit(); };
export const updatePaymentStatusBatch = (period: string, unitIds: string[], status: 'paid' | 'unpaid', charges: ChargeRaw[]) => { if (unitIds.length === 0) return Promise.resolve(); const batch = writeBatch(db); const chargesMap = new Map(charges.map(c => [c.UnitID, c])); unitIds.forEach(id => { const update = { paymentStatus: status, PaymentConfirmed: status === 'paid', TotalPaid: status === 'paid' ? (chargesMap.get(id)?.TotalDue ?? 0) : 0 }; batch.update(doc(db, 'charges', `${period}_${id}`), update); }); return batch.commit(); };
export const wipeAllBusinessData = async (progress: (msg: string) => void) => { const collections = ['charges', 'waterReadings', 'vehicles', 'adjustments', 'owners', 'units', 'activity_logs', 'monthly_stats', 'billing_locks', 'water_locks', 'profileRequests', 'misc_revenues', 'admin_notifications', 'service_registrations']; for (const name of collections) { progress(`Querying ${name}...`); const snapshot = await getDocs(collection(db, name)); if (snapshot.empty) continue; const batch = writeBatch(db); snapshot.docs.forEach(d => batch.delete(d.ref)); progress(`Deleting ${snapshot.size} docs from ${name}...`); await batch.commit(); } };
export const saveUsers = async (d: UserPermission[]) => { const batch = writeBatch(db); d.forEach(u => batch.set(doc(db, 'users', u.Email), u, { merge: true })); bumpVersion(batch, 'users_version'); return batch.commit(); };
export const deleteUsers = async (emails: string[]) => { if (emails.length === 0) return Promise.resolve(); const batch = writeBatch(db); emails.forEach(email => batch.delete(doc(db, 'users', email))); bumpVersion(batch, 'users_version'); return batch.commit(); };
export const saveTariffs = async (d: TariffCollection) => { const batch = writeBatch(db); batch.set(doc(db, 'settings', 'tariffs'), d, { merge: true }); bumpVersion(batch, 'tariffs_version'); return batch.commit(); };
export const saveAdjustments = (d: Adjustment[]) => { const batch = writeBatch(db); d.forEach(item => { const id = `ADJ_${item.Period}_${item.UnitID}`; batch.set(doc(db, 'adjustments', id), item, { merge: true }); }); return batch.commit(); };
export const saveWaterReadings = (d: WaterReading[]) => { const batch = writeBatch(db); d.forEach(item => { const id = `${item.Period}_${item.UnitID}`; batch.set(doc(db, 'waterReadings', id), item, { merge: true }); }); return batch.commit(); };
export const getLockStatus = async (month: string): Promise<boolean> => { const docRef = doc(db, 'water_locks', month); const docSnap = await getDoc(docRef); return docSnap.exists() ? docSnap.data().isLocked : false; };
export const setLockStatus = async (month: string, status: boolean): Promise<void> => { const docRef = doc(db, 'water_locks', month); await setDoc(docRef, { isLocked: status, updatedAt: new Date().toISOString() }, { merge: true }); };
export const getBillingLockStatus = async (period: string): Promise<boolean> => { const docRef = doc(db, 'billing_locks', period); const docSnap = await getDoc(docRef); return docSnap.exists() ? docSnap.data().isLocked : false; };
export const setBillingLockStatus = async (period: string, status: boolean): Promise<void> => { const docRef = doc(db, 'billing_locks', period); await setDoc(docRef, { isLocked: status, updatedAt: new Date().toISOString() }, { merge: true }); };
export const resetUserPassword = async (email: string): Promise<void> => { const userRef = doc(db, 'users', email); await updateDoc(userRef, { password: '123456', mustChangePassword: true }); };
export const getAllPendingProfileRequests = async (): Promise<ProfileRequest[]> => { const q = query(collection(db, 'profileRequests'), where('status', '==', 'PENDING')); const snap = await getDocs(q); return snap.docs.map(d => d.data() as ProfileRequest); };
export const getPendingProfileRequest = async (residentId: string): Promise<ProfileRequest | null> => { const q = query(collection(db, 'profileRequests'), where('residentId', '==', residentId), where('status', '==', 'PENDING'), limit(1)); const snap = await getDocs(q); return !snap.empty ? snap.docs[0].data() as ProfileRequest : null; };

export const resolveProfileRequest = async (request: ProfileRequest, action: 'approve' | 'reject', adminEmail: string, approvedChanges?: any) => {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    batch.update(doc(db, 'profileRequests', request.id), { status: action === 'approve' ? 'APPROVED' : 'REJECTED', updatedAt: now });

    // Gửi thông báo cho cư dân
    const resNotifRef = doc(collection(db, 'notifications'));
    batch.set(resNotifRef, {
        userId: request.residentId,
        title: action === 'approve' ? 'Yêu cầu cập nhật đã được duyệt' : 'Yêu cầu bị từ chối',
        body: action === 'approve' ? 'Thông tin cá nhân của bạn đã được cập nhật thành công.' : 'BQL đã xem xét và không phê duyệt yêu cầu thay đổi thông tin của bạn.',
        type: 'profile',
        link: 'portalProfile',
        isRead: false,
        createdAt: serverTimestamp()
    });

    await batch.commit();
};

export const submitUserProfileUpdate = async (userAuthEmail: string, residentId: string, ownerId: string, newData: any) => {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    const userRef = doc(db, 'users', userAuthEmail);
    const userUpdates: any = {};
    if (newData.DisplayName !== undefined) userUpdates.DisplayName = newData.DisplayName;
    if (newData.avatarUrl !== undefined) userUpdates.avatarUrl = newData.avatarUrl;
    if (Object.keys(userUpdates).length > 0) { batch.update(userRef, userUpdates); }
    const requestId = `req_${Date.now()}_${residentId}`;
    const requestRef = doc(db, 'profileRequests', requestId);
    const profileRequest: ProfileRequest = { id: requestId, residentId, ownerId, status: 'PENDING', changes: newData, createdAt: now, updatedAt: now };
    batch.set(requestRef, profileRequest, { merge: true });
    const adminNotifRef = doc(collection(db, 'admin_notifications'));
    batch.set(adminNotifRef, { id: adminNotifRef.id, type: 'request', title: `Yêu cầu hồ sơ - Căn ${residentId}`, message: `Cư dân yêu cầu thay đổi thông tin.`, isRead: false, createdAt: serverTimestamp(), linkTo: 'residents' });
    await batch.commit(); return profileRequest;
};

export const updateResidentAvatar = async (ownerId: string, avatarUrl: string, userEmail?: string): Promise<void> => { const batch = writeBatch(db); const ownerRef = doc(db, 'owners', ownerId); batch.update(ownerRef, { avatarUrl: avatarUrl, updatedAt: new Date().toISOString() }); if (userEmail) { const userRef = doc(db, 'users', userEmail); batch.update(userRef, { avatarUrl: avatarUrl }); } await batch.commit(); };
export const importResidentsBatch = async (currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[], updates: any[]) => { const batch = writeBatch(db); updates.forEach(up => { const unitId = String(up.unitId).trim(); const existingUnit = currentUnits.find(u => u.UnitID === unitId); if (existingUnit) { batch.update(doc(db, "units", unitId), { Status: up.status, Area_m2: up.area, UnitType: up.unitType }); batch.update(doc(db, "owners", existingUnit.OwnerID), { OwnerName: up.ownerName, Phone: up.phone, Email: up.email }); } else { const newOwnerId = doc(collection(db, "owners")).id; batch.set(doc(db, "owners", newOwnerId), { OwnerID: newOwnerId, OwnerName: up.ownerName, Phone: up.phone, Email: up.email }, { merge: true }); batch.set(doc(db, "units", unitId), { UnitID: unitId, OwnerID: newOwnerId, UnitType: up.unitType, Area_m2: up.area, Status: up.status }, { merge: true }); } }); bumpVersion(batch, 'units_version'); bumpVersion(batch, 'owners_version'); bumpVersion(batch, 'vehicles_version'); await batch.commit(); return { createdCount: 0, updatedCount: 0, vehicleCount: 0 }; };
export const createProfileRequest = async (request: ProfileRequest) => Promise.resolve();
