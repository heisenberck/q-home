
// services/firebaseAPI.ts
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, query, deleteDoc, updateDoc, limit, orderBy, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { InvoiceSettings, Unit, Owner, Vehicle, WaterReading, ChargeRaw, Adjustment, UserPermission, ActivityLog, AllData, PaymentStatus, MonthlyStat, SystemMetadata, ProfileRequest } from '../types';
import { VehicleTier } from '../types';
import { MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_USER_PERMISSIONS } from '../constants';

// --- METADATA HELPERS ---
const METADATA_DOC_ID = 'metadata';
const SETTINGS_COLLECTION = 'settings';

export const getSystemMetadata = async (): Promise<SystemMetadata> => {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, METADATA_DOC_ID));
    if (snap.exists()) {
        return snap.data() as SystemMetadata;
    }
    // Return default if not exists (forces initial load)
    return { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };
};

// Helper to atomically bump a version number
const bumpVersion = (batch: any, field: keyof SystemMetadata) => {
    const metaRef = doc(db, SETTINGS_COLLECTION, METADATA_DOC_ID);
    batch.set(metaRef, { [field]: Date.now() }, { merge: true });
};

// --- READ OPERATIONS ---

// Used only for initial migration or DEV mode
export const loadAllData = async (): Promise<any> => {
    // Return safe empty structure
    return {
        units: [], owners: [], vehicles: [], tariffs: { service: [], parking: [], water: [] },
        users: [], invoiceSettings: null, adjustments: [], waterReadings: [], activityLogs: [], monthlyStats: [], lockedWaterPeriods: [],
        hasData: false
    };
};

// NEW: Granular Fetchers for useSmartData
export const fetchCollection = async <T>(colName: string): Promise<T[]> => {
    const snap = await getDocs(collection(db, colName));
    return snap.docs.map(d => d.data() as T);
};

// OPTIMIZATION: Only fetch the latest 20 logs to save bandwidth and read quota
// This is sufficient for the dashboard footer and initial view.
export const fetchLatestLogs = async (limitCount: number = 20): Promise<ActivityLog[]> => {
    try {
        const q = query(collection(db, 'activityLogs'), orderBy('ts', 'desc'), limit(limitCount));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as ActivityLog);
    } catch (e) {
        console.warn("Failed to fetch logs (possibly missing index). Returning empty.", e);
        return [];
    }
};

// --- PROFILE REQUEST OPERATIONS (APPROVAL WORKFLOW) ---

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

// NEW: Fetch all pending requests for Admin View
export const getAllPendingProfileRequests = async (): Promise<ProfileRequest[]> => {
    try {
        const q = query(
            collection(db, 'profileRequests'),
            where('status', '==', 'PENDING')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as ProfileRequest);
    } catch (e) {
        console.error("Error fetching all pending requests", e);
        return [];
    }
};

export const createProfileRequest = async (request: ProfileRequest) => {
    await setDoc(doc(db, 'profileRequests', request.id), request);
};

export const resolveProfileRequest = async (
    request: ProfileRequest, 
    action: 'approve' | 'reject', 
    adminEmail: string,
    approvedChanges?: Partial<ProfileRequest['changes']> // NEW: Allow selective approval
) => {
    const batch = writeBatch(db);
    const reqRef = doc(db, 'profileRequests', request.id);

    // 1. Update Request Status
    batch.update(reqRef, { 
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        updatedAt: new Date().toISOString()
    });

    // 2. If Approved, Apply Changes
    if (action === 'approve') {
        // Use approvedChanges if provided (partial approval), otherwise use all request changes
        const changesToApply = approvedChanges || request.changes;
        
        // Update Owner Data
        const ownerUpdates: any = {};
        if (changesToApply.OwnerName) ownerUpdates.OwnerName = changesToApply.OwnerName;
        if (changesToApply.Phone) ownerUpdates.Phone = changesToApply.Phone;
        if (changesToApply.Email) ownerUpdates.Email = changesToApply.Email;
        if (changesToApply.title) ownerUpdates.title = changesToApply.title;
        if (changesToApply.secondOwnerName) ownerUpdates.secondOwnerName = changesToApply.secondOwnerName;
        if (changesToApply.secondOwnerPhone) ownerUpdates.secondOwnerPhone = changesToApply.secondOwnerPhone;
        if (changesToApply.avatarUrl) ownerUpdates.avatarUrl = changesToApply.avatarUrl;

        if (Object.keys(ownerUpdates).length > 0) {
            batch.update(doc(db, 'owners', request.ownerId), ownerUpdates);
            bumpVersion(batch, 'owners_version');
        }

        // Update Unit Status (if changed)
        if (changesToApply.UnitStatus) {
            batch.update(doc(db, 'units', request.residentId), { Status: changesToApply.UnitStatus });
            bumpVersion(batch, 'units_version');
        }

        // --- CRITICAL: SYNC USER TABLE IF EMAIL CHANGED ---
        // If Email is changed, we must update the 'users' collection used for Login.
        // Since Email is the Doc ID in 'users', we must Create New + Delete Old.
        if (changesToApply.Email) {
            // Find current user doc (we assume the current Owner Email was the ID)
            // Note: We need to know the OLD email. We can get it from the 'owners' table snapshot or assume
            // the system integrity holds. Best effort: Query users by residentId or try the old email from the request if we had it.
            // For now, we will try to fetch the existing Owner to get the OLD email.
            
            // NOTE: In a transaction/batch, we can't read-then-write easily without 'runTransaction'.
            // For simplicity in this batch function, we assume we can query separately or the caller handles the read.
            // However, since we are inside a batch function here, let's do a read before the batch commit? No, must use runTransaction for that.
            // To stick to the current pattern, we will fetch the CURRENT owner data first.
            
            const ownerSnap = await getDoc(doc(db, 'owners', request.ownerId));
            if (ownerSnap.exists()) {
                const currentOwnerData = ownerSnap.data() as Owner;
                const oldEmail = currentOwnerData.Email;
                const newEmail = changesToApply.Email;

                if (oldEmail && oldEmail !== newEmail) {
                    const oldUserRef = doc(db, 'users', oldEmail);
                    const oldUserSnap = await getDoc(oldUserRef);
                    
                    if (oldUserSnap.exists()) {
                        const oldUserData = oldUserSnap.data() as UserPermission;
                        
                        // Create NEW User Doc
                        const newUserRef = doc(db, 'users', newEmail);
                        batch.set(newUserRef, {
                            ...oldUserData,
                            Email: newEmail,
                            // Maintain password/role etc.
                        });

                        // Delete OLD User Doc
                        batch.delete(oldUserRef);
                        bumpVersion(batch, 'users_version');
                    }
                }
            }
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
            summary: `Duyệt yêu cầu cập nhật cho căn ${request.residentId}`,
            undone: false,
            ids: [request.residentId],
            before_snapshot: null
        } as ActivityLog);
        
        // Send Notification to Resident
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
            type: 'system',
            title: 'Hồ sơ đã cập nhật',
            body: 'BQL đã duyệt yêu cầu thay đổi thông tin của bạn.',
            userId: request.residentId, // Assuming notification system maps UnitID -> User
            isRead: false,
            createdAt: new Date().toISOString()
        });
    } else {
        // If Rejected
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
            type: 'system',
            title: 'Yêu cầu bị từ chối',
            body: 'BQL đã từ chối yêu cầu thay đổi thông tin của bạn. Vui lòng liên hệ để biết thêm chi tiết.',
            userId: request.residentId,
            isRead: false,
            createdAt: new Date().toISOString()
        });
    }

    await batch.commit();
};

// --- WRITE OPERATIONS ---

export const logActivity = async (log: ActivityLog) => {
    // Direct write, no batch needed for single log
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

    // BUMP METADATA VERSIONS
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

// Wrappers that bump versions
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

    // BUMP METADATA
    bumpVersion(batch, 'units_version');
    bumpVersion(batch, 'owners_version');
    bumpVersion(batch, 'vehicles_version');

    await batch.commit();
    return { units: [], owners: [], vehicles: [], createdCount: created, updatedCount: updated, vehicleCount };
};

// Water Lock
export const getLockStatus = async (month: string): Promise<boolean> => {
    const docRef = doc(db, 'water_locks', month);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data().isLocked : false;
};

export const setLockStatus = async (month: string, status: boolean): Promise<void> => {
    const docRef = doc(db, 'water_locks', month);
    await setDoc(docRef, { isLocked: status, updatedAt: new Date().toISOString() });
};

// Billing Lock
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
