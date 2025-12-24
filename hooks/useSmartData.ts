
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import { isProduction } from '../utils/env';
import { 
    Unit, Owner, Vehicle, WaterReading, NewsItem,
    TariffCollection, UserPermission, InvoiceSettings, Adjustment, ActivityLog, MonthlyStat, SystemMetadata, ChargeRaw, MiscRevenue, OperationalExpense, FeedbackItem
} from '../types';
import * as api from '../services/index'; 
import { get, set } from 'idb-keyval';

const CACHE_PREFIX = 'qhome_cache_v2_';
const META_KEY = 'qhome_meta_version';

export const useSmartSystemData = (currentUser: UserPermission | null) => {
    
    const [data, setData] = useState<{
        units: Unit[];
        owners: Owner[];
        vehicles: Vehicle[];
        tariffs: TariffCollection;
        users: UserPermission[];
        news: NewsItem[];
        feedback: FeedbackItem[];
        invoiceSettings: InvoiceSettings | null;
        adjustments: Adjustment[];
        waterReadings: WaterReading[];
        activityLogs: ActivityLog[];
        monthlyStats: MonthlyStat[];
        lockedWaterPeriods: string[];
        charges: ChargeRaw[];
        miscRevenues: MiscRevenue[];
        expenses: OperationalExpense[];
        hasLoaded: boolean;
    }>({
        units: [], owners: [], vehicles: [], tariffs: { service: [], parking: [], water: [] },
        users: [], news: [], feedback: [], invoiceSettings: null, adjustments: [], waterReadings: [], activityLogs: [], monthlyStats: [], lockedWaterPeriods: [],
        charges: [], miscRevenues: [], expenses: [],
        hasLoaded: false
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshSystemData = useCallback(async (force = false) => {
        setLoading(true);
        setError(null);
        
        try {
            const isAdmin = currentUser && currentUser.Role !== 'Resident';
            const residentId = currentUser?.residentId;
            const currentPeriod = new Date().toISOString().slice(0, 7);

            const serverMeta = await api.getSystemMetadata();
            const localMeta = (await get(CACHE_PREFIX + META_KEY)) as SystemMetadata || { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };

            const invoiceSettingsSnap = await getDoc(doc(db, 'settings', 'invoice'));
            const invoiceSettings = invoiceSettingsSnap.exists() ? invoiceSettingsSnap.data() as InvoiceSettings : null;

            const cachedUsers = await get(CACHE_PREFIX + 'users');
            const shouldFetchUsers = force || serverMeta.users_version > localMeta.users_version || !cachedUsers;
            // Fix: Untyped function calls may not accept type arguments. Removed <UserPermission> and added type assertion.
            const fetchedUsers = shouldFetchUsers ? await (api.fetchCollection('users') as Promise<UserPermission[]>) : cachedUsers;
            if (shouldFetchUsers) await set(CACHE_PREFIX + 'users', fetchedUsers);

            const fetchedNews = await api.fetchNews();

            if (!currentUser) {
                setData(prev => ({ ...prev, users: fetchedUsers, news: fetchedNews, invoiceSettings, hasLoaded: true }));
                setLoading(false);
                return;
            }

            const promises: Promise<any>[] = [];
            const cachedTariffs = await get(CACHE_PREFIX + 'tariffs');
            const shouldFetchTariffs = force || serverMeta.tariffs_version > localMeta.tariffs_version || !cachedTariffs;
            promises.push(shouldFetchTariffs ? getDoc(doc(db, 'settings', 'tariffs')).then(s => s.exists() ? s.data() : null) : Promise.resolve(cachedTariffs));
            promises.push(api.fetchWaterLocks());
            // Fix: Untyped function calls may not accept type arguments. Removed <MonthlyStat> and added type assertion.
            promises.push(api.fetchCollection('monthly_stats') as Promise<MonthlyStat[]>);

            let fetchedUnits: Unit[] = [];
            let fetchedOwners: Owner[] = [];
            let fetchedVehicles: Vehicle[] = [];
            let fetchedAdjustments: Adjustment[] = [];
            let fetchedWaterReadings: WaterReading[] = [];
            let fetchedCharges: ChargeRaw[] = [];
            let fetchedMisc: MiscRevenue[] = [];
            let fetchedExpenses: OperationalExpense[] = [];

            if (isAdmin) {
                const [cachedUnits, cachedOwners, cachedVehicles] = await Promise.all([
                    get(CACHE_PREFIX + 'units'), get(CACHE_PREFIX + 'owners'), get(CACHE_PREFIX + 'vehicles')
                ]);
                const shouldFetchUnitsFlag = force || serverMeta.units_version > localMeta.units_version || !cachedUnits;
                const shouldFetchOwnersFlag = force || serverMeta.owners_version > localMeta.owners_version || !cachedOwners;
                const shouldFetchVehiclesFlag = force || serverMeta.vehicles_version > localMeta.vehicles_version || !cachedVehicles;

                // Fix: Untyped function calls may not accept type arguments. Removed <Unit> and added type assertion.
                promises.push(shouldFetchUnitsFlag ? (api.fetchCollection('units') as Promise<Unit[]>) : Promise.resolve(cachedUnits));
                // Fix: Untyped function calls may not accept type arguments. Removed <Owner> and added type assertion.
                promises.push(shouldFetchOwnersFlag ? (api.fetchCollection('owners') as Promise<Owner[]>) : Promise.resolve(cachedOwners));
                // Fix: Untyped function calls may not accept type arguments. Removed <Vehicle> and added type assertion.
                promises.push(shouldFetchVehiclesFlag ? (api.fetchCollection('vehicles') as Promise<Vehicle[]>) : Promise.resolve(cachedVehicles));
                promises.push(api.fetchRecentAdjustments(currentPeriod)); 
                promises.push(api.fetchRecentWaterReadings([currentPeriod]));
                // Fix: Untyped function calls may not accept type arguments. Removed <ChargeRaw> and added type assertion.
                promises.push(api.fetchCollection('charges') as Promise<ChargeRaw[]>);
                promises.push(api.getMonthlyMiscRevenues(currentPeriod));
                // Fix: Untyped function calls may not accept type arguments. Removed <OperationalExpense> and added type assertion.
                promises.push((api.fetchCollection('operational_expenses') as Promise<OperationalExpense[]>).then(all => all.filter(e => e.date.startsWith(currentPeriod))));

                const results = await Promise.all(promises);
                const tariffs = results[0] || { service: [], parking: [], water: [] };
                const lockedWaterPeriods = results[1] || [];
                const monthlyStats = results[2] || [];
                fetchedUnits = results[3] || [];
                fetchedOwners = results[4] || [];
                fetchedVehicles = results[5] || [];
                fetchedAdjustments = results[6] || [];
                fetchedWaterReadings = results[7] || [];
                fetchedCharges = results[8] || [];
                fetchedMisc = results[9] || [];
                fetchedExpenses = results[10] || [];

                if (shouldFetchUnitsFlag) await set(CACHE_PREFIX + 'units', fetchedUnits);
                if (shouldFetchOwnersFlag) await set(CACHE_PREFIX + 'owners', fetchedOwners);
                if (shouldFetchVehiclesFlag) await set(CACHE_PREFIX + 'vehicles', fetchedVehicles);
                await set(CACHE_PREFIX + 'tariffs', tariffs);
                await set(CACHE_PREFIX + META_KEY, serverMeta);

                setData({
                    units: fetchedUnits, owners: fetchedOwners, vehicles: fetchedVehicles, tariffs, 
                    users: fetchedUsers, news: fetchedNews, feedback: [],
                    invoiceSettings, adjustments: fetchedAdjustments, waterReadings: fetchedWaterReadings, 
                    activityLogs: [], monthlyStats, lockedWaterPeriods, charges: fetchedCharges, 
                    miscRevenues: fetchedMisc, expenses: fetchedExpenses, hasLoaded: true
                });
            } else {
                if (residentId) {
                    const specificData = await api.fetchResidentSpecificData(residentId);
                    // Fix: Untyped function calls may not accept type arguments. Removed <ChargeRaw> and added type assertion.
                    const charges = await (api.fetchCollection('charges') as Promise<ChargeRaw[]>).then(all => all.filter(c => c.UnitID === residentId));

                    setData(prev => ({
                        ...prev,
                        units: specificData.unit ? [specificData.unit] : [],
                        owners: specificData.owner ? [specificData.owner] : [],
                        vehicles: specificData.vehicles,
                        charges,
                        users: fetchedUsers,
                        news: fetchedNews,
                        invoiceSettings,
                        hasLoaded: true
                    }));
                }
            }
        } catch (err: any) {
            console.error("System Data Load Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [currentUser]); 

    useEffect(() => { refreshSystemData(false); }, [currentUser, refreshSystemData]);
    return { ...data, loading, error, refreshSystemData };
};
