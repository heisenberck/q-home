
// services/index.ts
import * as firebaseAPI from './firebaseAPI';
import * as mockAPI from './mockAPI';
import * as feedbackAPI from './feedbackService';
import * as regAPI from './registrationService';
import * as revenueAPI from './revenueService';
import * as logAPI from './logService';
import { isProduction } from '../utils/env';

const IS_PROD = isProduction();

// Merge all APIs based on environment
const api = IS_PROD 
    ? { ...firebaseAPI, ...feedbackAPI, ...regAPI, ...revenueAPI, ...logAPI } 
    : { ...mockAPI, ...feedbackAPI, ...regAPI, ...revenueAPI, ...logAPI };

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
    logActivity, // Fix: Now correctly imported from logAPI
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
    getSystemMetadata,
    fetchCollection,
    fetchRecentAdjustments,
    fetchRecentWaterReadings,
    fetchResidentSpecificData,
    fetchChargesForResident,
    fetchUserForLogin,
    submitFeedback,
    replyFeedback,
    fetchActiveFeedback, // Updated from subscribeToActiveFeedback
    fetchResolvedFeedback,
    submitServiceRegistration,
    fetchRegistrations, // Updated from subscribeToRegistrations to fix TypeError
    processRegistrationAction,
    fetchActiveCharges,
    getDashboardCounts
} = api as any;
