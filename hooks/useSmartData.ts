
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Unit, Owner, Vehicle, WaterReading, NewsItem,
    TariffCollection, UserPermission, InvoiceSettings, Adjustment, MonthlyStat, SystemMetadata, ChargeRaw,
    MiscRevenue, OperationalExpense
} from '../types';
import * as api from '../services/index'; 
import { get, set } from 'idb-keyval';
import { getPreviousPeriod } from '../utils/helpers';

const CACHE_PREFIX = 'qhome_cache_v5_';
const META_KEY = 'qhome_meta_version';

// Cache ngoài component để tồn tại qua các lần re-render
const SESSION_PERIOD_CACHE: Record<string, Map<string, any>> = {
    charges: new Map(),
    water: new Map(),
    misc: new Map(),
    expenses: new Map()
};

export const useSmartSystemData = (currentUser: UserPermission | null) => {
    const [data, setData] = useState<any>({
        units: [], owners: [], vehicles: [], waterReadings: [], charges: [],
        adjustments: [], users: [], news: [], monthlyStats: [],
        lockedWaterPeriods: [], invoiceSettings: null,
        tariffs: { service: [], parking: [], water: [] },
        miscRevenues: [], expenses: [], hasLoaded: false
    });
    
    const [loading, setLoading] = useState(true);
    const isFetching = useRef(false);
    const lastFetchTs = useRef(0);

    const refreshSystemData = useCallback(async (force = false) => {
        // Nếu force = true, xóa bỏ cache RAM cũ để lấy dữ liệu mới nhất (Ví dụ sau khi Tính Phí)
        if (force) {
            SESSION_PERIOD_CACHE.charges.clear();
            SESSION_PERIOD_CACHE.water.clear();
            SESSION_PERIOD_CACHE.misc.clear();
            SESSION_PERIOD_CACHE.expenses.clear();
        }

        if (isFetching.current || (!force && Date.now() - lastFetchTs.current < 2000)) return;
        
        isFetching.current = true;
        setLoading(true);
        lastFetchTs.current = Date.now();
        
        try {
            const isAdmin = currentUser && currentUser.Role !== 'Resident';
            const currentPeriod = new Date().toISOString().slice(0, 7);

            const serverMeta = await api.getSystemMetadata();
            const localMeta = (await get(CACHE_PREFIX + META_KEY)) as SystemMetadata || { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };

            const fetchOrCache = async (key: string, versionKey: keyof SystemMetadata, apiCall: () => Promise<any>) => {
                const cached = await get(CACHE_PREFIX + key);
                if (force || !cached || serverMeta[versionKey] > localMeta[versionKey]) {
                    const fresh = await apiCall();
                    await set(CACHE_PREFIX + key, fresh);
                    return fresh;
                }
                return cached;
            };

            const [fetchedUsers, fetchedNews, invoiceSettings] = await Promise.all([
                fetchOrCache('users', 'users_version', () => api.fetchCollection('users')),
                api.fetchNews(),
                api.fetchInvoiceSettings()
            ]);

            if (!isAdmin) {
                if (currentUser?.residentId) {
                    const specific = await api.fetchResidentSpecificData(currentUser.residentId);
                    const charges = await api.fetchChargesForResident(currentUser.residentId);

                    setData({
                        units: specific.unit ? [specific.unit] : [],
                        owners: specific.owner ? [specific.owner] : [],
                        vehicles: (specific.vehicles || []).filter((v:any) => v.isActive),
                        charges: charges,
                        news: fetchedNews || [],
                        users: fetchedUsers || [],
                        invoiceSettings,
                        tariffs: { service: [], parking: [], water: [] },
                        waterReadings: [], adjustments: [], monthlyStats: [], lockedWaterPeriods: [],
                        miscRevenues: [], expenses: [], hasLoaded: true
                    });
                }
            } else {
                const [units, owners, vehicles, tariffsData] = await Promise.all([
                    fetchOrCache('units', 'units_version', () => api.fetchCollection('units')),
                    fetchOrCache('owners', 'owners_version', () => api.fetchCollection('owners')),
                    fetchOrCache('vehicles', 'vehicles_version', () => api.fetchCollection('vehicles')),
                    fetchOrCache('tariffs', 'tariffs_version', () => api.fetchTariffsData()),
                ]);

                const p1 = currentPeriod;
                const p2 = getPreviousPeriod(p1);
                const p3 = getPreviousPeriod(p2);
                const periodsToFetch = [p1, p2, p3];

                const cacheKey = periodsToFetch.join('_');
                let charges, water;

                // Nếu không force, ưu tiên lấy từ RAM
                if (!force && SESSION_PERIOD_CACHE.charges.has(cacheKey)) {
                    charges = SESSION_PERIOD_CACHE.charges.get(cacheKey);
                    water = SESSION_PERIOD_CACHE.water.get(cacheKey);
                } else {
                    [charges, water] = await Promise.all([
                        api.fetchActiveCharges(periodsToFetch),
                        api.fetchRecentWaterReadings(periodsToFetch)
                    ]);
                    SESSION_PERIOD_CACHE.charges.set(cacheKey, charges);
                    SESSION_PERIOD_CACHE.water.set(cacheKey, water);
                }

                const [stats, locks, recentAdjustments, misc, exps] = await Promise.all([
                    api.fetchCollection('monthly_stats'),
                    api.fetchWaterLocks(),
                    api.fetchRecentAdjustments(currentPeriod),
                    api.getMonthlyMiscRevenues(currentPeriod),
                    api.fetchCollection('operational_expenses')
                ]);

                setData({
                    units: units || [], owners: owners || [], vehicles: vehicles || [],
                    tariffs: tariffsData || { service: [], parking: [], water: [] },
                    users: fetchedUsers || [], news: fetchedNews || [],
                    invoiceSettings, monthlyStats: stats || [], lockedWaterPeriods: locks || [],
                    adjustments: recentAdjustments || [], charges: charges || [],
                    waterReadings: water || [], miscRevenues: misc || [],
                    expenses: exps || [], hasLoaded: true
                });

                await set(CACHE_PREFIX + META_KEY, serverMeta);
            }
        } catch (err) {
            console.error("Smart Sync Error:", err);
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser) refreshSystemData();
    }, [currentUser?.residentId, refreshSystemData]);

    return { ...data, loading, refreshSystemData };
};
