
// services/firebaseAPI.ts
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, query, deleteDoc, updateDoc, limit, orderBy, where, startAfter, documentId, addDoc } from 'firebase/firestore';
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

// --- PAGINATION & SEARCH OPTIMIZATION ---

export interface ResidentPageResult {
    data: any[]; 
    lastDoc: any; 
}

export const getResidentsPaged = async (
    pageSize: number = 20, 
    lastDoc: any = null, 
    searchQuery: string = ''
): Promise<ResidentPageResult> => {
    let q;
    const unitsRef = collection(db, 'units');

    if (searchQuery) {
        if (searchQuery.length <= 4 && /^[A-Z0-9]+$/i.test(searchQuery)) {
             q = query(unitsRef, where('UnitID', '==', searchQuery.toUpperCase()));
        } else {
             q = query(unitsRef, 
                where('UnitID', '>=', searchQuery.toUpperCase()),
                where('UnitID', '<=', searchQuery.toUpperCase() + '\uf8ff'),
                limit(pageSize)
             );
        }
    } else {
        if (lastDoc) {
            q = query(unitsRef, orderBy('UnitID'), startAfter(lastDoc), limit(pageSize));
        } else {
            q = query(unitsRef, orderBy('UnitID'), limit(pageSize));
        }
    }

    const snapshot = await getDocs(q);
    const units = snapshot.docs.map(d => d.data() as Unit);
    
    if (units.length === 0) {
        return { data: [], lastDoc: null };
    }

    const ownerIds = Array.from(new Set(units.map(u => u.OwnerID).filter(Boolean)));
    const ownersMap = new Map<string, Owner>();

    if (ownerIds.length > 0) {
        const chunkedIds = [];
        for (let i = 0; i < ownerIds.length; i += 10) {
            chunkedIds.push(ownerIds.slice(i, i + 10));
        }

        const ownerPromises = chunkedIds.map(ids => 
            getDocs(query(collection(db, 'owners'), where('OwnerID', 'in', ids)))
        );
        
        const ownerSnaps = await Promise.all(ownerPromises);
        ownerSnaps.forEach(snap => {
            snap.docs.forEach(d => {
                const o = d.data() as Owner;
                ownersMap.set(o.OwnerID, o);
            });
        });
    }
    
    const combinedData = units.map(unit => ({
        unit,
        owner: ownersMap.get(unit.OwnerID) || { OwnerID: unit.OwnerID, OwnerName: 'Unknown', Phone: '', Email: '' } as Owner,
        vehicles: [], 
        pendingRequest: null 
    }));

    const unitIds = units.map(u => u.UnitID);
    if (unitIds.length > 0) {
        const chunkedUnitIds = [];
        for (let i = 0; i < unitIds.length; i += 10) {
            chunkedUnitIds.push(unitIds.slice(i, i + 10));
        }
        const reqPromises = chunkedUnitIds.map(ids => 
            getDocs(query(collection(db, 'profileRequests'), where('residentId', 'in', ids), where('status', '==', 'PENDING')))
        );
        const reqSnaps = await Promise.all(reqPromises);
        
        const requestsMap = new Map();
        reqSnaps.forEach(snap => snap.docs.forEach(d => {
            const req = d.data();
            requestsMap.set(req.residentId, req);
        }));

        combinedData.forEach(item => {
            item.pendingRequest = requestsMap.get(item.unit.UnitID) || null;
        });
    }

    return {
        data: combinedData,
        lastDoc: snapshot.docs[snapshot.docs.length - 1]
    };
};

// --- PROFILE OPERATIONS ---

// 1. DIRECT AVATAR UPDATE (Logic Fix: Find User by Unit relation, not just email)
export const updateResidentAvatar = async (ownerId: string, avatarUrl: string): Promise<void> => {
    const batch = writeBatch(db);
    
    // A. Update Owner Table (Always)
    const ownerRef = doc(db, 'owners', ownerId);
    batch.update(ownerRef, { avatarUrl: avatarUrl, updatedAt: new Date().toISOString() });
    bumpVersion(batch, 'owners_version');

    // B. Update User Table
    // To identify the correct User document (Key = UnitID/Username), we query the Unit linked to this Owner.
    const unitsQ = query(collection(db, 'units'), where('OwnerID', '==', ownerId));
    const unitsSnap = await getDocs(unitsQ);

    unitsSnap.forEach(uDoc => {
        const unitId = uDoc.data().UnitID;
        if (unitId) {
            // User Document Key is the UnitID (Username)
            const userRef = doc(db, 'users', unitId);
            // Use set with merge: true to update if exists, or safely ignore/create partially if needed
            batch.set(userRef, { avatarUrl: avatarUrl }, { merge: true });
            bumpVersion(batch, 'users_version');
        }
    });

    await batch.commit();
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
        return null;
    }
};

export const getAllPendingProfileRequests = async (): Promise<ProfileRequest[]> => {
    try {
        const q = query(collection(db, 'profileRequests'), where('status', '==', 'PENDING'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as ProfileRequest);
    } catch (e) {
        return [];
    }
};

export const createProfileRequest = async (request: ProfileRequest) => {
    await setDoc(doc(db, 'profileRequests', request.id), request);
};

// 2. RESOLVE REQUEST (Logic Fix: Use residentId as Key)
export const resolveProfileRequest = async (
    request: ProfileRequest, 
    action: 'approve' | 'reject', 
    adminEmail: string,
    approvedChanges?: Partial<ProfileRequest['changes']>
): Promise<any> => {
    const batch = writeBatch(db);
    const reqRef = doc(db, 'profileRequests', request.id);

    batch.update(reqRef, { 
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        updatedAt: new Date().toISOString()
    });

    let updatedOwnerData: any = null;
    let updatedUnitData: any = null;

    if (action === 'approve') {
        const changesToApply = approvedChanges || request.changes;
        
        // A. Update Owner
        const ownerRef = doc(db, 'owners', request.ownerId);
        const ownerSnap = await getDoc(ownerRef);
        const currentOwnerData = ownerSnap.exists() ? ownerSnap.data() as Owner : null;

        if (currentOwnerData) {
            const ownerUpdates: any = {};
            if (changesToApply.OwnerName) ownerUpdates.OwnerName = changesToApply.OwnerName;
            if (changesToApply.Phone) ownerUpdates.Phone = changesToApply.Phone;
            if (changesToApply.Email) ownerUpdates.Email = changesToApply.Email;
            if (changesToApply.title) ownerUpdates.title = changesToApply.title;
            if (changesToApply.secondOwnerName) ownerUpdates.secondOwnerName = changesToApply.secondOwnerName;
            if (changesToApply.secondOwnerPhone) ownerUpdates.secondOwnerPhone = changesToApply.secondOwnerPhone;
            if (changesToApply.avatarUrl) ownerUpdates.avatarUrl = changesToApply.avatarUrl;
            
            ownerUpdates.updatedAt = new Date().toISOString();

            if (Object.keys(ownerUpdates).length > 0) {
                batch.update(ownerRef, ownerUpdates);
                bumpVersion(batch, 'owners_version');
                updatedOwnerData = { ...currentOwnerData, ...ownerUpdates };
            }
        }

        // B. Update User (Correctly using residentId as Key)
        // request.residentId corresponds to UnitID/Username
        if (changesToApply.Email || changesToApply.OwnerName || changesToApply.avatarUrl) {
            const userRef = doc(db, 'users', request.residentId); 
            const userUpdates: any = {};
            
            if (changesToApply.Email) userUpdates.Email = changesToApply.Email;
            if (changesToApply.OwnerName) userUpdates.DisplayName = changesToApply.OwnerName;
            if (changesToApply.avatarUrl) userUpdates.avatarUrl = changesToApply.avatarUrl;

            if (Object.keys(userUpdates).length > 0) {
                batch.set(userRef, userUpdates, { merge: true });
                bumpVersion(batch, 'users_version');
            }
        }

        // C. Update Unit
        if (changesToApply.UnitStatus) {
            batch.update(doc(db, 'units', request.residentId), { Status: changesToApply.UnitStatus });
            bumpVersion(batch, 'units_version');
            updatedUnitData = { UnitID: request.residentId, Status: changesToApply.UnitStatus };
        }

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
        
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
            type: 'system',
            title: 'Hồ sơ đã cập nhật',
            body: 'BQL đã duyệt yêu cầu thay đổi thông tin của bạn.',
            userId: request.residentId, // Notif uses Username/UnitID as key
            isRead: false,
            createdAt: new Date().toISOString()
        });
    } else {
        // Rejection
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
            type: 'system',
            title: 'Yêu cầu bị từ chối',
            body: 'BQL đã từ chối yêu cầu thay đổi thông tin của bạn.',
            userId: request.residentId,
            isRead: false,
            createdAt: new Date().toISOString()
        });
    }

    await batch.commit();

    return {
        unitId: request.residentId,
        ownerId: request.ownerId,
        updatedOwner: updatedOwnerData,
        updatedUnit: updatedUnitData
    };
};

// --- WRITE OPERATIONS ---

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
        let id = item.id;
        if (!id) {
             if (name === 'users') id = item.Username; 
             else id = item.Email ?? item.UnitID ?? item.OwnerID ?? item.VehicleId ?? `${item.Period}_${item.UnitID}`;
        }
        batch.set(doc(db, name, id), item);
    });
    return batch.commit();
};

export const saveUsers = async (d: UserPermission[]) => {
    const batch = writeBatch(db);
    // Explicitly using Username as key
    d.forEach(u => batch.set(doc(db, 'users', u.Username), u));
    bumpVersion(batch, 'users_version');
    return batch.commit();
};

export const deleteUsers = async (usernames: string[]) => {
    if (usernames.length === 0) return Promise.resolve();
    const batch = writeBatch(db);
    // Deleting by Username key
    usernames.forEach(username => batch.delete(doc(db, 'users', username)));
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
    // Legacy logic might still send email here if UI calls it with email.
    // If username is key, this should probably query for key.
    // For now assuming Admin UI finds user first.
    const q = query(collection(db, 'users'), where('Email', '==', email), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { password: '123456', mustChangePassword: true });
    }
};
