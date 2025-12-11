
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { isProduction } from '../utils/env';
import { 
    Unit, Owner, Vehicle, WaterReading, ChargeRaw, 
    TariffCollection, UserPermission, InvoiceSettings, Adjustment, ActivityLog 
} from '../types';
import { MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_USER_PERMISSIONS } from '../constants';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 Hours
const CACHE_PREFIX = 'qhome_smart_cache_v1_';
const LAST_UPDATED_KEY = 'qhome_last_updated';
const REFRESH_EVENT = 'qhome_data_refreshed';

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
                    return packet.data;
                }
            } catch (e) {
                localStorage.removeItem(cacheKey);
            }
        }
    }

    // 2. Fetch from Network (Firestore)
    if (!isProduction()) {
        return fallbackData as T;
    }

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
        throw error;
    }
}

/**
 * Orchestrator Hook: Loads ALL static system data efficiently
 */
export const useSmartSystemData = (skipFetch = false) => {
    const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
        const saved = localStorage.getItem(LAST_UPDATED_KEY);
        return saved ? new Date(parseInt(saved)) : null;
    });

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

    const [loading, setLoading] = useState(!skipFetch);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Listen for global refresh events to update timestamp
    useEffect(() => {
        const handleRefreshEvent = () => {
            const saved = localStorage.getItem(LAST_UPDATED_KEY);
            if (saved) setLastUpdated(new Date(parseInt(saved)));
        };
        window.addEventListener(REFRESH_EVENT, handleRefreshEvent);
        return () => window.removeEventListener(REFRESH_EVENT, handleRefreshEvent);
    }, []);

    const refreshSystemData = useCallback(async (force = false) => {
        setLoading(true);
        setIsRefreshing(true);
        setError(null);
        
        try {
            // Parallel Fetching
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

            let invoiceSettings: InvoiceSettings | null = null;
            let tariffs: TariffCollection = { service: MOCK_TARIFFS_SERVICE, parking: MOCK_TARIFFS_PARKING, water: MOCK_TARIFFS_WATER };

            if (isProduction()) {
                // Fetch settings fresh
                const { doc, getDoc } = await import('firebase/firestore');
                const invoiceSnap = await getDoc(doc(db, 'settings', 'invoice'));
                if (invoiceSnap.exists()) invoiceSettings = invoiceSnap.data() as InvoiceSettings;

                const tariffsSnap = await getDoc(doc(db, 'settings', 'tariffs'));
                if (tariffsSnap.exists()) tariffs = tariffsSnap.data() as TariffCollection;
            } else {
                invoiceSettings = {
                    logoUrl: '', accountName: 'Mock', accountNumber: '123', bankName: 'MockBank',
                    senderEmail: 'test', buildingName: 'Mock Building'
                };
            }

            setData({
                units, owners, vehicles, users, adjustments, waterReadings, activityLogs,
                invoiceSettings, tariffs, hasLoaded: true
            });

            // Update Timestamp
            const now = new Date();
            setLastUpdated(now);
            localStorage.setItem(LAST_UPDATED_KEY, now.getTime().toString());
            window.dispatchEvent(new Event(REFRESH_EVENT));

        } catch (err: any) {
            console.error("System Data Load Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // Initial Load
    useEffect(() => {
        if (!skipFetch) {
            refreshSystemData(false);
        }
    }, [refreshSystemData, skipFetch]);

    return { 
        ...data, 
        loading, 
        isRefreshing, // Export refreshing state specifically
        error, 
        refreshSystemData,
        lastUpdated 
    };
};
