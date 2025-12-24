
import { 
    doc, getDoc, setDoc, collection, getDocs, writeBatch, 
    query, deleteDoc, updateDoc, limit, orderBy, where, 
    serverTimestamp, addDoc, getCountFromServer 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { cacheManager } from './cacheManager';
import type { 
    InvoiceSettings, Unit, Owner, Vehicle, WaterReading, 
    ChargeRaw, Adjustment, UserPermission, ActivityLog, 
    AllData, PaymentStatus, MonthlyStat, SystemMetadata, 
    ProfileRequest, MiscRevenue, TariffCollection, AdminNotification,
    Role, NewsItem
} from '../types';

export { logActivity } from './logService';

const METADATA_DOC_ID = 'metadata';
const SETTINGS_COLLECTION = 'settings';

/**
 * OPTIMIZED: Fetch collection with Smart Caching
 */
export const fetchCollectionOptimized = async <T>(colName: string, versionKey?: keyof SystemMetadata): Promise<T[]> => {
    // Check background versions if provided
    if (versionKey) {
        const serverMeta = await getSystemMetadata();
        const localMeta = await cacheManager.get<SystemMetadata>('meta');
        
        if (localMeta && serverMeta[versionKey] <= localMeta[versionKey]) {
            const cached = await cacheManager.get<T[]>(colName);
            if (cached) return cached;
        }
        // If versions differ or no cache, update metadata cache
        await cacheManager.set('meta', serverMeta);
    }

    // Fallback to memory/disk cache first
    const cached = await cacheManager.get<T[]>(colName);
    if (cached) return cached;

    // Actual Network Call
    const snap = await getDocs(collection(db, colName));
    const data = snap.docs.map(d => d.data() as T);
    
    // Store in cache
    await cacheManager.set(colName, data);
    return data;
};

/**
 * QUOTA SAVER: Use Aggregation Query to count documents (Costs only 1 read unit)
 */
export const getQuickStats = async () => {
    const unitsCol = collection(db, 'units');
    const vehiclesCol = query(collection(db, 'vehicles'), where('isActive', '==', true));
    
    const [unitsCount, vehiclesCount] = await Promise.all([
        getCountFromServer(unitsCol),
        getCountFromServer(vehiclesCol)
    ]);

    return {
        totalUnits: unitsCount.data().count,
        activeVehicles: vehiclesCount.data().count
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

export const getSystemMetadata = async (): Promise<SystemMetadata> => {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, METADATA_DOC_ID));
    if (snap.exists()) return snap.data() as SystemMetadata;
    return { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };
};

export const fetchCollection = <T>(colName: string) => fetchCollectionOptimized<T>(colName);

export const fetchLatestLogs = async (limitCount: number = 20): Promise<ActivityLog[]> => {
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ts: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(), actor_email: data.performedBy?.email || 'system', summary: data.description, module: data.module, action: data.actionType } as any;
    });
};

export const fetchNews = async (): Promise<NewsItem[]> => {
    const cached = await cacheManager.get<NewsItem[]>('news');
    if (cached) return cached;

    const q = query(collection(db, 'news'), orderBy('date', 'desc'), limit(50));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem));
    await cacheManager.set('news', data);
    return data;
};

export const saveNewsItem = async (item: NewsItem): Promise<string> => {
    const { id, ...data } = item;
    cacheManager.invalidate('news');
    if (id && !id.startsWith('news_mock')) { await setDoc(doc(db, 'news', id), data, { merge: true }); return id; }
    else { const docRef = await addDoc(collection(db, 'news'), data); return docRef.id; }
};

export const deleteNewsItem = async (id: string): Promise<void> => { 
    cacheManager.invalidate('news');
    await deleteDoc(doc(db, 'news', id)); 
};

export const updateFeeSettings = (settings: InvoiceSettings) => setDoc(doc(db, 'settings', 'invoice'), settings, { merge: true });

export const saveChargesBatch = (charges: ChargeRaw[], periodStat?: MonthlyStat) => { 
    if (charges.length === 0 && !periodStat) return Promise.resolve(); 
    const batch = writeBatch(db); 
    charges.forEach(charge => batch.set(doc(db, 'charges', `${charge.Period}_${charge.UnitID}`), charge)); 
    if (periodStat) { batch.set(doc(db, 'monthly_stats', periodStat.period), periodStat); } 
    return batch.commit(); 
};

export const fetchWaterLocks = async (): Promise<string[]> => {
    const snap = await getDocs(collection(db, 'water_locks'));
    return snap.docs.filter(d => d.data().isLocked === true).map(d => d.id);
};

export const loadAllData = async (): Promise<AllData & { hasData: boolean }> => {
    const [units, owners, vehicles, waterReadings, tariffsDoc, adjustments, monthlyStats, lockedWaterPeriods] = await Promise.all([
        fetchCollectionOptimized<Unit>('units', 'units_version'), 
        fetchCollectionOptimized<Owner>('owners', 'owners_version'), 
        fetchCollectionOptimized<Vehicle>('vehicles', 'vehicles_version'), 
        fetchCollectionOptimized<WaterReading>('waterReadings'), 
        getDoc(doc(db, 'settings', 'tariffs')), 
        fetchCollectionOptimized<Adjustment>('adjustments'), 
        fetchCollectionOptimized<MonthlyStat>('monthly_stats'), 
        fetchWaterLocks()
    ]);
    const activityLogs = await fetchLatestLogs(50);
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

export const setLockStatus = async (month: string, status: boolean): Promise<void> => { const docRef = doc(db, 'water_locks', month); await setDoc(docRef, { isLocked: status, updatedAt: new Date().toISOString() }); };
export const getBillingLockStatus = async (period: string): Promise<boolean> => { const docRef = doc(db, 'billing_locks', period); const docSnap = await getDoc(docRef); return docSnap.exists() ? docSnap.data().isLocked : false; };
export const setBillingLockStatus = async (period: string, status: boolean): Promise<void> => { const docRef = doc(db, 'billing_locks', period); await setDoc(docRef, { isLocked: status, updatedAt: new Date().toISOString() }); };
export const resetUserPassword = async (email: string): Promise<void> => { const userRef = doc(db, 'users', email); await updateDoc(userRef, { password: '123456', mustChangePassword: true }); };
export const addMiscRevenue = async (data: Omit<MiscRevenue, 'id' | 'createdAt'>): Promise<string> => { const docRef = doc(collection(db, 'misc_revenues')); const id = docRef.id; await setDoc(docRef, { ...data, id, createdAt: new Date().toISOString() }); return id; };
export const getMonthlyMiscRevenues = async (month: string): Promise<MiscRevenue[]> => { const q = query(collection(db, 'misc_revenues'), where('date', '>=', month), where('date', '<=', month + '\uf8ff'), orderBy('date', 'desc'), orderBy('createdAt', 'desc')); const snap = await getDocs(q); return snap.docs.map(d => d.data() as MiscRevenue); };
export const deleteMiscRevenue = async (id: string): Promise<void> => { await deleteDoc(doc(db, 'misc_revenues', id)); };
export const getAllPendingProfileRequests = async (): Promise<ProfileRequest[]> => { const q = query(collection(db, 'profileRequests'), where('status', '==', 'PENDING')); const snap = await getDocs(q); return snap.docs.map(d => d.data() as ProfileRequest); };
export const resolveProfileRequest = async (request: ProfileRequest, action: 'approve' | 'reject', adminEmail: string, approvedChanges?: any) => { const batch = writeBatch(db); const reqRef = doc(db, 'profileRequests', request.id); batch.update(reqRef, { status: action === 'approve' ? 'APPROVED' : 'REJECTED', updatedAt: new Date().toISOString() }); if (action === 'approve') { const changesToApply = approvedChanges || request.changes; const ownerRef = doc(db, 'owners', request.ownerId); const ownerUpdates: any = {}; if (changesToApply.OwnerName !== undefined) ownerUpdates.OwnerName = changesToApply.OwnerName; if (changesToApply.Phone !== undefined) ownerUpdates.Phone = changesToApply.Phone; if (changesToApply.Email !== undefined) ownerUpdates.Email = changesToApply.Email; if (changesToApply.secondOwnerName !== undefined) ownerUpdates.secondOwnerName = changesToApply.secondOwnerName; if (changesToApply.secondOwnerPhone !== undefined) ownerUpdates.secondOwnerPhone = changesToApply.secondOwnerPhone; if (changesToApply.avatarUrl !== undefined) ownerUpdates.avatarUrl = changesToApply.avatarUrl; ownerUpdates.updatedAt = new Date().toISOString(); if (Object.keys(ownerUpdates).length > 0) { batch.update(ownerRef, ownerUpdates); } if (changesToApply.UnitStatus) { batch.update(doc(db, 'units', request.residentId), { Status: changesToApply.UnitStatus }); } } await batch.commit(); };
export const getPendingProfileRequest = async (residentId: string): Promise<ProfileRequest | null> => { const q = query(collection(db, 'profileRequests'), where('residentId', '==', residentId), where('status', '==', 'PENDING'), limit(1)); const snap = await getDocs(q); return !snap.empty ? snap.docs[0].data() as ProfileRequest : null; };
export const submitUserProfileUpdate = async (userAuthEmail: string, residentId: string, ownerId: string, newData: any) => { const batch = writeBatch(db); const now = new Date().toISOString(); const userRef = doc(db, 'users', userAuthEmail); const userUpdates: any = {}; if (newData.displayName !== undefined) userUpdates.DisplayName = newData.displayName; if (newData.contactEmail !== undefined) userUpdates.contact_email = newData.contactEmail; if (newData.avatarUrl !== undefined) userUpdates.avatarUrl = newData.avatarUrl; batch.update(userRef, userUpdates); const requestId = `req_${Date.now()}_${residentId}`; const requestRef = doc(db, 'profileRequests', requestId); const profileRequest: ProfileRequest = { id: requestId, residentId, ownerId, status: 'PENDING', changes: newData, createdAt: now, updatedAt: now }; batch.set(requestRef, profileRequest); await batch.commit(); return profileRequest; };
export const updateResidentAvatar = async (ownerId: string, avatarUrl: string, userEmail?: string): Promise<void> => { const batch = writeBatch(db); const ownerRef = doc(db, 'owners', ownerId); batch.update(ownerRef, { avatarUrl: avatarUrl, updatedAt: new Date().toISOString() }); if (userEmail) { const userRef = doc(db, 'users', userEmail); batch.update(userRef, { avatarUrl: avatarUrl }); } await batch.commit(); };
export const importResidentsBatch = async (currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[], updates: any[]) => { const batch = writeBatch(db); updates.forEach(up => { const unitId = String(up.unitId).trim(); const existingUnit = currentUnits.find(u => u.UnitID === unitId); if (existingUnit) { batch.update(doc(db, "units", unitId), { Status: up.status, Area_m2: up.area, UnitType: up.unitType }); batch.update(doc(db, "owners", existingUnit.OwnerID), { OwnerName: up.ownerName, Phone: up.phone, Email: up.email }); } else { const newOwnerId = doc(collection(db, "owners")).id; batch.set(doc(db, "owners", newOwnerId), { OwnerID: newOwnerId, OwnerName: up.ownerName, Phone: up.phone, Email: up.email }); batch.set(doc(db, "units", unitId), { UnitID: unitId, OwnerID: newOwnerId, UnitType: up.unitType, Area_m2: up.area, Status: up.status }); } }); await batch.commit(); return { createdCount: 0, updatedCount: 0, vehicleCount: 0 }; };
export const createProfileRequest = async (request: ProfileRequest) => Promise.resolve();
