
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, query, deleteDoc, updateDoc, limit, orderBy, where, serverTimestamp, startAfter } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { InvoiceSettings, Unit, Owner, Vehicle, WaterReading, ChargeRaw, Adjustment, UserPermission, ActivityLog, AllData, PaymentStatus, MonthlyStat, SystemMetadata, ProfileRequest } from '../types';
import { VehicleTier } from '../types';

// --- METADATA HELPERS ---
const METADATA_DOC_ID = 'metadata';
const SETTINGS_COLLECTION = 'settings';

export const getSystemMetadata = async (): Promise<SystemMetadata> => {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, METADATA_DOC_ID));
    if (snap.exists()) {
        return snap.data() as SystemMetadata;
    }
    return { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };
};

const bumpVersion = (batch: any, field: keyof SystemMetadata) => {
    const metaRef = doc(db, SETTINGS_COLLECTION, METADATA_DOC_ID);
    batch.set(metaRef, { [field]: Date.now() }, { merge: true });
};

// --- READ OPERATIONS ---

export const loadAllData = async (): Promise<any> => {
    return {
        units: [], owners: [], vehicles: [], tariffs: { service: [], parking: [], water: [] },
        users: [], invoiceSettings: null, adjustments: [], waterReadings: [], activityLogs: [], monthlyStats: [], lockedWaterPeriods: [],
        hasData: false
    };
};

export const fetchCollection = async <T>(colName: string): Promise<T[]> => {
    const snap = await getDocs(collection(db, colName));
    return snap.docs.map(d => d.data() as T);
};

// NEW: Optimized fetch for Residents (Single Docs instead of Collection)
export const fetchResidentSpecificData = async (unitId: string) => {
    const unitSnap = await getDoc(doc(db, 'units', unitId));
    let unit: Unit | null = null;
    let owner: Owner | null = null;
    let vehicles: Vehicle[] = [];

    if (unitSnap.exists()) {
        unit = unitSnap.data() as Unit;
        if (unit.OwnerID) {
            const ownerSnap = await getDoc(doc(db, 'owners', unit.OwnerID));
            if (ownerSnap.exists()) {
                owner = ownerSnap.data() as Owner;
            }
        }
    }

    // Fetch vehicles for this unit
    const vQ = query(collection(db, 'vehicles'), where('UnitID', '==', unitId), where('isActive', '==', true));
    const vSnap = await getDocs(vQ);
    vehicles = vSnap.docs.map(d => d.data() as Vehicle);

    return { unit, owner, vehicles };
};

// NEW: Fetch Water Readings for specific periods only (Optimization)
export const fetchRecentWaterReadings = async (periods: string[]): Promise<WaterReading[]> => {
    if (periods.length === 0) return [];
    // Firestore 'in' query supports up to 10 items
    const q = query(collection(db, 'waterReadings'), where('Period', 'in', periods.slice(0, 10)));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WaterReading);
};

// NEW: Paginated Logs Fetching
export const fetchLogsPaginated = async (lastDoc: any = null, limitCount: number = 20) => {
    let q = query(collection(db, 'activityLogs'), orderBy('ts', 'desc'), limit(limitCount));
    if (lastDoc) {
        q = query(collection(db, 'activityLogs'), orderBy('ts', 'desc'), startAfter(lastDoc), limit(limitCount));
    }
    const snap = await getDocs(q);
    return {
        data: snap.docs.map(d => d.data() as ActivityLog),
        lastDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.docs.length === limitCount
    };
};

export const fetchWaterLocks = async (): Promise<string[]> => {
    const snap = await getDocs(collection(db, 'water_locks'));
    return snap.docs
        .filter(d => d.data().isLocked === true)
        .map(d => d.id);
};

// Deprecated for Global Load, kept for compatibility if needed elsewhere
export const fetchLatestLogs = async (limitCount: number = 20): Promise<ActivityLog[]> => {
    try {
        const q = query(collection(db, 'activityLogs'), orderBy('ts', 'desc'), limit(limitCount));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as ActivityLog);
    } catch (e) {
        console.warn("Failed to fetch logs.", e);
        return [];
    }
};

// --- ONE-WAY FLOW: User Updates Profile -> Request Created ---
export const submitUserProfileUpdate = async (
    userAuthEmail: string, 
    residentId: string, 
    ownerId: string,
    newData: {
        displayName?: string;
        phoneNumber?: string;
        contactEmail?: string;
        avatarUrl?: string;
        title?: string;
        spouseName?: string;
        spousePhone?: string;
        unitStatus?: 'Owner' | 'Rent' | 'Business';
    }
) => {
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    // 1. Optimistic Update on 'users' collection (Instant Feedback for User)
    const userRef = doc(db, 'users', userAuthEmail);
    const userUpdates: any = {};
    if (newData.displayName !== undefined) userUpdates.DisplayName = newData.displayName;
    if (newData.contactEmail !== undefined) userUpdates.contact_email = newData.contactEmail;
    if (newData.avatarUrl !== undefined) userUpdates.avatarUrl = newData.avatarUrl;
    if (newData.title !== undefined) userUpdates.title = newData.title;
    if (newData.spouseName !== undefined) userUpdates.spouseName = newData.spouseName; 
    if (newData.spousePhone !== undefined) userUpdates.spousePhone = newData.spousePhone;
    if (newData.unitStatus !== undefined) userUpdates.apartmentStatus = newData.unitStatus; 
    
    batch.update(userRef, userUpdates);
    bumpVersion(batch, 'users_version');

    // 2. Create Profile Request for Admin (Official Data Update)
    const requestId = `req_${Date.now()}_${residentId}`;
    const requestRef = doc(db, 'profileRequests', requestId);
    
    const changesForAdmin: ProfileRequest['changes'] = {};
    if (newData.displayName !== undefined) changesForAdmin.OwnerName = newData.displayName;
    if (newData.phoneNumber !== undefined) changesForAdmin.Phone = newData.phoneNumber;
    if (newData.contactEmail !== undefined) changesForAdmin.Email = newData.contactEmail;
    if (newData.avatarUrl !== undefined) changesForAdmin.avatarUrl = newData.avatarUrl;
    
    // Mapping: spouseName -> secondOwnerName for Official Records
    if (newData.spouseName !== undefined) changesForAdmin.secondOwnerName = newData.spouseName;
    if (newData.spousePhone !== undefined) changesForAdmin.secondOwnerPhone = newData.spousePhone;
    if (newData.unitStatus !== undefined) changesForAdmin.UnitStatus = newData.unitStatus;

    const profileRequest: ProfileRequest = {
        id: requestId,
        residentId,
        ownerId,
        status: 'PENDING',
        changes: changesForAdmin,
        createdAt: now,
        updatedAt: now
    };

    batch.set(requestRef, profileRequest);

    await batch.commit();
    return profileRequest;
};

export const createProfileRequest = async (request: ProfileRequest) => {
    await setDoc(doc(db, 'profileRequests', request.id), request);
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
        if (!snap.empty) {
            return snap.docs[0].data() as ProfileRequest;
        }
        return null;
    } catch (e) {
        console.error("Error checking pending requests", e);
        return null;
    }
};

export const getAllPendingProfileRequests = async (): Promise<ProfileRequest[]> => {
    try {
        const q = query(collection(db, 'profileRequests'), where('status', '==', 'PENDING'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as ProfileRequest);
    } catch (e) {
        console.error("Error fetching all pending requests", e);
        return [];
    }
};

// --- ADMIN APPROVAL FLOW ---
export const resolveProfileRequest = async (
    request: ProfileRequest, 
    action: 'approve' | 'reject', 
    adminEmail: string,
    approvedChanges?: Partial<ProfileRequest['changes']>
) => {
    const batch = writeBatch(db);
    
    // 1. Update Request Status
    const reqRef = doc(db, 'profileRequests', request.id);
    batch.update(reqRef, { 
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        updatedAt: new Date().toISOString()
    });

    // 2. If Approved, Update Official Tables (Owners & Units)
    if (action === 'approve') {
        const changesToApply = approvedChanges || request.changes;
        
        // Update Owner Info
        const ownerRef = doc(db, 'owners', request.ownerId);
        const ownerUpdates: any = {};
        
        if (changesToApply.OwnerName !== undefined) ownerUpdates.OwnerName = changesToApply.OwnerName;
        if (changesToApply.Phone !== undefined) ownerUpdates.Phone = changesToApply.Phone;
        if (changesToApply.Email !== undefined) ownerUpdates.Email = changesToApply.Email;
        
        // Critical Fix: Explicitly map second owner fields
        if (changesToApply.secondOwnerName !== undefined) ownerUpdates.secondOwnerName = changesToApply.secondOwnerName;
        if (changesToApply.secondOwnerPhone !== undefined) ownerUpdates.secondOwnerPhone = changesToApply.secondOwnerPhone;
        if (changesToApply.avatarUrl !== undefined) ownerUpdates.avatarUrl = changesToApply.avatarUrl;
        
        ownerUpdates.updatedAt = new Date().toISOString();

        if (Object.keys(ownerUpdates).length > 0) {
            batch.update(ownerRef, ownerUpdates);
            bumpVersion(batch, 'owners_version');
        }

        // Update Unit Info (Status)
        if (changesToApply.UnitStatus) {
            batch.update(doc(db, 'units', request.residentId), { Status: changesToApply.UnitStatus });
            bumpVersion(batch, 'units_version');
        }

        // Log Activity
        const logId = `log_${Date.now()}`;
        batch.set(doc(db, 'activityLogs', logId), {
            id: logId,
            ts: new Date().toISOString(),
            actor_email: adminEmail,
            actor_role: 'Admin',
            module: 'Residents',
            action: 'APPROVE_PROFILE_UPDATE',
            summary: `Duyệt cập nhật thông tin cư dân ${request.residentId}`,
            undone: false,
            ids: [request.residentId],
            before_snapshot: null
        } as ActivityLog);
        
        // Notify Resident
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
            type: 'system',
            title: 'Hồ sơ đã được duyệt',
            body: 'Thông tin chính thức của bạn trên hệ thống BQL đã được cập nhật.',
            userId: request.residentId, // Sending to Unit ID as User ID
            isRead: false,
            createdAt: new Date().toISOString()
        });
    } else {
        // Notify Rejection
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
            type: 'system',
            title: 'Yêu cầu bị từ chối',
            body: 'BQL đã từ chối yêu cầu thay đổi thông tin chính thức của bạn.',
            userId: request.residentId,
            isRead: false,
            createdAt: new Date().toISOString()
        });
    }

    await batch.commit();
};

export const updateResidentAvatar = async (ownerId: string, avatarUrl: string, userEmail?: string): Promise<void> => {
    const batch = writeBatch(db);
    
    // 1. Update Official Owner Record
    const ownerRef = doc(db, 'owners', ownerId);
    batch.update(ownerRef, { avatarUrl: avatarUrl, updatedAt: new Date().toISOString() });
    bumpVersion(batch, 'owners_version');

    // 2. Update User Account Record (Optimistic)
    if (userEmail) {
        const userRef = doc(db, 'users', userEmail);
        batch.update(userRef, { avatarUrl: avatarUrl });
        bumpVersion(batch, 'users_version');
    }
    await batch.commit();
};

export const logActivity = async (log: ActivityLog) => {
    await setDoc(doc(db, 'activityLogs', log.id), log);
};

export const updateFeeSettings = (settings: InvoiceSettings) => setDoc(doc(db, 'settings', 'invoice'), settings, { merge: true });

export const saveChargesBatch = (charges: ChargeRaw[], periodStat?: MonthlyStat) => {
    if (charges.length === 0 && !periodStat) return Promise.resolve();
    const batch = writeBatch(db);
    charges.forEach(charge => batch.set(doc(db, 'charges', `${charge.Period}_${charge.UnitID}`), charge));
    if (periodStat) {
        batch.set(doc(db, 'monthly_stats', periodStat.period), periodStat);
    }
    return batch.commit();
};

export const updateChargeStatuses = (period: string, unitIds: string[], updates: { isPrinted?: boolean; isSent?: boolean }) => {
    if (unitIds.length === 0) return Promise.resolve();
    const batch = writeBatch(db);
    unitIds.forEach(id => batch.update(doc(db, 'charges', `${period}_${id}`), updates));
    return batch.commit();
};

export const updateChargePayments = (period: string, paymentUpdates: Map<string, number>) => {
    if (paymentUpdates.size === 0) return Promise.resolve();
    const batch = writeBatch(db);
    paymentUpdates.forEach((amount, id) => batch.update(doc(db, 'charges', `${period}_${id}`), { TotalPaid: amount, paymentStatus: 'reconciling', PaymentConfirmed: false }));
    return batch.commit();
};

export const confirmSinglePayment = async (charge: ChargeRaw, finalPaidAmount: number, status: PaymentStatus = 'paid') => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'charges', `${charge.Period}_${charge.UnitID}`), { TotalPaid: finalPaidAmount, paymentStatus: status, PaymentConfirmed: true });
    const diff = finalPaidAmount - charge.TotalDue;
    if (diff !== 0) {
        const nextPeriod = new Date(charge.Period + '-02');
        nextPeriod.setMonth(nextPeriod.getMonth() + 1);
        const nextPeriodStr = nextPeriod.toISOString().slice(0, 7);
        const adj: Adjustment = { UnitID: charge.UnitID, Period: nextPeriodStr, Amount: -diff, Description: 'Công nợ kỳ trước', SourcePeriod: charge.Period };
        batch.set(doc(db, 'adjustments', `ADJ_${nextPeriodStr}_${charge.UnitID}`), adj, { merge: true });
    }
    return batch.commit();
};

export const updatePaymentStatusBatch = (period: string, unitIds: string[], status: 'paid' | 'unpaid', charges: ChargeRaw[]) => {
    if (unitIds.length === 0) return Promise.resolve();
    const batch = writeBatch(db);
    const chargesMap = new Map(charges.map(c => [c.UnitID, c]));
    unitIds.forEach(id => {
        const update = { paymentStatus: status, PaymentConfirmed: status === 'paid', TotalPaid: status === 'paid' ? (chargesMap.get(id)?.TotalDue ?? 0) : 0 };
        batch.update(doc(db, 'charges', `${period}_${id}`), update);
    });
    return batch.commit();
};

export const updateResidentData = async (
    currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[],
    data: { unit: Unit; owner: Owner; vehicles: Vehicle[] }
) => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'units', data.unit.UnitID), data.unit);
    batch.set(doc(db, 'owners', data.owner.OwnerID), data.owner);

    const activeIds = new Set<string>();
    let maxIndex = currentVehicles
        .filter(v => v.UnitID === data.unit.UnitID && v.PlateNumber.startsWith(`${data.unit.UnitID}-XD`))
        .reduce((max, veh) => {
            const match = veh.PlateNumber.match(/-XD(\d+)$/);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);

    data.vehicles.forEach(v => {
        let id = v.VehicleId;
        let vehicleToSave = { ...v };
        if (vehicleToSave.Type === VehicleTier.BICYCLE && id.startsWith('VEH_NEW_') && !vehicleToSave.PlateNumber) {
            maxIndex++;
            vehicleToSave.PlateNumber = `${data.unit.UnitID}-XD${maxIndex}`;
        }
        if (id.startsWith('VEH_NEW_')) {
            const newRef = doc(collection(db, 'vehicles'));
            id = newRef.id;
            batch.set(newRef, { ...vehicleToSave, VehicleId: id, updatedAt: new Date().toISOString() });
        } else {
            batch.set(doc(db, 'vehicles', id), { ...vehicleToSave, updatedAt: new Date().toISOString() });
        }
        activeIds.add(id);
    });

    currentVehicles.filter(v => v.UnitID === data.unit.UnitID && !activeIds.has(v.VehicleId)).forEach(v => {
        batch.update(doc(db, 'vehicles', v.VehicleId), { isActive: false, updatedAt: new Date().toISOString() });
    });

    bumpVersion(batch, 'units_version');
    bumpVersion(batch, 'owners_version');
    bumpVersion(batch, 'vehicles_version');

    await batch.commit();
    return true; 
};

export const wipeAllBusinessData = async (progress: (msg: string) => void) => {
    const collections = ['charges', 'waterReadings', 'vehicles', 'adjustments', 'owners', 'units', 'activityLogs', 'monthly_stats', 'billing_locks', 'water_locks', 'profileRequests'];
    for (const name of collections) {
        progress(`Querying ${name}...`);
        const snapshot = await getDocs(collection(db, name));
        if (snapshot.empty) continue;
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => batch.delete(d.ref));
        progress(`Deleting ${snapshot.size} docs from ${name}...`);
        await batch.commit();
    }
};

const saveBatch = (name: string, data: any[]) => {
    if (data.length === 0) return Promise.resolve();
    const batch = writeBatch(db);
    data.forEach(item => {
        const id = item.id ?? item.Email ?? item.UnitID ?? item.OwnerID ?? item.VehicleId ?? `${item.Period}_${item.UnitID}`;
        batch.set(doc(db, name, id), item);
    });
    return batch.commit();
};

export const saveUsers = async (d: UserPermission[]) => {
    const batch = writeBatch(db);
    d.forEach(u => batch.set(doc(db, 'users', u.Email), u));
    bumpVersion(batch, 'users_version');
    return batch.commit();
};

export const deleteUsers = async (emails: string[]) => {
    if (emails.length === 0) return Promise.resolve();
    const batch = writeBatch(db);
    emails.forEach(email => batch.delete(doc(db, 'users', email)));
    bumpVersion(batch, 'users_version');
    return batch.commit();
};

export const saveTariffs = async (d: AllData['tariffs']) => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'settings', 'tariffs'), d);
    bumpVersion(batch, 'tariffs_version');
    return batch.commit();
};

export const saveVehicles = async (d: Vehicle[]) => {
    if (d.length === 0) return;
    const batch = writeBatch(db);
    d.forEach(v => batch.set(doc(db, 'vehicles', v.VehicleId), v));
    bumpVersion(batch, 'vehicles_version');
    return batch.commit();
};

export const saveAdjustments = (d: Adjustment[]) => saveBatch('adjustments', d);
export const saveWaterReadings = (d: WaterReading[]) => saveBatch('waterReadings', d);

export const importResidentsBatch = async (
    currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[], updates: any[]
) => {
    const batch = writeBatch(db);
    let created = 0, updated = 0, vehicleCount = 0;
    const plateCounters = new Map<string, { xd: number, eb: number }>();
    const unitIdsToUpdate = new Set(updates.map(up => String(up.unitId).trim()));

    currentVehicles.forEach(v => {
        if (unitIdsToUpdate.has(v.UnitID)) {
            batch.update(doc(db, "vehicles", v.VehicleId), { isActive: false, log: `Deactivated on import ${new Date().toISOString()}` });
        }
    });

    unitIdsToUpdate.forEach(unitId => {
        const existingBicycles = currentVehicles.filter(v => v.UnitID === unitId && v.PlateNumber.startsWith(`${unitId}-XD`));
        const maxXd = existingBicycles.reduce((max, v) => {
            const match = v.PlateNumber.match(/-XD(\d+)$/);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        const existingEBikes = currentVehicles.filter(v => v.UnitID === unitId && v.PlateNumber.startsWith(`${unitId}-EB`));
        const maxEb = existingEBikes.reduce((max, v) => {
            const match = v.PlateNumber.match(/-EB(\d+)$/);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        plateCounters.set(unitId, { xd: maxXd, eb: maxEb });
    });

    updates.forEach(up => {
        const unitId = String(up.unitId).trim();
        const existingUnit = currentUnits.find(u => u.UnitID === unitId);

        if (existingUnit) {
            batch.update(doc(db, "units", unitId), { Status: up.status, Area_m2: up.area, UnitType: up.unitType });
            batch.update(doc(db, "owners", existingUnit.OwnerID), { OwnerName: up.ownerName, Phone: up.phone, Email: up.email });
            updated++;
        } else {
            const newOwnerId = doc(collection(db, "owners")).id;
            batch.set(doc(db, "owners", newOwnerId), { OwnerID: newOwnerId, OwnerName: up.ownerName, Phone: up.phone, Email: up.email });
            batch.set(doc(db, "units", unitId), { UnitID: unitId, OwnerID: newOwnerId, UnitType: up.unitType, Area_m2: up.area, Status: up.status });
            created++;
        }
        
        if (up.vehicles && Array.isArray(up.vehicles)) {
            up.vehicles.forEach((v: any) => {
                const plate = String(v.PlateNumber || '').trim();
                const isBicycle = v.Type === VehicleTier.BICYCLE;
                const isEBike = v.Type === VehicleTier.EBIKE;
                const isNumericQuantity = /^\d+$/.test(plate);
                const quantity = isNumericQuantity ? parseInt(plate, 10) : 0;

                if ((isBicycle || isEBike) && (quantity > 0 || plate === '')) {
                    const count = plate === '' ? 1 : quantity;
                    const counters = plateCounters.get(unitId)!;
                    const prefix = isBicycle ? 'XD' : 'EB';
                    const typeKey = isBicycle ? 'xd' : 'eb';
                    const type = isBicycle ? VehicleTier.BICYCLE : VehicleTier.EBIKE;

                    for (let i = 0; i < count; i++) {
                        counters[typeKey]++;
                        const newPlate = `${unitId}-${prefix}${counters[typeKey]}`;
                        const newVehicleRef = doc(collection(db, "vehicles"));
                        batch.set(newVehicleRef, {
                            VehicleId: newVehicleRef.id, UnitID: unitId, Type: type, VehicleName: v.VehicleName || (isBicycle ? 'Xe đạp' : 'Xe điện'), PlateNumber: newPlate, StartDate: new Date().toISOString().split('T')[0], isActive: true, parkingStatus: up.parkingStatus || null,
                        });
                        vehicleCount++;
                    }
                    plateCounters.set(unitId, counters);
                } else {
                    const newVehicleRef = doc(collection(db, "vehicles"));
                    batch.set(newVehicleRef, {
                        VehicleId: newVehicleRef.id, UnitID: unitId, Type: v.Type, VehicleName: v.VehicleName || '', PlateNumber: plate, StartDate: new Date().toISOString().split('T')[0], isActive: true, parkingStatus: up.parkingStatus || null,
                    });
                    vehicleCount++;
                }
            });
        }
    });

    bumpVersion(batch, 'units_version');
    bumpVersion(batch, 'owners_version');
    bumpVersion(batch, 'vehicles_version');

    await batch.commit();
    return { units: [], owners: [], vehicles: [], createdCount: created, updatedCount: updated, vehicleCount };
};

export const getLockStatus = async (month: string): Promise<boolean> => {
    const docRef = doc(db, 'water_locks', month);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data().isLocked : false;
};

export const setLockStatus = async (month: string, status: boolean): Promise<void> => {
    const docRef = doc(db, 'water_locks', month);
    await setDoc(docRef, { isLocked: status, updatedAt: new Date().toISOString() });
};

export const getBillingLockStatus = async (period: string): Promise<boolean> => {
    const docRef = doc(db, 'billing_locks', period);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data().isLocked : false;
};

export const setBillingLockStatus = async (period: string, status: boolean): Promise<void> => {
    const docRef = doc(db, 'billing_locks', period);
    await setDoc(docRef, { isLocked: status, updatedAt: new Date().toISOString() });
};

export const resetUserPassword = async (email: string): Promise<void> => {
    const userRef = doc(db, 'users', email);
    await updateDoc(userRef, { password: '123456', mustChangePassword: true });
};
