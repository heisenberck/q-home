
// services/index.ts
import * as firebaseAPI from './firebaseAPI';
import * as mockAPI from './mockAPI';
import * as feedbackAPI from './feedbackService';
import * as regAPI from './registrationService';
import * as revenueAPI from './revenueService'; // New
import { isProduction } from '../utils/env';

const IS_PROD = isProduction();

const api = IS_PROD 
    ? { ...firebaseAPI, ...feedbackAPI, ...regAPI, ...revenueAPI } 
    : { ...mockAPI, ...feedbackAPI, ...regAPI, ...revenueAPI };

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
    getMiscRevenues, // Vẫn giữ nếu cần cho logic khác
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
    subscribeToActiveFeedback,
    submitServiceRegistration,
    subscribeToRegistrations,
    processRegistrationAction
} = api as any;
