
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore'; 
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebaseConfig';
import { 
    Unit, Owner, Vehicle, WaterReading, NewsItem,
    TariffCollection, UserPermission, InvoiceSettings, Adjustment, ActivityLog, MonthlyStat, SystemMetadata, ChargeRaw, MiscRevenue, OperationalExpense, FeedbackItem
} from '../types';
import * as api from '../services/index'; 
import { get, set } from 'idb-keyval';
import { isProduction } from '../utils/env';

const CACHE_PREFIX = 'qhome_cache_v3_';
const META_KEY = 'qhome_meta_version';

export const useSmartSystemData = (currentUser: UserPermission | null) => {
    const IS_PROD = isProduction();
    
    const [data, setData] = useState<any>({
        units: [], owners: [], vehicles: [], waterReadings: [], charges: [], adjustments: [], users: [], news: [],
        monthlyStats: [], lockedWaterPeriods: [], invoiceSettings: null,
        tariffs: { service: [], parking: [], water: [] }, hasLoaded: false
    });
    
    const [loading, setLoading] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);
    const isFetching = useRef(false);

    // 1. Kiểm tra trạng thái Firebase Auth thực tế
    useEffect(() => {
        if (!IS_PROD) { setIsAuthed(true); return; }
        const unsub = onAuthStateChanged(auth, (u) => {
            // Quan trọng: Rules yêu cầu request.auth.token.email cho hầu hết các thao tác
            setIsAuthed(!!u && (!!u.email || u.isAnonymous));
        });
        return () => unsub();
    }, [IS_PROD]);

    const refreshSystemData = useCallback(async (force = false) => {
        // Chỉ fetch khi User đã đăng nhập App VÀ Firebase Auth đã sẵn sàng với danh tính cụ thể
        if (isFetching.current || !currentUser || !isAuthed) return;
        
        isFetching.current = true;
        setLoading(true);
        
        try {
            const isAdmin = currentUser.Role !== 'Resident';
            const currentPeriod = new Date().toISOString().slice(0, 7);

            // Fetch Metadata & Settings
            const serverMeta = await api.getSystemMetadata();
            const localMeta = (await get(CACHE_PREFIX + META_KEY)) as SystemMetadata || { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };

            const invoiceSettingsSnap = await getDoc(doc(db, 'settings', 'invoice'));
            const invoiceSettings = invoiceSettingsSnap.exists() ? invoiceSettingsSnap.data() as InvoiceSettings : null;

            const fetchOrCache = async (key: string, versionKey: keyof SystemMetadata, apiCall: () => Promise<any>) => {
                const cached = await get(CACHE_PREFIX + key);
                if (force || !cached || serverMeta[versionKey] > localMeta[versionKey]) {
                    const fresh = await apiCall();
                    await set(CACHE_PREFIX + key, fresh);
                    return fresh;
                }
                return cached;
            };

            const fetchedNews = await api.fetchNews();

            if (!isAdmin) {
                // Resident Path: Chỉ fetch dữ liệu của chính mình
                if (currentUser.residentId) {
                    const specific = await api.fetchResidentSpecificData(currentUser.residentId);
                    const charges = await (api.fetchCollection('charges') as Promise<ChargeRaw[]>)
                        .then(all => all.filter(c => c.UnitID === currentUser.residentId).slice(-6));

                    setData({
                        units: specific.unit ? [specific.unit] : [],
                        owners: specific.owner ? [specific.owner] : [],
                        vehicles: specific.vehicles || [],
                        charges: charges || [],
                        news: fetchedNews || [],
                        users: [], // Cư dân không có quyền fetch toàn bộ collection users
                        invoiceSettings,
                        tariffs: { service: [], parking: [], water: [] },
                        hasLoaded: true
                    });
                }
            } else {
                // Admin/Staff Path: Fetch toàn bộ (Có Cache hỗ trợ)
                const [units, owners, vehicles, tariffs, fetchedUsers] = await Promise.all([
                    fetchOrCache('units', 'units_version', () => api.fetchCollection('units')),
                    fetchOrCache('owners', 'owners_version', () => api.fetchCollection('owners')),
                    fetchOrCache('vehicles', 'vehicles_version', () => api.fetchCollection('vehicles')),
                    fetchOrCache('tariffs', 'tariffs_version', () => getDoc(doc(db, 'settings', 'tariffs')).then(s => s.data())),
                    fetchOrCache('users', 'users_version', () => api.fetchCollection('users')),
                ]);

                const [stats, locks, recentAdjustments] = await Promise.all([
                    api.fetchCollection('monthly_stats'),
                    api.fetchWaterLocks(),
                    api.fetchRecentAdjustments(currentPeriod)
                ]);

                const allCharges = await (api.fetchCollection('charges') as Promise<ChargeRaw[]>)
                    .then(all => all.filter(c => c.Period === currentPeriod || c.paymentStatus === 'unpaid' || c.paymentStatus === 'reconciling'));

                setData({
                    units: units || [], owners: owners || [], vehicles: vehicles || [],
                    tariffs: tariffs || {service:[], parking:[], water:[]},
                    users: fetchedUsers || [], news: fetchedNews || [],
                    invoiceSettings, monthlyStats: stats || [],
                    lockedWaterPeriods: locks || [], adjustments: recentAdjustments || [],
                    charges: allCharges || [], hasLoaded: true
                });

                await set(CACHE_PREFIX + META_KEY, serverMeta);
            }
        } catch (err: any) {
            console.error("Smart Sync Permission Error:", err.message);
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    }, [currentUser, isAuthed]);

    useEffect(() => {
        refreshSystemData();
    }, [currentUser?.Email, isAuthed, refreshSystemData]);

    return { ...data, loading, refreshSystemData };
};
