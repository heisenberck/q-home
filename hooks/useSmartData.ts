
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, query, collection, where, getDocs, limit } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import { isProduction } from '../utils/env';
import { 
    Unit, Owner, Vehicle, WaterReading, NewsItem,
    TariffCollection, UserPermission, InvoiceSettings, Adjustment, ActivityLog, MonthlyStat, SystemMetadata, ChargeRaw
} from '../types';
import * as api from '../services/index'; 
import { get, set } from 'idb-keyval';

const CACHE_PREFIX = 'qhome_cache_v3_';
const META_KEY = 'qhome_meta_version';

export const useSmartSystemData = (currentUser: UserPermission | null) => {
    const [data, setData] = useState<{
        units: Unit[];
        owners: Owner[];
        vehicles: Vehicle[];
        tariffs: TariffCollection;
        users: UserPermission[];
        news: NewsItem[];
        invoiceSettings: InvoiceSettings | null;
        adjustments: Adjustment[];
        waterReadings: WaterReading[];
        activityLogs: ActivityLog[];
        monthlyStats: MonthlyStat[];
        lockedWaterPeriods: string[];
        charges: ChargeRaw[];
        hasLoaded: boolean;
    }>({
        units: [], owners: [], vehicles: [], tariffs: { service: [], parking: [], water: [] },
        users: [], news: [], invoiceSettings: null, adjustments: [], waterReadings: [], activityLogs: [], monthlyStats: [], lockedWaterPeriods: [],
        charges: [],
        hasLoaded: false
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshSystemData = useCallback(async (force = false) => {
        if (!currentUser && !force && data.hasLoaded) return;
        
        setLoading(true);
        try {
            const isResident = currentUser?.Role === 'Resident';
            const residentId = currentUser?.residentId;
            const IS_PROD = isProduction();

            const serverMeta = IS_PROD ? await api.getSystemMetadata() : { units_version: Date.now(), owners_version: Date.now(), vehicles_version: Date.now(), tariffs_version: Date.now(), users_version: Date.now() };
            const localMeta = (await get(CACHE_PREFIX + META_KEY)) as SystemMetadata || { units_version: 0, owners_version: 0, vehicles_version: 0, tariffs_version: 0, users_version: 0 };

            const invoiceSettings = await api.fetchCollection<InvoiceSettings>('settings').then(s => (s as any).find((i: any) => i.id === 'invoice') || null);
            const fetchedNews = await api.fetchNews();

            if (isResident && residentId) {
                const cacheKey = `${CACHE_PREFIX}res_data_${residentId}`;
                const cachedResData = await get(cacheKey);
                
                if (!force && cachedResData && serverMeta.units_version <= localMeta.units_version) {
                    setData(prev => ({ ...prev, ...cachedResData, news: fetchedNews, invoiceSettings, hasLoaded: true }));
                } else {
                    const unitSnap = await getDoc(doc(db, 'units', residentId));
                    const unit = unitSnap.exists() ? unitSnap.data() as Unit : null;
                    
                    const ownerSnap = unit ? await getDoc(doc(db, 'owners', unit.OwnerID)) : null;
                    const owner = ownerSnap?.exists() ? ownerSnap.data() as Owner : null;

                    const vq = query(collection(db, 'vehicles'), where('UnitID', '==', residentId), where('isActive', '==', true));
                    const vehicles = await getDocs(vq).then(s => s.docs.map(d => d.data() as Vehicle));

                    // FIX: Gỡ bỏ orderBy trong query để tránh lỗi Index. Cư dân chỉ có tối đa ~24 bản ghi phí, load hết rồi sort sau.
                    const cq = query(collection(db, 'charges'), where('UnitID', '==', residentId));
                    const charges = await getDocs(cq).then(s => 
                        s.docs.map(d => d.data() as ChargeRaw)
                              .sort((a, b) => b.Period.localeCompare(a.Period))
                              .slice(0, 12)
                    );

                    const resSpecificData = {
                        units: unit ? [unit] : [],
                        owners: owner ? [owner] : [],
                        vehicles,
                        charges,
                        tariffs: await get(CACHE_PREFIX + 'tariffs') || { service: [], parking: [], water: [] }
                    };

                    await set(cacheKey, resSpecificData);
                    await set(CACHE_PREFIX + META_KEY, serverMeta);
                    setData(prev => ({ ...prev, ...resSpecificData, news: fetchedNews, invoiceSettings, hasLoaded: true }));
                }
            } else {
                const fullData = await api.loadAllData();
                setData({ ...fullData, news: fetchedNews, invoiceSettings, hasLoaded: true });
                await set(CACHE_PREFIX + META_KEY, serverMeta);
            }

        } catch (err: any) {
            console.error("System Data Load Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        refreshSystemData();
    }, [refreshSystemData]);

    return { ...data, loading, error, refreshSystemData };
};
