
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
const FETCH_THROTTLE_MS = 30000; // Không tự động fetch lại nếu chưa đủ 30 giây

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
    const lastFetchTs = useRef<number>(0);

    const refreshSystemData = useCallback(async (force = false) => {
        const now = Date.now();
        // CHẶN: Nếu đang fetch hoặc fetch quá nhanh (dưới 30s) mà không phải do nhấn nút ép buộc (force)
        if (isFetching.current) return;
        if (!force && (now - lastFetchTs.current < FETCH_THROTTLE_MS)) {
            console.log("[SmartData] Fetch throttled to save quota...");
            return;
        }

        if (!currentUser) return;
        
        isFetching.current = true;
        setLoading(true);
        lastFetchTs.current = now;
        
        try {
            const isAdmin = currentUser.Role !== 'Resident';
            const currentPeriod = new Date().toISOString().slice(0, 7);

            // Fetch News và Settings trước (nhẹ, ít tốn quota)
            const [fetchedNews, invoiceSettings] = await Promise.all([
                api.fetchNews().catch(() => []),
                api.fetchInvoiceSettings().catch(() => null)
            ]);

            if (!isAdmin) {
                // LUỒNG CƯ DÂN: Chỉ fetch 1 lần khi vào trang
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
                // LUỒNG ADMIN: Kiểm tra Metadata Version trước khi fetch bảng lớn
                const serverMeta = await api.getSystemMetadata().catch(() => ({ units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 }));
                const localMeta = (await get(CACHE_PREFIX + META_KEY)) as SystemMetadata || { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };

                const fetchOrCache = async (key: string, versionKey: keyof SystemMetadata, apiCall: () => Promise<any>) => {
                    const cached = await get(CACHE_PREFIX + key);
                    // Chỉ fetch khi Metadata trên server mới hơn Metadata local
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
            setData((prev: any) => ({ ...prev, hasLoaded: true }));
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    }, [currentUser?.Email]); // CHỈ re-fetch khi User thay đổi (Logout/Login)

    useEffect(() => {
        if (currentUser) {
            refreshSystemData();
        }
    }, [currentUser?.Email, refreshSystemData]);

    return { ...data, loading, refreshSystemData };
};
