
// services/mockAPI.ts
// Fix: Added missing RegistrationStatus type to imports
import type { 
    InvoiceSettings, Unit, Owner, Vehicle, WaterReading, ChargeRaw, 
    Adjustment, UserPermission, ActivityLog, MonthlyStat, TariffCollection, 
    PaymentStatus, ProfileRequest, MiscRevenue, NewsItem, SystemMetadata,
    FeedbackItem, FeedbackReply, ServiceRegistration, OperationalExpense,
    RegistrationStatus
} from '../types';
import { MOCK_UNITS, MOCK_OWNERS, MOCK_VEHICLES, MOCK_WATER_READINGS, MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_ADJUSTMENTS, MOCK_USER_PERMISSIONS, MOCK_NEWS_ITEMS, patchKiosAreas } from '../constants';
import { VehicleTier, Role } from '../types';

const DB_PREFIX = 'QHOME_MOCK_DB_V3_';

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
let news: NewsItem[] = loadFromStorage('news', JSON.parse(JSON.stringify(MOCK_NEWS_ITEMS)));
let activityLogs: ActivityLog[] = loadFromStorage('activityLogs', []);
let profileRequests: ProfileRequest[] = loadFromStorage('profileRequests', []);
let miscRevenues: MiscRevenue[] = loadFromStorage('miscRevenues', []);
let feedback: FeedbackItem[] = loadFromStorage('feedback', []);
let registrations: ServiceRegistration[] = loadFromStorage('registrations', []);
let expenses: OperationalExpense[] = loadFromStorage('expenses', []);

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
    buildingName: 'Q-Home Manager Mock',
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
        units, owners, vehicles, waterReadings, charges, adjustments, users, activityLogs, invoiceSettings, tariffs, monthlyStats, news,
        lockedWaterPeriods,
        hasData: units.length > 0
    });
};

export const fetchInvoiceSettings = async () => Promise.resolve(invoiceSettings);
export const fetchTariffsData = async () => Promise.resolve(tariffs);

export const getDashboardCounts = async () => {
    return Promise.resolve({
        totalUnits: units.length,
        activeVehicles: vehicles.filter(v => v.isActive).length,
        waitingVehicles: vehicles.filter(v => v.isActive && v.parkingStatus === 'Xếp lốt').length
    });
};

export const fetchActiveCharges = async (periods: string[]): Promise<ChargeRaw[]> => {
    return Promise.resolve(charges.filter(c => 
        periods.includes(c.Period) || 
        ['unpaid', 'reconciling', 'pending'].includes(c.paymentStatus)
    ));
};

export const fetchChargesForResident = async (residentId: string): Promise<ChargeRaw[]> => {
    return Promise.resolve(
        charges
            .filter(c => c.UnitID === residentId)
            .sort((a, b) => b.Period.localeCompare(a.Period))
            .slice(0, 12)
    );
};

export const getSystemMetadata = async (): Promise<SystemMetadata> => {
    return Promise.resolve({
        units_version: Date.now(),
        owners_version: Date.now(),
        vehicles_version: Date.now(),
        tariffs_version: Date.now(),
        users_version: Date.now()
    });
};

export const fetchCollection = async <T>(colName: string): Promise<T[]> => {
    switch (colName) {
        case 'units': return Promise.resolve(units as unknown as T[]);
        case 'owners': return Promise.resolve(owners as unknown as T[]);
        case 'vehicles': return Promise.resolve(vehicles as unknown as T[]);
        case 'waterReadings': return Promise.resolve(waterReadings as unknown as T[]);
        case 'adjustments': return Promise.resolve(adjustments as unknown as T[]);
        case 'users': return Promise.resolve(users as unknown as T[]);
        case 'charges': return Promise.resolve(charges as unknown as T[]);
        case 'monthly_stats': return Promise.resolve(monthlyStats as unknown as T[]);
        case 'operational_expenses': return Promise.resolve(expenses as unknown as T[]);
        default: return Promise.resolve([]);
    }
};

export const fetchRecentAdjustments = async (startPeriod: string): Promise<Adjustment[]> => {
    return Promise.resolve(adjustments.filter(a => a.Period >= startPeriod));
};

export const fetchRecentWaterReadings = async (periods: string[]): Promise<WaterReading[]> => {
    return Promise.resolve(waterReadings.filter(r => periods.includes(r.Period)));
};

export const fetchResidentSpecificData = async (residentId: string) => {
    const unit = units.find(u => u.UnitID === residentId);
    if (!unit) return Promise.resolve({ unit: null, owner: null, vehicles: [] });
    const owner = owners.find(o => o.OwnerID === unit.OwnerID);
    const unitVehicles = vehicles.filter(v => v.UnitID === residentId && v.isActive);
    return Promise.resolve({ unit, owner, vehicles: unitVehicles });
};

export const fetchNews = async (): Promise<NewsItem[]> => Promise.resolve(news);

export const saveNewsItem = async (item: NewsItem): Promise<string> => {
    if (item.id && !item.id.startsWith('news_mock')) {
        news = news.map(n => n.id === item.id ? item : n);
    } else {
        item.id = `news_mock_${Date.now()}`;
        news = [item, ...news];
    }
    saveToStorage('news', news);
    return Promise.resolve(item.id);
};

export const deleteNewsItem = async (id: string): Promise<void> => {
    news = news.filter(n => n.id !== id);
    saveToStorage('news', news);
    return Promise.resolve();
};

export const updateUserProfile = async (email: string, updates: Partial<UserPermission>) => {
    users = users.map(u => u.Email === email ? { ...u, ...updates } : u);
    saveToStorage('users', users);
    return Promise.resolve();
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

export const fetchLogs = async () => {
    const logs = [...activityLogs].sort((a,b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return Promise.resolve({
        logs,
        lastDoc: null,
        count: logs.length
    });
};

export const logActivity = async (actionType: any, module: string, description: string, ids?: string[]) => {
    const log: ActivityLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        ts: new Date().toISOString(),
        actor_email: 'mock-admin@hud3.vn',
        actor_role: 'Admin',
        module,
        action: String(actionType),
        summary: description,
        ids: ids || [],
        undone: false,
        undo_token: null,
        undo_until: null
    };
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
    updatedData: { unit: Unit; owner: Owner; vehicles: Vehicle[] },
    actor?: { email: string, role: Role },
    reason?: string
) => {
    const { unit, owner, vehicles: incomingVehicles } = updatedData;
    units = currentUnits.map(u => u.UnitID === unit.UnitID ? unit : u);
    owners = currentOwners.map(o => o.OwnerID === owner.OwnerID ? owner : o);
    const activeIds = new Set<string>();
    const newVehiclesList = [...vehicles];
    incomingVehicles.forEach(updatedV => {
        const existingIdx = newVehiclesList.findIndex(v => v.VehicleId === updatedV.VehicleId);
        if (existingIdx > -1) {
            newVehiclesList[existingIdx] = { ...updatedV, isActive: true, updatedAt: new Date().toISOString() };
            activeIds.add(updatedV.VehicleId);
        } else {
            const newId = updatedV.VehicleId.startsWith('VEH_NEW_') ? `VEH_MOCK_${Date.now()}` : updatedV.VehicleId;
            const newV = { ...updatedV, VehicleId: newId, isActive: true, updatedAt: new Date().toISOString() };
            newVehiclesList.push(newV);
            activeIds.add(newId);
        }
    });
    vehicles = newVehiclesList.map(v => {
        if (v.UnitID === unit.UnitID && v.isActive && !activeIds.has(v.VehicleId)) {
            return { ...v, isActive: false, updatedAt: new Date().toISOString() };
        }
        return v;
    });
    saveToStorage('units', units);
    saveToStorage('owners', owners);
    saveToStorage('vehicles', vehicles);
    const logSummary = reason ? `[Mock] Điều chỉnh hồ sơ: ${reason}` : `[Mock] Cập nhật căn hộ ${unit.UnitID}`;
    logActivity('UPDATE', 'Residents', logSummary, [unit.UnitID]);
    return Promise.resolve({ units, owners, vehicles });
};

export const wipeAllBusinessData = async (progressCallback: (message: string) => void) => {
    progressCallback("Cleaning LocalStorage...");
    const keys = ['units', 'owners', 'vehicles', 'waterReadings', 'charges', 'adjustments', 'activityLogs', 'monthlyStats', 'waterLocks', 'billingLocks', 'profileRequests', 'miscRevenues', 'news', 'feedback', 'registrations', 'expenses'];
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

export const fetchUserForLogin = async (identifier: string): Promise<UserPermission | null> => {
    const norm = identifier.trim().toLowerCase();
    const found = users.find(u => 
        u.Email.toLowerCase() === norm || 
        (u.Username && u.Username.toLowerCase() === norm)
    );
    return Promise.resolve(found || null);
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

// --- FEEDBACK MOCK ---
export const fetchActiveFeedback = async (): Promise<FeedbackItem[]> => Promise.resolve(feedback.filter(f => f.status !== 'Resolved'));
export const fetchResolvedFeedback = async (period: string): Promise<FeedbackItem[]> => Promise.resolve(feedback.filter(f => f.status === 'Resolved' && f.date.startsWith(period)));
export const submitFeedback = async (item: any) => {
    const id = `fb_mock_${Date.now()}`;
    feedback = [{ ...item, id }, ...feedback];
    saveToStorage('feedback', feedback);
    return Promise.resolve(id);
};
export const replyFeedback = async (id: string, replies: FeedbackReply[], status: FeedbackItem['status']) => {
    feedback = feedback.map(f => f.id === id ? { ...f, replies, status } : f);
    saveToStorage('feedback', feedback);
    return Promise.resolve();
};

// --- REGISTRATION MOCK ---
export const fetchRegistrations = async (): Promise<ServiceRegistration[]> => Promise.resolve(registrations);
export const submitServiceRegistration = async (item: any) => {
    const id = `reg_mock_${Date.now()}`;
    registrations = [{ ...item, id }, ...registrations];
    saveToStorage('registrations', registrations);
    return Promise.resolve(id);
};
export const processRegistrationAction = async (id: string, status: RegistrationStatus, note: string) => {
    registrations = registrations.map(r => r.id === id ? { ...r, status, rejectionReason: note } : r);
    saveToStorage('registrations', registrations);
    return Promise.resolve();
};

// --- REVENUE MOCK ---
export const addMiscRevenue = async (data: any): Promise<string> => {
    const id = `misc_${Date.now()}`;
    miscRevenues.push({...data, id, createdAt: new Date().toISOString()});
    saveToStorage('miscRevenues', miscRevenues);
    return Promise.resolve(id);
};
export const getMiscRevenues = async (date: string): Promise<MiscRevenue[]> => Promise.resolve(miscRevenues.filter(r => r.date === date));
export const getMonthlyMiscRevenues = async (month: string): Promise<MiscRevenue[]> => Promise.resolve(miscRevenues.filter(r => r.date.startsWith(month)));
export const deleteMiscRevenue = async (id: string): Promise<void> => { miscRevenues = miscRevenues.filter(r => r.id !== id); saveToStorage('miscRevenues', miscRevenues); return Promise.resolve(); };

// --- EXPENSE MOCK ---
export const addExpense = async (data: any): Promise<string> => {
    const id = `exp_mock_${Date.now()}`;
    expenses = [{ ...data, id, createdAt: new Date().toISOString() }, ...expenses];
    saveToStorage('expenses', expenses);
    return Promise.resolve(id);
};
export const getExpensesByMonth = async (month: string): Promise<OperationalExpense[]> => Promise.resolve(expenses.filter(e => e.date.startsWith(month)));
export const deleteExpense = async (id: string): Promise<void> => {
    expenses = expenses.filter(e => e.id !== id);
    saveToStorage('expenses', expenses);
    return Promise.resolve();
};
