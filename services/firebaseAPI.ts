// services/firebaseAPI.ts
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, query, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { InvoiceSettings, Unit, Owner, Vehicle, WaterReading, ChargeRaw, Adjustment, UserPermission, ActivityLog, AllData } from '../types';
import { VehicleTier } from '../types';
import { MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_USER_PERMISSIONS } from '../constants';

type AppDataForService = {
    units: Unit[]; owners: Owner[]; vehicles: Vehicle[]; waterReadings: WaterReading[];
    charges: ChargeRaw[]; adjustments: Adjustment[]; users: UserPermission[];
    activityLogs: ActivityLog[]; invoiceSettings: InvoiceSettings | null;
    tariffs: AllData['tariffs']; hasData: boolean;
};

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

export const updateFeeSettings = (settings: InvoiceSettings) => setDoc(doc(db, 'settings', 'invoice'), settings, { merge: true });

export const saveChargesBatch = (charges: ChargeRaw[]) => {
    if (charges.length === 0) return Promise.resolve();
    const batch = writeBatch(db);
    charges.forEach(charge => batch.set(doc(db, 'charges', `${charge.Period}_${charge.UnitID}`), charge));
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

export const confirmSinglePayment = async (charge: ChargeRaw, finalPaidAmount: number) => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'charges', `${charge.Period}_${charge.UnitID}`), { TotalPaid: finalPaidAmount, paymentStatus: 'paid', PaymentConfirmed: true });
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
    await batch.commit();
    return loadAllData().then(d => ({ units: d.units, owners: d.owners, vehicles: d.vehicles }));
};

export const wipeAllBusinessData = async (progress: (msg: string) => void) => {
    const collections = ['charges', 'waterReadings', 'vehicles', 'adjustments', 'owners', 'units', 'activityLogs'];
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

export const saveUsers = (d: UserPermission[]) => saveBatch('users', d);
export const saveTariffs = (d: AllData['tariffs']) => setDoc(doc(db, 'settings', 'tariffs'), d);
export const saveAdjustments = (d: Adjustment[]) => saveBatch('adjustments', d);
export const saveWaterReadings = (d: WaterReading[]) => saveBatch('waterReadings', d);
export const saveVehicles = (d: Vehicle[]) => saveBatch('vehicles', d);

export const importResidentsBatch = async (
    currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[], updates: any[]
) => {
    const batch = writeBatch(db);
    let created = 0, updated = 0, vehicleCount = 0;
    
    // Tracks the NEXT available index for each unit and type within this batch
    const plateCounters = new Map<string, { xd: number, eb: number }>();

    const unitIdsToUpdate = new Set(updates.map(up => String(up.unitId).trim()));

    // Deactivate all existing vehicles for the units being updated
    currentVehicles.forEach(v => {
        if (unitIdsToUpdate.has(v.UnitID)) {
            batch.update(doc(db, "vehicles", v.VehicleId), { isActive: false, log: `Deactivated on import ${new Date().toISOString()}` });
        }
    });

    // Pre-calculate the starting sequence index for all units in the batch
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

    // Process updates
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

                // Check if plate is a plain number string, representing quantity
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
                            VehicleId: newVehicleRef.id,
                            UnitID: unitId,
                            Type: type,
                            VehicleName: v.VehicleName || (isBicycle ? 'Xe đạp' : 'Xe điện'),
                            PlateNumber: newPlate,
                            StartDate: new Date().toISOString().split('T')[0],
                            isActive: true,
                            parkingStatus: up.parkingStatus || null,
                        });
                        vehicleCount++;
                    }
                    plateCounters.set(unitId, counters); // Update map with new counters
                } else {
                    // This is a vehicle with a specific plate number
                    const newVehicleRef = doc(collection(db, "vehicles"));
                    batch.set(newVehicleRef, {
                        VehicleId: newVehicleRef.id,
                        UnitID: unitId,
                        Type: v.Type,
                        VehicleName: v.VehicleName || '',
                        PlateNumber: plate,
                        StartDate: new Date().toISOString().split('T')[0],
                        isActive: true,
                        parkingStatus: up.parkingStatus || null,
                    });
                    vehicleCount++;
                }
            });
        }
    });

    await batch.commit();
    const { units, owners, vehicles } = await loadAllData();
    return { units, owners, vehicles, createdCount: created, updatedCount: updated, vehicleCount };
};

// --- NEW: Water Lock Functions ---
export const getLockStatus = async (month: string): Promise<boolean> => {
    const docRef = doc(db, 'water_locks', month);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data().isLocked : false;
};

export const setLockStatus = async (month: string, status: boolean): Promise<void> => {
    const docRef = doc(db, 'water_locks', month);
    await setDoc(docRef, { isLocked: status });
};
