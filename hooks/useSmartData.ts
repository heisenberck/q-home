
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import { 
    Unit, Owner, Vehicle, WaterReading, NewsItem,
    TariffCollection, UserPermission, InvoiceSettings, Adjustment, MonthlyStat, SystemMetadata, ChargeRaw,
    MiscRevenue, OperationalExpense
} from '../types';
import * as api from '../services/index'; 
import { get, set } from 'idb-keyval';
import { getPreviousPeriod } from '../utils/helpers';

const CACHE_PREFIX = 'qhome_cache_v3_';
const META_KEY = 'qhome_meta_version';

export const useSmartSystemData = (currentUser: UserPermission | null) => {
    const [data, setData] = useState<any>({
        units: [],
        owners: [],
        vehicles: [],
        waterReadings: [],
        charges: [],
        adjustments: [],
        users: [],
        news: [],
        monthlyStats: [],
        lockedWaterPeriods: [],
        invoiceSettings: null,
        tariffs: { service: [], parking: [], water: [] },
        miscRevenues: [],
        expenses: [],
        hasLoaded: false
    });
    const [loading, setLoading] = useState(true);
    const isFetching = useRef(false);

    const refreshSystemData = useCallback(async (force = false) => {
        if (isFetching.current) return;
        isFetching.current = true;
        setLoading(true);
        
        try {
            const isAdmin = currentUser && currentUser.Role !== 'Resident';
            const currentPeriod = new Date().toISOString().slice(0, 7);

            // 1. Fetch Metadata & Cache Status
            const serverMeta = await api.getSystemMetadata();
            const localMeta = (await get(CACHE_PREFIX + META_KEY)) as SystemMetadata || { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };

            // 2. Fetch Invoice Settings
            const invoiceSettingsSnap = await getDoc(doc(db, 'settings', 'invoice'));
            const invoiceSettings = invoiceSettingsSnap.exists() ? invoiceSettingsSnap.data() as InvoiceSettings : null;

            // 3. Logic Fetch Collection lớn dựa trên Version
            const fetchOrCache = async (key: string, versionKey: keyof SystemMetadata, apiCall: () => Promise<any>) => {
                const cached = await get(CACHE_PREFIX + key);
                if (force || !cached || serverMeta[versionKey] > localMeta[versionKey]) {
                    const fresh = await apiCall();
                    await set(CACHE_PREFIX + key, fresh);
                    return fresh;
                }
                return cached;
            };

            const fetchedUsers = await fetchOrCache('users', 'users_version', () => api.fetchCollection('users')) || [];
            const fetchedNews = await api.fetchNews() || [];

            if (!isAdmin) {
                // Portal dành cho Cư dân
                if (currentUser?.residentId) {
                    const specific = await api.fetchResidentSpecificData(currentUser.residentId);
                    const charges = await (api.fetchCollection('charges') as Promise<ChargeRaw[]>)
                        .then(all => (all || []).filter(c => c.UnitID === currentUser.residentId).slice(-3)) || [];

                    setData({
                        units: specific.unit ? [specific.unit] : [],
                        owners: specific.owner ? [specific.owner] : [],
                        vehicles: (specific.vehicles || []).filter((v:any) => v.isActive),
                        charges: charges,
                        news: fetchedNews,
                        users: fetchedUsers,
                        invoiceSettings,
                        tariffs: { service: [], parking: [], water: [] },
                        waterReadings: [],
                        adjustments: [],
                        monthlyStats: [],
                        lockedWaterPeriods: [],
                        miscRevenues: [],
                        expenses: [],
                        hasLoaded: true
                    });
                }
            } else {
                // Dashboard dành cho Admin/Nhân viên
                const [units, owners, vehicles, tariffsData] = await Promise.all([
                    fetchOrCache('units', 'units_version', () => api.fetchCollection('units')),
                    fetchOrCache('owners', 'owners_version', () => api.fetchCollection('owners')),
                    fetchOrCache('vehicles', 'vehicles_version', () => api.fetchCollection('vehicles')),
                    fetchOrCache('tariffs', 'tariffs_version', () => getDoc(doc(db, 'settings', 'tariffs')).then(s => {
                        const d = s.data();
                        return d ? d : { service: [], parking: [], water: [] };
                    })),
                ]);

                // Lấy danh sách kỳ cần tải số nước (Hiện tại và 2 tháng trước)
                const p1 = currentPeriod;
                const p2 = getPreviousPeriod(p1);
                const p3 = getPreviousPeriod(p2);

                const [stats, locks, recentAdjustments, misc, exps, water] = await Promise.all([
                    api.fetchCollection('monthly_stats'),
                    api.fetchWaterLocks(),
                    api.fetchRecentAdjustments(currentPeriod),
                    api.getMonthlyMiscRevenues(currentPeriod),
                    api.fetchCollection('operational_expenses'),
                    api.fetchRecentWaterReadings([p1, p2, p3]) // Tải chỉ số nước thực tế
                ]);

                const allCharges = await (api.fetchCollection('charges') as Promise<ChargeRaw[]>)
                    .then(all => (all || []).filter(c => c.Period === currentPeriod || c.paymentStatus === 'unpaid')) || [];

                setData({
                    units: units || [],
                    owners: owners || [],
                    vehicles: vehicles || [],
                    tariffs: tariffsData || { service: [], parking: [], water: [] },
                    users: fetchedUsers,
                    news: fetchedNews,
                    invoiceSettings,
                    monthlyStats: stats || [],
                    lockedWaterPeriods: locks || [],
                    adjustments: recentAdjustments || [],
                    charges: allCharges,
                    waterReadings: water || [], // Cập nhật dữ liệu nước thật
                    miscRevenues: misc || [],
                    expenses: exps || [],
                    hasLoaded: true
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
