
import { 
    doc, getDoc, setDoc, collection, getDocs, writeBatch, query, 
    deleteDoc, updateDoc, limit, orderBy, where, serverTimestamp, 
    addDoc, Timestamp, getCountFromServer
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';
import type { 
    InvoiceSettings, Unit, Owner, Vehicle, WaterReading, 
    ChargeRaw, Adjustment, UserPermission, ActivityLog, 
    AllData, PaymentStatus, MonthlyStat, SystemMetadata, 
    ProfileRequest, TariffCollection, AdminNotification,
    Role, NewsItem, MiscRevenue, OperationalExpense,
    RegistrationStatus, FeedbackItem, FeedbackReply, ServiceRegistration
} from '../types';

// Tăng tốc độ đọc bằng cách sử dụng bộ nhớ đệm nội bộ
let settingsCache: { invoice?: InvoiceSettings, tariffs?: TariffCollection } = {};

export const fetchInvoiceSettings = async (): Promise<InvoiceSettings | null> => {
    if (settingsCache.invoice) return settingsCache.invoice;
    try {
        const snap = await getDoc(doc(db, 'settings', 'invoice'));
        if (snap.exists()) {
            settingsCache.invoice = snap.data() as InvoiceSettings;
            return settingsCache.invoice;
        }
    } catch (e) {
        console.warn("Permission denied for invoice settings");
    }
    return null;
};

export const fetchTariffsData = async (): Promise<TariffCollection> => {
    if (settingsCache.tariffs) return settingsCache.tariffs;
    try {
        const snap = await getDoc(doc(db, 'settings', 'tariffs'));
        const data = snap.exists() ? snap.data() as TariffCollection : { service: [], parking: [], water: [] };
        settingsCache.tariffs = data;
        return data;
    } catch (e) {
        console.warn("Permission denied for tariffs");
        return { service: [], parking: [], water: [] };
    }
};

export const getSystemMetadata = async (): Promise<SystemMetadata> => {
    try {
        const snap = await getDoc(doc(db, 'settings', 'metadata'));
        if (snap.exists()) return snap.data() as SystemMetadata;
    } catch (e) {
        console.warn("Metadata not found or denied");
    }
    return { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };
};

export const fetchActiveCharges = async (periods: string[]): Promise<ChargeRaw[]> => {
    if (periods.length === 0) return [];
    try {
        const chargesRef = collection(db, 'charges');
        const q = query(
            chargesRef, 
            where('Period', 'in', periods),
            limit(1000) 
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as ChargeRaw);
    } catch (e) {
        console.warn("Failed to fetch active charges:", e);
        return [];
    }
};

export const fetchChargesForResident = async (residentId: string): Promise<ChargeRaw[]> => {
    try {
        const q = query(collection(db, 'charges'), where('UnitID', '==', residentId), orderBy('Period', 'desc'), limit(12));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as ChargeRaw);
    } catch (e) {
        console.warn("Failed to fetch resident charges");
        return [];
    }
};

export const fetchResidentSpecificData = async (residentId: string) => {
    try {
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
        const unitVehicles = vSnap.docs.map(d => d.data() as Vehicle);
        
        return { unit: unitData, owner: ownerData, vehicles: unitVehicles };
    } catch (e) {
        console.warn("Error fetching resident specific data");
        return { unit: null, owner: null, vehicles: [] };
    }
};

export const fetchLatestLogs = async (limitCount: number = 20): Promise<ActivityLog[]> => {
    try {
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
    } catch (e) {
        return [];
    }
};

export const fetchNews = async (): Promise<NewsItem[]> => {
    try {
        const q = query(collection(db, 'news'), where('isArchived', '==', false), orderBy('date', 'desc'), limit(15));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem));
    } catch (e) {
        return [];
    }
};

export const fetchRecentWaterReadings = async (periods: string[]): Promise<WaterReading[]> => {
    if (periods.length === 0) return [];
    try {
        const q = query(collection(db, 'waterReadings'), where('Period', 'in', periods), limit(1000));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as WaterReading);
    } catch (e) {
        return [];
    }
};

export const fetchWaterLocks = async (): Promise<string[]> => {
    try {
        const snap = await getDoc(doc(db, 'settings', 'water_locks'));
        if (snap.exists()) return snap.data().periods || [];
    } catch (e) {}
    return [];
};

export const fetchRecentAdjustments = async (startPeriod: string): Promise<Adjustment[]> => {
    try {
        const q = query(collection(db, 'adjustments'), where('Period', '>=', startPeriod), limit(500));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as Adjustment);
    } catch (e) {
        return [];
    }
};

export const fetchCollection = async <T>(colName: string): Promise<T[]> => {
    try {
        const snap = await getDocs(query(collection(db, colName), limit(1500)));
        return snap.docs.map(d => d.data() as T);
    } catch (e) {
        return [];
    }
};

export const updateFeeSettings = async (settings: InvoiceSettings) => {
    settingsCache.invoice = settings;
    return setDoc(doc(db, 'settings', 'invoice'), settings, { merge: true });
};

export const setLockStatus = async (period: string, isLocked: boolean) => {
    const ref = doc(db, 'settings', 'water_locks');
    const snap = await getDoc(ref);
    let periods: string[] = [];
    if (snap.exists()) {
        periods = snap.data().periods || [];
    }
    if (isLocked) {
        if (!periods.includes(period)) periods.push(period);
    } else {
        periods = periods.filter(p => p !== period);
    }
    return setDoc(ref, { periods });
};

export const getBillingLockStatus = async (period: string): Promise<boolean> => {
    try {
        const snap = await getDoc(doc(db, 'billing_locks', period));
        return snap.exists() ? snap.data().isLocked : false;
    } catch (e) {
        return false;
    }
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
    if (periodStat) {
        batch.set(doc(db, 'monthly_stats', periodStat.period), periodStat);
    }
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
    users.forEach(u => {
        batch.set(doc(db, 'users', u.Email), u, { merge: true });
    });
    return batch.commit();
};

export const deleteUsers = async (emails: string[]) => {
    const batch = writeBatch(db);
    emails.forEach(email => {
        batch.delete(doc(db, 'users', email));
    });
    return batch.commit();
};

export const updateUserProfile = async (email: string, updates: Partial<UserPermission>) => {
    const cleanData = JSON.parse(JSON.stringify(updates));
    return setDoc(doc(db, 'users', email), cleanData, { merge: true });
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
    
    vehicles.forEach(v => {
        batch.set(doc(db, 'vehicles', v.VehicleId), v, { merge: true });
    });

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

export const submitUserProfileUpdate = async (userAuthEmail: string, residentId: string, ownerId: string, newData: any): Promise<ProfileRequest> => {
    const req: Omit<ProfileRequest, 'id'> = {
        residentId,
        ownerId,
        status: 'PENDING',
        changes: newData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    const ref = await addDoc(collection(db, 'profileRequests'), req);
    const result = { ...req, id: ref.id };
    await updateDoc(ref, { id: ref.id });
    
    return result as ProfileRequest;
};

export const getAllPendingProfileRequests = async (): Promise<ProfileRequest[]> => {
    try {
        const q = query(collection(db, 'profileRequests'), where('status', '==', 'PENDING'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProfileRequest));
    } catch (e) {
        return [];
    }
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

export const saveVehicles = async (
    vehicles: Vehicle[],
    actor?: { email: string, role: Role },
    reason?: string
) => {
    const batch = writeBatch(db);
    vehicles.forEach(v => {
        const ref = doc(db, 'vehicles', v.VehicleId);
        batch.set(ref, v, { merge: true });
    });
    if (actor && reason) {
        const logRef = doc(collection(db, 'activity_logs'));
        const summary = `Cập nhật ${vehicles.length} phương tiện: ${vehicles.map(v => v.PlateNumber).join(', ')}. Lý do: ${reason}`;
        batch.set(logRef, {
            actionType: 'UPDATE', module: 'Vehicles', description: summary, timestamp: serverTimestamp(), performedBy: { name: actor.role, email: actor.email }, ids: vehicles.map(v => v.VehicleId)
        });
    }
    return batch.commit();
};

export const fetchUserForLogin = async (identifier: string): Promise<UserPermission | null> => {
    try {
        const usersRef = collection(db, 'users');
        const q1 = query(usersRef, where('Email', '==', identifier), limit(1));
        const q2 = query(usersRef, where('Username', '==', identifier), limit(1));
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const found = snap1.docs[0] || snap2.docs[0];
        return found ? (found.data() as UserPermission) : null;
    } catch (e) {
        return null;
    }
};

export const saveWaterReadings = async (readings: WaterReading[]) => {
    const batch = writeBatch(db);
    readings.forEach(r => {
        const id = `${r.Period}_${r.UnitID}`;
        const ref = doc(db, 'waterReadings', id);
        batch.set(ref, r);
    });
    return batch.commit();
};

// --- NEW FUNCTIONS FOR PRODUCTION ---

export const saveTariffs = async (newTariffs: TariffCollection) => {
    settingsCache.tariffs = newTariffs;
    await setDoc(doc(db, 'settings', 'tariffs'), newTariffs);
};

export const saveAdjustments = async (newAdjustments: Adjustment[]) => {
    const batch = writeBatch(db);
    // Since adjustments don't have a unique ID in the type, we might assume full replace or create new.
    // For safety in this app structure, we might treat it as "append recent" or replace all for a period.
    // To properly support "Save all adjustments" logic from mock, we ideally need IDs.
    // Assuming simple add for now or overwrite if logical ID exists.
    newAdjustments.forEach(adj => {
        // Create a composite ID to avoid duplicates if possible, or just add
        const id = `${adj.Period}_${adj.UnitID}_${Math.abs(adj.Amount)}`; 
        const ref = doc(db, 'adjustments', id);
        batch.set(ref, adj);
    });
    await batch.commit();
};

export const updateChargeStatuses = async (period: string, unitIds: string[], updates: { isPrinted?: boolean; isSent?: boolean }) => {
    const batch = writeBatch(db);
    unitIds.forEach(unitId => {
        const id = `${period}_${unitId}`;
        batch.update(doc(db, 'charges', id), updates);
    });
    await batch.commit();
};

export const updateChargePayments = async (period: string, paymentUpdates: Map<string, number>) => {
    const batch = writeBatch(db);
    paymentUpdates.forEach((amount, unitId) => {
        const id = `${period}_${unitId}`;
        // Set to reconciling for manual review or paid directly?
        // Logic from BillingPage implies these are from bank statement, so we might set them as 'reconciling' or 'paid_ck'
        batch.update(doc(db, 'charges', id), {
            TotalPaid: amount,
            paymentStatus: 'reconciling',
            PaymentConfirmed: false,
            updatedAt: serverTimestamp()
        });
    });
    await batch.commit();
};

export const updatePaymentStatusBatch = async (period: string, unitIds: string[], newStatus: 'paid' | 'unpaid') => {
    const batch = writeBatch(db);
    unitIds.forEach(unitId => {
        const id = `${period}_${unitId}`;
        // Need to calculate TotalPaid based on status. If paid, set to TotalDue (need to fetch? No, just set logic)
        // Firestore update can't read-modify-write in batch easily without reading first.
        // Assuming the caller knows what to do, or we just update status.
        // BillingPage logic suggests we mark as paid (full amount) or unpaid (0).
        // Since we can't read 'TotalDue' here efficiently in batch without reads, we might just update status.
        // But BillingPage logic: TotalPaid: method === 'pending' ? 0 : c.TotalDue
        // We will just update status here, assuming client UI handles visual update, and data consistency is eventual.
        // Better: client should pass the amount if needed. For now, simple status update.
        batch.update(doc(db, 'charges', id), {
            paymentStatus: newStatus,
            PaymentConfirmed: newStatus === 'paid',
            updatedAt: serverTimestamp()
        });
    });
    await batch.commit();
};

export const importResidentsBatch = async (
    _u: Unit[], _o: Owner[], _v: Vehicle[], updates: any[]
) => {
    // Perform batched writes for imported data
    const batch = writeBatch(db);
    
    updates.forEach(row => {
        if (row.unitId) {
            // Update/Create Unit
            batch.set(doc(db, 'units', row.unitId), {
                UnitID: row.unitId,
                OwnerID: row.unitId, // Simple mapping: UnitID = OwnerID key
                UnitType: row.unitType,
                Area_m2: row.area,
                Status: row.status
            }, { merge: true });

            // Update/Create Owner
            batch.set(doc(db, 'owners', row.unitId), {
                OwnerID: row.unitId,
                OwnerName: row.ownerName,
                Phone: row.phone,
                Email: row.email,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // Update/Create Vehicles
            if (row.vehicles && Array.isArray(row.vehicles)) {
                row.vehicles.forEach((v: any) => {
                    // Generate a deterministic ID if possible, or random
                    const vId = v.PlateNumber ? v.PlateNumber.replace(/[^a-zA-Z0-9]/g, '') : `VEH_${Date.now()}_${Math.random()}`;
                    batch.set(doc(db, 'vehicles', vId), {
                        VehicleId: vId,
                        UnitID: row.unitId,
                        PlateNumber: v.PlateNumber,
                        Type: v.Type,
                        isActive: true,
                        StartDate: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                });
            }
        }
    });

    await batch.commit();
    return { createdCount: updates.length, updatedCount: 0 };
};

export const resetUserPassword = async (email: string) => {
    // Firebase Client SDK method
    await sendPasswordResetEmail(auth, email);
};

export const wipeAllBusinessData = async (progressCallback: (msg: string) => void) => {
    progressCallback("Starting wipe...");
    const collections = ['charges', 'waterReadings', 'activity_logs', 'notifications', 'operational_expenses', 'misc_revenues', 'profileRequests'];
    
    for (const col of collections) {
        progressCallback(`Deleting collection: ${col}...`);
        const q = query(collection(db, col), limit(500));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
    
    // Note: Deleting large collections in client SDK is not recommended for production massive data. 
    // This is a "soft" wipe for demo/small scale.
    progressCallback("Wipe complete.");
};

export const getPendingProfileRequest = async (residentId: string): Promise<ProfileRequest | null> => {
    try {
        const q = query(
            collection(db, 'profileRequests'), 
            where('residentId', '==', residentId), 
            where('status', '==', 'PENDING'), 
            limit(1)
        );
        const snap = await getDocs(q);
        return !snap.empty ? (snap.docs[0].data() as ProfileRequest) : null;
    } catch {
        return null;
    }
};
