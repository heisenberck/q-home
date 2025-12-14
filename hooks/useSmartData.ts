
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import { isProduction } from '../utils/env';
import { 
    Unit, Owner, Vehicle, WaterReading, ChargeRaw, 
    TariffCollection, UserPermission, InvoiceSettings, Adjustment, ActivityLog, MonthlyStat, SystemMetadata 
} from '../types';
import * as firebaseAPI from '../services/firebaseAPI'; 
import { loadAllData as loadMockData } from '../services/mockAPI';
// Import from idb-keyval via CDN as defined in importmap
import { get, set } from 'idb-keyval';

const CACHE_PREFIX = 'qhome_cache_v2_';
const META_KEY = 'qhome_meta_version';

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
        monthlyStats: MonthlyStat[];
        lockedWaterPeriods: string[];
        hasLoaded: boolean;
    }>({
        units: [], owners: [], vehicles: [], tariffs: { service: [], parking: [], water: [] },
        users: [], invoiceSettings: null, adjustments: [], waterReadings: [], activityLogs: [], monthlyStats: [], lockedWaterPeriods: [],
        hasLoaded: false
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshSystemData = useCallback(async (force = false) => {
        setLoading(true);
        setError(null);
        
        if (!isProduction()) {
            // Mock Data Flow
            try {
                const devData = await loadMockData();
                setData({ ...devData, hasLoaded: true });
            } catch (err: any) { setError(err.message); } finally { setLoading(false); }
            return;
        }

        try {
            // 1. Fetch Server Metadata (1 Read)
            const serverMeta = await firebaseAPI.getSystemMetadata();
            
            // IndexedDB is async
            const localMeta = (await get(CACHE_PREFIX + META_KEY)) as SystemMetadata || { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };

            // 2. Determine what to fetch
            // We use Promise.all to fetch cache in parallel if needed
            const [
                cachedUnits, cachedOwners, cachedVehicles, cachedTariffs, cachedUsers
            ] = await Promise.all([
                get(CACHE_PREFIX + 'units'),
                get(CACHE_PREFIX + 'owners'),
                get(CACHE_PREFIX + 'vehicles'),
                get(CACHE_PREFIX + 'tariffs'),
                get(CACHE_PREFIX + 'users')
            ]);

            const shouldFetchUnits = force || serverMeta.units_version > localMeta.units_version || !cachedUnits;
            const shouldFetchOwners = force || serverMeta.owners_version > localMeta.owners_version || !cachedOwners;
            const shouldFetchVehicles = force || serverMeta.vehicles_version > localMeta.vehicles_version || !cachedVehicles;
            const shouldFetchTariffs = force || serverMeta.tariffs_version > localMeta.tariffs_version || !cachedTariffs;
            const shouldFetchUsers = force || serverMeta.users_version > localMeta.users_version || !cachedUsers;

            console.log(`[SmartData] Sync Plan: Units:${shouldFetchUnits} Owners:${shouldFetchOwners} Vehicles:${shouldFetchVehicles} (Using IndexedDB)`);

            // 3. Execute Fetches (Parallel)
            const promises: Promise<any>[] = [];
            
            // Hot Data (Versioned)
            promises.push(shouldFetchUnits ? firebaseAPI.fetchCollection<Unit>('units') : Promise.resolve(cachedUnits));
            promises.push(shouldFetchOwners ? firebaseAPI.fetchCollection<Owner>('owners') : Promise.resolve(cachedOwners));
            promises.push(shouldFetchVehicles ? firebaseAPI.fetchCollection<Vehicle>('vehicles') : Promise.resolve(cachedVehicles));
            promises.push(shouldFetchTariffs ? getDoc(doc(db, 'settings', 'tariffs')).then(s => s.exists() ? s.data() : null) : Promise.resolve(cachedTariffs));
            promises.push(shouldFetchUsers ? firebaseAPI.fetchCollection<UserPermission>('users') : Promise.resolve(cachedUsers));

            // Cold/Append-Only Data (Always fetch fresh but limited)
            promises.push(firebaseAPI.fetchCollection<Adjustment>('adjustments')); 
            promises.push(firebaseAPI.fetchCollection<WaterReading>('waterReadings')); 
            
            // UPDATED: Use fetchLatestLogs with limit 20 (reduced from 50) to respect quota and fit user request
            promises.push(firebaseAPI.fetchLatestLogs(20)); 
            
            promises.push(firebaseAPI.fetchCollection<MonthlyStat>('monthly_stats'));
            promises.push(firebaseAPI.fetchCollection('water_locks').then(docs => docs.filter((d:any) => d.isLocked).map((d:any) => d.id))); 
            promises.push(getDoc(doc(db, 'settings', 'invoice')).then(s => s.exists() ? s.data() : null));

            const [
                units, owners, vehicles, tariffs, users,
                adjustments, waterReadings, activityLogs, monthlyStats, lockedWaterPeriods,
                invoiceSettings
            ] = await Promise.all(promises);

            // 4. Update Cache (Async)
            const cachePromises = [];
            if (shouldFetchUnits) cachePromises.push(set(CACHE_PREFIX + 'units', units));
            if (shouldFetchOwners) cachePromises.push(set(CACHE_PREFIX + 'owners', owners));
            if (shouldFetchVehicles) cachePromises.push(set(CACHE_PREFIX + 'vehicles', vehicles));
            if (shouldFetchTariffs) cachePromises.push(set(CACHE_PREFIX + 'tariffs', tariffs));
            if (shouldFetchUsers) cachePromises.push(set(CACHE_PREFIX + 'users', users));
            
            // Always update metadata
            cachePromises.push(set(CACHE_PREFIX + META_KEY, serverMeta));
            await Promise.all(cachePromises);

            setData({
                units: units || [], 
                owners: owners || [], 
                vehicles: vehicles || [], 
                tariffs: tariffs || { service: [], parking: [], water: [] }, 
                users: users || [],
                invoiceSettings: invoiceSettings || null, 
                adjustments: adjustments || [], 
                waterReadings: waterReadings || [], 
                activityLogs: activityLogs || [], 
                monthlyStats: monthlyStats || [], 
                lockedWaterPeriods: lockedWaterPeriods || [],
                hasLoaded: true
            });

        } catch (err: any) {
            console.error("System Data Load Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refreshSystemData(false); }, [refreshSystemData]);

    return { ...data, loading, error, refreshSystemData };
};
