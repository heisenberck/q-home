
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    HomeIcon, UsersIcon, UserCircleIcon, 
    ChevronLeftIcon, CarIcon, BanknotesIcon, PieChartIcon,
    UserIcon, ArrowRightOnRectangleIcon, MotorbikeIcon,
    MenuIcon
} from '../ui/Icons';
import type { UserPermission } from '../../types';
import { useAuth } from '../../App';
import NotificationBell from '../common/NotificationBell';

export type AdminPortalPage = 'adminPortalHome' | 'adminPortalResidents' | 'adminPortalVehicles' | 'adminPortalBilling' | 'adminPortalMore' | 'adminPortalVAS' | 'adminPortalExpenses';

const navItems = [
  { id: 'adminPortalHome' as AdminPortalPage, label: 'Home', icon: <HomeIcon />, perm: 'overview' },
  { id: 'adminPortalResidents' as AdminPortalPage, label: 'Cư dân', icon: <UsersIcon />, perm: 'residents' },
  { id: 'adminPortalVehicles' as AdminPortalPage, label: 'Phương tiện', icon: <MotorbikeIcon />, perm: 'vehicles' },
  { id: 'adminPortalBilling' as AdminPortalPage, label: 'Phí', icon: <BanknotesIcon />, perm: 'billing' },
  { id: 'adminPortalMore' as AdminPortalPage, label: 'Thêm', icon: <MenuIcon />, perm: 'all' }, 
];

const pageTitles: Record<AdminPortalPage, string> = {
    adminPortalHome: 'Admin Dashboard',
    adminPortalResidents: 'Danh sách Cư dân',
    adminPortalVehicles: 'Quản lý Xe',
    adminPortalBilling: 'Bảng tính phí',
    adminPortalMore: 'Menu Quản trị',
    adminPortalVAS: 'Doanh thu GTGT',
    adminPortalExpenses: 'Chi phí vận hành',
};

interface AdminMobileLayoutProps {
  children: React.ReactNode;
  activePage: AdminPortalPage;
  setActivePage: (page: AdminPortalPage) => void;
  user: UserPermission;
}

const AdminMobileLayout: React.FC<AdminMobileLayoutProps> = ({ children, activePage, setActivePage, user }) => {
  const { logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isHomePage = activePage === 'adminPortalHome';
  const isSubPage = ['adminPortalVAS', 'adminPortalExpenses'].includes(activePage);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredNavItems = useMemo(() => {
      if (user.Role === 'Admin') return navItems;

      const userPerms = new Set(user.permissions || []);
      return navItems.filter(item => {
          if (item.perm === 'all') return true;
          return userPerms.has(item.perm);
      });
  }, [user]);
    
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
        <header className={`sticky top-0 z-40 p-4 flex justify-between items-center h-16 shadow-md transition-all duration-300 ${
            isHomePage ? 'bg-primary text-white' : 'bg-white text-gray-800 border-b border-gray-100'
        }`}>
            <div className="flex items-center gap-3">
                {!isHomePage ? (
                    <button onClick={() => setActivePage('adminPortalHome')} className="p-1 -ml-1 text-gray-400 active:scale-90 transition-transform">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                ) : (
                    <div className="p-1.5 bg-white/20 rounded-lg shadow-inner">
                        <PieChartIcon className="w-5 h-5 text-white" />
                    </div>
                )}
                <h1 className="text-base font-black tracking-tight">{pageTitles[activePage]}</h1>
            </div>

            <div className="flex items-center gap-4">
                <NotificationBell />

                <div className="relative" ref={menuRef}>
                    <button 
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className={`w-9 h-9 rounded-full border-2 shadow-sm overflow-hidden flex items-center justify-center transition-all active:scale-90 ${
                            isHomePage ? 'border-white/40 bg-white/10' : 'border-gray-100 bg-gray-50'
                        }`}
                    >
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="Admin" className="w-full h-full object-cover" />
                        ) : (
                            <UserCircleIcon className={`w-7 h-7 ${isHomePage ? 'text-white/60' : 'text-gray-400'}`} />
                        )}
                    </button>

                    {isProfileOpen && (
                        <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 py-2 animate-fade-in-down ring-1 ring-black/5 text-gray-800">
                            <div className="px-4 py-2 border-b border-gray-50 mb-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{user.Role}</p>
                                <p className="text-sm font-black text-gray-800 truncate">{user.DisplayName || user.Username}</p>
                            </div>
                            <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                                <div className="p-1.5 bg-primary/10 rounded-lg"><UserIcon className="w-4 h-4 text-primary" /></div> Cài đặt cá nhân
                            </button>
                            <button 
                                onClick={logout}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors border-t border-gray-50 mt-1"
                            >
                                <div className="p-1.5 bg-red-100 rounded-lg"><ArrowRightOnRectangleIcon className="w-4 h-4" /></div> Đăng xuất
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-md mx-auto">
            {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-40 pb-safe">
        <div className={`grid max-w-md mx-auto ${filteredNavItems.length === 5 ? 'grid-cols-5' : filteredNavItems.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {filteredNavItems.map(item => {
            const isActive = activePage === item.id || (item.id === 'adminPortalMore' && isSubPage);
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`flex flex-col items-center justify-center w-full pt-3 pb-2 transition-all ${isActive ? 'text-primary' : 'text-gray-400'}`}
              >
                <div className={`transition-all duration-300 ${isActive ? 'scale-110 -translate-y-0.5' : ''}`}>
                  {React.cloneElement(item.icon, { className: 'w-6 h-6' })}
                </div>
                <span className={`text-[8px] mt-1 uppercase tracking-widest font-black ${isActive ? 'opacity-100' : 'opacity-50'}`}>{item.label}</span>
                {isActive && <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1 animate-pulse"></div>}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AdminMobileLayout;
