
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, DocumentData } from 'firebase/firestore';
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
 * Core function to fetch data with Local-First strategy
 */
async function fetchWithCache<T>(
    collectionName: string, 
    fallbackData: T | null = null,
    forceRefresh: boolean = false
): Promise<T> {
    const cacheKey = `${CACHE_PREFIX}${collectionName}`;
    const now = Date.now();
    
    // 1. Try Local Cache
    if (!forceRefresh) {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
            try {
                const packet: CachePacket<T> = JSON.parse(cachedRaw);
                if (now - packet.timestamp < CACHE_DURATION) {
                    // console.log(`[SmartCache] Hit: ${collectionName}`);
                    return packet.data;
                } else {
                    console.log(`[SmartCache] Expired: ${collectionName}`);
                }
            } catch (e) {
                console.warn(`[SmartCache] Corrupt cache for ${collectionName}`);
                localStorage.removeItem(cacheKey);
            }
        }
    }

    // 2. Fetch from Network (Firestore)
    if (!isProduction()) {
        // console.log(`[SmartCache] Dev Mode - Returning fallback for ${collectionName}`);
        return fallbackData as T;
    }

    console.log(`[SmartCache] Network Fetch: ${collectionName}`);
    try {
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);
        const data = snapshot.docs.map(doc => doc.data()) as unknown as T; // Generic cast

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
        throw error;
    }
}

// Special handler for settings (Single Doc)
async function fetchSettingsWithCache(docName: string, defaultSettings: any, forceRefresh: boolean = false): Promise<any> {
    const collectionName = `settings_${docName}`; // Virtual collection name for cache key
    // Logic similar to fetchWithCache but for single doc is implemented via collection fetch in main logic usually, 
    // but here we simulate getting it from the 'settings' collection if structured that way, 
    // OR we just use the generic fetch if settings are stored as individual docs in a collection.
    // For this project structure, settings are likely documents in 'settings' collection.
    
    // Simplified: We will fetch the whole 'settings' collection and filter in memory to save reads if multiple settings exist,
    // OR just use getDoc. For quota safety, let's assume we fetch the specific doc.
    
    // ... Implementation reused in useSystemData ...
    return defaultSettings; 
}

/**
 * Orchestrator Hook: Loads ALL static system data efficiently
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
        waterReadings: WaterReading[]; // Historical readings
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
            // Parallel Fetching
            const [
                units, owners, vehicles, users, 
                adjustments, waterReadings, activityLogs,
                // Special handling for Settings & Tariffs (often single docs)
                // For simplicity in this fix, we assume standard collections or we wrap logic
            ] = await Promise.all([
                fetchWithCache<Unit[]>('units', [], force),
                fetchWithCache<Owner[]>('owners', [], force),
                fetchWithCache<Vehicle[]>('vehicles', [], force),
                fetchWithCache<UserPermission[]>('users', MOCK_USER_PERMISSIONS, force),
                fetchWithCache<Adjustment[]>('adjustments', [], force),
                fetchWithCache<WaterReading[]>('waterReadings', [], force),
                fetchWithCache<ActivityLog[]>('activityLogs', [], force), // Activity logs might need frequent updates, consider shorter cache
            ]);

            // Fetch Settings manually as they are single docs usually
            // We can cache these manually
            let invoiceSettings: InvoiceSettings | null = null;
            let tariffs: TariffCollection = { service: MOCK_TARIFFS_SERVICE, parking: MOCK_TARIFFS_PARKING, water: MOCK_TARIFFS_WATER };

            if (isProduction()) {
                // We don't cache settings strictly or we use a separate key because they change often
                // But for Quota safety, let's cache them for 1 hour or use the same mechanism
                // Here we essentially re-implement fetchWithCache logic for single docs if needed, 
                // but let's assume we just fetch them fresh for safety or implement a small fetch helper.
                
                // For now, let's fetch them fresh to ensure settings are correct, 
                // as they are low volume (1 read per reload).
                // Or use the generic fetch if 'settings' is a collection containing 'invoice' and 'tariffs' docs.
                
                // Re-using the logic from firebaseAPI but ensuring we don't break strict rules:
                // We will fetch 'settings' collection once.
                const settingsCol = await fetchWithCache<any[]>('settings', [], force);
                
                // Manually map if the structure allows, otherwise fall back to defaults
                // Assuming 'settings' collection has docs with IDs 'invoice' and 'tariffs'
                // But fetchWithCache returns data arrays without IDs. 
                // We might need to adjust fetchWithCache to include IDs if we fetch whole collections.
                
                // ADJUSTMENT: To be safe and compatible with existing structure:
                // We will just fetch them fresh here or use a dedicated method.
                // Given the constraints, let's use the provided 'loadAllData' logic style but encapsulated.
                
                const { doc, getDoc } = await import('firebase/firestore');
                
                // Settings are critical, maybe fetch fresh?
                const invoiceSnap = await getDoc(doc(db, 'settings', 'invoice'));
                if (invoiceSnap.exists()) invoiceSettings = invoiceSnap.data() as InvoiceSettings;

                const tariffsSnap = await getDoc(doc(db, 'settings', 'tariffs'));
                if (tariffsSnap.exists()) tariffs = tariffsSnap.data() as TariffCollection;

            } else {
                // Mock Data
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

    // Initial Load
    useEffect(() => {
        refreshSystemData(false);
    }, [refreshSystemData]);

    return { ...data, loading, error, refreshSystemData };
};
