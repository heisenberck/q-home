// services/mockAPI.ts
import type { InvoiceSettings, Unit, Owner, Vehicle, WaterReading, ChargeRaw, Adjustment, UserPermission, ActivityLog, AllData, TariffCollection, PaymentStatus, MonthlyStat, SystemMetadata, ProfileRequest, MiscRevenue } from '../types';
import { MOCK_UNITS, MOCK_OWNERS, MOCK_VEHICLES, MOCK_WATER_READINGS, MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_ADJUSTMENTS, MOCK_USER_PERMISSIONS, patchKiosAreas } from '../constants';
import { UnitType, VehicleTier } from '../types';

// --- PERSISTENCE HELPERS ---
const DB_PREFIX = 'QHOME_MOCK_DB_V2_';

const loadFromStorage = <T>(key: string, defaultData: T): T => {
    try {
        const stored = localStorage.getItem(DB_PREFIX + key);
        if (stored) {
            return JSON.parse(stored);
        }
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

// --- DATA INITIALIZATION ---
// We clone constants to ensure we don't mutate the imports directly, 
// and we try to load from LocalStorage first.

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
    { period: '2024-06', totalService: 50000000, totalParking: 30000000, totalWater: 15000000, totalDue: 95000000, updatedAt: new Date().toISOString() },
    { period: '2024-07', totalService: 50000000, totalParking: 31000000, totalWater: 16000000, totalDue: 97000000, updatedAt: new Date().toISOString() },
    { period: '2024-08', totalService: 50000000, totalParking: 30500000, totalWater: 14000000, totalDue: 94500000, updatedAt: new Date().toISOString() },
    { period: '2024-09', totalService: 52000000, totalParking: 32000000, totalWater: 18000000, totalDue: 102000000, updatedAt: new Date().toISOString() },
    { period: '2024-10', totalService: 52000000, totalParking: 32500000, totalWater: 17000000, totalDue: 101500000, updatedAt: new Date().toISOString() },
    { period: '2024-11', totalService: 52000000, totalParking: 33000000, totalWater: 16500000, totalDue: 101500000, updatedAt: new Date().toISOString() },
]);

let tariffs: TariffCollection = loadFromStorage('tariffs', {
    service: JSON.parse(JSON.stringify(MOCK_TARIFFS_SERVICE)),
    parking: JSON.parse(JSON.stringify(MOCK_TARIFFS_PARKING)),
    water: JSON.parse(JSON.stringify(MOCK_TARIFFS_WATER)),
});

let invoiceSettings: InvoiceSettings | null = loadFromStorage('invoiceSettings', {
    logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    accountName: 'Công ty Cổ phần Mock Service', accountNumber: '123456789', bankName: 'MockBank - Chi nhánh Dev',
    senderEmail: 'dev@example.com', senderName: 'BQL Mock Data',
    emailSubject: '[MOCK] THONG BAO PHI', emailBody: 'Day la email mock.',
    transferContentTemplate: 'HUD3 {{unitId}} T{{period}}',
});

// Map cannot be directly JSON stringified, so we store it as an array of entries or just rebuild it
let waterLocksRaw = loadFromStorage('waterLocks', []);
let waterLocks = new Map<string, boolean>(waterLocksRaw);

let billingLocksRaw = loadFromStorage('billingLocks', []);
let billingLocks = new Map<string, boolean>(billingLocksRaw);

// Apply patch to Ensure Kiosks have correct area even if loaded from old storage (optional, but good for consistency)
patchKiosAreas(units);

// --- HELPER TO SAVE MAPS ---
const saveWaterLocks = () => saveToStorage('waterLocks', Array.from(waterLocks.entries()));
const saveBillingLocks = () => saveToStorage('billingLocks', Array.from(billingLocks.entries()));


// --- API IMPLEMENTATION ---

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

// FIX: Added mock implementation for fetchWaterLocks
export const fetchWaterLocks = async (): Promise<string[]> => {
    return Promise.resolve(
        Array.from(waterLocks.entries())
            .filter(([_, isLocked]) => isLocked)
            .map(([period]) => period)
    );
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
    // Update local stats store for mock charts
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
    const { unit, owner, vehicles: draftVehicles } = updatedData;
    
    // Update State
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

    // Deactivate old vehicles
    vehicles = vehicles.map(v => {
        if (v.UnitID === unit.UnitID && !activeIds.has(v.VehicleId)) {
            return { ...v, isActive: false, updatedAt: new Date().toISOString() };
        }
        return v;
    });

    // Update/Add new vehicles
    processedDraftVehicles.forEach(updatedV => {
        const existingIdx = vehicles.findIndex(v => v.VehicleId === updatedV.VehicleId);
        if (existingIdx > -1) {
            vehicles[existingIdx] = { ...updatedV, updatedAt: new Date().toISOString() };
        } else {
            vehicles.push({ ...updatedV, updatedAt: new Date().toISOString() });
        }
    });
    
    // Persist
    saveToStorage('units', units);
    saveToStorage('owners', owners);
    saveToStorage('vehicles', vehicles);

    return Promise.resolve({ units, owners, vehicles });
};

export const wipeAllBusinessData = async (progressCallback: (message: string) => void) => {
    progressCallback("Cleaning LocalStorage...");
    
    // Reset variables to defaults or empty
    units = JSON.parse(JSON.stringify(MOCK_UNITS)); // Keep units structure but could reset
    owners = JSON.parse(JSON.stringify(MOCK_OWNERS));
    // Or actually wipe them if that's the intent:
    // For a "Wipe All Business Data" feature, usually we want to keep config but clear transactions/residents
    // But since this is "Mock", let's reset to "Factory Settings" (The MOCK_CONSTANTS)
    
    vehicles = JSON.parse(JSON.stringify(MOCK_VEHICLES));
    waterReadings = JSON.parse(JSON.stringify(MOCK_WATER_READINGS));
    charges = [];
    adjustments = JSON.parse(JSON.stringify(MOCK_ADJUSTMENTS));
    activityLogs = [];
    monthlyStats = [];
    miscRevenues = [];
    
    // Clear storage keys
    const keysToRemove = ['units', 'owners', 'vehicles', 'waterReadings', 'charges', 'adjustments', 'activityLogs', 'monthlyStats', 'waterLocks', 'billingLocks', 'profileRequests', 'miscRevenues'];
    keysToRemove.forEach(k => localStorage.removeItem(DB_PREFIX + k));

    await new Promise(r => setTimeout(r, 500));
    progressCallback("Restored to Factory Mock Data.");
    return Promise.resolve();
};

export const saveUsers = async (newUsers: UserPermission[]) => {
    // In mock mode, we usually replace the whole list or merge. 
    // The App.tsx passes the FULL list of users in 'newUsers' usually when calling setUsers.
    // However, if it passes just one, we need to handle merge.
    // Looking at App.tsx handleSetUsers: it calls saveUsers(newState), where newState is the full array.
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
    const updatedReadings = [...waterReadings.filter(r => !newReadingsSet.has(`${r.Period}_${r.UnitID}`)), ...newReadings];
    waterReadings = updatedReadings;
    saveToStorage('waterReadings', waterReadings);
    return Promise.resolve();
};

export const saveVehicles = async (newVehicles: Vehicle[]) => {
    // Merging logic might be needed if newVehicles is partial, but usually setVehicles sends full list.
    // To be safe, we assume newVehicles IS the master list if passed from setVehicles state.
    vehicles = newVehicles;
    saveToStorage('vehicles', vehicles);
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
    
    // Persist
    saveToStorage('units', units);
    saveToStorage('owners', owners);
    saveToStorage('vehicles', vehicles);

    return Promise.resolve({ units, owners, vehicles, createdCount, updatedCount, vehicleCount });
};

export const getLockStatus = async (month: string): Promise<boolean> => {
    return Promise.resolve(waterLocks.get(month) ?? false);
};

export const setLockStatus = async (month: string, status: boolean): Promise<void> => {
    waterLocks.set(month, status);
    saveWaterLocks();
    return Promise.resolve();
};

export const getBillingLockStatus = async (period: string): Promise<boolean> => {
    return Promise.resolve(billingLocks.get(period) ?? false);
};

export const setBillingLockStatus = async (period: string, status: boolean): Promise<void> => {
    billingLocks.set(period, status);
    saveBillingLocks();
    return Promise.resolve();
};

export const resetUserPassword = async (email: string): Promise<void> => {
    users = users.map(u => 
        u.Email.toLowerCase() === email.toLowerCase() 
        ? { ...u, password: '123456', mustChangePassword: true } 
        : u
    );
    saveToStorage('users', users);
    return Promise.resolve();
};

export const getPendingProfileRequest = async (residentId: string): Promise<ProfileRequest | null> => {
    const req = profileRequests.find(r => r.residentId === residentId && r.status === 'PENDING');
    return Promise.resolve(req || null);
};

export const getAllPendingProfileRequests = async (): Promise<ProfileRequest[]> => {
    return Promise.resolve(profileRequests.filter(r => r.status === 'PENDING'));
};

// NEW: Mock function for user profile update
export const submitUserProfileUpdate = async (
    userAuthEmail: string, 
    residentId: string, 
    ownerId: string,
    newData: {
        displayName?: string;
        phoneNumber?: string;
        contactEmail?: string;
        avatarUrl?: string;
        spouseName?: string;
        spousePhone?: string;
        unitStatus?: 'Owner' | 'Rent' | 'Business';
    }
) => {
    // 1. Mock update user data (UI update)
    const userIdx = users.findIndex(u => u.Email === userAuthEmail);
    if (userIdx > -1) {
        if (newData.displayName) users[userIdx].DisplayName = newData.displayName;
        if (newData.contactEmail) users[userIdx].contact_email = newData.contactEmail;
        if (newData.avatarUrl) users[userIdx].avatarUrl = newData.avatarUrl;
        saveToStorage('users', users);
    }

    // 2. Mock create request
    const now = new Date().toISOString();
    const requestId = `req_mock_${Date.now()}_${residentId}`;
    
    const changesForAdmin: any = {};
    if (newData.displayName) changesForAdmin.OwnerName = newData.displayName;
    if (newData.phoneNumber) changesForAdmin.Phone = newData.phoneNumber;
    if (newData.contactEmail) changesForAdmin.Email = newData.contactEmail;
    if (newData.avatarUrl) changesForAdmin.avatarUrl = newData.avatarUrl;
    if (newData.spouseName) changesForAdmin.secondOwnerName = newData.spouseName;
    if (newData.spousePhone) changesForAdmin.secondOwnerPhone = newData.spousePhone;
    if (newData.unitStatus) changesForAdmin.UnitStatus = newData.unitStatus;

    const profileRequest: ProfileRequest = {
        id: requestId,
        residentId,
        ownerId,
        status: 'PENDING',
        changes: changesForAdmin,
        createdAt: now,
        updatedAt: now
    };

    profileRequests.push(profileRequest);
    saveToStorage('profileRequests', profileRequests);

    return Promise.resolve(profileRequest);
};

export const createProfileRequest = async (request: ProfileRequest) => {
    profileRequests.push(request);
    saveToStorage('profileRequests', profileRequests);
    return Promise.resolve();
};

// MOCK: Update Resident Avatar with Direct Dual Update
export const updateResidentAvatar = async (ownerId: string, avatarUrl: string, userEmail?: string): Promise<void> => {
    // 1. Update Owner (Official)
    const owner = owners.find(o => o.OwnerID === ownerId);
    if (owner) {
        owner.avatarUrl = avatarUrl;
        owner.updatedAt = new Date().toISOString();
        saveToStorage('owners', owners);
    }
    
    // 2. Update User (Personal) directly, skipping request flow
    if (userEmail) {
        const user = users.find(u => u.Email === userEmail);
        if (user) {
            user.avatarUrl = avatarUrl;
            saveToStorage('users', users);
        }
    }
    
    return Promise.resolve();
};

export const resolveProfileRequest = async (
    request: ProfileRequest, 
    action: 'approve' | 'reject', 
    adminEmail: string,
    approvedChanges?: Partial<ProfileRequest['changes']>
) => {
    const idx = profileRequests.findIndex(r => r.id === request.id);
    if (idx > -1) {
        profileRequests[idx].status = action === 'approve' ? 'APPROVED' : 'REJECTED';
        profileRequests[idx].updatedAt = new Date().toISOString();
        
        if (action === 'approve') {
            const changes = approvedChanges || request.changes;
            const unit = units.find(u => u.UnitID === request.residentId);
            const owner = owners.find(o => o.OwnerID === request.ownerId);
            
            // Email Sync Logic Mock
            if (changes.Email && owner) {
                const oldEmail = owner.Email;
                if (oldEmail && oldEmail !== changes.Email) {
                    const userIdx = users.findIndex(u => u.Email === oldEmail);
                    if (userIdx > -1) {
                        // Rename User (Simulate Create/Delete)
                        users[userIdx] = { ...users[userIdx], Email: changes.Email!, Username: changes.Email!.split('@')[0] };
                    }
                }
            }

            if (unit && owner) {
                if (changes.OwnerName) owner.OwnerName = changes.OwnerName;
                if (changes.Phone) owner.Phone = changes.Phone;
                if (changes.Email) owner.Email = changes.Email;
                if (changes.title) owner.title = changes.title as any;
                if (changes.secondOwnerName) owner.secondOwnerName = changes.secondOwnerName;
                if (changes.secondOwnerPhone) owner.secondOwnerPhone = changes.secondOwnerPhone;
                if (changes.avatarUrl) owner.avatarUrl = changes.avatarUrl;

                if (changes.UnitStatus) {
                    unit.Status = changes.UnitStatus as any;
                }
                
                saveToStorage('units', units);
                saveToStorage('owners', owners);
                saveToStorage('users', users);
            }
        }
        
        saveToStorage('profileRequests', profileRequests);
    }
    return Promise.resolve();
};

// MISC REVENUES MOCK
export const addMiscRevenue = async (data: Omit<MiscRevenue, 'id' | 'createdAt'>): Promise<string> => {
    const id = `misc_mock_${Date.now()}`;
    const newItem: MiscRevenue = {
        ...data,
        id,
        createdAt: new Date().toISOString()
    };
    miscRevenues = [newItem, ...miscRevenues];
    saveToStorage('miscRevenues', miscRevenues);
    return Promise.resolve(id);
};

export const getMiscRevenues = async (date: string): Promise<MiscRevenue[]> => {
    return Promise.resolve(miscRevenues.filter(r => r.date === date));
};

/* Fix: Added getMonthlyMiscRevenues to support monthly reporting in VAS module */
export const getMonthlyMiscRevenues = async (month: string): Promise<MiscRevenue[]> => {
    return Promise.resolve(
        miscRevenues
            .filter(r => r.date.startsWith(month))
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    );
};

export const deleteMiscRevenue = async (id: string): Promise<void> => {
    miscRevenues = miscRevenues.filter(r => r.id !== id);
    saveToStorage('miscRevenues', miscRevenues);
    return Promise.resolve();
};