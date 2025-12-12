
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { isProduction } from '../utils/env';
import { 
    Unit, Owner, Vehicle, WaterReading, ChargeRaw, 
    TariffCollection, UserPermission, InvoiceSettings, Adjustment, ActivityLog 
} from '../types';
import { MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_USER_PERMISSIONS } from '../constants';

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
    // SAFETY CHECK: Only fetch from Firestore in Production to prevent Dev/Test pollution issues
    // or unexpected quota usage. Dev mode uses Mock Data (fallbackData).
    if (!isProduction()) {
        console.log(`[SmartCache] Dev Mode - Returning fallback for ${collectionName}`);
        return fallbackData as T;
    }

    console.log(`[SmartCache] Network Fetch: ${collectionName}`);
    
    try {
        // PURE READ OPERATION
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);
        const data = snapshot.docs.map(doc => doc.data()) as unknown as T; // Generic cast

        // 3. Save to Cache (Read-Through Cache pattern)
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
        // On error, try to return fallback rather than crashing
        return fallbackData as T;
    }
}

/**
 * Orchestrator Hook: Loads ALL static system data efficiently.
 * Does NOT write to database.
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
        hasLoaded: boolean;
    }>({
        units: [], owners: [], vehicles: [], tariffs: { service: [], parking: [], water: [] },
        users: [], invoiceSettings: null, adjustments: [], waterReadings: [], activityLogs: [],
        hasLoaded: false
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshSystemData = useCallback(async (force = false) => {
        setLoading(true);
        setError(null);
        
        try {
            // Parallel Fetching - READ ONLY
            const [
                units, owners, vehicles, users, 
                adjustments, waterReadings, activityLogs,
            ] = await Promise.all([
                fetchWithCache<Unit[]>('units', [], force),
                fetchWithCache<Owner[]>('owners', [], force),
                fetchWithCache<Vehicle[]>('vehicles', [], force),
                fetchWithCache<UserPermission[]>('users', MOCK_USER_PERMISSIONS, force),
                fetchWithCache<Adjustment[]>('adjustments', [], force),
                fetchWithCache<WaterReading[]>('waterReadings', [], force),
                fetchWithCache<ActivityLog[]>('activityLogs', [], force),
            ]);

            // Fetch Settings manually as they are single docs usually
            let invoiceSettings: InvoiceSettings | null = null;
            let tariffs: TariffCollection = { service: MOCK_TARIFFS_SERVICE, parking: MOCK_TARIFFS_PARKING, water: MOCK_TARIFFS_WATER };

            if (isProduction()) {
                // Fetch Settings directly (low volume, usually safe to fetch fresh or implement simpler caching)
                try {
                    const invoiceSnap = await getDoc(doc(db, 'settings', 'invoice'));
                    if (invoiceSnap.exists()) invoiceSettings = invoiceSnap.data() as InvoiceSettings;

                    const tariffsSnap = await getDoc(doc(db, 'settings', 'tariffs'));
                    if (tariffsSnap.exists()) tariffs = tariffsSnap.data() as TariffCollection;
                } catch (e) {
                    console.error("Error fetching settings:", e);
                }
            } else {
                // Mock Data for Dev
                invoiceSettings = {
                    logoUrl: '', accountName: 'Mock', accountNumber: '123', bankName: 'MockBank',
                    senderEmail: 'test', buildingName: 'Mock Building'
                };
            }

            setData({
                units, owners, vehicles, users, adjustments, waterReadings, activityLogs,
                invoiceSettings, tariffs, hasLoaded: true
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
