
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
    startAfter, 
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
    ProfileRequest, MiscRevenue, TariffCollection, AdminNotification,
    Role, NewsItem
} from '../types';

/**
 * Optimized: Fetches only charges for a specific period range OR unpaid status
 * This prevents reading thousands of historical paid records.
 */
export const fetchActiveCharges = async (periods: string[]): Promise<ChargeRaw[]> => {
    const chargesRef = collection(db, 'charges');
    // Query for specific months OR any unpaid bill (debt recovery)
    const q = query(
        chargesRef,
        or(
            where('Period', 'in', periods),
            where('paymentStatus', '==', 'unpaid'),
            where('paymentStatus', '==', 'reconciling')
        )
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ChargeRaw);
};

/**
 * Aggregation: Get counts for Dashboard without fetching documents
 */
export const getDashboardCounts = async () => {
    const unitsRef = collection(db, 'units');
    const vehiclesRef = collection(db, 'vehicles');
    
    const [unitsSnap, vehiclesSnap, waitingVehiclesSnap] = await Promise.all([
        getCountFromServer(unitsRef),
        getCountFromServer(query(vehiclesRef, where('isActive', '==', true))),
        getCountFromServer(query(vehiclesRef, and(where('isActive', '==', true), where('parkingStatus', '==', 'Xếp lốt'))))
    ]);

    return {
        totalUnits: unitsSnap.data().count,
        activeVehicles: vehiclesSnap.data().count,
        waitingVehicles: waitingVehiclesSnap.data().count
    };
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
        createdAt: serverTimestamp() 
    };
    batch.set(notifRef, notifData);
};

export const fetchNews = async (): Promise<NewsItem[]> => {
    const q = query(collection(db, 'news'), orderBy('date', 'desc'), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem));
};

export const saveNewsItem = async (item: NewsItem): Promise<string> => {
    const { id, ...data } = item;
    if (id && !id.startsWith('news_mock')) { 
        await setDoc(doc(db, 'news', id), data, { merge: true }); 
        return id; 
    }
    else { 
        const docRef = await addDoc(collection(db, 'news'), data); 
        return docRef.id; 
    }
};

export const deleteNewsItem = async (id: string): Promise<void> => { await deleteDoc(doc(db, 'news', id)); };
export const updateUserProfile = async (email: string, updates: Partial<UserPermission>) => { const userRef = doc(db, 'users', email); await updateDoc(userRef, updates); };

export const updateResidentData = async (currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[], data: { unit: Unit; owner: Owner; vehicles: Vehicle[] }, actor?: { email: string, role: Role }, reason?: string) => {
    const batch = writeBatch(db);
    const unitRef = doc(db, 'units', data.unit.UnitID);
    batch.set(unitRef, data.unit, { merge: true });
    const ownerRef = doc(db, 'owners', data.owner.OwnerID);
    batch.set(ownerRef, data.owner, { merge: true });
    const activeIds = new Set<string>();
    const platesUpdated: string[] = [];
    data.vehicles.forEach(v => {
        let vehicleId = v.VehicleId;
        let vehicleToSave = { ...v, isActive: true, updatedAt: new Date().toISOString() };
        platesUpdated.push(v.PlateNumber);
        if (!vehicleId || vehicleId.startsWith('VEH_NEW_')) { 
            const newRef = doc(collection(db, "vehicles")); 
            vehicleToSave.VehicleId = newRef.id; 
            batch.set(newRef, vehicleToSave); 
            activeIds.add(newRef.id); 
        }
        else { 
            const vRef = doc(db, 'vehicles', vehicleId);
            batch.set(vRef, vehicleToSave, { merge: true }); 
            activeIds.add(vehicleId); 
        }
    });
    currentVehicles.filter(v => v.UnitID === data.unit.UnitID && v.isActive && !activeIds.has(v.VehicleId)).forEach(v => { 
        const vRef = doc(db, 'vehicles', v.VehicleId);
        batch.update(vRef, { isActive: false }); 
    });
    const logSummary = `${platesUpdated.length > 0 ? `Xe: ${platesUpdated.join(', ')}` : 'Cập nhật hồ sơ'}. ${reason ? `Lý do: ${reason}` : ''}`;
    injectLogAndNotif(batch, { actor_email: actor?.email, module: 'Cư dân', action: 'UPDATE', title: `Cập nhật Căn ${data.unit.UnitID}`, summary: logSummary, type: 'request' });
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
    const details = d.map(v => `${v.Type.includes('car') ? 'Ô tô' : 'Xe máy'} [${v.PlateNumber}]`).join(', ');
    d.forEach(v => { 
        const vRef = doc(db, 'vehicles', v.VehicleId);
        batch.set(vRef, v, { merge: true }); 
    });
    injectLogAndNotif(batch, { actor_email: actor?.email, module: 'Phương tiện', action: 'UPDATE', title: `Cập nhật Căn ${unitId}`, summary: `Căn ${unitId}: Cập nhật ${details}${reason ? `. Lý do: ${reason}` : ''}`, type: 'system' });
    bumpVersion(batch, 'vehicles_version'); 
    return batch.commit();
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
        if (data.timestamp instanceof Timestamp) { tsString = data.timestamp.toDate().toISOString(); } 
        else if (data.timestamp && typeof data.timestamp.toDate === 'function') { tsString = data.timestamp.toDate().toISOString(); } 
        else if (data.timestamp) { tsString = new Date(data.timestamp).toISOString(); }
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
export const resolveProfileRequest = async (request: ProfileRequest, action: 'approve' | 'reject', adminEmail: string, approvedChanges?: any) => { const batch = writeBatch(db); const reqRef = doc(db, 'profileRequests', request.id); batch.update(reqRef, { status: action === 'approve' ? 'APPROVED' : 'REJECTED', updatedAt: new Date().toISOString() }); if (action === 'approve') { const changesToApply = approvedChanges || request.changes; const ownerRef = doc(db, 'owners', request.ownerId); const ownerUpdates: any = {}; if (changesToApply.OwnerName !== undefined) ownerUpdates.OwnerName = changesToApply.OwnerName; if (changesToApply.Phone !== undefined) ownerUpdates.Phone = changesToApply.Phone; if (changesToApply.Email !== undefined) ownerUpdates.Email = changesToApply.Email; if (changesToApply.secondOwnerName !== undefined) ownerUpdates.secondOwnerName = changesToApply.secondOwnerName; if (changesToApply.secondOwnerPhone !== undefined) ownerUpdates.secondOwnerPhone = changesToApply.secondOwnerPhone; if (changesToApply.avatarUrl !== undefined) ownerUpdates.avatarUrl = changesToApply.avatarUrl; ownerUpdates.updatedAt = new Date().toISOString(); if (Object.keys(ownerUpdates).length > 0) { batch.update(ownerRef, ownerUpdates); bumpVersion(batch, 'owners_version'); } if (changesToApply.UnitStatus) { batch.update(doc(db, 'units', request.residentId), { Status: changesToApply.UnitStatus }); bumpVersion(batch, 'units_version'); } injectLogAndNotif(batch, { actor_email: adminEmail, actor_role: 'Admin', module: 'Residents', action: 'APPROVE_PROFILE_UPDATE', summary: `Duyệt cập nhật thông tin cư dân ${request.residentId}`, ids: [request.residentId] }); } await batch.commit(); };
export const getPendingProfileRequest = async (residentId: string): Promise<ProfileRequest | null> => { const q = query(collection(db, 'profileRequests'), where('residentId', '==', residentId), where('status', '==', 'PENDING'), limit(1)); const snap = await getDocs(q); return !snap.empty ? snap.docs[0].data() as ProfileRequest : null; };
export const submitUserProfileUpdate = async (userAuthEmail: string, residentId: string, ownerId: string, newData: any) => { const batch = writeBatch(db); const now = new Date().toISOString(); const userRef = doc(db, 'users', userAuthEmail); const userUpdates: any = {}; if (newData.displayName !== undefined) userUpdates.DisplayName = newData.displayName; if (newData.contactEmail !== undefined) userUpdates.contact_email = newData.contactEmail; if (newData.avatarUrl !== undefined) userUpdates.avatarUrl = newData.avatarUrl; batch.update(userRef, userUpdates); const requestId = `req_${Date.now()}_${residentId}`; const requestRef = doc(db, 'profileRequests', requestId); const profileRequest: ProfileRequest = { id: requestId, residentId, ownerId, status: 'PENDING', changes: newData, createdAt: now, updatedAt: now }; batch.set(requestRef, profileRequest, { merge: true }); await batch.commit(); return profileRequest; };
export const updateResidentAvatar = async (ownerId: string, avatarUrl: string, userEmail?: string): Promise<void> => { const batch = writeBatch(db); const ownerRef = doc(db, 'owners', ownerId); batch.update(ownerRef, { avatarUrl: avatarUrl, updatedAt: new Date().toISOString() }); if (userEmail) { const userRef = doc(db, 'users', userEmail); batch.update(userRef, { avatarUrl: avatarUrl }); } await batch.commit(); };
export const importResidentsBatch = async (currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[], updates: any[]) => { const batch = writeBatch(db); updates.forEach(up => { const unitId = String(up.unitId).trim(); const existingUnit = currentUnits.find(u => u.UnitID === unitId); if (existingUnit) { batch.update(doc(db, "units", unitId), { Status: up.status, Area_m2: up.area, UnitType: up.unitType }); batch.update(doc(db, "owners", existingUnit.OwnerID), { OwnerName: up.ownerName, Phone: up.phone, Email: up.email }); } else { const newOwnerId = doc(collection(db, "owners")).id; batch.set(doc(db, "owners", newOwnerId), { OwnerID: newOwnerId, OwnerName: up.ownerName, Phone: up.phone, Email: up.email }, { merge: true }); batch.set(doc(db, "units", unitId), { UnitID: unitId, OwnerID: newOwnerId, UnitType: up.unitType, Area_m2: up.area, Status: up.status }, { merge: true }); } }); bumpVersion(batch, 'units_version'); bumpVersion(batch, 'owners_version'); bumpVersion(batch, 'vehicles_version'); await batch.commit(); return { createdCount: 0, updatedCount: 0, vehicleCount: 0 }; };
export const createProfileRequest = async (request: ProfileRequest) => Promise.resolve();
