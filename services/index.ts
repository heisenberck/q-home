
import * as firebaseAPI from './firebaseAPI';
import * as mockAPI from './mockAPI';
import * as feedbackAPI from './feedbackService';
import * as regAPI from './registrationService';
import * as revenueAPI from './revenueService';
import * as logAPI from './logService';
import { isProduction } from '../utils/env';

const IS_PROD = isProduction();

// On Production: Merge all real Firebase services
// On DEV: Use ONLY the mockAPI which contains implementations for all modules
const api = IS_PROD 
    ? { 
        ...firebaseAPI, 
        ...feedbackAPI, 
        ...regAPI, 
        ...revenueAPI, 
        ...logAPI 
      } 
    : { 
        ...mockAPI 
      };

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
    getSystemMetadata,
    fetchCollection,
    fetchRecentAdjustments,
    fetchRecentWaterReadings,
    fetchResidentSpecificData,
    fetchChargesForResident,
    fetchUserForLogin,
    submitFeedback,
    replyFeedback,
    fetchActiveFeedback,
    fetchResolvedFeedback,
    submitServiceRegistration,
    fetchRegistrations,
    processRegistrationAction,
    fetchActiveCharges,
    getDashboardCounts,
    // New gated calls for hooks
    fetchInvoiceSettings,
    fetchTariffsData
} = api as any;
