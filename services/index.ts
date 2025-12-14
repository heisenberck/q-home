
// services/index.ts
import * as firebaseAPI from './firebaseAPI';
import * as mockAPI from './mockAPI';
import { isProduction } from '../utils/env';

const IS_PROD = isProduction();

const api = IS_PROD ? firebaseAPI : mockAPI;

export const {
    loadAllData,
    getResidentsPaged, // NEW
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
    getPendingProfileRequest,
    getAllPendingProfileRequests,
    resolveProfileRequest,
    updateResidentAvatar, 
} = api;
