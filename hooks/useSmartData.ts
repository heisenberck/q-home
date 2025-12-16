
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import { isProduction } from '../utils/env';
import { 
    Unit, Owner, Vehicle, WaterReading, 
    TariffCollection, UserPermission, InvoiceSettings, Adjustment, ActivityLog, MonthlyStat, SystemMetadata 
} from '../types';
import * as firebaseAPI from '../services/firebaseAPI'; 
import { loadAllData as loadMockData } from '../services/mockAPI';
// Import from idb-keyval via CDN as defined in importmap
import { get, set } from 'idb-keyval';

const CACHE_PREFIX = 'qhome_cache_v2_';
const META_KEY = 'qhome_meta_version';

// UPDATED: Accept currentUser as an argument to avoid circular dependency with App.tsx
export const useSmartSystemData = (currentUser: UserPermission | null) => {
    
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
            const isAdmin = currentUser?.Role !== 'Resident'; // Treat as non-admin if null (we handle null logic below)
            const residentId = currentUser?.residentId;

            // 1. Fetch Server Metadata (1 Read)
            const serverMeta = await firebaseAPI.getSystemMetadata();
            const localMeta = (await get(CACHE_PREFIX + META_KEY)) as SystemMetadata || { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };

            // 2. Fetch Base Data (Users, Settings) - Needed for Login & App Start
            // Always fetch Invoice Settings
            const invoiceSettingsSnap = await getDoc(doc(db, 'settings', 'invoice'));
            const invoiceSettings = invoiceSettingsSnap.exists() ? invoiceSettingsSnap.data() as InvoiceSettings : null;

            // Always fetch Users (for Login validation) - Consider caching this heavily
            const cachedUsers = await get(CACHE_PREFIX + 'users');
            const shouldFetchUsers = force || serverMeta.users_version > localMeta.users_version || !cachedUsers;
            const fetchedUsers = shouldFetchUsers ? await firebaseAPI.fetchCollection<UserPermission>('users') : cachedUsers;
            
            // If we fetched fresh users, update cache
            if (shouldFetchUsers) await set(CACHE_PREFIX + 'users', fetchedUsers);

            // If NOT logged in, return base data and stop
            if (!currentUser) {
                setData(prev => ({
                    ...prev,
                    users: fetchedUsers,
                    invoiceSettings,
                    hasLoaded: true
                }));
                setLoading(false);
                return;
            }

            // 3. Authenticated Data Fetching
            const promises: Promise<any>[] = [];
            
            // Tariffs & Locks
            const cachedTariffs = await get(CACHE_PREFIX + 'tariffs');
            const shouldFetchTariffs = force || serverMeta.tariffs_version > localMeta.tariffs_version || !cachedTariffs;
            promises.push(shouldFetchTariffs ? getDoc(doc(db, 'settings', 'tariffs')).then(s => s.exists() ? s.data() : null) : Promise.resolve(cachedTariffs));
            promises.push(firebaseAPI.fetchWaterLocks());
            promises.push(firebaseAPI.fetchCollection<MonthlyStat>('monthly_stats'));

            // 4. Role-Specific Data
            let fetchedUnits: Unit[] = [];
            let fetchedOwners: Owner[] = [];
            let fetchedVehicles: Vehicle[] = [];
            let fetchedAdjustments: Adjustment[] = [];
            let fetchedWaterReadings: WaterReading[] = [];

            if (isAdmin) {
                // --- ADMIN FLOW ---
                const [cachedUnits, cachedOwners, cachedVehicles] = await Promise.all([
                    get(CACHE_PREFIX + 'units'), get(CACHE_PREFIX + 'owners'), get(CACHE_PREFIX + 'vehicles')
                ]);

                const shouldFetchUnits = force || serverMeta.units_version > localMeta.units_version || !cachedUnits;
                const shouldFetchOwners = force || serverMeta.owners_version > localMeta.owners_version || !cachedOwners;
                const shouldFetchVehicles = force || serverMeta.vehicles_version > localMeta.vehicles_version || !cachedVehicles;

                promises.push(shouldFetchUnits ? firebaseAPI.fetchCollection<Unit>('units') : Promise.resolve(cachedUnits));
                promises.push(shouldFetchOwners ? firebaseAPI.fetchCollection<Owner>('owners') : Promise.resolve(cachedOwners));
                promises.push(shouldFetchVehicles ? firebaseAPI.fetchCollection<Vehicle>('vehicles') : Promise.resolve(cachedVehicles));
                
                // OPTIMIZATION: Fetch only recent adjustments (last 6 months) instead of all history
                const currentPeriod = new Date().toISOString().slice(0, 7);
                const [year, month] = currentPeriod.split('-').map(Number);
                
                // Calculate 6 months ago for adjustments window
                const sixMonthsAgoDate = new Date(year, month - 6, 1);
                const startPeriod = `${sixMonthsAgoDate.getFullYear()}-${String(sixMonthsAgoDate.getMonth() + 1).padStart(2, '0')}`;
                
                promises.push(firebaseAPI.fetchRecentAdjustments(startPeriod)); 
                
                // Fetch recent water readings (2 months window for processing)
                const prevDate = new Date(year, month - 2, 1);
                const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
                promises.push(firebaseAPI.fetchRecentWaterReadings([currentPeriod, prevPeriod]));

            } else {
                // --- RESIDENT FLOW ---
                if (residentId) {
                    promises.push(firebaseAPI.fetchResidentSpecificData(residentId));
                    promises.push(Promise.resolve([])); // Owners placeholder
                    promises.push(Promise.resolve([])); // Vehicles placeholder
                    promises.push(Promise.resolve([])); // Adjustments placeholder
                    promises.push(Promise.resolve([])); // Water placeholder
                } else {
                    promises.push(Promise.resolve({ unit: null, owner: null, vehicles: [] }));
                    promises.push(Promise.resolve([]));
                    promises.push(Promise.resolve([]));
                    promises.push(Promise.resolve([]));
                    promises.push(Promise.resolve([]));
                }
            }

            // --- EXECUTE PROMISES ---
            const results = await Promise.all(promises);
            
            const tariffs = results[0] || { service: [], parking: [], water: [] };
            const lockedWaterPeriods = results[1] || [];
            const monthlyStats = results[2] || [];

            if (isAdmin) {
                fetchedUnits = results[3] || [];
                fetchedOwners = results[4] || [];
                fetchedVehicles = results[5] || [];
                fetchedAdjustments = results[6] || [];
                fetchedWaterReadings = results[7] || [];

                // Update Cache for Admin
                const cachePromises = [];
                if (force || serverMeta.units_version > localMeta.units_version) cachePromises.push(set(CACHE_PREFIX + 'units', fetchedUnits));
                if (force || serverMeta.owners_version > localMeta.owners_version) cachePromises.push(set(CACHE_PREFIX + 'owners', fetchedOwners));
                if (force || serverMeta.vehicles_version > localMeta.vehicles_version) cachePromises.push(set(CACHE_PREFIX + 'vehicles', fetchedVehicles));
                cachePromises.push(set(CACHE_PREFIX + 'tariffs', tariffs));
                cachePromises.push(set(CACHE_PREFIX + META_KEY, serverMeta));
                await Promise.all(cachePromises);

            } else {
                const specificData = results[3];
                if (specificData && specificData.unit) {
                    fetchedUnits = [specificData.unit];
                    fetchedOwners = specificData.owner ? [specificData.owner] : [];
                    fetchedVehicles = specificData.vehicles;
                }
            }

            setData({
                units: fetchedUnits, 
                owners: fetchedOwners, 
                vehicles: fetchedVehicles, 
                tariffs, 
                users: fetchedUsers,
                invoiceSettings, 
                adjustments: fetchedAdjustments, 
                waterReadings: fetchedWaterReadings, 
                activityLogs: [], 
                monthlyStats, 
                lockedWaterPeriods,
                hasLoaded: true
            });

        } catch (err: any) {
            console.error("System Data Load Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [currentUser]); 

    // Trigger on mount or user change
    useEffect(() => { 
        refreshSystemData(false); 
    }, [currentUser, refreshSystemData]);

    return { ...data, loading, error, refreshSystemData };
};
