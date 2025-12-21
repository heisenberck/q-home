
// services/mockAPI.ts
import type { InvoiceSettings, Unit, Owner, Vehicle, WaterReading, ChargeRaw, Adjustment, UserPermission, ActivityLog, MonthlyStat, TariffCollection, PaymentStatus, ProfileRequest, MiscRevenue } from '../types';
import { MOCK_UNITS, MOCK_OWNERS, MOCK_VEHICLES, MOCK_WATER_READINGS, MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_ADJUSTMENTS, MOCK_USER_PERMISSIONS, patchKiosAreas } from '../constants';
import { VehicleTier } from '../types';

const DB_PREFIX = 'QHOME_MOCK_DB_V2_';

const loadFromStorage = <T>(key: string, defaultData: T): T => {
    try {
        const stored = localStorage.getItem(DB_PREFIX + key);
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.warn(`Failed to load ${key} from storage`, e);
    }
    return defaultData;
};

const saveToStorage = (key: string, data: any) => {
    try {
        localStorage.setItem(DB_PREFIX + key, JSON.stringify(data));
    } catch (e) {
        console.error(`Failed to save ${key} to storage`, e);
    }
};

let units: Unit[] = loadFromStorage('units', JSON.parse(JSON.stringify(MOCK_UNITS)));
let owners: Owner[] = loadFromStorage('owners', JSON.parse(JSON.stringify(MOCK_OWNERS)));
let vehicles: Vehicle[] = loadFromStorage('vehicles', JSON.parse(JSON.stringify(MOCK_VEHICLES)));
let waterReadings: WaterReading[] = loadFromStorage('waterReadings', JSON.parse(JSON.stringify(MOCK_WATER_READINGS)));
let charges: ChargeRaw[] = loadFromStorage('charges', []);
let adjustments: Adjustment[] = loadFromStorage('adjustments', JSON.parse(JSON.stringify(MOCK_ADJUSTMENTS)));
let users: UserPermission[] = loadFromStorage('users', JSON.parse(JSON.stringify(MOCK_USER_PERMISSIONS)));
let activityLogs: ActivityLog[] = loadFromStorage('activityLogs', []);
let profileRequests: ProfileRequest[] = loadFromStorage('profileRequests', []);
let miscRevenues: MiscRevenue[] = loadFromStorage('miscRevenues', []);

let monthlyStats: MonthlyStat[] = loadFromStorage('monthlyStats', [
    { period: '2024-11', totalService: 52000000, totalParking: 33000000, totalWater: 16500000, totalDue: 101500000, updatedAt: new Date().toISOString() },
]);

let tariffs: TariffCollection = loadFromStorage('tariffs', {
    service: JSON.parse(JSON.stringify(MOCK_TARIFFS_SERVICE)),
    parking: JSON.parse(JSON.stringify(MOCK_TARIFFS_PARKING)),
    water: JSON.parse(JSON.stringify(MOCK_TARIFFS_WATER)),
});

let invoiceSettings: InvoiceSettings = loadFromStorage('invoiceSettings', {
    logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    accountName: 'Công ty Cổ phần Mock Service', 
    accountNumber: '123456789', 
    bankName: 'MockBank',
    senderEmail: 'dev@example.com', 
    senderName: 'BQL Mock Data',
    buildingName: 'Q-Home Manager Mock', // FIXED: Added missing property
    emailSubject: '[MOCK] THÔNG BÁO PHÍ', 
    emailBody: 'Đây là email mock.',
    transferContentTemplate: 'HUD3 {{unitId}} T{{period}}',
});

let waterLocksRaw = loadFromStorage('waterLocks', []);
let waterLocks = new Map<string, boolean>(waterLocksRaw);
let billingLocksRaw = loadFromStorage('billingLocks', []);
let billingLocks = new Map<string, boolean>(billingLocksRaw);

patchKiosAreas(units);

const saveWaterLocks = () => saveToStorage('waterLocks', Array.from(waterLocks.entries()));
const saveBillingLocks = () => saveToStorage('billingLocks', Array.from(billingLocks.entries()));

export const loadAllData = async () => {
    const lockedWaterPeriods = Array.from(waterLocks.entries())
        .filter(([_, isLocked]) => isLocked)
        .map(([period]) => period);

    return Promise.resolve({
        units, owners, vehicles, waterReadings, charges, adjustments, users, activityLogs, invoiceSettings, tariffs, monthlyStats, 
        lockedWaterPeriods,
        hasData: units.length > 0
    });
};

export const fetchWaterLocks = async (): Promise<string[]> => {
    return Promise.resolve(
        Array.from(waterLocks.entries())
            .filter(([_, isLocked]) => isLocked)
            .map(([period]) => period)
    );
};

export const fetchLatestLogs = async (limitCount: number = 20): Promise<ActivityLog[]> => {
    return Promise.resolve([...activityLogs].sort((a,b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, limitCount));
};

export const logActivity = async (log: ActivityLog) => {
    activityLogs = [log, ...activityLogs];
    saveToStorage('activityLogs', activityLogs);
    return Promise.resolve();
};

export const updateFeeSettings = async (settings: InvoiceSettings) => {
    invoiceSettings = settings;
    saveToStorage('invoiceSettings', invoiceSettings);
    return Promise.resolve();
};

export const saveChargesBatch = async (newCharges: ChargeRaw[], periodStat?: MonthlyStat) => {
    const period = newCharges[0]?.Period;
    if (period) {
        charges = [...charges.filter(c => c.Period !== period), ...newCharges];
        saveToStorage('charges', charges);
    }
    if (periodStat) {
        monthlyStats = [...monthlyStats.filter(s => s.period !== periodStat.period), periodStat];
        saveToStorage('monthlyStats', monthlyStats);
    }
    return Promise.resolve();
};

export const updateChargeStatuses = async (period: string, unitIds: string[], updates: { isPrinted?: boolean; isSent?: boolean }) => {
    charges = charges.map(c => (c.Period === period && unitIds.includes(c.UnitID)) ? { ...c, ...updates } : c);
    saveToStorage('charges', charges);
    return Promise.resolve();
};

export const updateChargePayments = async (period: string, paymentUpdates: Map<string, number>) => {
    charges = charges.map(c => {
        if (c.Period === period && paymentUpdates.has(c.UnitID)) {
            return { ...c, TotalPaid: paymentUpdates.get(c.UnitID)!, paymentStatus: 'reconciling', PaymentConfirmed: false };
        }
        return c;
    });
    saveToStorage('charges', charges);
    return Promise.resolve();
};

export const confirmSinglePayment = async (charge: ChargeRaw, finalPaidAmount: number, status: PaymentStatus = 'paid') => {
    charges = charges.map(c => c.Period === charge.Period && c.UnitID === charge.UnitID ? { ...c, TotalPaid: finalPaidAmount, paymentStatus: status, PaymentConfirmed: true } : c);
    saveToStorage('charges', charges);
    return Promise.resolve();
};

export const updatePaymentStatusBatch = async (period: string, unitIds: string[], newStatus: 'paid' | 'unpaid') => {
    charges = charges.map(c => {
        if (c.Period === period && unitIds.includes(c.UnitID)) {
            return { ...c, paymentStatus: newStatus, PaymentConfirmed: newStatus === 'paid', TotalPaid: newStatus === 'paid' ? c.TotalDue : 0 };
        }
        return c;
    });
    saveToStorage('charges', charges);
    return Promise.resolve();
};

export const updateResidentData = async (
    currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[],
    updatedData: { unit: Unit; owner: Owner; vehicles: Vehicle[] }
) => {
    const { unit, owner, vehicles: incomingVehicles } = updatedData;
    
    // 1. Cập nhật Units & Owners
    units = currentUnits.map(u => u.UnitID === unit.UnitID ? unit : u);
    owners = currentOwners.map(o => o.OwnerID === owner.OwnerID ? owner : o);
    
    // 2. Cập nhật Vehicles
    const activeIds = new Set<string>();
    const newVehiclesList = [...vehicles];

    incomingVehicles.forEach(updatedV => {
        const existingIdx = newVehiclesList.findIndex(v => v.VehicleId === updatedV.VehicleId);
        if (existingIdx > -1) {
            newVehiclesList[existingIdx] = { ...updatedV, isActive: true, updatedAt: new Date().toISOString() };
            activeIds.add(updatedV.VehicleId);
        } else {
            const newId = updatedV.VehicleId.startsWith('VEH_NEW_') ? `VEH_MOCK_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` : updatedV.VehicleId;
            const newV = { ...updatedV, VehicleId: newId, isActive: true, updatedAt: new Date().toISOString() };
            newVehiclesList.push(newV);
            activeIds.add(newId);
        }
    });

    // Phát hiện và vô hiệu hóa xe bị xóa khỏi Modal
    vehicles = newVehiclesList.map(v => {
        if (v.UnitID === unit.UnitID && v.isActive && !activeIds.has(v.VehicleId)) {
            return { ...v, isActive: false, updatedAt: new Date().toISOString() };
        }
        return v;
    });
    
    saveToStorage('units', units);
    saveToStorage('owners', owners);
    saveToStorage('vehicles', vehicles);
    
    return Promise.resolve({ units, owners, vehicles });
};

export const wipeAllBusinessData = async (progressCallback: (message: string) => void) => {
    progressCallback("Cleaning LocalStorage...");
    const keys = ['units', 'owners', 'vehicles', 'waterReadings', 'charges', 'adjustments', 'activityLogs', 'monthlyStats', 'waterLocks', 'billingLocks', 'profileRequests', 'miscRevenues'];
    keys.forEach(k => localStorage.removeItem(DB_PREFIX + k));
    await new Promise(r => setTimeout(r, 500));
    progressCallback("Restored to Factory Mock Data.");
    return Promise.resolve();
};

export const saveUsers = async (newUsers: UserPermission[]) => {
    users = newUsers;
    saveToStorage('users', users);
    return Promise.resolve();
};

export const deleteUsers = async (emails: string[]) => {
    users = users.filter(u => !emails.includes(u.Email));
    saveToStorage('users', users);
    return Promise.resolve();
};

export const saveTariffs = async (newTariffs: TariffCollection) => {
    tariffs = newTariffs;
    saveToStorage('tariffs', tariffs);
    return Promise.resolve();
};

export const saveAdjustments = async (newAdjustments: Adjustment[]) => {
    adjustments = newAdjustments;
    saveToStorage('adjustments', adjustments);
    return Promise.resolve();
};

export const saveWaterReadings = async (newReadings: WaterReading[]) => {
    const newReadingsSet = new Set(newReadings.map(r => `${r.Period}_${r.UnitID}`));
    waterReadings = [...waterReadings.filter(r => !newReadingsSet.has(`${r.Period}_${r.UnitID}`)), ...newReadings];
    saveToStorage('waterReadings', waterReadings);
    return Promise.resolve();
};

export const saveVehicles = async (newVehicles: Vehicle[]) => {
    vehicles = newVehicles;
    saveToStorage('vehicles', vehicles);
    return Promise.resolve();
};

export const importResidentsBatch = async (
    currentUnits: Unit[], currentOwners: Owner[], currentVehicles: Vehicle[], updates: any[]
) => {
    saveToStorage('units', units);
    saveToStorage('owners', owners);
    saveToStorage('vehicles', vehicles);
    return Promise.resolve({ units, owners, vehicles, createdCount: 0, updatedCount: 0, vehicleCount: 0 });
};

export const getLockStatus = async (month: string): Promise<boolean> => Promise.resolve(waterLocks.get(month) ?? false);
export const setLockStatus = async (month: string, status: boolean): Promise<void> => { waterLocks.set(month, status); saveWaterLocks(); return Promise.resolve(); };
export const getBillingLockStatus = async (period: string): Promise<boolean> => Promise.resolve(billingLocks.get(period) ?? false);
export const setBillingLockStatus = async (period: string, status: boolean): Promise<void> => { billingLocks.set(period, status); saveBillingLocks(); return Promise.resolve(); };
export const resetUserPassword = async (email: string): Promise<void> => Promise.resolve();
export const getPendingProfileRequest = async (residentId: string): Promise<ProfileRequest | null> => Promise.resolve(null);
export const getAllPendingProfileRequests = async (): Promise<ProfileRequest[]> => Promise.resolve([]);
export const submitUserProfileUpdate = async (userAuthEmail: string, residentId: string, ownerId: string, newData: any) => Promise.resolve({} as ProfileRequest);
export const createProfileRequest = async (request: ProfileRequest) => Promise.resolve();
export const updateResidentAvatar = async (ownerId: string, avatarUrl: string, userEmail?: string): Promise<void> => Promise.resolve();
export const resolveProfileRequest = async (request: ProfileRequest, action: 'approve' | 'reject', adminEmail: string, approvedChanges?: any) => Promise.resolve();

export const addMiscRevenue = async (data: any): Promise<string> => {
    const id = `misc_${Date.now()}`;
    miscRevenues.push({...data, id, createdAt: new Date().toISOString()});
    saveToStorage('miscRevenues', miscRevenues);
    return Promise.resolve(id);
};

export const getMiscRevenues = async (date: string): Promise<MiscRevenue[]> => Promise.resolve(miscRevenues.filter(r => r.date === date));
export const getMonthlyMiscRevenues = async (month: string): Promise<MiscRevenue[]> => Promise.resolve(miscRevenues.filter(r => r.date.startsWith(month)));
export const deleteMiscRevenue = async (id: string): Promise<void> => { miscRevenues = miscRevenues.filter(r => r.id !== id); saveToStorage('miscRevenues', miscRevenues); return Promise.resolve(); };
