
// services/mockAPI.ts
import { 
    MOCK_UNITS, MOCK_OWNERS, MOCK_VEHICLES, 
    MOCK_WATER_READINGS, MOCK_TARIFFS_SERVICE, 
    MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, 
    MOCK_ADJUSTMENTS, MOCK_USER_PERMISSIONS 
} from '../constants';
import type { ResidentPageResult } from './firebaseAPI';
import type { InvoiceSettings, ChargeRaw, UserPermission, AllData, Adjustment, WaterReading, Vehicle, ProfileRequest, ActivityLog } from '../types';

export const getResidentsPaged = async (
    pageSize: number = 20, 
    lastDoc: any = null, 
    searchQuery: string = ''
): Promise<ResidentPageResult> => {
    // 1. Mock Search
    let filteredUnits = MOCK_UNITS;
    if (searchQuery) {
        filteredUnits = MOCK_UNITS.filter(u => u.UnitID.includes(searchQuery.toUpperCase()));
    }

    // 2. Mock Pagination
    const startIndex = lastDoc ? filteredUnits.findIndex(u => u.UnitID === lastDoc.UnitID) + 1 : 0;
    const pagedUnits = filteredUnits.slice(startIndex, startIndex + pageSize);

    // 3. Mock Data Construction
    const data = pagedUnits.map(unit => {
        const owner = MOCK_OWNERS.find(o => o.OwnerID === unit.OwnerID);
        const vehicles = MOCK_VEHICLES.filter(v => v.UnitID === unit.UnitID); 
        return {
            unit,
            owner: owner || { OwnerID: 'unknown', OwnerName: 'Unknown', Phone: '', Email: '' },
            vehicles: vehicles,
            pendingRequest: null
        };
    });

    // Mock "Last Doc" as the last unit object itself
    const newLastDoc = data.length > 0 ? data[data.length - 1].unit : null;

    return Promise.resolve({
        data,
        lastDoc: newLastDoc
    });
};

export const loadAllData = async (): Promise<any> => { 
    return { 
        units: MOCK_UNITS, 
        owners: MOCK_OWNERS, 
        vehicles: MOCK_VEHICLES, 
        waterReadings: MOCK_WATER_READINGS,
        charges: [],
        tariffs: {
            service: MOCK_TARIFFS_SERVICE,
            parking: MOCK_TARIFFS_PARKING,
            water: MOCK_TARIFFS_WATER
        },
        users: MOCK_USER_PERMISSIONS,
        adjustments: MOCK_ADJUSTMENTS,
        invoiceSettings: null,
        activityLogs: [],
        monthlyStats: [],
        lockedWaterPeriods: [],
        hasData: true 
    }; 
};

export const updateFeeSettings = async (settings: InvoiceSettings) => Promise.resolve();
export const saveChargesBatch = async (charges: ChargeRaw[], periodStat?: any) => Promise.resolve();
export const updateChargeStatuses = async (period: string, unitIds: string[], updates: any) => Promise.resolve();
export const updateChargePayments = async (period: string, paymentUpdates: Map<string, number>) => Promise.resolve();
export const confirmSinglePayment = async (charge: ChargeRaw, finalPaidAmount: number, status: any = 'paid') => Promise.resolve();
export const updatePaymentStatusBatch = async (period: string, unitIds: string[], status: 'paid' | 'unpaid', charges: ChargeRaw[]) => Promise.resolve();
export const updateResidentData = async (currentUnits: any, currentOwners: any, currentVehicles: any, data: any) => Promise.resolve(true);
export const wipeAllBusinessData = async (onProgress: (msg: string) => void) => Promise.resolve();
export const saveUsers = async (d: UserPermission[]) => Promise.resolve();
export const deleteUsers = async (emails: string[]) => Promise.resolve();
export const saveTariffs = async (d: AllData['tariffs']) => Promise.resolve();
export const saveAdjustments = async (d: Adjustment[]) => Promise.resolve();
export const saveWaterReadings = async (d: WaterReading[]) => Promise.resolve();
export const saveVehicles = async (d: Vehicle[]) => Promise.resolve();
export const importResidentsBatch = async (u: any, o: any, v: any, updates: any[]) => Promise.resolve({ createdCount: 0, updatedCount: 0 });
export const getLockStatus = async (month: string) => false;
export const setLockStatus = async (month: string, status: boolean) => {};
export const getBillingLockStatus = async (period: string) => false;
export const setBillingLockStatus = async (period: string, status: boolean) => {};
export const resetUserPassword = async (email: string) => Promise.resolve();
export const logActivity = async (log: any) => Promise.resolve();
export const fetchLatestLogs = async (limitCount: number = 50): Promise<ActivityLog[]> => Promise.resolve([]);
export const createProfileRequest = async (request: ProfileRequest) => Promise.resolve();
export const getPendingProfileRequest = async (residentId: string): Promise<ProfileRequest | null> => Promise.resolve(null);
export const getAllPendingProfileRequests = async (): Promise<ProfileRequest[]> => Promise.resolve([]);
export const resolveProfileRequest = async (request: ProfileRequest, action: 'approve' | 'reject', adminEmail: string, changes?: any) => Promise.resolve({ unitId: request.residentId, ownerId: request.ownerId, updatedOwner: null, updatedUnit: null });
export const updateResidentAvatar = async (ownerId: string, avatarUrl: string) => Promise.resolve();
