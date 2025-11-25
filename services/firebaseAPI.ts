// services/firebaseAPI.ts
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, query } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { InvoiceSettings, Unit, Owner, Vehicle, WaterReading, ChargeRaw, Adjustment, UserPermission, ActivityLog, AllData } from '../types';
import { MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_USER_PERMISSIONS } from '../constants';
import { UnitType } from '../types';

// Internal type for the data structure returned by the loader
type AppDataForService = {
    units: Unit[];
    owners: Owner[];
    vehicles: Vehicle[];
    waterReadings: WaterReading[];
    charges: ChargeRaw[];
    adjustments: Adjustment[];
    users: UserPermission[];
    activityLogs: ActivityLog[];
    invoiceSettings: InvoiceSettings | null;
    tariffs: AllData['tariffs'];
    hasData: boolean;
};

// --- Data Loading ---
export const loadAllData = async (): Promise<AppDataForService> => {
    const collectionsToFetch = ['units', 'owners', 'vehicles', 'waterReadings', 'charges', 'adjustments', 'users', 'activityLogs'];
    const promises = collectionsToFetch.map(c => getDocs(collection(db, c)));
    
    const snapshots = await Promise.all(promises);
    const [unitsSnap, ownersSnap, vehiclesSnap, waterReadingsSnap, chargesSnap, adjustmentsSnap, usersSnap, activityLogsSnap] = snapshots;
    
    const [invoiceSettingsSnap, tariffsSnap] = await Promise.all([
        getDoc(doc(db, 'settings', 'invoice')),
        getDoc(doc(db, 'settings', 'tariffs'))
    ]);

    const loadedInvoiceSettings = invoiceSettingsSnap.exists() ? invoiceSettingsSnap.data() as InvoiceSettings : null;
    const loadedTariffs = tariffsSnap.exists() ? tariffsSnap.data() as AllData['tariffs'] : { service: MOCK_TARIFFS_SERVICE, parking: MOCK_TARIFFS_PARKING, water: MOCK_TARIFFS_WATER };

    const loadedUsers = usersSnap.docs.map(d => d.data() as UserPermission);

    return {
        units: unitsSnap.docs.map(d => d.data() as Unit),
        owners: ownersSnap.docs.map(d => d.data() as Owner),
        vehicles: vehiclesSnap.docs.map(d => d.data() as Vehicle),
        waterReadings: waterReadingsSnap.docs.map(d => d.data() as WaterReading),
        charges: chargesSnap.docs.map(d => d.data() as ChargeRaw),
        adjustments: adjustmentsSnap.docs.map(d => d.data() as Adjustment),
        users: loadedUsers.length > 0 ? loadedUsers : MOCK_USER_PERMISSIONS,
        activityLogs: activityLogsSnap.docs.map(d => d.data() as ActivityLog).sort((a,b) => b.ts.localeCompare(a.ts)),
        invoiceSettings: loadedInvoiceSettings,
        tariffs: loadedTariffs,
        hasData: unitsSnap.docs.length > 0,
    };
};

// --- Mutations ---

export const updateFeeSettings = async (settings: InvoiceSettings): Promise<void> => {
    const settingsRef = doc(db, 'settings', 'invoice');
    await setDoc(settingsRef, settings, { merge: true });
};

export const saveChargesBatch = async (charges: ChargeRaw[]): Promise<void> => {
    if (charges.length === 0) return;
    const batch = writeBatch(db);
    charges.forEach(charge => {
        const docId = `${charge.Period}_${charge.UnitID}`;
        const docRef = doc(collection(db, 'charges'), docId);
        batch.set(docRef, charge);
    });
    await batch.commit();
};

export const updateChargeStatuses = async (
    period: string,
    unitIds: string[],
    updates: { isPrinted?: boolean; isSent?: boolean }
): Promise<void> => {
    if (unitIds.length === 0) return;
    const batch = writeBatch(db);
    unitIds.forEach(unitId => {
        const docId = `${period}_${unitId}`;
        const docRef = doc(collection(db, 'charges'), docId);
        batch.update(docRef, updates);
    });
    await batch.commit();
};

export const updateChargePayments = async (
    period: string,
    paymentUpdates: Map<string, number>
): Promise<void> => {
    if (paymentUpdates.size === 0) return;
    const batch = writeBatch(db);
    paymentUpdates.forEach((amount, unitId) => {
        const docId = `${period}_${unitId}`;
        const docRef = doc(collection(db, 'charges'), docId);
        batch.update(docRef, {
            TotalPaid: amount,
            paymentStatus: 'reconciling',
            PaymentConfirmed: false,
        });
    });
    await batch.commit();
};

export const confirmSinglePayment = async (
    charge: ChargeRaw,
    finalPaidAmount: number
): Promise<void> => {
    const batch = writeBatch(db);
    const docId = `${charge.Period}_${charge.UnitID}`;
    const chargeRef = doc(collection(db, 'charges'), docId);

    batch.update(chargeRef, {
        TotalPaid: finalPaidAmount,
        paymentStatus: 'paid',
        PaymentConfirmed: true,
    });

    const difference = finalPaidAmount - charge.TotalDue;
    if (difference !== 0) {
        const nextPeriodDate = new Date(charge.Period + '-02');
        nextPeriodDate.setMonth(nextPeriodDate.getMonth() + 1);
        const nextPeriod = nextPeriodDate.toISOString().slice(0, 7);

        const adjustment: Adjustment = {
            UnitID: charge.UnitID,
            Period: nextPeriod,
            Amount: -difference,
            Description: `Công nợ kỳ trước`,
            SourcePeriod: charge.Period,
        };
        const adjustmentId = `ADJ_${nextPeriod}_${charge.UnitID}_${charge.Period}`;
        const adjustmentRef = doc(db, 'adjustments', adjustmentId);
        batch.set(adjustmentRef, adjustment, { merge: true });
    }

    await batch.commit();
};

export const updatePaymentStatusBatch = async (
    period: string,
    unitIds: string[],
    newStatus: 'paid' | 'unpaid' | 'pending',
    charges: ChargeRaw[]
): Promise<void> => {
    if (unitIds.length === 0) return;
    const batch = writeBatch(db);
    const chargesMap = new Map(charges.map(c => [c.UnitID, c]));
    unitIds.forEach(unitId => {
        const docId = `${period}_${unitId}`;
        const docRef = doc(collection(db, 'charges'), docId);
        let updateData: Partial<ChargeRaw> = { paymentStatus: newStatus };
        if (newStatus === 'paid') {
            const charge = chargesMap.get(unitId);
            updateData.PaymentConfirmed = true;
            if (charge) updateData.TotalPaid = charge.TotalDue;
        } else if (newStatus === 'unpaid') {
            updateData.PaymentConfirmed = false;
            updateData.TotalPaid = 0;
        } else {
            updateData.PaymentConfirmed = false;
        }
        batch.update(docRef, updateData);
    });
    await batch.commit();
};

export const updateResidentData = async (
    originalUnits: Unit[],
    originalOwners: Owner[],
    originalVehicles: Vehicle[],
    updatedData: { unit: Unit; owner: Owner; vehicles: Vehicle[] }
): Promise<{units: Unit[], owners: Owner[], vehicles: Vehicle[]}> => {
    const { unit, owner, vehicles: draftVehicles } = updatedData;
    const batch = writeBatch(db);
    const unitRef = doc(db, 'units', unit.UnitID);
    batch.update(unitRef, unit);
    const ownerRef = doc(db, 'owners', owner.OwnerID);
    batch.update(ownerRef, owner);

    const processedVehicles: Vehicle[] = [];
    const existingVehicleIds = new Set<string>();

    draftVehicles.forEach(draftVehicle => {
        let vehicleId = draftVehicle.VehicleId;
        if (vehicleId.startsWith('VEH_NEW_')) {
            const newVehicleRef = doc(collection(db, 'vehicles'));
            vehicleId = newVehicleRef.id;
            const newVehicle: Vehicle = { ...draftVehicle, VehicleId: vehicleId, isActive: true, updatedAt: new Date().toISOString() };
            batch.set(newVehicleRef, newVehicle);
            processedVehicles.push(newVehicle);
        } else {
            const vehicleRef = doc(db, 'vehicles', vehicleId);
            const updatedVehicle: Vehicle = { ...draftVehicle, isActive: true, updatedAt: new Date().toISOString() };
            batch.update(vehicleRef, updatedVehicle);
            processedVehicles.push(updatedVehicle);
        }
        existingVehicleIds.add(vehicleId);
    });

    const vehiclesInUnitBefore = originalVehicles.filter(v => v.UnitID === unit.UnitID);
    const softDeletedVehicles: Vehicle[] = [];
    vehiclesInUnitBefore.forEach(originalVehicle => {
        if (originalVehicle.isActive && !existingVehicleIds.has(originalVehicle.VehicleId)) {
            const vehicleRef = doc(db, 'vehicles', originalVehicle.VehicleId);
            batch.update(vehicleRef, { isActive: false, updatedAt: new Date().toISOString() });
            softDeletedVehicles.push({ ...originalVehicle, isActive: false, updatedAt: new Date().toISOString() });
        }
    });

    await batch.commit();

    // Return the new state
    return {
        units: originalUnits.map(u => u.UnitID === unit.UnitID ? unit : u),
        owners: originalOwners.map(o => o.OwnerID === owner.OwnerID ? owner : o),
        vehicles: [...originalVehicles.filter(v => v.UnitID !== unit.UnitID), ...processedVehicles, ...softDeletedVehicles],
    };
};

export const wipeAllBusinessData = async (progressCallback: (message: string) => void): Promise<void> => {
    const collectionsToDelete = ['charges', 'waterReadings', 'vehicles', 'adjustments', 'owners', 'units', 'activityLogs'];
    for (const collectionName of collectionsToDelete) {
        progressCallback(`Querying collection: ${collectionName}...`);
        const q = query(collection(db, collectionName));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            progressCallback(`Collection '${collectionName}' is empty. Skipping.`);
            continue;
        }
        let batch = writeBatch(db);
        let count = 0;
        let totalDeleted = 0;
        for (const docSnapshot of querySnapshot.docs) {
            batch.delete(docSnapshot.ref);
            count++;
            if (count === 500) { // Firestore batch limit
                await batch.commit();
                totalDeleted += count;
                progressCallback(`Deleted ${totalDeleted}/${querySnapshot.size} from '${collectionName}'`);
                batch = writeBatch(db);
                count = 0;
            }
        }
        if (count > 0) {
            await batch.commit();
            totalDeleted += count;
            progressCallback(`Finished deleting ${totalDeleted}/${querySnapshot.size} from '${collectionName}'`);
        }
    }
};

const saveCollectionBatch = async (collectionName: string, data: any[]): Promise<void> => {
    if (data.length === 0) return;
    const batch = writeBatch(db);
    data.forEach(item => {
        let docId;
        if (collectionName === 'users') docId = item.Email;
        else if (collectionName === 'units') docId = item.UnitID;
        else if (collectionName === 'owners') docId = item.OwnerID;
        else if (collectionName === 'vehicles') docId = item.VehicleId;
        else docId = doc(collection(db, collectionName)).id; // For logs, adjustments etc.
        
        const docRef = doc(db, collectionName, docId);
        batch.set(docRef, item);
    });
    await batch.commit();
};

export const saveUsers = (data: UserPermission[]) => saveCollectionBatch('users', data);
export const saveTariffs = (data: AllData['tariffs']) => setDoc(doc(db, 'settings', 'tariffs'), data);
export const saveAdjustments = (data: Adjustment[]) => saveCollectionBatch('adjustments', data);
export const saveWaterReadings = (data: WaterReading[]) => saveCollectionBatch('waterReadings', data);
export const saveVehicles = (data: Vehicle[]) => saveCollectionBatch('vehicles', data);

export const importResidentsBatch = async (
    currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[], updates: any[]
): Promise<{ units: Unit[], owners: Owner[], vehicles: Vehicle[], createdCount: number, updatedCount: number, vehicleCount: number }> => {
    if (!updates || updates.length === 0) {
        return { units: currentUnits, owners: currentOwners, vehicles: currentVehicles, createdCount: 0, updatedCount: 0, vehicleCount: 0 };
    }

    const batch = writeBatch(db);
    const nextUnits = [...currentUnits];
    const nextOwners = [...currentOwners];
    const nextVehicles = [...currentVehicles];
    let createdCount = 0, updatedCount = 0, vehicleCount = 0;

    updates.forEach(update => {
        const unitId = String(update.unitId).trim();
        if (!unitId) return;
        let unit = currentUnits.find(u => u.UnitID === unitId);

        if (!unit) { // CREATE NEW
            const newOwnerId = doc(collection(db, "owners")).id;
            const newOwner: Owner = { OwnerID: newOwnerId, OwnerName: update.ownerName || '[Chưa có tên]', Phone: update.phone || '', Email: update.email || '' };
            batch.set(doc(db, "owners", newOwnerId), newOwner);
            nextOwners.push(newOwner);

            const newUnit: Unit = { UnitID: unitId, OwnerID: newOwnerId, UnitType: update.unitType || (unitId.startsWith('K') ? UnitType.KIOS : UnitType.APARTMENT), Area_m2: parseFloat(update.area) || 0, Status: update.status || 'Owner' };
            batch.set(doc(db, "units", unitId), newUnit);
            nextUnits.push(newUnit);
            unit = newUnit;
            createdCount++;
        } else { // UPDATE EXISTING
            const unitChanges: Partial<Unit> = {};
            if (update.status) unitChanges.Status = update.status;
            if (update.area) unitChanges.Area_m2 = parseFloat(update.area) || unit.Area_m2;
            if (update.unitType) unitChanges.UnitType = update.unitType;
            if (Object.keys(unitChanges).length > 0) {
                batch.update(doc(db, "units", unitId), unitChanges);
                const unitIndex = nextUnits.findIndex(u => u.UnitID === unitId);
                if (unitIndex !== -1) nextUnits[unitIndex] = { ...nextUnits[unitIndex], ...unitChanges };
            }
            const ownerChanges: Partial<Owner> = {};
            if (update.ownerName !== undefined) ownerChanges.OwnerName = update.ownerName;
            if (update.phone !== undefined) ownerChanges.Phone = update.phone;
            if (update.email !== undefined) ownerChanges.Email = update.email;
            if (Object.keys(ownerChanges).length > 0) {
                batch.update(doc(db, "owners", unit.OwnerID), ownerChanges);
                const ownerIndex = nextOwners.findIndex(o => o.OwnerID === unit!.OwnerID);
                if (ownerIndex !== -1) nextOwners[ownerIndex] = { ...nextOwners[ownerIndex], ...ownerChanges };
            }
            updatedCount++;
        }
    });

    await batch.commit();
    return { units: nextUnits, owners: nextOwners, vehicles: nextVehicles, createdCount, updatedCount, vehicleCount };
};