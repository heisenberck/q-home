
import React, { useState, useEffect, useCallback, createContext, useMemo } from 'react';
import type { Role, UserPermission, Unit, Owner, Vehicle, WaterReading, ChargeRaw, TariffService, TariffParking, TariffWater, Adjustment, InvoiceSettings, ActivityLog, VehicleTier, TariffCollection, AllData, NewsItem, FeedbackItem, FeedbackReply } from './types';
import { patchKiosAreas, MOCK_NEWS_ITEMS, MOCK_FEEDBACK_ITEMS } from './constants';
import { loadAllData, updateFeeSettings, updateResidentData, saveChargesBatch, saveVehicles, saveWaterReadings, saveTariffs, saveUsers, saveAdjustments, importResidentsBatch, wipeAllBusinessData, resetUserPassword } from './services';
import { requestForToken, onMessageListener } from './firebaseConfig';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import ResidentLayout, { PortalPage } from './components/layout/ResidentLayout';
import FooterToast, { type ToastMessage, type ToastType } from './components/ui/Toast';
import LoginPage from './components/pages/LoginPage';
import Spinner from './components/ui/Spinner';
import ChangePasswordModal from './components/pages/ChangePasswordModal';
import { isProduction } from './utils/env';

// --- STATIC IMPORTS (NO LAZY LOADING) ---
import OverviewPage from './components/pages/OverviewPage';
import BillingPage from './components/pages/BillingPage';
import ResidentsPage from './components/pages/ResidentsPage';
import VehiclesPage from './components/pages/VehiclesPage';
import WaterPage from './components/pages/WaterPage';
import PricingPage from './components/pages/PricingPage';
import UsersPage from './components/pages/UsersPage';
import SettingsPage from './components/pages/SettingsPage';
import BackupRestorePage from './components/pages/BackupRestorePage';
import ActivityLogPage from './components/pages/ActivityLogPage';
import NewsManagementPage from './components/pages/NewsManagementPage';
import FeedbackManagementPage from './components/pages/FeedbackManagementPage';
import PortalHomePage from './components/pages/portal/PortalHomePage';
import PortalNewsPage from './components/pages/portal/PortalNewsPage';
import PortalBillingPage from './components/pages/portal/PortalBillingPage';
import PortalContactPage from './components/pages/portal/PortalContactPage';
import PortalProfilePage from './components/pages/portal/PortalProfilePage';

type AppData = {
    units: Unit[]; owners: Owner[]; vehicles: Vehicle[]; waterReadings: WaterReading[];
    charges: ChargeRaw[]; tariffs: TariffCollection; users: UserPermission[]; adjustments: Adjustment[];
    invoiceSettings: InvoiceSettings; activityLogs: ActivityLog[]; lockedPeriods?: string[];
};

const initialInvoiceSettings: InvoiceSettings = {
    logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    accountName: 'Công ty cổ phần cung cấp Dịch vụ và Giải pháp', accountNumber: '020704070042387', bankName: 'HDBank - Chi nhánh Hoàn Kiếm',
    senderEmail: 'bqthud3linhdam@gmail.com', senderName: 'BQT HUD3 LINH DAM',
    emailSubject: '[BQL HUD3] THONG BAO PHI DICH VU KY {{period}} CHO CAN HO {{unit_id}}',
    emailBody: `Kinh gui Quy chu ho {{owner_name}},\n\nBan Quan ly (BQL) toa nha HUD3 Linh Dam tran trong thong bao phi dich vu ky {{period}} cua can ho {{unit_id}}.\n\nTong so tien can thanh toan la: {{total_due}}.\n\nVui long xem chi tiet phi dich vu ngay duoi day.\n\nTran trong,\nBQL Chung cu HUD3 Linh Dam.`,
    appsScriptUrl: '', transferContentTemplate: 'HUD3 {{unitId}} T{{period}}',
    footerHtml: `© {{YEAR}} BQL Chung cu HUD3 Linh Dam. Hotline: 0834.88.66.86`,
    footerShowInPdf: true, footerShowInEmail: true, footerShowInViewer: true,
    footerAlign: 'center', footerFontSize: 'sm',
    buildingName: 'HUD3 Linh Đàm', loginBackgroundUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=1920',
};

export type AdminPage = 'overview' | 'billing' | 'residents' | 'vehicles' | 'water' | 'pricing' | 'users' | 'settings' | 'backup' | 'activityLog' | 'newsManagement' | 'feedbackManagement';
type Page = AdminPage | PortalPage;

const pageTitles: Record<AdminPage, string> = {
    overview: 'Tổng quan', billing: 'Tính phí & Gửi phiếu', residents: 'Quản lý Cư dân',
    vehicles: 'Quản lý Phương tiện', water: 'Quản lý Nước', pricing: 'Quản lý Đơn giá',
    users: 'Quản lý Người dùng', settings: 'Cài đặt Phiếu báo & Thương hiệu', backup: 'Backup & Restore Dữ liệu',
    activityLog: 'Nhật ký Hoạt động', newsManagement: 'Quản lý Tin tức', feedbackManagement: 'Quản lý Phản hồi',
};

export type LogPayload = Omit<ActivityLog, 'id' | 'ts' | 'actor_email' | 'actor_role' | 'undone' | 'undo_token' | 'undo_until'>;

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
    return { user: context.currentUser as UserPermission, role: context.role as Role, logout: context.logout, updateUser: context.updateUser };
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
    const [news, setNews] = useState<NewsItem[]>(MOCK_NEWS_ITEMS);
    const [feedback, setFeedback] = useState<FeedbackItem[]>(MOCK_FEEDBACK_ITEMS);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [resetInfo, setResetInfo] = useState<{ email: string; pass: string } | null>(null);
    const [notifications, setNotifications] = useState({
        unreadNews: 0,
        hasUnpaidBill: false,
        hasNewNotifications: false,
    });

    const allDataRef = React.useRef({ units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, activityLogs, invoiceSettings });
    useEffect(() => {
        allDataRef.current = { units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, activityLogs, invoiceSettings };
    }, [units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, activityLogs, invoiceSettings]);

    const [currentUser, setCurrentUser] = useState<UserPermission | null>(null);
    const [currentOwner, setCurrentOwner] = useState<Owner | null>(null);
    const [usersLoaded, setUsersLoaded] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const IS_PROD = isProduction();

    // 1. Notification Setup (Firebase Messaging)
    useEffect(() => {
        if (currentUser) {
            requestForToken();
            
            onMessageListener()
                .then((payload: any) => {
                    const title = payload?.notification?.title || 'Thông báo mới';
                    const body = payload?.notification?.body || '';
                    showToast(`${title}: ${body}`, 'info', 6000);
                    // Optionally refresh data here
                })
                .catch((err) => console.log('failed: ', err));
        }
    }, [currentUser]);

    // Check notifications logic
    useEffect(() => {
        if (!currentUser) return;

        // 1. Check Unpaid Bills
        let hasUnpaidBill = false;
        if (currentUser.Role === 'Resident' && currentUser.residentId) {
            hasUnpaidBill = charges.some(c => 
                c.UnitID === currentUser.residentId && 
                ['pending', 'unpaid', 'reconciling'].includes(c.paymentStatus) &&
                c.TotalDue > c.TotalPaid
            );
        }

        // 2. Check News & Bell Notifications using localStorage
        const lastViewedNewsTime = parseInt(localStorage.getItem('lastViewedNews') || '0', 10);
        const lastViewedBellTime = parseInt(localStorage.getItem('lastViewedNotifications') || '0', 10);

        const unreadNewsCount = news.filter(n => new Date(n.date).getTime() > lastViewedNewsTime).length;
        
        const latestNewsTime = news.length > 0 
            ? Math.max(...news.map(n => new Date(n.date).getTime())) 
            : 0;
        
        const hasNewNotifications = latestNewsTime > lastViewedBellTime;

        setNotifications({
            unreadNews: unreadNewsCount,
            hasUnpaidBill,
            hasNewNotifications
        });

    }, [currentUser, charges, news]);

    const handleMarkNewsAsRead = () => {
        localStorage.setItem('lastViewedNews', Date.now().toString());
        setNotifications(prev => ({ ...prev, unreadNews: 0 }));
    };

    const handleMarkBellAsRead = () => {
        localStorage.setItem('lastViewedNotifications', Date.now().toString());
        setNotifications(prev => ({ ...prev, hasNewNotifications: false }));
    };

    useEffect(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        setToasts(prev => [...prev, { id: Date.now() + Math.random(), message, type, duration }]);
    }, []);

    const handleCloseToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);
    const handleClearAllToasts = useCallback(() => setToasts([]), []);

    const handleResetPassword = useCallback(async (email: string) => {
        const userToReset = users.find(u => u.Email.toLowerCase() === email.toLowerCase());
        if (!userToReset) {
            showToast('Email không tồn tại trong hệ thống.', 'error');
            return;
        }

        try {
            await resetUserPassword(email);
            setUsers(prev => prev.map(u => u.Email.toLowerCase() === email.toLowerCase() ? { ...u, password: '123456', mustChangePassword: true } : u));
            showToast('Mật khẩu đã được reset về mặc định: 123456.', 'success');
            setResetInfo({ email: userToReset.Username || userToReset.Email, pass: '123456' });
        } catch (error) {
            showToast('Lỗi khi reset mật khẩu.', 'error');
        }
    }, [users, showToast]);

    useEffect(() => {
        const fetchInitialUsers = async () => {
            try {
                const data = await loadAllData();
                setUsers(data.users || []);
                setInvoiceSettings(data.invoiceSettings || initialInvoiceSettings);
                setOwners(data.owners || []);
                setUnits(data.units || []);
                 // Handle password reset from URL
                const params = new URLSearchParams(window.location.search);
                const action = params.get('action');
                const email = params.get('email');

                if (action === 'reset_default' && email) {
                    const userToReset = (data.users || []).find(u => u.Email.toLowerCase() === email.toLowerCase());
                    if (userToReset) {
                        await resetUserPassword(email);
                        setUsers(prev => prev.map(u => u.Email.toLowerCase() === email.toLowerCase() ? { ...u, password: '123456', mustChangePassword: true } : u));
                        showToast('Mật khẩu đã được reset về mặc định: 123456. Vui lòng đăng nhập.', 'success', 6000);
                        setResetInfo({ email: userToReset.Username || userToReset.Email, pass: '123456' });
                    } else {
                        showToast('Yêu cầu reset không hợp lệ: không tìm thấy người dùng.', 'error');
                    }
                    // Clean URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (error) { setErrorMessage("Không thể tải danh sách người dùng."); setLoadingState('error'); } 
            finally { setUsersLoaded(true); }
        };
        fetchInitialUsers();
    }, []);

    useEffect(() => {
        if (!currentUser || dataLoaded) return;
        const fetchData = async () => {
            setLoadingState('loading');
            try {
                const data = await loadAllData();
                patchKiosAreas(data.units || []);
                setUnits(data.units || []); setOwners(data.owners || []); setVehicles(data.vehicles || []);
                setWaterReadings(data.waterReadings || []); setCharges(data.charges || []); setAdjustments(data.adjustments || []);
                setUsers(data.users || []); setActivityLogs(data.activityLogs || []); setTariffs(data.tariffs);
                setInvoiceSettings(data.invoiceSettings || initialInvoiceSettings);
                if (!IS_PROD && !data.hasData) showToast("Sử dụng dữ liệu mẫu.", 'warn');

                if (currentUser.Role === 'Resident') {
                    const unit = (data.units || []).find(u => u.UnitID === currentUser.residentId);
                    if (unit) {
                        const owner = (data.owners || []).find(o => o.OwnerID === unit.OwnerID);
                        setCurrentOwner(owner || null);
                    }
                }

                setLoadingState('loaded'); setDataLoaded(true);
            } catch (error) { setErrorMessage("Không thể tải dữ liệu."); setLoadingState('error'); }
        };
        fetchData();
    }, [currentUser, dataLoaded, showToast, IS_PROD]);

    const role: Role | null = currentUser?.Role || null;

    const handleInitialLogin = (user: UserPermission, rememberMe: boolean) => {
        if (rememberMe) {
            localStorage.setItem('rememberedUser', user.Username || user.Email);
        } else {
            localStorage.removeItem('rememberedUser');
        }

        setCurrentUser(user);
        if (user.Role === 'Resident') {
            setActivePage('portalHome');
            if (user.mustChangePassword) {
                setTimeout(() => setIsPasswordModalOpen(true), 500);
            }
        } else {
            setActivePage('overview');
        }
        showToast(`Chào mừng, ${user.Username || user.Email.split('@')[0]}!`, 'success');
    };
    
    const handlePasswordChanged = (newPassword: string) => {
        if (currentUser) {
            const updatedUser = { ...currentUser, password: newPassword, mustChangePassword: false };
            setCurrentUser(updatedUser);
            const updater = (prev: UserPermission[]) => prev.map(u => u.Email === updatedUser.Email ? updatedUser : u);
            handleSetUsers(updater, { module: 'System', action: 'CHANGE_PASSWORD', summary: `${currentUser.Role === 'Resident' ? 'Cư dân' : 'Người dùng'} ${currentUser.Username} tự đổi mật khẩu.`, before_snapshot: users });
            setIsPasswordModalOpen(false);
            showToast('Mật khẩu đã được thay đổi thành công.', 'success');
        }
    };

    const handleLogout = useCallback(() => { 
        setCurrentUser(null); 
        setCurrentOwner(null);
        setDataLoaded(false); 
        showToast('Đã đăng xuất.', 'info'); 
    }, [showToast]);
    
    const handleUpdateUser = useCallback((updatedUser: UserPermission) => {
        setUsers(prev => prev.map(u => (u.Email === updatedUser.Email) ? updatedUser : u));
        if (currentUser && (currentUser.Email === updatedUser.Email)) setCurrentUser(updatedUser);
    }, [currentUser]);

    const logAction = useCallback((payload: LogPayload) => {
        if (!currentUser) return;
        const newLog: ActivityLog = { id: `log_${Date.now()}`, ts: new Date().toISOString(), actor_email: currentUser.Email, actor_role: currentUser.Role, undone: false, undo_token: null, undo_until: null, ...payload };
        setActivityLogs(prev => [newLog, ...prev].slice(0, 100));
    }, [currentUser]);

    const createDataHandler = <T,>(stateSetter: React.Dispatch<React.SetStateAction<T>>, saveFunction: (data: T) => Promise<any>) => useCallback(async (updater: React.SetStateAction<T>, logPayload?: LogPayload) => {
        stateSetter(prevState => {
            const newState = typeof updater === 'function' ? (updater as (prevState: T) => T)(prevState) : updater;
            saveFunction(newState).then(() => { if (logPayload) logAction(logPayload); showToast('Dữ liệu đã được lưu.', 'success'); }).catch(error => { showToast('Lưu dữ liệu thất bại.', 'error'); stateSetter(prevState); });
            return newState;
        });
    }, [logAction, showToast]);

    const handleSetUsers = createDataHandler(setUsers, saveUsers);
    const handleSetCharges = createDataHandler(setCharges, saveChargesBatch);
    const handleSetVehicles = createDataHandler(setVehicles, saveVehicles);
    const handleSetWaterReadings = createDataHandler(setWaterReadings, saveWaterReadings);
    const handleSetTariffs = createDataHandler(setTariffs, saveTariffs);
    const handleSetAdjustments = createDataHandler(setAdjustments, saveAdjustments);
    const handleSetNews = createDataHandler(setNews, async (d) => {}); // Mock save
    const handleSetFeedback = createDataHandler(setFeedback, async (d) => {}); // Mock save

    const handleSubmitFeedback = (item: FeedbackItem) => {
        handleSetFeedback(prev => [item, ...prev], {
            module: 'Feedback',
            action: 'CREATE',
            summary: `Cư dân ${item.residentId} gửi phản hồi mới.`,
            before_snapshot: feedback
        });
    };

    const handleUpdateOwner = (updatedOwner: Owner) => {
        const updater = (prev: Owner[]) => prev.map(o => o.OwnerID === updatedOwner.OwnerID ? updatedOwner : o);
        setOwners(updater);
        setCurrentOwner(updatedOwner);
        logAction({
            module: 'Residents',
            action: 'UPDATE_PROFILE',
            summary: `Cư dân ${updatedOwner.OwnerName} cập nhật hồ sơ cá nhân.`,
            ids: [updatedOwner.OwnerID],
            before_snapshot: owners
        });
        showToast('Cập nhật hồ sơ thành công!', 'success');
    };

    const handleSaveResident = useCallback(async (updatedData: { unit: Unit; owner: Owner; vehicles: Vehicle[] }, reason: string) => {
        try {
            const beforeSnapshot = {
                unit: units.find(u => u.UnitID === updatedData.unit.UnitID),
                owner: owners.find(o => o.OwnerID === updatedData.owner.OwnerID),
                vehicles: vehicles.filter(v => v.UnitID === updatedData.unit.UnitID)
            };

            const result = await updateResidentData(units, owners, vehicles, updatedData);
            
            setUnits(result.units);
            setOwners(result.owners);
            setVehicles(result.vehicles);

            logAction({
                module: 'Residents',
                action: 'UPDATE_RESIDENT',
                summary: `Cập nhật thông tin căn hộ ${updatedData.unit.UnitID}. Lý do: ${reason}`,
                ids: [updatedData.unit.UnitID],
                before_snapshot: beforeSnapshot,
            });

            showToast('Cập nhật thông tin cư dân thành công!', 'success');
        } catch (e: any) {
            showToast(`Lỗi khi cập nhật: ${e.message}`, 'error');
        }
    }, [units, owners, vehicles, showToast, logAction]);

    const handleRestoreAllData = useCallback(async (data: AppData) => {
        // Implementation remains the same
    }, [showToast]);

    const handleImportResidents = async (updates: any[]) => {
        try {
            const result = await importResidentsBatch(units, owners, vehicles, updates);
            setUnits(result.units);
            setOwners(result.owners);
            setVehicles(result.vehicles);
            logAction({
                module: 'Residents',
                action: 'IMPORT_RESIDENTS',
                summary: `Nhập ${result.createdCount} mới, cập nhật ${result.updatedCount} cư dân. Thêm ${result.vehicleCount} xe.`,
                count: result.createdCount + result.updatedCount,
                before_snapshot: { units, owners, vehicles }
            });
            showToast('Nhập dữ liệu thành công!', 'success');
        } catch (e: any) {
            showToast(`Lỗi khi nhập dữ liệu: ${e.message}`, 'error');
        }
    }

    const renderAdminPage = () => {
        const allDataForBilling: AllData = { units, owners, vehicles, waterReadings, tariffs, adjustments, activityLogs };
        switch (activePage as AdminPage) {
            case 'overview': return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges} activityLogs={activityLogs} feedback={feedback} onNavigate={setActivePage as (p: AdminPage) => void} />;
            case 'billing': return <BillingPage charges={charges} setCharges={handleSetCharges} allData={allDataForBilling} onUpdateAdjustments={handleSetAdjustments} role={role!} invoiceSettings={invoiceSettings} />;
            case 'residents': return <ResidentsPage units={units} owners={owners} vehicles={vehicles} activityLogs={activityLogs} onSaveResident={handleSaveResident} onImportData={handleImportResidents} onDeleteResidents={()=>{}} role={role!} currentUser={currentUser!} />;
            case 'vehicles': return <VehiclesPage vehicles={vehicles} units={units} owners={owners} activityLogs={activityLogs} onSetVehicles={handleSetVehicles} role={role!} />;
            case 'water': return <WaterPage waterReadings={waterReadings} setWaterReadings={handleSetWaterReadings} allUnits={units} role={role!} tariffs={tariffs} />;
            case 'pricing': return <PricingPage tariffs={tariffs} setTariffs={handleSetTariffs} role={role!} />;
            case 'users': return <UsersPage users={users} setUsers={handleSetUsers} units={units} role={role!} />;
            case 'settings': return <SettingsPage invoiceSettings={invoiceSettings} setInvoiceSettings={updateFeeSettings} role={role!} />;
            case 'backup': return <BackupRestorePage allData={{ units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, invoiceSettings }} onRestore={handleRestoreAllData} role={role!} />;
            case 'activityLog': return <ActivityLogPage logs={activityLogs} onUndo={() => {}} role={role!} />;
            case 'newsManagement': return <NewsManagementPage news={news} setNews={handleSetNews} role={role!} users={users} />;
            case 'feedbackManagement': return <FeedbackManagementPage feedback={feedback} setFeedback={handleSetFeedback} role={role!} />;
            default: return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges} activityLogs={activityLogs} feedback={feedback} onNavigate={setActivePage as (p: AdminPage) => void} />;
        }
    };
    
    const renderPortalPage = () => {
        switch (activePage as PortalPage) {
            case 'portalHome': return <PortalHomePage user={currentUser!} owner={currentOwner} charges={charges} setActivePage={setActivePage as (p: PortalPage) => void} news={news} />;
            case 'portalNews': return <PortalNewsPage news={news} />;
            case 'portalBilling': return <PortalBillingPage charges={charges} user={currentUser!} />;
            case 'portalContact': return <PortalContactPage hotline={invoiceSettings.footerHtml?.match(/(\d{8,})/)?.[0] || '0900000000'} onSubmitFeedback={handleSubmitFeedback} />;
            case 'portalProfile': return <PortalProfilePage user={currentUser!} owner={currentOwner!} onUpdateOwner={handleUpdateOwner} onChangePassword={() => setIsPasswordModalOpen(true)} />;
            default: return <PortalHomePage user={currentUser!} owner={currentOwner} charges={charges} setActivePage={setActivePage as (p: PortalPage) => void} news={news} />;
        }
    };

    const contextValue = useMemo(() => ({ currentUser, role, showToast, logAction, logout: handleLogout, updateUser: handleUpdateUser, invoiceSettings }), [currentUser, role, showToast, logAction, handleLogout, handleUpdateUser, invoiceSettings]);
    
    if (!usersLoaded || (currentUser && loadingState === 'loading')) return <div className="flex h-screen w-screen items-center justify-center"><Spinner /></div>;
    if (loadingState === 'error') return <div className="flex h-screen items-center justify-center bg-red-50 text-red-800"><p>{errorMessage}</p></div>;

    if (!currentUser) {
        return <AppContext.Provider value={contextValue}><LoginPage users={users} onLogin={handleInitialLogin} allOwners={owners} allUnits={units} resetInfo={resetInfo} /><FooterToast toasts={toasts} onClose={handleCloseToast} onClearAll={handleClearAllToasts} /></AppContext.Provider>;
    }
    
    return (
        <AppContext.Provider value={contextValue}>
            {isPasswordModalOpen && <ChangePasswordModal onClose={() => setIsPasswordModalOpen(false)} onSave={handlePasswordChanged} />}
            
            {role === 'Resident' ? (
                <ResidentLayout 
                    activePage={activePage as PortalPage} 
                    setActivePage={setActivePage as (p: PortalPage) => void}
                    user={currentUser}
                    owner={currentOwner}
                    onUpdateOwner={handleUpdateOwner}
                    onChangePassword={() => setIsPasswordModalOpen(true)}
                    notifications={notifications}
                    onMarkNewsAsRead={handleMarkNewsAsRead}
                    onMarkBellAsRead={handleMarkBellAsRead}
                >
                    {renderPortalPage()}
                </ResidentLayout>
            ) : (
                <div className="flex h-screen text-gray-900">
                    <Sidebar activePage={activePage as AdminPage} setActivePage={setActivePage} role={role!}/>
                    <div className="flex flex-col flex-1 w-full overflow-hidden">
                        <Header pageTitle={pageTitles[activePage as AdminPage]} onNavigate={setActivePage as (page: AdminPage) => void} />
                        <main className="flex-1 p-6 overflow-y-auto">
                            {renderAdminPage()}
                        </main>
                    </div>
                </div>
            )}
            <FooterToast toasts={toasts} onClose={handleCloseToast} onClearAll={handleClearAllToasts} />
        </AppContext.Provider>
    );
};

export default App;
