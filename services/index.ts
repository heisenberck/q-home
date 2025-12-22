
// services/index.ts
import * as firebaseAPI from './firebaseAPI';
import * as mockAPI from './mockAPI';
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
    updateUserProfile,
    fetchNews,
    saveNewsItem,
    deleteNewsItem,
    // Add missing exports for useSmartData
    getSystemMetadata,
    fetchCollection,
    fetchRecentAdjustments,
    fetchRecentWaterReadings,
    fetchResidentSpecificData
} = api;