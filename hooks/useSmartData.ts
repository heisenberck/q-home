
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
        if (force) {
            SESSION_PERIOD_CACHE.charges.clear();
            SESSION_PERIOD_CACHE.water.clear();
            SESSION_PERIOD_CACHE.misc.clear();
            SESSION_PERIOD_CACHE.expenses.clear();
        }

        if (isFetching.current || !currentUser) return;
        
        isFetching.current = true;
        setLoading(true);
        lastFetchTs.current = Date.now();
        
        try {
            const isAdmin = currentUser.Role !== 'Resident';
            const currentPeriod = new Date().toISOString().slice(0, 7);

            // Các bảng dữ liệu công khai hoặc đọc nhẹ
            const [fetchedNews, invoiceSettings] = await Promise.all([
                api.fetchNews().catch(() => []),
                api.fetchInvoiceSettings().catch(() => null)
            ]);

            if (!isAdmin) {
                // LUỒNG CƯ DÂN: Chỉ fetch những gì cư dân được phép xem
                if (currentUser.residentId) {
                    const [specific, charges] = await Promise.all([
                        api.fetchResidentSpecificData(currentUser.residentId).catch(() => ({ unit: null, owner: null, vehicles: [] })),
                        api.fetchChargesForResident(currentUser.residentId).catch(() => [])
                    ]);

                    setData((prev: any) => ({
                        ...prev,
                        units: specific.unit ? [specific.unit] : [],
                        owners: specific.owner ? [specific.owner] : [],
                        vehicles: (specific.vehicles || []).filter((v:any) => v.isActive),
                        charges: charges,
                        news: fetchedNews || [],
                        invoiceSettings,
                        hasLoaded: true
                    }));
                } else {
                    setData((prev: any) => ({ ...prev, news: fetchedNews, invoiceSettings, hasLoaded: true }));
                }
            } else {
                // LUỒNG ADMIN: Fetch toàn bộ bảng nghiệp vụ có kiểm tra Cache
                const serverMeta = await api.getSystemMetadata().catch(() => ({ units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 }));
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

                const [units, owners, vehicles, tariffsData, fetchedUsers] = await Promise.all([
                    fetchOrCache('units', 'units_version', () => api.fetchCollection('units')),
                    fetchOrCache('owners', 'owners_version', () => api.fetchCollection('owners')),
                    fetchOrCache('vehicles', 'vehicles_version', () => api.fetchCollection('vehicles')),
                    fetchOrCache('tariffs', 'tariffs_version', () => api.fetchTariffsData()),
                    fetchOrCache('users', 'users_version', () => api.fetchCollection('users'))
                ]);

                const periodsToFetch = [currentPeriod, getPreviousPeriod(currentPeriod)];
                const [charges, water, stats, locks, misc, exps] = await Promise.all([
                    api.fetchActiveCharges(periodsToFetch).catch(() => []),
                    api.fetchRecentWaterReadings(periodsToFetch).catch(() => []),
                    api.fetchCollection('monthly_stats').catch(() => []),
                    api.fetchWaterLocks().catch(() => []),
                    api.getMonthlyMiscRevenues(currentPeriod).catch(() => []),
                    api.fetchCollection('operational_expenses').catch(() => [])
                ]);

                setData({
                    units: units || [], owners: owners || [], vehicles: vehicles || [],
                    tariffs: tariffsData || { service: [], parking: [], water: [] },
                    users: fetchedUsers || [], news: fetchedNews || [],
                    invoiceSettings, monthlyStats: stats || [], lockedWaterPeriods: locks || [],
                    charges: charges || [], waterReadings: water || [],
                    miscRevenues: misc || [], expenses: exps || [],
                    hasLoaded: true
                });

                await set(CACHE_PREFIX + META_KEY, serverMeta);
            }
        } catch (err) {
            console.error("Smart Sync Error:", err);
            // Vẫn set loaded để không bị kẹt màn hình quay quay
            setData((prev: any) => ({ ...prev, hasLoaded: true }));
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
