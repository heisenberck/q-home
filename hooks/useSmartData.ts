
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import { 
    Unit, Owner, Vehicle, WaterReading, NewsItem,
    TariffCollection, UserPermission, InvoiceSettings, Adjustment, MonthlyStat, SystemMetadata, ChargeRaw
} from '../types';
import * as api from '../services/index'; 
import { cacheManager } from '../services/cacheManager';

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
        quickStats: { totalUnits: 0, activeVehicles: 0 },
        hasLoaded: false
    });
    const [loading, setLoading] = useState(true);
    const isFetching = useRef(false);

    const refreshSystemData = useCallback(async (force = false) => {
        if (!currentUser) return;
        if (isFetching.current) return;
        isFetching.current = true;
        setLoading(true);
        
        try {
            const isAdmin = currentUser.Role !== 'Resident';
            const currentPeriod = new Date().toISOString().slice(0, 7);

            // 1. Fetch Invoice Settings (Small object, fetch always or cache simple)
            const invoiceSettingsSnap = await getDoc(doc(db, 'settings', 'invoice'));
            const invoiceSettings = invoiceSettingsSnap.exists() ? invoiceSettingsSnap.data() as InvoiceSettings : null;

            // 2. Load News (Always check cache first)
            const fetchedNews = await api.fetchNews();

            if (!isAdmin) {
                // RESIDENT SCOPE: Fetch only what's necessary
                if (currentUser.residentId) {
                    const specific = await api.fetchResidentSpecificData(currentUser.residentId);
                    const charges = await api.fetchChargesForResident(currentUser.residentId);

                    setData((prev: any) => ({
                        ...prev,
                        units: specific.unit ? [specific.unit] : [],
                        owners: specific.owner ? [specific.owner] : [],
                        vehicles: specific.vehicles || [],
                        charges: charges || [],
                        news: fetchedNews || [],
                        invoiceSettings,
                        hasLoaded: true
                    }));
                }
            } else {
                // ADMIN SCOPE: Use Optimized Collection Fetching with Versioning
                const serverMeta = await api.getSystemMetadata();
                
                const [units, owners, vehicles, fetchedUsers, tariffs] = await Promise.all([
                    api.fetchCollectionOptimized<Unit>('units', 'units_version'),
                    api.fetchCollectionOptimized<Owner>('owners', 'owners_version'),
                    api.fetchCollectionOptimized<Vehicle>('vehicles', 'vehicles_version'),
                    api.fetchCollectionOptimized<UserPermission>('users', 'users_version'),
                    getDoc(doc(db, 'settings', 'tariffs')).then(s => s.data() as TariffCollection),
                ]);

                // Quick aggregated counts for dashboard
                const quickStats = await api.getQuickStats();

                const [stats, locks, recentAdjustments] = await Promise.all([
                    api.fetchCollectionOptimized<MonthlyStat>('monthly_stats'),
                    api.fetchWaterLocks(),
                    api.fetchRecentAdjustments(currentPeriod)
                ]);

                // Charges: Still pull recent, but limit to unpaid/current
                const allCharges = await api.fetchCollectionOptimized<ChargeRaw>('charges');
                const filteredCharges = allCharges.filter(c => c.Period === currentPeriod || c.paymentStatus === 'unpaid');

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
                    charges: filteredCharges || [],
                    quickStats,
                    hasLoaded: true
                });

                // Persist new meta for future version checks
                await cacheManager.set('meta', serverMeta);
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
