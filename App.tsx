
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { 
    UserPermission, Unit, Owner, Vehicle, WaterReading, 
    TariffCollection, InvoiceSettings, Adjustment, ChargeRaw, 
    MonthlyStat, ActivityLog, NewsItem, FeedbackItem, Role 
} from './types';
import { useSmartSystemData } from './hooks/useSmartData';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import LoginPage from './components/pages/LoginPage';
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
import ValueAddedServicesPage from './components/pages/ValueAddedServicesPage';
import ResidentLayout, { PortalPage } from './components/layout/ResidentLayout';
import AdminMobileLayout, { AdminPortalPage } from './components/layout/AdminMobileLayout';
import PortalHomePage from './components/pages/portal/PortalHomePage';
import PortalNewsPage from './components/pages/portal/PortalNewsPage';
import PortalBillingPage from './components/pages/portal/PortalBillingPage';
import PortalContactPage from './components/pages/portal/PortalContactPage';
import PortalProfilePage from './components/pages/portal/PortalProfilePage';
import AdminPortalHomePage from './components/pages/admin-portal/AdminPortalHomePage';
import AdminPortalResidentsPage from './components/pages/admin-portal/AdminPortalResidentsPage';
import AdminPortalVehiclesPage from './components/pages/admin-portal/AdminPortalVehiclesPage';
import AdminPortalBillingPage from './components/pages/admin-portal/AdminPortalBillingPage';
import Toast, { ToastMessage, ToastType } from './components/ui/Toast';
import { deleteUsers, updateResidentData, importResidentsBatch, updateFeeSettings, fetchLatestLogs } from './services';
import ChangePasswordModal from './components/pages/ChangePasswordModal';
import NotificationListener from './components/common/NotificationListener';

// --- Types ---
export type AdminPage = 'overview' | 'billing' | 'residents' | 'vehicles' | 'water' | 'pricing' | 'users' | 'settings' | 'backup' | 'activityLog' | 'newsManagement' | 'feedbackManagement' | 'vas';

// Ánh xạ tiêu đề Tiếng Việt chuẩn theo yêu cầu
const ADMIN_PAGE_TITLES: Record<AdminPage, string> = {
    overview: 'Tổng quan hệ thống',
    billing: 'Bảng tính phí dịch vụ',
    residents: 'Quản lý Cư dân & Căn hộ',
    vehicles: 'Quản lý Phương tiện',
    water: 'Quản lý Chỉ số Nước',
    pricing: 'Cấu hình Đơn giá',
    users: 'Quản lý Người dùng',
    settings: 'Cài đặt Hệ thống',
    backup: 'Sao lưu & Phục hồi',
    activityLog: 'Nhật ký Hoạt động',
    newsManagement: 'Quản lý Tin tức',
    feedbackManagement: 'Phản hồi Cư dân',
    vas: 'Dịch vụ Gia tăng (VAS)'
};

export interface LogPayload {
    module: 'Billing' | 'Residents' | 'Water' | 'Pricing' | 'Settings' | 'System' | 'Vehicles' | 'News' | 'Feedback' | 'Finance';
    action: string;
    summary: string;
    count?: number;
    ids?: string[];
    before_snapshot: any;
}

// --- Contexts ---
interface AuthContextType {
    user: UserPermission | null;
    login: (user: UserPermission, rememberMe: boolean) => void;
    logout: () => void;
    updateUser: (updatedUser: UserPermission, oldEmail: string) => void;
    handleDeleteUsers: (usernames: string[]) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface NotificationContextType {
    showToast: (message: string, type: ToastType, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface SettingsContextType {
    invoiceSettings: InvoiceSettings;
    setInvoiceSettings: (settings: InvoiceSettings) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface DataRefreshContextType {
    refreshData: (force?: boolean) => void;
}

const DataRefreshContext = createContext<DataRefreshContextType | undefined>(undefined);

// --- Hooks ---
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotification must be used within a NotificationProvider');
    return context;
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within a SettingsProvider');
    return context;
};

export const useDataRefresh = () => {
    const context = useContext(DataRefreshContext);
    if (!context) throw new Error('useDataRefresh must be used within a DataRefreshProvider');
    return context;
};

// Default Settings to prevent crashes before data loads
const DEFAULT_SETTINGS: InvoiceSettings = {
    logoUrl: '',
    accountName: '',
    accountNumber: '',
    bankName: '',
    senderEmail: '',
    buildingName: 'Q-Home Manager'
};

// --- App Component ---
const App: React.FC = () => {
    const [user, setUser] = useState<UserPermission | null>(null);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [activePage, setActivePage] = useState<AdminPage | PortalPage | AdminPortalPage>('overview');
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const rememberedUserStr = localStorage.getItem('rememberedUserObject');
        if (rememberedUserStr) {
            try {
                const parsed = JSON.parse(rememberedUserStr);
                setUser(parsed);
                if (parsed.Role === 'Resident') {
                    setActivePage('portalHome');
                } else if (window.innerWidth < 768) {
                    setActivePage('adminPortalHome');
                } else {
                    setActivePage('overview');
                }
            } catch (e) {
                localStorage.removeItem('rememberedUserObject');
            }
        }
    }, []);

    const { 
        units, owners, vehicles, waterReadings, charges, adjustments, users: fetchedUsers, 
        invoiceSettings, tariffs, monthlyStats, lockedWaterPeriods,
        refreshSystemData 
    } = useSmartSystemData(user);

    const [localUnits, setLocalUnits] = useState<Unit[]>([]);
    const [localOwners, setLocalOwners] = useState<Owner[]>([]);
    const [localVehicles, setLocalVehicles] = useState<Vehicle[]>([]);
    const [localWaterReadings, setLocalWaterReadings] = useState<WaterReading[]>([]);
    const [localCharges, setLocalCharges] = useState<ChargeRaw[]>([]);
    const [localAdjustments, setLocalAdjustments] = useState<Adjustment[]>([]);
    const [localUsers, setLocalUsers] = useState<UserPermission[]>([]);
    const [localTariffs, setLocalTariffs] = useState<TariffCollection>({ service: [], parking: [], water: [] });
    const [localFeedback, setLocalFeedback] = useState<FeedbackItem[]>([]);
    const [localNews, setLocalNews] = useState<NewsItem[]>([]);

    useEffect(() => {
        setLocalUnits(units);
        setLocalOwners(owners);
        setLocalVehicles(vehicles);
        setLocalWaterReadings(waterReadings);
        setLocalCharges(charges);
        setLocalAdjustments(adjustments);
        setLocalUsers(fetchedUsers);
        setLocalTariffs(tariffs);
    }, [units, owners, vehicles, waterReadings, charges, adjustments, fetchedUsers, tariffs]);

    // Tải log thủ công khi cần để tiết kiệm Quota
    const refreshLogs = useCallback(async () => {
        if (!user || user.Role === 'Resident') return;
        const latest = await fetchLatestLogs(50);
        setActivityLogs(latest);
    }, [user]);

    useEffect(() => {
        if (activePage === 'overview' || activePage === 'activityLog') {
            refreshLogs();
        }
    }, [activePage, refreshLogs]);

    const showToast = useCallback((message: string, type: ToastType, duration: number = 3000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleLogin = (loggedInUser: UserPermission, rememberMe: boolean) => {
        setUser(loggedInUser);
        if (rememberMe) {
            localStorage.setItem('rememberedUserObject', JSON.stringify(loggedInUser));
        } else {
            localStorage.removeItem('rememberedUserObject');
        }
        
        if (loggedInUser.Role === 'Resident') {
            setActivePage('portalHome');
        } else if (window.innerWidth < 768) {
            setActivePage('adminPortalHome');
        } else {
            setActivePage('overview');
        }

        if (loggedInUser.mustChangePassword) {
            setIsChangePasswordModalOpen(true);
        }
    };

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('rememberedUserObject');
        setActivePage('overview');
    };

    const handleUpdateUser = (updatedUser: UserPermission, oldEmail: string) => {
        setLocalUsers(prev => prev.map(u => u.Email === oldEmail ? updatedUser : u));
        if (user?.Email === oldEmail) {
            setUser(updatedUser);
        }
    };

    const handleDeleteUsersAction = (usernames: string[]) => {
        const usernamesSet = new Set(usernames);
        const emailsToDelete = localUsers.filter(u => usernamesSet.has(u.Username || '')).map(u => u.Email);
        setLocalUsers(prev => prev.filter(u => !usernamesSet.has(u.Username || '')));
        deleteUsers(emailsToDelete);
    };

    const handleSetInvoiceSettings = async (settings: InvoiceSettings) => {
        await updateFeeSettings(settings);
        refreshSystemData(true);
    };

    const handleSaveResident = async (data: { unit: Unit, owner: Owner, vehicles: Vehicle[] }, reason: string) => {
        if (!user) return;
        // Bổ sung reason và actor để log được ghi đầy đủ
        await updateResidentData(localUnits, localOwners, localVehicles, data, { email: user.Email, role: user.Role }, reason);
        refreshSystemData(true);
        refreshLogs(); // Chủ động tải lại nhật ký để UI hiển thị dòng mới ngay lập tức
    };

    const handleImportResidents = (updates: any[]) => {
        importResidentsBatch(localUnits, localOwners, localVehicles, updates).then(() => {
            refreshSystemData(true);
            refreshLogs();
        });
    };

    const handleMarkNewsAsRead = useCallback(() => {
        showToast('Đã đánh dấu tin tức là đã đọc', 'info');
    }, [showToast]);

    const handleMarkBellAsRead = useCallback(() => {
        showToast('Đã xem tất cả thông báo', 'info');
    }, [showToast]);

    const notifications = useMemo(() => {
        return { 
            unreadNews: localNews.filter(n => !n.isArchived).length,
            hasUnpaidBill: localCharges.some(c => c.UnitID === user?.residentId && !['paid', 'paid_tm', 'paid_ck'].includes(c.paymentStatus)),
            hasNewNotifications: false 
        };
    }, [localNews, localCharges, user]);

    const renderAdminPage = () => {
        switch (activePage as AdminPage) {
            case 'overview': return <OverviewPage allUnits={localUnits} allOwners={localOwners} allVehicles={localVehicles} allWaterReadings={localWaterReadings} charges={localCharges} activityLogs={activityLogs} feedback={localFeedback} onNavigate={(p) => setActivePage(p as AdminPage)} monthlyStats={monthlyStats} />;
            case 'billing': return <BillingPage charges={localCharges} setCharges={setLocalCharges} allData={{ units: localUnits, owners: localOwners, vehicles: localVehicles, waterReadings: localWaterReadings, tariffs: localTariffs, adjustments: localAdjustments, activityLogs, monthlyStats, lockedWaterPeriods }} onUpdateAdjustments={setLocalAdjustments} role={user!.Role} invoiceSettings={invoiceSettings || DEFAULT_SETTINGS} onRefresh={() => refreshSystemData(true)} />;
            case 'vas': return <ValueAddedServicesPage />;
            case 'residents': return <ResidentsPage units={localUnits} owners={localOwners} vehicles={localVehicles} activityLogs={activityLogs} onSaveResident={handleSaveResident} onImportData={handleImportResidents} onDeleteResidents={()=>{}} role={user!.Role} currentUser={user!} onNavigate={(p) => setActivePage(p as AdminPage)} />;
            case 'vehicles': return <VehiclesPage vehicles={localVehicles} units={localUnits} owners={localOwners} activityLogs={activityLogs} onSetVehicles={setLocalVehicles} role={user!.Role} />;
            case 'water': return <WaterPage waterReadings={localWaterReadings} setWaterReadings={setLocalWaterReadings} allUnits={localUnits} role={user!.Role} tariffs={localTariffs} lockedPeriods={lockedWaterPeriods} refreshData={refreshSystemData} />;
            case 'pricing': return <PricingPage tariffs={localTariffs} setTariffs={setLocalTariffs} role={user!.Role} />;
            case 'users': return <UsersPage users={localUsers} setUsers={setLocalUsers} units={localUnits} role={user!.Role} />;
            case 'settings': return <SettingsPage invoiceSettings={invoiceSettings || DEFAULT_SETTINGS} setInvoiceSettings={handleSetInvoiceSettings} role={user!.Role} />;
            case 'backup': return <BackupRestorePage allData={{ units: localUnits, owners: localOwners, vehicles: localVehicles, waterReadings: localWaterReadings, charges: localCharges, adjustments: localAdjustments, users: localUsers, tariffs: localTariffs }} onRestore={(d) => refreshSystemData(true)} role={user!.Role} />;
            case 'activityLog': return <ActivityLogPage logs={activityLogs} onUndo={()=>{}} role={user!.Role} />;
            case 'newsManagement': return <NewsManagementPage news={localNews} setNews={setLocalNews} role={user!.Role} users={localUsers} />;
            case 'feedbackManagement': return <FeedbackManagementPage feedback={localFeedback} setFeedback={setLocalFeedback} role={user!.Role} />;
            default: return <OverviewPage allUnits={localUnits} allOwners={localOwners} allVehicles={localVehicles} allWaterReadings={localWaterReadings} charges={localCharges} activityLogs={activityLogs} feedback={localFeedback} onNavigate={(p) => setActivePage(p as AdminPage)} monthlyStats={monthlyStats} />;
        }
    };

    const renderResidentPage = () => {
        const owner = localOwners.find(o => o.OwnerID === localUnits.find(u => u.UnitID === user!.residentId)?.OwnerID) || null;
        switch (activePage as PortalPage) {
            case 'portalHome': return <PortalHomePage user={user!} owner={owner} charges={localCharges} news={localNews} setActivePage={setActivePage as (p: PortalPage) => void} />;
            case 'portalNews': return <PortalNewsPage news={localNews} />;
            case 'portalBilling': return <PortalBillingPage charges={localCharges} user={user!} />;
            case 'portalContact': return <PortalContactPage hotline={invoiceSettings?.HOTLINE || '0834.88.66.86'} onSubmitFeedback={(f) => setLocalFeedback([...localFeedback, f])} />;
            case 'portalProfile': return <PortalProfilePage user={user!} owner={owner!} onUpdateOwner={(o) => setLocalOwners(prev => prev.map(old => old.OwnerID === o.OwnerID ? o : old))} onChangePassword={() => setIsChangePasswordModalOpen(true)} />;
            default: return <PortalHomePage user={user!} owner={owner} charges={localCharges} news={localNews} setActivePage={setActivePage as (p: PortalPage) => void} />;
        }
    };

    const renderAdminMobilePage = () => {
        const props = { units: localUnits, vehicles: localVehicles, charges: localCharges, monthlyStats, news: localNews, owners: localOwners };
        switch (activePage as AdminPortalPage) {
            case 'adminPortalHome': return <AdminPortalHomePage {...props} onNavigate={(p) => setActivePage(p as AdminPortalPage)} />;
            case 'adminPortalBilling': return <AdminPortalBillingPage charges={localCharges} units={localUnits} owners={localOwners} />;
            case 'adminPortalResidents': return <AdminPortalResidentsPage units={localUnits} owners={localOwners} vehicles={localVehicles} />;
            case 'adminPortalVehicles': return <AdminPortalVehiclesPage vehicles={localVehicles} units={localUnits} owners={localOwners} />;
            case 'adminPortalMore': return (
                <div className="p-4 space-y-4">
                    <button onClick={() => setActivePage('newsManagement')} className="w-full p-4 bg-white rounded-xl shadow-sm border flex justify-between items-center font-bold text-gray-800">Quản lý Tin tức <span>→</span></button>
                    <button onClick={() => setActivePage('feedbackManagement')} className="w-full p-4 bg-white rounded-xl shadow-sm border flex justify-between items-center font-bold text-gray-800">Phản hồi Cư dân <span>→</span></button>
                    <button onClick={() => handleLogout()} className="w-full p-4 bg-red-50 text-red-600 rounded-xl shadow-sm border flex justify-between items-center font-black">Đăng xuất <span>⏻</span></button>
                </div>
            );
            default: return <AdminPortalHomePage {...props} onNavigate={(p) => setActivePage(p as AdminPortalPage)} />;
        }
    };

    const isResident = user?.Role === 'Resident';

    return (
        <AuthContext.Provider value={{ user, login: handleLogin, logout: handleLogout, updateUser: handleUpdateUser, handleDeleteUsers: handleDeleteUsersAction }}>
            <NotificationContext.Provider value={{ showToast }}>
                <SettingsContext.Provider value={{ invoiceSettings: invoiceSettings || DEFAULT_SETTINGS, setInvoiceSettings: handleSetInvoiceSettings }}>
                    <DataRefreshContext.Provider value={{ refreshData: refreshSystemData }}>
                        {!user ? (
                            <>
                                <LoginPage users={localUsers} onLogin={handleLogin} allOwners={localOwners} allUnits={localUnits} />
                                <Toast toasts={toasts} onClose={removeToast} onClearAll={() => setToasts([])} />
                            </>
                        ) : (
                            <>
                                <NotificationListener userId={user.Username || user.Email} />
                                {isResident ? (
                                    <ResidentLayout activePage={activePage as PortalPage} setActivePage={setActivePage as (p: PortalPage) => void} user={user} owner={localOwners.find(o => o.OwnerID === localUnits.find(u => u.UnitID === user.residentId)?.OwnerID) || null} onUpdateOwner={() => {}} onChangePassword={() => setIsChangePasswordModalOpen(true)} notifications={notifications} onMarkNewsAsRead={handleMarkNewsAsRead} onMarkBellAsRead={handleMarkBellAsRead}>
                                        {renderResidentPage()}
                                    </ResidentLayout>
                                ) : isMobile ? (
                                    <AdminMobileLayout activePage={activePage as AdminPortalPage} setActivePage={setActivePage as (p: AdminPortalPage) => void} user={user}>
                                        {renderAdminMobilePage()}
                                    </AdminMobileLayout>
                                ) : (
                                    <div className="flex h-screen bg-gray-50 overflow-hidden">
                                        <Sidebar activePage={activePage as AdminPage} setActivePage={(p) => setActivePage(p as AdminPage)} role={user.Role} />
                                        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                                            <Header pageTitle={ADMIN_PAGE_TITLES[activePage as AdminPage] || 'Hệ thống Quản lý'} onNavigate={(p) => setActivePage(p as AdminPage)} />
                                            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                                                {renderAdminPage()}
                                            </main>
                                            <Footer />
                                        </div>
                                    </div>
                                )}
                                <Toast toasts={toasts} onClose={removeToast} onClearAll={() => setToasts([])} />
                                {isChangePasswordModalOpen && <ChangePasswordModal onClose={() => setIsChangePasswordModalOpen(false)} onSave={() => setIsChangePasswordModalOpen(false)} />}
                            </>
                        )}
                    </DataRefreshContext.Provider>
                </SettingsContext.Provider>
            </NotificationContext.Provider>
        </AuthContext.Provider>
    );
};

export default App;
