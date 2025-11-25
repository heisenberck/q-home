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
};

patchKiosAreas(units);

export const loadAllData = async () => {
    console.log("MockAPI: loadAllData called");
    return Promise.resolve({
        units, owners, vehicles, waterReadings, charges, adjustments, users, activityLogs, invoiceSettings, tariffs, hasData: units.length > 0
    });
};

export const updateFeeSettings = async (settings: InvoiceSettings) => {
    console.log("MockAPI: updateFeeSettings", settings);
    invoiceSettings = settings;
    return Promise.resolve();
};

export const saveChargesBatch = async (newCharges: ChargeRaw[]) => {
    console.log(`MockAPI: saveChargesBatch for period ${newCharges[0]?.Period}`);
    const period = newCharges[0]?.Period;
    if (period) {
        charges = [...charges.filter(c => c.Period !== period), ...newCharges];
    }
    return Promise.resolve();
};

export const updateChargeStatuses = async (period: string, unitIds: string[], updates: { isPrinted?: boolean; isSent?: boolean }) => {
    console.log("MockAPI: updateChargeStatuses", { period, unitIds, updates });
    charges = charges.map(c => (c.Period === period && unitIds.includes(c.UnitID)) ? { ...c, ...updates } : c);
    return Promise.resolve();
};

export const updateChargePayments = async (period: string, paymentUpdates: Map<string, number>) => {
    console.log("MockAPI: updateChargePayments", paymentUpdates);
    charges = charges.map(c => {
        if (c.Period === period && paymentUpdates.has(c.UnitID)) {
            return { ...c, TotalPaid: paymentUpdates.get(c.UnitID)!, paymentStatus: 'reconciling', PaymentConfirmed: false };
        }
        return c;
    });
    return Promise.resolve();
};

export const confirmSinglePayment = async (charge: ChargeRaw, finalPaidAmount: number) => {
    console.log("MockAPI: confirmSinglePayment for", charge.UnitID);
    charges = charges.map(c => c.Period === charge.Period && c.UnitID === charge.UnitID ? { ...c, TotalPaid: finalPaidAmount, paymentStatus: 'paid', PaymentConfirmed: true } : c);
    return Promise.resolve();
};

export const updatePaymentStatusBatch = async (period: string, unitIds: string[], newStatus: 'paid' | 'unpaid') => {
    console.log("MockAPI: updatePaymentStatusBatch to", newStatus);
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
    console.log("MockAPI: updateResidentData for", updatedData.unit.UnitID);
    const { unit, owner, vehicles: draftVehicles } = updatedData;
    units = currentUnits.map(u => u.UnitID === unit.UnitID ? unit : u);
    owners = currentOwners.map(o => o.OwnerID === owner.OwnerID ? owner : o);
    vehicles = [...currentVehicles.filter(v => v.UnitID !== unit.UnitID), ...draftVehicles];
    return Promise.resolve({ units, owners, vehicles });
};

export const wipeAllBusinessData = async (progressCallback: (message: string) => void) => {
    console.log("MockAPI: wipeAllBusinessData");
    progressCallback("Wiping mock data in memory...");
    units = []; owners = []; vehicles = []; waterReadings = []; charges = []; adjustments = []; activityLogs = [];
    await new Promise(r => setTimeout(r, 500));
    progressCallback("Done.");
    return Promise.resolve();
};

export const saveUsers = async (newUsers: UserPermission[]) => {
    console.log("MockAPI: saveUsers");
    users = newUsers;
    return Promise.resolve();
};

export const saveTariffs = async (newTariffs: TariffCollection) => {
    console.log("MockAPI: saveTariffs");
    tariffs = newTariffs;
    return Promise.resolve();
};

export const saveAdjustments = async (newAdjustments: Adjustment[]) => {
    console.log("MockAPI: saveAdjustments");
    adjustments = newAdjustments;
    return Promise.resolve();
};

export const saveWaterReadings = async (newReadings: WaterReading[]) => {
    console.log("MockAPI: saveWaterReadings");
    waterReadings = newReadings;
    return Promise.resolve();
};

export const saveVehicles = async (newVehicles: Vehicle[]) => {
    console.log("MockAPI: saveVehicles");
    vehicles = newVehicles;
    return Promise.resolve();
};

export const importResidentsBatch = async (
    currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[], updates: any[]
) => {
    console.log("MockAPI: importResidentsBatch");
    let createdCount = 0, updatedCount = 0, vehicleCount = 0;
    updates.forEach(update => {
        const unitId = String(update.unitId).trim();
        let unit = currentUnits.find(u => u.UnitID === unitId);
        if (!unit) {
            const newOwnerId = `OWN_MOCK_${Date.now()}_${Math.random()}`;
            const newOwner = { OwnerID: newOwnerId, OwnerName: update.ownerName, Phone: update.phone, Email: update.email };
            owners.push(newOwner);
            const newUnit = { UnitID: unitId, OwnerID: newOwnerId, UnitType: update.unitType, Area_m2: update.area, Status: update.status };
            units.push(newUnit);
            createdCount++;
        } else {
            updatedCount++;
        }
    });
    return Promise.resolve({ units, owners, vehicles, createdCount, updatedCount, vehicleCount });
};