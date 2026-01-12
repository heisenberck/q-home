
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { 
    UserPermission, Unit, Owner, Vehicle, WaterReading, 
    TariffCollection, InvoiceSettings, Adjustment, ChargeRaw, 
    MonthlyStat, ActivityLog, NewsItem, FeedbackItem, Role, ResidentNotification,
    MiscRevenue, OperationalExpense 
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
import ExpenseManagementPage from './components/pages/ExpenseManagementPage';
import ServiceRegistrationPage from './components/pages/ServiceRegistration';
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
import AdminPortalVASPage from './components/pages/admin-portal/AdminPortalVASPage';
import AdminPortalExpensesPage from './components/pages/admin-portal/AdminPortalExpensesPage';
import Toast, { ToastMessage, ToastType } from './components/ui/Toast';
import { deleteUsers, updateResidentData, importResidentsBatch, updateFeeSettings, fetchLatestLogs, updateUserProfile, saveWaterReadings, logActivity } from './services';
import ChangePasswordModal from './components/pages/ChangePasswordModal';
import NotificationListener from './components/common/NotificationListener';
import Spinner from './components/ui/Spinner';

export type AdminPage = 'overview' | 'billing' | 'residents' | 'vehicles' | 'water' | 'pricing' | 'users' | 'settings' | 'backup' | 'activityLog' | 'newsManagement' | 'feedbackManagement' | 'vas' | 'expenses' | 'serviceRegistration';

export interface LogPayload {
    module: string; action: string; summary: string; before_snapshot?: any; count?: number; ids?: string[];
}

const ADMIN_PAGE_TITLES: Record<AdminPage, string> = {
    overview: 'Tổng quan hệ thống', billing: 'Bảng tính phí dịch vụ', residents: 'Quản lý Cư dân & Căn hộ', vehicles: 'Quản lý Phương tiện', water: 'Quản lý Chỉ số Nước', pricing: 'Cấu hình Đơn giá', users: 'Quản lý Người dùng', settings: 'Cài đặt Hệ thống', backup: 'Sao lưu & Phục hồi', activityLog: 'Nhật ký Hoạt động', newsManagement: 'Quản lý Tin tức', feedbackManagement: 'Phản hồi Cư dân', vas: 'Dịch vụ Gia tăng (VAS)', expenses: 'Quản lý Chi phí Vận hành', serviceRegistration: 'Quản lý đăng ký dịch vụ'
};

interface AuthContextType {
    user: UserPermission | null;
    login: (user: UserPermission, rememberMe: boolean) => void;
    logout: () => void;
    updateUser: (updatedUser: UserPermission, oldEmail: string) => Promise<void>;
    handleDeleteUsers: (usernames: string[]) => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface NotificationContextType { showToast: (message: string, type: ToastType, duration?: number) => void; }
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface SettingsContextType { invoiceSettings: InvoiceSettings; setInvoiceSettings: (settings: InvoiceSettings) => Promise<void>; }
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface DataRefreshContextType { refreshData: (force?: boolean) => void; }
const DataRefreshContext = createContext<DataRefreshContextType | undefined>(undefined);

export const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error('useAuth error'); return context; };
export const useNotification = () => { const context = useContext(NotificationContext); if (!context) throw new Error('useNotification error'); return context; };
export const useSettings = () => { const context = useContext(SettingsContext); if (!context) throw new Error('useSettings error'); return context; };
export const useDataRefresh = () => { const context = useContext(DataRefreshContext); if (!context) throw new Error('useDataRefresh error'); return context; };

const DEFAULT_SETTINGS: InvoiceSettings = { logoUrl: '', accountName: '', accountNumber: '', bankName: '', senderEmail: '', buildingName: 'Q-Home Manager' };

const App: React.FC = () => {
    const [user, setUser] = useState<UserPermission | null>(null);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [activePage, setActivePage] = useState<AdminPage | PortalPage | AdminPortalPage>('overview');
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [unreadResidentNotifications, setUnreadResidentNotifications] = useState<ResidentNotification[]>([]);
    const [readNewsIds, setReadNewsIds] = useState<Set<string>>(new Set());

    const { 
        units = [], owners = [], vehicles = [], waterReadings = [], charges = [], adjustments = [], users: fetchedUsers = [], news = [],
        invoiceSettings, tariffs, monthlyStats = [], lockedWaterPeriods = [], miscRevenues = [], expenses = [], refreshSystemData, hasLoaded 
    } = useSmartSystemData(user);

    const [localCharges, setLocalCharges] = useState<ChargeRaw[]>([]);
    useEffect(() => { if(charges) setLocalCharges(charges); }, [charges]);

    // Local Users state to allow instant UI updates in the Users management page
    const [localUsers, setLocalUsers] = useState<UserPermission[]>([]);
    useEffect(() => { if(fetchedUsers) setLocalUsers(fetchedUsers); }, [fetchedUsers]);

    // --- FIX: Đồng bộ quyền User từ Server về Session hiện tại ---
    useEffect(() => {
        if (!user || localUsers.length === 0) return;

        const freshUser = localUsers.find(u => u.Email === user.Email);
        if (freshUser) {
            // So sánh quyền và vai trò
            const currentPerms = JSON.stringify(user.permissions || []);
            const freshPerms = JSON.stringify(freshUser.permissions || []);
            const currentRole = user.Role;
            const freshRole = freshUser.Role;

            if (currentPerms !== freshPerms || currentRole !== freshRole) {
                console.log("Syncing user permissions from server...");
                const mergedUser = { ...user, ...freshUser };
                setUser(mergedUser);
                if (localStorage.getItem('rememberedUserObject')) {
                    localStorage.setItem('rememberedUserObject', JSON.stringify(mergedUser));
                }
            }
        }
    }, [localUsers, user?.Email]); // Chỉ chạy khi localUsers thay đổi

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        const saved = localStorage.getItem('seen_news_ids_v2');
        if (saved) try { setReadNewsIds(new Set(JSON.parse(saved))); } catch {}
        const remembered = localStorage.getItem('rememberedUserObject');
        if (remembered) try {
            const parsed = JSON.parse(remembered);
            setUser(parsed);
            setActivePage(parsed.Role === 'Resident' ? 'portalHome' : (window.innerWidth < 768 ? 'adminPortalHome' : 'overview'));
        } catch { localStorage.removeItem('rememberedUserObject'); }
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const refreshLogs = useCallback(async () => {
        if (!user || user.Role === 'Resident') return;
        const latest = await fetchLatestLogs(50);
        setActivityLogs(latest);
    }, [user]);

    useEffect(() => { if (['overview', 'activityLog'].includes(activePage)) refreshLogs(); }, [activePage, refreshLogs]);

    const showToast = useCallback((message: string, type: ToastType, duration: number = 3000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const handleLogin = (loggedInUser: UserPermission, rememberMe: boolean) => {
        setUser(loggedInUser);
        if (rememberMe) localStorage.setItem('rememberedUserObject', JSON.stringify(loggedInUser));
        setActivePage(loggedInUser.Role === 'Resident' ? 'portalHome' : (window.innerWidth < 768 ? 'adminPortalHome' : 'overview'));
        if (loggedInUser.mustChangePassword) setIsChangePasswordModalOpen(true);
    };

    const handleLogout = () => { setUser(null); localStorage.removeItem('rememberedUserObject'); setActivePage('overview'); };

    const handleUpdateUser = async (updatedUser: UserPermission, oldEmail: string) => {
        await updateUserProfile(oldEmail, updatedUser);
        if (user?.Email === oldEmail) setUser(updatedUser);
        refreshSystemData(true);
    };

    const handleDeleteUsersAction = async (usernames: string[]) => {
        const usernamesSet = new Set(usernames);
        const emailsToDelete = fetchedUsers.filter((u:any) => usernamesSet.has(u.Username || '')).map((u:any) => u.Email);
        await deleteUsers(emailsToDelete);
        refreshSystemData(true);
    };

    const handleSaveResident = async (data: any, reason: string) => {
        if (!user) return;
        await updateResidentData(units, owners, vehicles, data, { email: user.Email, role: user.Role }, reason);
        refreshSystemData(true);
        refreshLogs(); 
    };

    const handleMarkNewsAsRead = useCallback((newsId: string) => {
        setReadNewsIds(prev => {
            const next = new Set(prev); next.add(newsId);
            localStorage.setItem('seen_news_ids_v2', JSON.stringify(Array.from(next)));
            return next;
        });
    }, []);

    const notifications = useMemo(() => ({ 
        unreadNews: news.filter((n:any) => !n.isArchived && !readNewsIds.has(n.id)).length,
        hasUnpaidBill: localCharges.some((c:any) => c.UnitID === user?.residentId && !['paid', 'paid_tm', 'paid_ck'].includes(c.paymentStatus)),
        unreadList: unreadResidentNotifications
    }), [news, localCharges, user, unreadResidentNotifications, readNewsIds]);

    const renderAdminPage = () => {
        const commonProps = { allUnits: units, allOwners: owners, allVehicles: vehicles, allWaterReadings: waterReadings, charges: localCharges, activityLogs, news, monthlyStats, lockedWaterPeriods, invoiceSettings: invoiceSettings || DEFAULT_SETTINGS, tariffs, role: user!.Role, refreshData: () => refreshSystemData(true) };
        switch (activePage as AdminPage) {
            case 'overview': return <OverviewPage {...commonProps} feedback={[]} onNavigate={(p) => setActivePage(p as AdminPage)} />;
            case 'billing': return <BillingPage charges={localCharges} setCharges={setLocalCharges} allData={{ units, owners, vehicles, waterReadings, tariffs, adjustments, activityLogs, monthlyStats, lockedWaterPeriods }} onUpdateAdjustments={() => {}} role={user!.Role} invoiceSettings={invoiceSettings || DEFAULT_SETTINGS} onRefresh={() => refreshSystemData(true)} />;
            case 'residents': return <ResidentsPage units={units} owners={owners} vehicles={vehicles} activityLogs={activityLogs} onSaveResident={handleSaveResident} onImportData={importResidentsBatch} onDeleteResidents={()=>{}} role={user!.Role} currentUser={user!} onNavigate={(p) => setActivePage(p as AdminPage)} />;
            case 'vehicles': return <VehiclesPage vehicles={vehicles} units={units} owners={owners} activityLogs={activityLogs} onSetVehicles={()=>{}} role={user!.Role} />;
            case 'water': return <WaterPage waterReadings={waterReadings} setWaterReadings={()=>{}} allUnits={units} role={user!.Role} tariffs={tariffs} lockedPeriods={lockedWaterPeriods} refreshData={refreshSystemData} />;
            case 'pricing': return <PricingPage tariffs={tariffs} setTariffs={()=>{}} role={user!.Role} />;
            case 'users': return <UsersPage users={localUsers} setUsers={setLocalUsers} units={units} role={user!.Role} />;
            case 'settings': return <SettingsPage invoiceSettings={invoiceSettings || DEFAULT_SETTINGS} setInvoiceSettings={(s) => updateFeeSettings(s)} role={user!.Role} />;
            case 'activityLog': return <ActivityLogPage logs={activityLogs} onUndo={()=>{}} role={user!.Role} />;
            case 'newsManagement': return <NewsManagementPage news={news} setNews={()=>{}} role={user!.Role} users={fetchedUsers} />;
            case 'feedbackManagement': return <FeedbackManagementPage role={user!.Role} units={units} owners={owners} />;
            case 'vas': return <ValueAddedServicesPage />;
            case 'expenses': return <ExpenseManagementPage />;
            case 'serviceRegistration': return <ServiceRegistrationPage role={user!.Role} />;
            default: return <OverviewPage {...commonProps} feedback={[]} onNavigate={(p) => setActivePage(p as AdminPage)} />;
        }
    };

    const renderResidentPage = () => {
        if (!hasLoaded) return <Spinner />;
        const unit = units.find((u:any) => u.UnitID === user!.residentId) || null;
        const owner = owners.find((o:any) => o.OwnerID === unit?.OwnerID) || null;
        const props = { user: user!, owner, charges: localCharges, news, setActivePage: setActivePage as any, readIds: readNewsIds, onReadNews: handleMarkNewsAsRead };
        switch (activePage as PortalPage) {
            case 'portalHome': return <PortalHomePage {...props} />;
            case 'portalNews': return <PortalNewsPage {...props} />;
            case 'portalBilling': return <PortalBillingPage charges={localCharges} user={user!} />;
            case 'portalContact': return <PortalContactPage hotline={invoiceSettings?.HOTLINE || '0834.88.66.86'} onSubmitFeedback={()=>{}} owner={owner} unit={unit} />;
            case 'portalProfile': return <PortalProfilePage user={user!} owner={owner!} onUpdateOwner={()=>{}} onChangePassword={() => setIsChangePasswordModalOpen(true)} />;
            default: return <PortalHomePage {...props} />;
        }
    };

    const renderAdminMobilePage = () => {
        const props = { units, vehicles, charges: localCharges, monthlyStats, news, owners, miscRevenues, expenses };
        const isAdmin = user!.Role === 'Admin';
        const userPerms = new Set(user!.permissions || []);

        const hasPerm = (perm: string) => isAdmin || userPerms.has(perm);

        switch (activePage as AdminPortalPage) {
            case 'adminPortalHome': return <AdminPortalHomePage {...props} onNavigate={(p) => setActivePage(p as AdminPortalPage)} />;
            case 'adminPortalBilling': return <AdminPortalBillingPage charges={localCharges} units={units} owners={owners} />;
            case 'adminPortalResidents': return <AdminPortalResidentsPage units={units} owners={owners} vehicles={vehicles} />;
            case 'adminPortalVehicles': return <AdminPortalVehiclesPage vehicles={vehicles} units={units} owners={owners} />;
            case 'adminPortalVAS': return <AdminPortalVASPage miscRevenues={miscRevenues} />;
            case 'adminPortalExpenses': return <AdminPortalExpensesPage expenses={expenses} />;
            case 'adminPortalMore': return (
                <div className="p-4 space-y-4">
                    {/* Render Buttons conditionally based on permissions */}
                    {hasPerm('newsManagement') && (
                        <button onClick={() => setActivePage('newsManagement' as any)} className="w-full p-4 bg-white rounded-xl shadow-sm border flex justify-between items-center font-bold text-gray-800">Quản lý Tin tức <span>→</span></button>
                    )}
                    {hasPerm('feedbackManagement') && (
                        <button onClick={() => setActivePage('feedbackManagement' as any)} className="w-full p-4 bg-white rounded-xl shadow-sm border flex justify-between items-center font-bold text-gray-800">Phản hồi Cư dân <span>→</span></button>
                    )}
                    
                    {/* Always allow logout */}
                    <button onClick={() => handleLogout()} className="w-full p-4 bg-red-50 text-red-600 rounded-xl shadow-sm border flex justify-between items-center font-black">Đăng xuất <span>⏻</span></button>
                </div>
            );
            default: return <AdminPortalHomePage {...props} onNavigate={(p) => setActivePage(p as AdminPortalPage)} />;
        }
    };

    return (
        <AuthContext.Provider value={{ user, login: handleLogin, logout: handleLogout, updateUser: handleUpdateUser, handleDeleteUsers: handleDeleteUsersAction }}>
            <NotificationContext.Provider value={{ showToast }}>
                <SettingsContext.Provider value={{ invoiceSettings: invoiceSettings || DEFAULT_SETTINGS, setInvoiceSettings: async (s) => { await updateFeeSettings(s); refreshSystemData(true); } }}>
                    <DataRefreshContext.Provider value={{ refreshData: refreshSystemData }}>
                        {!user ? <LoginPage users={localUsers} onLogin={handleLogin} allOwners={owners} allUnits={units} /> : (
                            <>
                                <NotificationListener userId={user.Username || user.Email} onUpdateList={setUnreadResidentNotifications} />
                                {user.Role === 'Resident' ? (
                                    <ResidentLayout activePage={activePage as PortalPage} setActivePage={setActivePage as any} user={user} owner={owners.find((o:any) => o.OwnerID === units.find((u:any) => u.UnitID === user.residentId)?.OwnerID) || null} onUpdateOwner={()=>{}} onChangePassword={() => setIsChangePasswordModalOpen(true)} notifications={notifications}>
                                        {renderResidentPage()}
                                    </ResidentLayout>
                                ) : isMobile ? (
                                    <AdminMobileLayout activePage={activePage as AdminPortalPage} setActivePage={setActivePage as any} user={user}>
                                        {renderAdminMobilePage()}
                                    </AdminMobileLayout>
                                ) : (
                                    <div className="flex h-screen bg-gray-50 overflow-hidden">
                                        <Sidebar activePage={activePage as AdminPage} setActivePage={setActivePage as any} role={user.Role} />
                                        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                                            <Header pageTitle={ADMIN_PAGE_TITLES[activePage as AdminPage] || 'Quản lý'} onNavigate={setActivePage as any} />
                                            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">{!hasLoaded ? <Spinner /> : renderAdminPage()}</main>
                                            <Footer />
                                        </div>
                                    </div>
                                )}
                                <Toast toasts={toasts} onClose={(id) => setToasts(t => t.filter(x => x.id !== id))} onClearAll={() => setToasts([])} />
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
