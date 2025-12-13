
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'; // STRICTLY READ-ONLY IMPORTS
import { db } from '../firebaseConfig';
import { isProduction } from '../utils/env';
import { 
    Unit, Owner, Vehicle, WaterReading, ChargeRaw, 
    TariffCollection, UserPermission, InvoiceSettings, Adjustment, ActivityLog, MonthlyStat 
} from '../types';
import { MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_USER_PERMISSIONS } from '../constants';
import { loadAllData } from '../services'; // Import service orchestrator

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 Hours
const CACHE_PREFIX = 'qhome_smart_cache_v1_';

interface CachePacket<T> {
    data: T;
    timestamp: number;
    version: string;
}

/**
 * Core function to fetch data with Local-First strategy.
 * STRICTLY READ-ONLY. No auto-seeding or write operations.
 * ONLY USED IN PRODUCTION.
 */
async function fetchWithCache<T>(
    collectionName: string, 
    fallbackData: T | null = null,
    forceRefresh: boolean = false
): Promise<T> {
    const cacheKey = `${CACHE_PREFIX}${collectionName}`;
    const now = Date.now();
    
    // 1. Try Local Cache (if not forced)
    if (!forceRefresh) {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
            try {
                const packet: CachePacket<T> = JSON.parse(cachedRaw);
                if (now - packet.timestamp < CACHE_DURATION) {
                    return packet.data;
                }
            } catch (e) {
                console.warn(`[SmartCache] Corrupt cache for ${collectionName}, clearing.`);
                localStorage.removeItem(cacheKey);
            }
        }
    }

    // 2. Fetch from Network (Firestore)
    // SAFETY CHECK: Ensure this is only called when connected to DB
    try {
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);
        
        const data = snapshot.docs.map(doc => doc.data()) as unknown as T; 

        // 3. Save to Cache
        const packet: CachePacket<T> = {
            data,
            timestamp: now,
            version: '1.0'
        };
        try {
            localStorage.setItem(cacheKey, JSON.stringify(packet));
        } catch (e) {
            console.warn("LocalStorage full, could not cache data.");
        }

        return data;
    } catch (error) {
        console.error(`[SmartCache] Error fetching ${collectionName}:`, error);
        return fallbackData as T;
    }
}

/**
 * Orchestrator Hook: Loads ALL static system data efficiently.
 */
export const useSmartSystemData = () => {
    const [data, setData] = useState<{
        units: Unit[];
        owners: Owner[];
        vehicles: Vehicle[];
        tariffs: TariffCollection;
        users: UserPermission[];
        invoiceSettings: InvoiceSettings | null;
        adjustments: Adjustment[];
        waterReadings: WaterReading[];
        activityLogs: ActivityLog[];
        monthlyStats: MonthlyStat[]; // Added
        hasLoaded: boolean;
    }>({
        units: [], owners: [], vehicles: [], tariffs: { service: [], parking: [], water: [] },
        users: [], invoiceSettings: null, adjustments: [], waterReadings: [], activityLogs: [], monthlyStats: [],
        hasLoaded: false
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshSystemData = useCallback(async (force = false) => {
        setLoading(true);
        setError(null);
        
        // --- DEV MODE STRATEGY ---
        // In Dev/Studio, we bypass the caching layer and talk directly to the Mock Service.
        // This ensures that when we "Import" or "Save" in Mock, the state updates immediately.
        if (!isProduction()) {
            try {
                // This calls services/index.ts -> services/mockAPI.ts
                const devData = await loadAllData();
                setData({
                    units: devData.units,
                    owners: devData.owners,
                    vehicles: devData.vehicles,
                    tariffs: devData.tariffs,
                    users: devData.users,
                    invoiceSettings: devData.invoiceSettings,
                    adjustments: devData.adjustments,
                    waterReadings: devData.waterReadings,
                    activityLogs: devData.activityLogs,
                    monthlyStats: devData.monthlyStats,
                    hasLoaded: true
                });
            } catch (err: any) {
                console.error("Mock Load Error:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
            return;
        }

        // --- PROD MODE STRATEGY (Local-First Cache) ---
        try {
            // Parallel Fetching - READ ONLY
            const [
                units, owners, vehicles, users, 
                adjustments, waterReadings, activityLogs, monthlyStats
            ] = await Promise.all([
                fetchWithCache<Unit[]>('units', [], force),
                fetchWithCache<Owner[]>('owners', [], force),
                fetchWithCache<Vehicle[]>('vehicles', [], force),
                fetchWithCache<UserPermission[]>('users', MOCK_USER_PERMISSIONS, force),
                fetchWithCache<Adjustment[]>('adjustments', [], force),
                fetchWithCache<WaterReading[]>('waterReadings', [], force),
                fetchWithCache<ActivityLog[]>('activityLogs', [], force),
                // Optimization: Load light-weight stats instead of heavy charges history
                fetchWithCache<MonthlyStat[]>('monthly_stats', [], force),
            ]);

            // Fetch Settings manually as they are single docs usually
            let invoiceSettings: InvoiceSettings | null = null;
            let tariffs: TariffCollection = { service: MOCK_TARIFFS_SERVICE, parking: MOCK_TARIFFS_PARKING, water: MOCK_TARIFFS_WATER };

            try {
                const invoiceSnap = await getDoc(doc(db, 'settings', 'invoice'));
                if (invoiceSnap.exists()) invoiceSettings = invoiceSnap.data() as InvoiceSettings;

                const tariffsSnap = await getDoc(doc(db, 'settings', 'tariffs'));
                if (tariffsSnap.exists()) tariffs = tariffsSnap.data() as TariffCollection;
            } catch (e) {
                console.error("Error fetching settings:", e);
            }

            setData({
                units, owners, vehicles, users, adjustments, waterReadings, activityLogs,
                invoiceSettings, tariffs, monthlyStats, hasLoaded: true
            });

        } catch (err: any) {
            console.error("System Data Load Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial Load - Strictly ONCE on mount
    useEffect(() => {
        refreshSystemData(false);
    }, [refreshSystemData]);

    return { ...data, loading, error, refreshSystemData };
};
