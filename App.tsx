

import React, { useState, useEffect, useCallback, createContext, useContext, useMemo, lazy, Suspense } from 'react';
import type { Role, UserPermission, Unit, Owner, Vehicle, WaterReading, ChargeRaw, TariffService, TariffParking, TariffWater, Adjustment, InvoiceSettings, ActivityLog, VehicleTier } from './types';
import { patchKiosAreas } from './constants';
import { UnitType } from './types';

import { 
    loadAllData, updateFeeSettings, updateResidentData, saveChargesBatch, 
    updateChargeStatuses, updateChargePayments, confirmSinglePayment, 
    updatePaymentStatusBatch, wipeAllBusinessData, saveUsers, saveTariffs, saveAdjustments, saveWaterReadings, saveVehicles, importResidentsBatch
} from './services'; // Import from the new service factory

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import FooterToast, { type ToastMessage, type ToastType } from './components/ui/Toast';
import LoginModal from './components/ui/LoginModal';
import LoginPage from './components/pages/LoginPage';
import Spinner from './components/ui/Spinner';
import { processFooterHtml } from './utils/helpers';
import { WarningIcon } from './components/ui/Icons';
import { isProduction } from './utils/env';

// Lazy load page components
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


const saspLogoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const initialInvoiceSettings: InvoiceSettings = {
    logoUrl: saspLogoBase64,
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
    settings: 'Cài đặt Phiếu báo',
    backup: 'Backup & Restore Dữ liệu',
    activityLog: 'Nhật ký Hoạt động',
};

// --- START: CONTEXT AND HOOKS ---
type LogPayload = Omit<ActivityLog, 'id' | 'ts' | 'actor_email' | 'actor_role' | 'undone' | 'undo_token' | 'undo_until'>;

interface AppContextType {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    currentUser: UserPermission | null;
    role: Role | null;
    setCurrentUser: (user: UserPermission) => void;
    showToast: (message: string, type: ToastType, duration?: number) => void;
    switchUserRequest: (user: UserPermission) => void;
    logAction: (payload: LogPayload) => void;
    logout: () => void;
    updateUser: (updatedUser: UserPermission) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useTheme = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useTheme must be used within an AppProvider');
    return { theme: context.theme, toggleTheme: context.toggleTheme };
};

export const useAuth = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAuth must be used within an AppProvider');
    return { 
        user: context.currentUser as UserPermission, 
        role: context.role as Role, 
        setCurrentUser: context.setCurrentUser, 
        switchUserRequest: context.switchUserRequest,
        logout: context.logout,
        updateUser: context.updateUser
    };
};

export const useNotification = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useNotification must be used within an AppProvider');
    return { showToast: context.showToast };
};

export const useLogger = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useLogger must be used within an AppProvider');
    return { logAction: context.logAction };
};
// --- END: CONTEXT AND HOOKS ---


const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'error'>('loaded');
    const [errorMessage, setErrorMessage] = useState('');
    const [activePage, setActivePage] = useState<Page>('overview');
    const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    
    // Data State (Centralized)
    const [units, setUnits] = useState<Unit[]>([]);
    const [owners, setOwners] = useState<Owner[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [waterReadings, setWaterReadings] = useState<WaterReading[]>([]);
    const [charges, setCharges] = useState<ChargeRaw[]>([]);
    const [tariffs, setTariffs] = useState<any>({ service: [], parking: [], water: [] });
    const [users, setUsers] = useState<UserPermission[]>([]);
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(initialInvoiceSettings);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

    // --- RBAC & AUTH ---
    const [currentUser, setCurrentUser] = useState<UserPermission | null>(null);
    const [usersLoaded, setUsersLoaded] = useState(false); // For pre-loading users
    const IS_PROD = isProduction();

    const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const newToast: ToastMessage = { id: Date.now() + Math.random(), message, type, duration };
        setToasts(prevToasts => [...prevToasts, newToast]);
    }, []);

    const handleCloseToast = useCallback(() => {
        setToasts(prevToasts => prevToasts.slice(1));
    }, []);

    // --- DATA FETCHING ---

    // Pre-load users to enable login screen validation
    useEffect(() => {
        const fetchInitialUsers = async () => {
            try {
                const data = await loadAllData();
                setUsers(data.users || []);
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

    // Main data fetching after user logs in
    useEffect(() => {
        if (!currentUser) return;

        const fetchData = async () => {
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
                    showToast("Using Mock Data.", 'warn');
                }

                setLoadingState('loaded');
            } catch (error: any) {
                console.error("Failed to load data:", error);
                setErrorMessage("Không thể tải dữ liệu. Vui lòng kiểm tra kết nối và thử lại.");
                setLoadingState('error');
            }
        };

        fetchData();
    }, [currentUser, showToast, IS_PROD]);


    useEffect(() => {
        // Validate current user on startup against user list
        if (currentUser && users.length > 0) {
            const validUser = users.find(u => u.Email === currentUser.Email);
            if (!validUser || validUser.status !== 'Active') {
                handleLogout();
            }
        }
    }, [currentUser, users]);
    
    const role: Role | null = currentUser?.Role || null;
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [userToSwitchTo, setUserToSwitchTo] = useState<UserPermission | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const MASTER_PASSWORD = '123456a@A';

    const handleSwitchUserRequest = (user: UserPermission) => {
        setUserToSwitchTo(user);
        setLoginError(null);
        setIsLoginModalOpen(true);
    };

    const handleLoginAttempt = (password: string) => {
        const validUser = users.find(u => u.Email === userToSwitchTo?.Email);
        if (!validUser) { setLoginError('Người dùng không tồn tại.'); return; }
        if (validUser.status !== 'Active') { setLoginError('Tài khoản này đã bị vô hiệu hóa.'); return; }

        const isMasterOverride = validUser.Role === 'Admin' && password === MASTER_PASSWORD;
        if (validUser.password === password || isMasterOverride) {
            setCurrentUser(validUser);
            setIsLoginModalOpen(false);
            setUserToSwitchTo(null);
            setLoginError(null);
            showToast(`Đã chuyển sang người dùng ${validUser.Email}`, 'success');
        } else {
            setLoginError('Mật khẩu không đúng. Vui lòng thử lại.');
        }
    };

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
        showToast('Đã đăng xuất.', 'info');
    }, [showToast]);

    const handleUpdateUser = useCallback((updatedUser: UserPermission) => {
        setUsers(prev => prev.map(u => (currentUser && u.Email === currentUser.Email) ? updatedUser : u));
        if (currentUser && (currentUser.Email === updatedUser.Email)) {
             setCurrentUser(updatedUser);
        }
    }, [currentUser]);


    // --- THEME EFFECT ---
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'light' ? 'dark' : 'light');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);
    
    const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

    // --- ACTIVITY LOGGING ---
    const logAction = useCallback((payload: LogPayload) => {
        if (!currentUser) return;
        const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newLog: ActivityLog = { id: logId, ts: new Date().toISOString(), actor_email: currentUser.Email, actor_role: currentUser.Role, undone: false, undo_token: null, undo_until: null, ...payload };
        
        setActivityLogs(prev => [newLog, ...prev].slice(0, 100));
        // Note: In a real app, this would also call a service to save the log
    }, [currentUser]);

    const handleUndoAction = useCallback((logId: string) => {
        showToast('Chức năng hoàn tác chưa được hỗ trợ.', 'warn');
    }, [showToast]);

    // --- DATA HANDLERS (Simplified with Service Factory) ---
    const createDataHandler = <T, S extends (...args: any[]) => Promise<any>>(
        stateSetter: React.Dispatch<React.SetStateAction<T>>,
        saveFunction: S
    ) => useCallback(async (updater: React.SetStateAction<T>, logPayload?: LogPayload) => {
        const newState = typeof updater === 'function' ? (updater as (prevState: T) => T)(await Promise.resolve(stateSetter(s => s))) : updater;
        try {
            await saveFunction(newState);
            stateSetter(newState);
            if (logPayload) logAction(logPayload);
            showToast('Dữ liệu đã được lưu.', 'success');
        } catch (error) {
            console.error("Save failed:", error);
            showToast('Lưu dữ liệu thất bại.', 'error');
            throw error; // Re-throw to allow UI to handle it
        }
    }, [logAction, showToast]);

    const handleSetCharges = createDataHandler(setCharges, saveChargesBatch as any);
    const handleSetAdjustments = createDataHandler(setAdjustments, saveAdjustments);
    const handleSetTariffs = createDataHandler(setTariffs, saveTariffs);
    const handleSetWaterReadings = createDataHandler(setWaterReadings, saveWaterReadings);
    const handleSetUsers = createDataHandler(setUsers, saveUsers);
    const handleSetVehicles = createDataHandler(setVehicles, saveVehicles);
    
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
        // This is a mock-only/temporary operation, so no service call needed.
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
            await wipeAllBusinessData(() => {}); // Perform wipe in the service
            // Now, batch-write the new data
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

            // Set state after successful save
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

    // --- PAGE RENDERING ---
    const renderPage = () => {
        switch (activePage) {
            case 'overview': return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges} />;
            case 'billing': return <BillingPage charges={charges} setCharges={handleSetCharges as any} allData={{ units, owners, vehicles, waterReadings, tariffs, adjustments }} onUpdateAdjustments={handleSetAdjustments as any} role={role!} invoiceSettings={invoiceSettings} />;
            case 'residents': return <ResidentsPage units={units} owners={owners} vehicles={vehicles} onSaveResident={handleSaveResident} onImportData={handleImportData} onDeleteResidents={handleResetResidents} role={role!} currentUser={currentUser!} />;
            case 'vehicles': return <VehiclesPage vehicles={vehicles} units={units} owners={owners} onSetVehicles={handleSetVehicles as any} role={role!} />;
            case 'water': return <WaterPage waterReadings={waterReadings} setWaterReadings={handleSetWaterReadings as any} allUnits={units} role={role!} />;
            case 'pricing': return <PricingPage tariffs={tariffs} setTariffs={handleSetTariffs as any} role={role!} />;
            case 'users': return <UsersPage users={users} setUsers={handleSetUsers as any} role={role!} />;
            case 'settings': return <SettingsPage invoiceSettings={invoiceSettings} setInvoiceSettings={handleSetInvoiceSettings} role={role!} />;
            case 'backup': return <BackupRestorePage allData={{ units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, invoiceSettings }} onRestore={handleRestoreAllData} role={role!} />;
            case 'activityLog': return <ActivityLogPage logs={activityLogs} onUndo={handleUndoAction} role={role!} />;
            default: return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges}/>;
        }
    };

    const contextValue = useMemo<AppContextType>(() => ({ theme, toggleTheme, currentUser, role, setCurrentUser, showToast, switchUserRequest: handleSwitchUserRequest, logAction, logout: handleLogout, updateUser: handleUpdateUser }), [theme, currentUser, role, showToast, logAction, handleLogout, handleUpdateUser]);
    const processedFooter = useMemo(() => processFooterHtml(invoiceSettings.footerHtml), [invoiceSettings.footerHtml]);
    const footerStyle = useMemo<React.CSSProperties>(() => ({ display: toasts.length > 0 ? 'none' : 'flex', justifyContent: {left: 'flex-start', center: 'center', right: 'flex-end'}[invoiceSettings.footerAlign || 'center'], fontSize: {sm: '0.75rem', md: '0.875rem', lg: '1rem'}[invoiceSettings.footerFontSize || 'sm'] }), [toasts.length, invoiceSettings.footerAlign, invoiceSettings.footerFontSize]);
    
    if (!usersLoaded || (currentUser && loadingState === 'loading')) {
        return <div className="flex h-screen w-screen items-center justify-center bg-light-bg dark:bg-dark-bg"><Spinner /></div>;
    }

    if (loadingState === 'error') {
        return (
            <div className="flex h-screen w-screen flex-col items-center justify-center bg-red-50 p-8 text-center text-red-800 dark:bg-red-900/20 dark:text-red-300">
                <WarningIcon className="h-12 w-12 text-red-500" />
                <h1 className="mt-4 text-2xl font-bold">Mất kết nối máy chủ</h1>
                <p className="mt-2 max-w-md text-base">{errorMessage}</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="mt-6 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
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
            <div className={`flex h-screen bg-light-bg dark:bg-dark-bg text-light-text-primary dark:text-dark-text-primary transition-colors duration-300`}>
                <Sidebar activePage={activePage} setActivePage={setActivePage} role={role!}/>
                <div className="flex flex-col flex-1 w-full overflow-hidden">
                    <Header pageTitle={pageTitles[activePage]} theme={theme} toggleTheme={toggleTheme} currentUser={currentUser} allUsers={users} onSwitchUserRequest={handleSwitchUserRequest} />
                    <main className="flex-1 flex flex-col pt-3 px-4 sm:px-6 lg:px-8 overflow-y-auto bg-light-bg dark:bg-dark-bg">
                        <Suspense fallback={<div className="flex-grow flex items-center justify-center"><Spinner /></div>}>
                            {renderPage()}
                        </Suspense>
                    </main>
                    <footer id="appFooter" className="footer-default" style={footerStyle}><div dangerouslySetInnerHTML={{ __html: processedFooter }} /></footer>
                    <FooterToast toast={toasts[0] || null} onClose={handleCloseToast} />
                </div>
            </div>
            {!IS_PROD && (
              <div className="fixed bottom-2 left-2 z-50 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded shadow-sm opacity-70 hover:opacity-100 pointer-events-none">
                DEV
              </div>
            )}
            <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLogin={handleLoginAttempt} userToSwitchTo={userToSwitchTo} error={loginError} />
        </AppContext.Provider>
    );
};

export default App;