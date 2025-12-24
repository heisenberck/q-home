
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'; 
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

export const useSmartSystemData = (currentUser: UserPermission | null, authLoading: boolean = false) => {
    
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
        if (authLoading) return;
        
        // Ở màn hình Login (currentUser == null), vẫn phải cho phép fetch Users nếu ở Prod
        // Để check quyền đăng nhập.
        setLoading(true);
        setError(null);
        
        try {
            const isAdmin = currentUser && currentUser.Role !== 'Resident';
            const residentId = currentUser?.residentId;
            const currentPeriod = new Date().toISOString().slice(0, 7);

            // 1. Fetch BASIC public data (News, Users list for login, Settings)
            let fetchedUsers: UserPermission[] = [];
            try {
                const usersSnap = await getDocs(collection(db, 'users'));
                fetchedUsers = usersSnap.docs.map(d => d.data() as UserPermission);
            } catch (e) {
                console.warn("Could not fetch users (maybe Rules issue):", e);
            }

            const invoiceSettingsSnap = await getDoc(doc(db, 'settings', 'invoice'));
            const invoiceSettings = invoiceSettingsSnap.exists() ? invoiceSettingsSnap.data() as InvoiceSettings : null;
            const fetchedNews = await api.fetchNews();

            // Nếu chưa đăng nhập, chỉ trả về dữ liệu cơ bản để login
            if (!currentUser) {
                setData(prev => ({ 
                    ...prev, 
                    users: fetchedUsers, 
                    news: fetchedNews, 
                    invoiceSettings, 
                    hasLoaded: true 
                }));
                setLoading(false);
                return;
            }

            // 2. Fetch SECURE data (only when logged in)
            const serverMeta = await api.getSystemMetadata();
            const promises: Promise<any>[] = [];
            
            promises.push(api.fetchWaterLocks());
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
                promises.push(api.fetchCollection('units') as Promise<Unit[]>);
                promises.push(api.fetchCollection('owners') as Promise<Owner[]>);
                promises.push(api.fetchCollection('vehicles') as Promise<Vehicle[]>);
                promises.push(api.fetchRecentAdjustments(currentPeriod)); 
                promises.push(api.fetchRecentWaterReadings([currentPeriod]));
                promises.push(api.fetchCollection('charges') as Promise<ChargeRaw[]>);
                promises.push(api.getMonthlyMiscRevenues(currentPeriod));
                promises.push((api.fetchCollection('operational_expenses') as Promise<OperationalExpense[]>));
                promises.push(getDoc(doc(db, 'settings', 'tariffs')).then(s => s.exists() ? s.data() : null));

                const results = await Promise.all(promises);
                
                setData({
                    lockedWaterPeriods: results[0] || [],
                    monthlyStats: results[1] || [],
                    units: results[2] || [],
                    owners: results[3] || [],
                    vehicles: results[4] || [],
                    adjustments: results[5] || [],
                    waterReadings: results[6] || [],
                    charges: results[7] || [],
                    miscRevenues: results[8] || [],
                    expenses: results[9] || [],
                    tariffs: results[10] || { service: [], parking: [], water: [] },
                    users: fetchedUsers, 
                    news: fetchedNews, 
                    feedback: [],
                    invoiceSettings, 
                    activityLogs: [], 
                    hasLoaded: true
                });
            } else {
                if (residentId) {
                    const specificData = await api.fetchResidentSpecificData(residentId);
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
    }, [currentUser, authLoading]); 

    useEffect(() => { refreshSystemData(false); }, [currentUser, authLoading, refreshSystemData]);
    return { ...data, loading, error, refreshSystemData };
};
