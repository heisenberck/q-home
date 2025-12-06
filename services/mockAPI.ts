// services/mockAPI.ts
import type { InvoiceSettings, Unit, Owner, Vehicle, WaterReading, ChargeRaw, Adjustment, UserPermission, ActivityLog, AllData, TariffCollection } from '../types';
import { MOCK_UNITS, MOCK_OWNERS, MOCK_VEHICLES, MOCK_WATER_READINGS, MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_ADJUSTMENTS, MOCK_USER_PERMISSIONS, patchKiosAreas } from '../constants';
import { UnitType } from '../types';

let units: Unit[] = JSON.parse(JSON.stringify(MOCK_UNITS));
let owners: Owner[] = JSON.parse(JSON.stringify(MOCK_OWNERS));
let vehicles: Vehicle[] = JSON.parse(JSON.stringify(MOCK_VEHICLES));
let waterReadings: WaterReading[] = JSON.parse(JSON.stringify(MOCK_WATER_READINGS));
let charges: ChargeRaw[] = [];
let adjustments: Adjustment[] = JSON.parse(JSON.stringify(MOCK_ADJUSTMENTS));
let users: UserPermission[] = JSON.parse(JSON.stringify(MOCK_USER_PERMISSIONS));
let activityLogs: ActivityLog[] = [];
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

patchKiosAreas(units);

export const loadAllData = async () => {
    return Promise.resolve({
        units, owners, vehicles, waterReadings, charges, adjustments, users, activityLogs, invoiceSettings, tariffs, hasData: units.length > 0
    });
};

export const updateFeeSettings = async (settings: InvoiceSettings) => {
    invoiceSettings = settings;
    return Promise.resolve();
};

export const saveChargesBatch = async (newCharges: ChargeRaw[]) => {
    const period = newCharges[0]?.Period;
    if (period) {
        charges = [...charges.filter(c => c.Period !== period), ...newCharges];
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

export const confirmSinglePayment = async (charge: ChargeRaw, finalPaidAmount: number) => {
    charges = charges.map(c => c.Period === charge.Period && c.UnitID === charge.UnitID ? { ...c, TotalPaid: finalPaidAmount, paymentStatus: 'paid', PaymentConfirmed: true } : c);
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
    vehicles = [...currentVehicles.filter(v => v.UnitID !== unit.UnitID), ...draftVehicles];
    return Promise.resolve({ units, owners, vehicles });
};

export const wipeAllBusinessData = async (progressCallback: (message: string) => void) => {
    progressCallback("Wiping mock data in memory...");
    units = []; owners = []; vehicles = []; waterReadings = []; charges = []; adjustments = []; activityLogs = [];
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
    waterReadings = newReadings;
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
    const unitIdsToUpdate = new Set(updates.map(up => up.unitId));

    // Deactivate old vehicles
    vehicles = vehicles.map(v => {
        if (unitIdsToUpdate.has(v.UnitID)) {
            return { ...v, isActive: false };
        }
        return v;
    });

    updates.forEach(update => {
        const unitId = String(update.unitId).trim();
        let unit = units.find(u => u.UnitID === unitId);

        if (unit) {
            // Update existing unit and owner
            units = units.map(u => u.UnitID === unitId ? { ...u, Status: update.status, Area_m2: update.area, UnitType: update.unitType } : u);
            owners = owners.map(o => o.OwnerID === unit!.OwnerID ? { ...o, OwnerName: update.ownerName, Phone: update.phone, Email: update.email } : o);
            updatedCount++;
        } else {
            // Create new unit and owner
            const newOwnerId = `OWN_MOCK_${Date.now()}_${Math.random()}`;
            owners.push({ OwnerID: newOwnerId, OwnerName: update.ownerName, Phone: update.phone, Email: update.email });
            units.push({ UnitID: unitId, OwnerID: newOwnerId, UnitType: update.unitType, Area_m2: update.area, Status: update.status });
            createdCount++;
        }
        
        // Add new vehicles
        if (update.vehicles && Array.isArray(update.vehicles)) {
            update.vehicles.forEach((v: any) => {
                const newVehicle: Vehicle = {
                    VehicleId: `VEH_MOCK_${Date.now()}_${Math.random()}`,
                    UnitID: unitId,
                    Type: v.Type,
                    VehicleName: v.VehicleName || '',
                    PlateNumber: v.PlateNumber,
                    StartDate: new Date().toISOString().split('T')[0],
                    isActive: true,
                    parkingStatus: update.parkingStatus || null,
                };
                vehicles.push(newVehicle);
                vehicleCount++;
            });
        }
    });
    
    return Promise.resolve({ units, owners, vehicles, createdCount, updatedCount, vehicleCount });
};