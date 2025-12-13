
// services/mockAPI.ts
import type { InvoiceSettings, Unit, Owner, Vehicle, WaterReading, ChargeRaw, Adjustment, UserPermission, ActivityLog, AllData, TariffCollection, PaymentStatus, MonthlyStat, SystemMetadata } from '../types';
import { MOCK_UNITS, MOCK_OWNERS, MOCK_VEHICLES, MOCK_WATER_READINGS, MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_ADJUSTMENTS, MOCK_USER_PERMISSIONS, patchKiosAreas } from '../constants';
import { UnitType, VehicleTier } from '../types';

let units: Unit[] = JSON.parse(JSON.stringify(MOCK_UNITS));
let owners: Owner[] = JSON.parse(JSON.stringify(MOCK_OWNERS));
let vehicles: Vehicle[] = JSON.parse(JSON.stringify(MOCK_VEHICLES));
let waterReadings: WaterReading[] = JSON.parse(JSON.stringify(MOCK_WATER_READINGS));
let charges: ChargeRaw[] = [];
let adjustments: Adjustment[] = JSON.parse(JSON.stringify(MOCK_ADJUSTMENTS));
let users: UserPermission[] = JSON.parse(JSON.stringify(MOCK_USER_PERMISSIONS));
let activityLogs: ActivityLog[] = [];

// Initialize some mock historical stats so the Dashboard chart looks good immediately
let monthlyStats: MonthlyStat[] = [
    { period: '2024-06', totalService: 50000000, totalParking: 30000000, totalWater: 15000000, totalDue: 95000000, updatedAt: new Date().toISOString() },
    { period: '2024-07', totalService: 50000000, totalParking: 31000000, totalWater: 16000000, totalDue: 97000000, updatedAt: new Date().toISOString() },
    { period: '2024-08', totalService: 50000000, totalParking: 30500000, totalWater: 14000000, totalDue: 94500000, updatedAt: new Date().toISOString() },
    { period: '2024-09', totalService: 52000000, totalParking: 32000000, totalWater: 18000000, totalDue: 102000000, updatedAt: new Date().toISOString() },
    { period: '2024-10', totalService: 52000000, totalParking: 32500000, totalWater: 17000000, totalDue: 101500000, updatedAt: new Date().toISOString() },
    { period: '2024-11', totalService: 52000000, totalParking: 33000000, totalWater: 16500000, totalDue: 101500000, updatedAt: new Date().toISOString() },
];

let tariffs: TariffCollection = {
    service: JSON.parse(JSON.stringify(MOCK_TARIFFS_SERVICE)),
    parking: JSON.parse(JSON.stringify(MOCK_TARIFFS_PARKING)),
    water: JSON.parse(JSON.stringify(MOCK_TARIFFS_WATER)),
};
let invoiceSettings: InvoiceSettings | null = {
    logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    accountName: 'Công ty Cổ phần Mock Service', accountNumber: '123456789', bankName: 'MockBank - Chi nhánh Dev',
    senderEmail: 'dev@example.com', senderName: 'BQL Mock Data',
    emailSubject: '[MOCK] THONG BAO PHI', emailBody: 'Day la email mock.',
    transferContentTemplate: 'HUD3 {{unitId}} T{{period}}',
};

// ADDED: In-memory store for locks
let waterLocks = new Map<string, boolean>();
let billingLocks = new Map<string, boolean>();

patchKiosAreas(units);

export const loadAllData = async () => {
    // Extract locked water periods for initial load
    const lockedWaterPeriods = Array.from(waterLocks.entries())
        .filter(([_, isLocked]) => isLocked)
        .map(([period]) => period);

    return Promise.resolve({
        units, owners, vehicles, waterReadings, charges, adjustments, users, activityLogs, invoiceSettings, tariffs, monthlyStats, 
        lockedWaterPeriods, // Return locked periods
        hasData: units.length > 0
    });
};

export const fetchLatestLogs = async (limitCount: number = 20): Promise<ActivityLog[]> => {
    // Return sorted descending
    return Promise.resolve(
        [...activityLogs]
        .sort((a,b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
        .slice(0, limitCount)
    );
};

export const logActivity = async (log: ActivityLog) => {
    activityLogs = [log, ...activityLogs];
    return Promise.resolve();
};

export const updateFeeSettings = async (settings: InvoiceSettings) => {
    invoiceSettings = settings;
    return Promise.resolve();
};

export const saveChargesBatch = async (newCharges: ChargeRaw[], periodStat?: MonthlyStat) => {
    const period = newCharges[0]?.Period;
    if (period) {
        charges = [...charges.filter(c => c.Period !== period), ...newCharges];
    }
    // Update local stats store for mock charts
    if (periodStat) {
        monthlyStats = [...monthlyStats.filter(s => s.period !== periodStat.period), periodStat];
    }
    return Promise.resolve();
};

export const updateChargeStatuses = async (period: string, unitIds: string[], updates: { isPrinted?: boolean; isSent?: boolean }) => {
    charges = charges.map(c => (c.Period === period && unitIds.includes(c.UnitID)) ? { ...c, ...updates } : c);
    return Promise.resolve();
};

export const updateChargePayments = async (period: string, paymentUpdates: Map<string, number>) => {
    charges = charges.map(c => {
        if (c.Period === period && paymentUpdates.has(c.UnitID)) {
            return { ...c, TotalPaid: paymentUpdates.get(c.UnitID)!, paymentStatus: 'reconciling', PaymentConfirmed: false };
        }
        return c;
    });
    return Promise.resolve();
};

export const confirmSinglePayment = async (charge: ChargeRaw, finalPaidAmount: number, status: PaymentStatus = 'paid') => {
    charges = charges.map(c => c.Period === charge.Period && c.UnitID === charge.UnitID ? { ...c, TotalPaid: finalPaidAmount, paymentStatus: status, PaymentConfirmed: true } : c);
    return Promise.resolve();
};

export const updatePaymentStatusBatch = async (period: string, unitIds: string[], newStatus: 'paid' | 'unpaid') => {
    charges = charges.map(c => {
        if (c.Period === period && unitIds.includes(c.UnitID)) {
            return { ...c, paymentStatus: newStatus, PaymentConfirmed: newStatus === 'paid', TotalPaid: newStatus === 'paid' ? c.TotalDue : 0 };
        }
        return c;
    });
    return Promise.resolve();
};

export const updateResidentData = async (
    currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[],
    updatedData: { unit: Unit; owner: Owner; vehicles: Vehicle[] }
) => {
    const { unit, owner, vehicles: draftVehicles } = updatedData;
    units = currentUnits.map(u => u.UnitID === unit.UnitID ? unit : u);
    owners = currentOwners.map(o => o.OwnerID === owner.OwnerID ? owner : o);

    let maxIndex = currentVehicles
        .filter(v => v.UnitID === unit.UnitID && v.PlateNumber.startsWith(`${unit.UnitID}-XD`))
        .reduce((max, veh) => {
            const match = veh.PlateNumber.match(/-XD(\d+)$/);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);

    const processedDraftVehicles = draftVehicles.map(v => {
        let vehicleToSave = { ...v };
        if (v.Type === VehicleTier.BICYCLE && v.VehicleId.startsWith('VEH_NEW_') && !v.PlateNumber) {
            maxIndex++;
            vehicleToSave.PlateNumber = `${unit.UnitID}-XD${maxIndex}`;
        }
        if(v.VehicleId.startsWith('VEH_NEW_')){
            vehicleToSave.VehicleId = `VEH_MOCK_${Date.now()}_${Math.random()}`;
        }
        return vehicleToSave;
    });

    const activeIds = new Set(processedDraftVehicles.map(v => v.VehicleId));

    vehicles.forEach(v => {
        if (v.UnitID === unit.UnitID && !activeIds.has(v.VehicleId)) {
            v.isActive = false;
            v.updatedAt = new Date().toISOString();
        }
    });

    processedDraftVehicles.forEach(updatedV => {
        const existingIdx = vehicles.findIndex(v => v.VehicleId === updatedV.VehicleId);
        if (existingIdx > -1) {
            vehicles[existingIdx] = { ...updatedV, updatedAt: new Date().toISOString() };
        } else {
            vehicles.push({ ...updatedV, updatedAt: new Date().toISOString() });
        }
    });
    
    return Promise.resolve({ units, owners, vehicles });
};

export const wipeAllBusinessData = async (progressCallback: (message: string) => void) => {
    progressCallback("Wiping mock data in memory...");
    units = []; owners = []; vehicles = []; waterReadings = []; charges = []; adjustments = []; activityLogs = []; monthlyStats = [];
    await new Promise(r => setTimeout(r, 500));
    progressCallback("Done.");
    return Promise.resolve();
};

export const saveUsers = async (newUsers: UserPermission[]) => {
    users = newUsers;
    return Promise.resolve();
};

export const saveTariffs = async (newTariffs: TariffCollection) => {
    tariffs = newTariffs;
    return Promise.resolve();
};

export const saveAdjustments = async (newAdjustments: Adjustment[]) => {
    adjustments = newAdjustments;
    return Promise.resolve();
};

export const saveWaterReadings = async (newReadings: WaterReading[]) => {
    const newReadingsSet = new Set(newReadings.map(r => `${r.Period}_${r.UnitID}`));
    const updatedReadings = [...waterReadings.filter(r => !newReadingsSet.has(`${r.Period}_${r.UnitID}`)), ...newReadings];
    waterReadings = updatedReadings;
    return Promise.resolve();
};

export const saveVehicles = async (newVehicles: Vehicle[]) => {
    vehicles = newVehicles;
    return Promise.resolve();
};

export const importResidentsBatch = async (
    currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[], updates: any[]
) => {
    let createdCount = 0, updatedCount = 0, vehicleCount = 0;
    const unitIdsToUpdate = new Set(updates.map(up => String(up.unitId).trim()));
    const plateCounters = new Map<string, { xd: number, eb: number }>();

    // Deactivate existing vehicles
    vehicles = vehicles.map(v => {
        if (unitIdsToUpdate.has(v.UnitID)) {
            return { ...v, isActive: false, log: `Deactivated on import ${new Date().toISOString()}` };
        }
        return v;
    });

    // Pre-calculate starting sequence indexes
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
    updates.forEach(update => {
        const unitId = String(update.unitId).trim();
        let unit = units.find(u => u.UnitID === unitId);

        if (unit) {
            units = units.map(u => u.UnitID === unitId ? { ...u, Status: update.status, Area_m2: update.area, UnitType: update.unitType } : u);
            owners = owners.map(o => o.OwnerID === unit!.OwnerID ? { ...o, OwnerName: update.ownerName, Phone: update.phone, Email: update.email } : o);
            updatedCount++;
        } else {
            const newOwnerId = `OWN_MOCK_${Date.now()}_${Math.random()}`;
            owners.push({ OwnerID: newOwnerId, OwnerName: update.ownerName, Phone: update.phone, Email: update.email });
            units.push({ UnitID: unitId, OwnerID: newOwnerId, UnitType: update.unitType, Area_m2: update.area, Status: update.status });
            createdCount++;
        }
        
        if (update.vehicles && Array.isArray(update.vehicles)) {
            update.vehicles.forEach((v: any) => {
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
                        
                        const newVehicle: Vehicle = {
                            VehicleId: `VEH_MOCK_${Date.now()}_${Math.random()}_${i}`,
                            UnitID: unitId,
                            Type: type,
                            VehicleName: v.VehicleName || (isBicycle ? 'Xe đạp' : 'Xe điện'),
                            PlateNumber: newPlate,
                            StartDate: new Date().toISOString().split('T')[0],
                            isActive: true,
                            parkingStatus: update.parkingStatus || null,
                        };
                        vehicles.push(newVehicle);
                        vehicleCount++;
                    }
                    plateCounters.set(unitId, counters);
                } else {
                    const newVehicle: Vehicle = {
                        VehicleId: `VEH_MOCK_${Date.now()}_${Math.random()}`,
                        UnitID: unitId,
                        Type: v.Type,
                        VehicleName: v.VehicleName || '',
                        PlateNumber: plate,
                        StartDate: new Date().toISOString().split('T')[0],
                        isActive: true,
                        parkingStatus: update.parkingStatus || null,
                    };
                    vehicles.push(newVehicle);
                    vehicleCount++;
                }
            });
        }
    });
    
    return Promise.resolve({ units, owners, vehicles, createdCount, updatedCount, vehicleCount });
};

export const getLockStatus = async (month: string): Promise<boolean> => {
    return Promise.resolve(waterLocks.get(month) ?? false);
};

export const setLockStatus = async (month: string, status: boolean): Promise<void> => {
    waterLocks.set(month, status);
    return Promise.resolve();
};

export const getBillingLockStatus = async (period: string): Promise<boolean> => {
    return Promise.resolve(billingLocks.get(period) ?? false);
};

export const setBillingLockStatus = async (period: string, status: boolean): Promise<void> => {
    billingLocks.set(period, status);
    return Promise.resolve();
};

export const resetUserPassword = async (email: string): Promise<void> => {
    users = users.map(u => 
        u.Email.toLowerCase() === email.toLowerCase() 
        ? { ...u, password: '123456', mustChangePassword: true } 
        : u
    );
    return Promise.resolve();
};
