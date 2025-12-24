
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import { 
    Unit, Owner, Vehicle, WaterReading, NewsItem,
    TariffCollection, UserPermission, InvoiceSettings, Adjustment, ActivityLog, MonthlyStat, SystemMetadata, ChargeRaw, MiscRevenue, OperationalExpense, FeedbackItem
} from '../types';
import * as api from '../services/index'; 
import { get, set } from 'idb-keyval';

const CACHE_PREFIX = 'qhome_cache_v2_';
const META_KEY = 'qhome_meta_version';

export const useSmartSystemData = (currentUser: UserPermission | null) => {
    // Đảm bảo trạng thái ban đầu có đầy đủ các mảng rỗng
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

            // 1. Fetch Metadata
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

            const fetchedUsers = await fetchOrCache('users', 'users_version', () => api.fetchCollection('users'));
            const fetchedNews = await api.fetchNews();

            if (!isAdmin) {
                if (currentUser?.residentId) {
                    const specific = await api.fetchResidentSpecificData(currentUser.residentId);
                    const charges = await (api.fetchCollection('charges') as Promise<ChargeRaw[]>)
                        .then(all => all.filter(c => c.UnitID === currentUser.residentId).slice(-3));

                    setData({
                        units: specific.unit ? [specific.unit] : [],
                        owners: specific.owner ? [specific.owner] : [],
                        vehicles: specific.vehicles || [],
                        charges: charges || [],
                        news: fetchedNews || [],
                        users: fetchedUsers || [],
                        invoiceSettings,
                        tariffs: { service: [], parking: [], water: [] },
                        hasLoaded: true
                    });
                }
            } else {
                const [units, owners, vehicles, tariffs] = await Promise.all([
                    fetchOrCache('units', 'units_version', () => api.fetchCollection('units')),
                    fetchOrCache('owners', 'owners_version', () => api.fetchCollection('owners')),
                    fetchOrCache('vehicles', 'vehicles_version', () => api.fetchCollection('vehicles')),
                    fetchOrCache('tariffs', 'tariffs_version', () => getDoc(doc(db, 'settings', 'tariffs')).then(s => s.data())),
                ]);

                const [stats, locks, recentAdjustments] = await Promise.all([
                    api.fetchCollection('monthly_stats'),
                    api.fetchWaterLocks(),
                    api.fetchRecentAdjustments(currentPeriod)
                ]);

                const allCharges = await (api.fetchCollection('charges') as Promise<ChargeRaw[]>)
                    .then(all => all.filter(c => c.Period === currentPeriod || c.paymentStatus === 'unpaid'));

                setData({
                    units: units || [],
                    owners: owners || [],
                    vehicles: vehicles || [],
                    tariffs: tariffs || {service:[], parking:[], water:[]},
                    users: fetchedUsers || [],
                    news: fetchedNews || [],
                    invoiceSettings,
                    monthlyStats: stats || [],
                    lockedWaterPeriods: locks || [],
                    adjustments: recentAdjustments || [],
                    charges: allCharges || [],
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
