import React, { useState, useEffect, useCallback, createContext, lazy, Suspense } from 'react';
import type { Role, UserPermission, Unit, Owner, Vehicle, WaterReading, ChargeRaw, TariffService, TariffParking, TariffWater, Adjustment, InvoiceSettings, ActivityLog, VehicleTier, TariffCollection } from './types';
import { patchKiosAreas } from './constants';
import { UnitType } from './types';

import { loadAllData, updateFeeSettings, updateResidentData, saveChargesBatch, updatePaymentStatusBatch, wipeAllBusinessData, saveUsers, saveTariffs, saveAdjustments, saveWaterReadings, saveVehicles, importResidentsBatch } from './services';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import FooterToast, { type ToastMessage, type ToastType } from './components/ui/Toast';
import LoginPage from './components/pages/LoginPage';
import Spinner from './components/ui/Spinner';
import { processFooterHtml } from './utils/helpers';
import { isProduction } from './utils/env';

const OverviewPage = lazy(() => import('./components/pages/OverviewPage'));
const BillingPage = lazy(() => import('./components/pages/BillingPage'));
const ResidentsPage = lazy(() => import('./components/pages/ResidentsPage'));
const VehiclesPage = lazy(() => import('./components/pages/VehiclesPage'));
const WaterPage = lazy(() => import('./components/pages/WaterPage'));
const PricingPage = lazy(() => import('./components/pages/PricingPage'));
const UsersPage = lazy(() => import('./components/pages/UsersPage'));
const SettingsPage = lazy(() => import('./components/pages/SettingsPage'));
const BackupRestorePage = lazy(() => import('./components/pages/BackupRestorePage'));
const ActivityLogPage = lazy(() => import('./components/pages/ActivityLogPage'));

type AppData = {
    units: Unit[];
    owners: Owner[];
    vehicles: Vehicle[];
    waterReadings: WaterReading[];
    charges: ChargeRaw[];
    tariffs: {
        service: TariffService[];
        parking: TariffParking[];
        water: TariffWater[];
    };
    users: UserPermission[];
    adjustments: Adjustment[];
    invoiceSettings: InvoiceSettings;
    activityLogs: ActivityLog[];
    lockedPeriods?: string[];
};

const initialInvoiceSettings: InvoiceSettings = {
    logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    accountName: 'Công ty cổ phần cung cấp Dịch vụ và Giải pháp',
    accountNumber: '020704070042387',
    bankName: 'HDBank - Chi nhánh Hoàn Kiếm',
    senderEmail: 'bqthud3linhdam@gmail.com',
    senderName: 'BQT HUD3 LINH DAM',
    emailSubject: '[BQL HUD3] THONG BAO PHI DICH VU KY {{period}} CHO CAN HO {{unit_id}}',
    emailBody: `Kinh gui Quy chu ho {{owner_name}},

Ban Quan ly (BQL) toa nha HUD3 Linh Dam tran trong thong bao phi dich vu ky {{period}} cua can ho {{unit_id}}.

Tong so tien can thanh toan la: {{total_due}}.

Vui long xem chi tiet phi dich vu ngay duoi day.

Tran trong,
BQL Chung cu HUD3 Linh Dam.`,
    appsScriptUrl: '',
    footerHtml: `© {{YEAR}} BQL Chung cu HUD3 Linh Dam. Hotline: 0834.88.66.86`,
    footerShowInPdf: true,
    footerShowInEmail: true,
    footerShowInViewer: true,
    footerAlign: 'center',
    footerFontSize: 'sm',
    buildingName: 'HUD3 Linh Đàm',
    loginBackgroundUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=1920',
};

type Page = 'overview' | 'billing' | 'residents' | 'vehicles' | 'water' | 'pricing' | 'users' | 'settings' | 'backup' | 'activityLog';
const pageTitles: Record<Page, string> = {
    overview: 'Tổng quan',
    billing: 'Tính phí & Gửi phiếu',
    residents: 'Quản lý Cư dân',
    vehicles: 'Quản lý Phương tiện',
    water: 'Quản lý Nước',
    pricing: 'Quản lý Đơn giá',
    users: 'Quản lý Người dùng',
    settings: 'Cài đặt Phiếu báo & Thương hiệu',
    backup: 'Backup & Restore Dữ liệu',
    activityLog: 'Nhật ký Hoạt động',
};

type LogPayload = Omit<ActivityLog, 'id' | 'ts' | 'actor_email' | 'actor_role' | 'undone' | 'undo_token' | 'undo_until'>;

interface AppContextType {
    currentUser: UserPermission | null;
    role: Role | null;
    showToast: (message: string, type: ToastType, duration?: number) => void;
    logAction: (payload: LogPayload) => void;
    logout: () => void;
    updateUser: (updatedUser: UserPermission) => void;
    invoiceSettings: InvoiceSettings;
}

const AppContext = createContext<AppContextType | null>(null);

export const useAuth = () => {
    const context = React.useContext(AppContext);
    if (!context) throw new Error('useAuth must be used within an AppProvider');
    return { 
        user: context.currentUser as UserPermission, 
        role: context.role as Role, 
        logout: context.logout,
        updateUser: context.updateUser
    };
};

export const useNotification = () => {
    const context = React.useContext(AppContext);
    if (!context) throw new Error('useNotification must be used within an AppProvider');
    return { showToast: context.showToast };
};

export const useLogger = () => {
    const context = React.useContext(AppContext);
    if (!context) throw new Error('useLogger must be used within an AppProvider');
    return { logAction: context.logAction };
};

export const useSettings = () => {
    const context = React.useContext(AppContext);
    if (!context) throw new Error('useSettings must be used within an AppProvider');
    return { invoiceSettings: context.invoiceSettings };
};

const App: React.FC = () => {
    const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'error'>('loaded');
    const [errorMessage, setErrorMessage] = useState('');
    const [activePage, setActivePage] = useState<Page>('overview');
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    
    const [units, setUnits] = useState<Unit[]>([]);
    const [owners, setOwners] = useState<Owner[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [waterReadings, setWaterReadings] = useState<WaterReading[]>([]);
    const [charges, setCharges] = useState<ChargeRaw[]>([]);
    const [tariffs, setTariffs] = useState<TariffCollection>({ service: [], parking: [], water: [] });
    const [users, setUsers] = useState<UserPermission[]>([]);
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(initialInvoiceSettings);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

    const allDataRef = React.useRef({ units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, activityLogs });
    useEffect(() => {
        allDataRef.current = { units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, activityLogs };
    }, [units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, activityLogs]);

    const [currentUser, setCurrentUser] = useState<UserPermission | null>(null);
    const [usersLoaded, setUsersLoaded] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false); // BUG FIX: Flag to prevent re-fetching
    const IS_PROD = isProduction();

    const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const newToast: ToastMessage = { id: Date.now() + Math.random(), message, type, duration };
        setToasts(prevToasts => [...prevToasts, newToast]);
    }, []);

    const handleCloseToast = useCallback(() => {
        setToasts(prevToasts => prevToasts.slice(1));
    }, []);

    useEffect(() => {
        const fetchInitialUsers = async () => {
            try {
                const data = await loadAllData();
                setUsers(data.users || []);
                setInvoiceSettings(data.invoiceSettings || initialInvoiceSettings);
            } catch (error) {
                console.error("Failed to pre-load users for login:", error);
                setErrorMessage("Không thể tải danh sách người dùng. Vui lòng thử lại.");
                setLoadingState('error');
            } finally {
                setUsersLoaded(true);
            }
        };
        fetchInitialUsers();
    }, []);

    useEffect(() => {
        // BUG FIX: Add guard to prevent re-fetching if data is already loaded
        if (!currentUser || dataLoaded) return;

        const fetchData = async () => {
            console.log('[System] Fetching all data...'); // BUG FIX: Add logging
            setLoadingState('loading');
            try {
                const data = await loadAllData();
                const loadedUnits = data.units || [];
                patchKiosAreas(loadedUnits);
                
                setUnits(loadedUnits);
                setOwners(data.owners || []);
                setVehicles(data.vehicles || []);
                setWaterReadings(data.waterReadings || []);
                setCharges(data.charges || []);
                setAdjustments(data.adjustments || []);
                setUsers(data.users || []);
                setActivityLogs(data.activityLogs || []);
                setTariffs(data.tariffs);
                setInvoiceSettings(data.invoiceSettings || initialInvoiceSettings);
                
                if (!IS_PROD && !data.hasData) {
                    showToast("Sử dụng dữ liệu mẫu.", 'warn');
                }
                setLoadingState('loaded');
                setDataLoaded(true); // BUG FIX: Set flag after successful fetch
            } catch (error: any) {
                console.error("Failed to load data:", error);
                setErrorMessage("Không thể tải dữ liệu. Vui lòng kiểm tra kết nối và thử lại.");
                setLoadingState('error');
            }
        };
        fetchData();
    }, [currentUser, dataLoaded, showToast, IS_PROD]);

    useEffect(() => {
        if (currentUser && users.length > 0) {
            const validUser = users.find(u => u.Email === currentUser.Email);
            if (!validUser || validUser.status !== 'Active') {
                handleLogout();
            }
        }
    }, [currentUser, users]);
    
    const role: Role | null = currentUser?.Role || null;

    const handleInitialLogin = (user: UserPermission) => {
        setCurrentUser(user);
        if (!IS_PROD) {
            showToast('Đăng nhập chế độ Mock thành công', 'success');
        } else {
            showToast(`Chào mừng quay trở lại, ${user.Username || user.Email.split('@')[0]}!`, 'success');
        }
    };

    const handleLogout = useCallback(() => {
        setCurrentUser(null);
        setDataLoaded(false); // BUG FIX: Reset flag on logout
        showToast('Đã đăng xuất.', 'info');
    }, [showToast]);

    const handleUpdateUser = useCallback((updatedUser: UserPermission) => {
        setUsers(prev => prev.map(u => (currentUser && u.Email === currentUser.Email) ? updatedUser : u));
        if (currentUser && (currentUser.Email === updatedUser.Email)) {
             setCurrentUser(updatedUser);
        }
    }, [currentUser]);

    const logAction = useCallback((payload: LogPayload) => {
        if (!currentUser) return;
        const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newLog: ActivityLog = { id: logId, ts: new Date().toISOString(), actor_email: currentUser.Email, actor_role: currentUser.Role, undone: false, undo_token: null, undo_until: null, ...payload };
        
        setActivityLogs(prev => [newLog, ...prev].slice(0, 100));
    }, [currentUser]);

    const handleUndoAction = useCallback((logId: string) => {
        showToast('Chức năng hoàn tác chưa được hỗ trợ.', 'warn');
    }, [showToast]);

    const createDataHandler = <T,>(
        stateSetter: React.Dispatch<React.SetStateAction<T>>,
        saveFunction: (data: T) => Promise<any>,
        stateKey: keyof typeof allDataRef.current
    ) => useCallback(async (updater: React.SetStateAction<T>, logPayload?: LogPayload) => {
        const currentState = allDataRef.current[stateKey] as T;
        const newState = typeof updater === 'function' ? (updater as (prevState: T) => T)(currentState) : updater;
        try {
            await saveFunction(newState);
            stateSetter(newState);
            if (logPayload) logAction(logPayload);
            showToast('Dữ liệu đã được lưu.', 'success');
        } catch (error) {
            console.error("Save failed:", error);
            showToast('Lưu dữ liệu thất bại.', 'error');
            throw error;
        }
    }, [logAction, showToast, stateSetter, saveFunction, stateKey]);

    const handleSetCharges = createDataHandler(setCharges, saveChargesBatch, 'charges');
    const handleSetAdjustments = createDataHandler(setAdjustments, saveAdjustments, 'adjustments');
    const handleSetTariffs = createDataHandler(setTariffs, saveTariffs, 'tariffs');
    const handleSetWaterReadings = createDataHandler(setWaterReadings, saveWaterReadings, 'waterReadings');
    const handleSetUsers = createDataHandler(setUsers, saveUsers, 'users');
    const handleSetVehicles = createDataHandler(setVehicles, saveVehicles, 'vehicles');
    
    const handleSetInvoiceSettings = useCallback(async (newSettings: InvoiceSettings) => {
        try {
            await updateFeeSettings(newSettings);
            setInvoiceSettings(newSettings);
            logAction({
                module: 'Settings',
                action: 'UPDATE_SETTINGS',
                summary: 'Cập nhật Cài đặt Phiếu báo',
                before_snapshot: invoiceSettings,
            });
            showToast('Đã lưu cài đặt.', 'success');
        } catch (error) {
            console.error("Error saving invoice settings:", error);
            showToast('Lưu cài đặt thất bại.', 'error');
            throw error;
        }
    }, [invoiceSettings, logAction, showToast]);
    
    const handleSaveResident = useCallback(async (updatedData: { unit: Unit; owner: Owner; vehicles: Vehicle[] }) => {
        try {
            const result = await updateResidentData(units, owners, vehicles, updatedData);
            setUnits(result.units);
            setOwners(result.owners);
            setVehicles(result.vehicles);
            showToast(`Đã lưu thông tin cho căn hộ ${updatedData.unit.UnitID}.`, 'success');
            logAction({
                module: 'Residents',
                action: 'UPDATE_RESIDENT',
                summary: `Cập nhật hồ sơ căn hộ ${updatedData.unit.UnitID}`,
                ids: [updatedData.unit.UnitID],
                before_snapshot: { units, owners, vehicles }
            });
        } catch (error) {
            console.error("Failed to save resident data:", error);
            showToast('Lỗi: Không thể lưu dữ liệu.', 'error');
            throw error;
        }
    }, [vehicles, owners, units, showToast, logAction]);

    const handleImportData = useCallback(async (updates: any[]) => {
        try {
            const result = await importResidentsBatch(units, owners, vehicles, updates);
            setUnits(result.units);
            setOwners(result.owners);
            setVehicles(result.vehicles);
            showToast(`Hoàn tất! Tạo mới ${result.createdCount}, cập nhật ${result.updatedCount} hộ. Xử lý ${result.vehicleCount} xe.`, 'success');
        } catch (error) {
            console.error("Import error:", error);
            showToast("Lỗi khi nhập dữ liệu.", 'error');
        }
    }, [units, owners, vehicles, showToast]);
    
    const handleResetResidents = useCallback((unitIds: Set<string>) => {
        const ownerIdsToReset = new Set<string>();
        setUnits(prev => {
            const newUnits = prev.map(u => {
                if (unitIds.has(u.UnitID)) {
                    ownerIdsToReset.add(u.OwnerID);
                    return { ...u, Status: 'Owner' as Unit['Status'] };
                }
                return u;
            });
            setOwners(prev => prev.map(o => ownerIdsToReset.has(o.OwnerID) ? { ...o, OwnerName: '[Trống]', Phone: '', Email: '' } : o));
            setVehicles(prev => prev.filter(v => !unitIds.has(v.UnitID)));
            return newUnits;
        });
        showToast(`Đã xoá thông tin của ${unitIds.size} hồ sơ (tạm thời).`, 'success');
    }, [showToast]);

    const handleRestoreAllData = useCallback(async (data: AppData) => {
        try {
            await wipeAllBusinessData(() => {});
            const batchPromises = [
                importResidentsBatch([], [], [], data.units.map(u => {
                    const owner = data.owners.find(o => o.OwnerID === u.OwnerID);
                    return { unitId: u.UnitID, ownerName: owner?.OwnerName, phone: owner?.Phone, email: owner?.Email, status: u.Status, area: u.Area_m2, unitType: u.UnitType, vehicles: [] };
                })),
                saveVehicles(data.vehicles),
                saveWaterReadings(data.waterReadings),
                saveChargesBatch(data.charges as any),
                saveTariffs(data.tariffs),
                saveUsers(data.users),
                saveAdjustments(data.adjustments),
                updateFeeSettings(data.invoiceSettings)
            ];
            await Promise.all(batchPromises);

            if (data.units && Array.isArray(data.units)) patchKiosAreas(data.units);
            setUnits(data.units || []); 
            setOwners(data.owners || []); 
            setVehicles(data.vehicles || []);
            setWaterReadings(data.waterReadings || []); 
            setCharges(data.charges || []);
            setTariffs(data.tariffs || { service: [], parking: [], water: [] }); 
            setUsers(data.users || []);
            setAdjustments(data.adjustments || []); 
            setInvoiceSettings(data.invoiceSettings || initialInvoiceSettings);
            
            if (data.lockedPeriods) {
                localStorage.setItem('lockedBillingPeriods', JSON.stringify(data.lockedPeriods));
            }
            showToast('Dữ liệu đã được phục hồi thành công!', 'success');
        } catch (error) {
            console.error("Restore failed:", error);
            showToast('Phục hồi dữ liệu thất bại!', 'error');
        }
    }, [showToast]);

    const renderPage = () => {
        switch (activePage) {
            case 'overview': return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges} activityLogs={activityLogs} />;
            case 'billing': return <BillingPage charges={charges} setCharges={handleSetCharges} allData={{ units, owners, vehicles, waterReadings, tariffs, adjustments }} onUpdateAdjustments={handleSetAdjustments} role={role!} invoiceSettings={invoiceSettings} />;
            case 'residents': return <ResidentsPage units={units} owners={owners} vehicles={vehicles} onSaveResident={handleSaveResident} onImportData={handleImportData} onDeleteResidents={handleResetResidents} role={role!} currentUser={currentUser!} />;
            case 'vehicles': return <VehiclesPage vehicles={vehicles} units={units} owners={owners} onSetVehicles={handleSetVehicles} role={role!} />;
            case 'water': return <WaterPage waterReadings={waterReadings} setWaterReadings={handleSetWaterReadings} allUnits={units} role={role!} />;
            case 'pricing': return <PricingPage tariffs={tariffs} setTariffs={handleSetTariffs} role={role!} />;
            case 'users': return <UsersPage users={users} setUsers={handleSetUsers} role={role!} />;
            case 'settings': return <SettingsPage invoiceSettings={invoiceSettings} setInvoiceSettings={handleSetInvoiceSettings} role={role!} />;
            case 'backup': return <BackupRestorePage allData={{ units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, invoiceSettings }} onRestore={handleRestoreAllData} role={role!} />;
            case 'activityLog': return <ActivityLogPage logs={activityLogs} onUndo={handleUndoAction} role={role!} />;
            default: return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges} activityLogs={activityLogs} />;
        }
    };

    const contextValue = React.useMemo<AppContextType>(() => ({ currentUser, role, showToast, logAction, logout: handleLogout, updateUser: handleUpdateUser, invoiceSettings }), [currentUser, role, showToast, logAction, handleLogout, handleUpdateUser, invoiceSettings]);
    
    if (!usersLoaded || (currentUser && loadingState === 'loading')) {
        return <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-slate-900"><Spinner /></div>;
    }

    if (loadingState === 'error') {
        return (
            <div className="flex h-screen w-screen flex-col items-center justify-center bg-red-50 p-8 text-center text-red-800 dark:bg-red-900/20 dark:text-red-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <h1 className="mt-4 text-2xl font-bold">Mất kết nối máy chủ</h1>
                <p className="mt-2 max-w-md text-base">{errorMessage}</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="mt-6 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
                >
                  Tải lại trang
                </button>
            </div>
        );
    }

    if (!currentUser) {
        return <AppContext.Provider value={contextValue}><LoginPage users={users} onLogin={handleInitialLogin} /><FooterToast toast={toasts[0] || null} onClose={handleCloseToast} /></AppContext.Provider>;
    }

    return (
        <AppContext.Provider value={contextValue}>
            <div className={`flex h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-200`}>
                <Sidebar activePage={activePage} setActivePage={setActivePage} role={role!}/>
                <div className="flex flex-col flex-1 w-full overflow-hidden">
                    <Header pageTitle={pageTitles[activePage]} />
                    <main className="flex-1 p-6 overflow-y-auto">
                        <Suspense fallback={<div className="flex-grow flex items-center justify-center"><Spinner /></div>}>
                            {renderPage()}
                        </Suspense>
                    </main>
                    <FooterToast toast={toasts[0] || null} onClose={handleCloseToast} />
                </div>
            </div>
        </AppContext.Provider>
    );
};

export default App;