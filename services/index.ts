// services/index.ts
import * as firebaseAPI from './firebaseAPI';
import * as mockAPI from './mockAPI';
import * as vehicleService from './vehicleService';
import { isProduction } from '../utils/env';

const IS_PROD = isProduction();

const api = IS_PROD ? firebaseAPI : mockAPI;

export const {
    loadAllData,
    updateFeeSettings,
    saveChargesBatch,
    updateChargeStatuses,
    updateChargePayments,
    confirmSinglePayment,
    updatePaymentStatusBatch,
    updateResidentData,
    wipeAllBusinessData,
    saveUsers,
    deleteUsers,
    saveTariffs,
    saveAdjustments,
    saveWaterReadings,
    saveVehicles,
    importResidentsBatch,
    getLockStatus,
    setLockStatus,
    getBillingLockStatus,
    setBillingLockStatus,
    resetUserPassword,
    logActivity,
    fetchLatestLogs,
    createProfileRequest,
    submitUserProfileUpdate,
    getPendingProfileRequest, 
    getAllPendingProfileRequests, 
    resolveProfileRequest, 
    updateResidentAvatar,
    fetchWaterLocks,
    addMiscRevenue,
    getMiscRevenues,
    getMonthlyMiscRevenues,
    deleteMiscRevenue,
} = api;

// Optimized services
export const { fetchAllVehicles } = vehicleService;
