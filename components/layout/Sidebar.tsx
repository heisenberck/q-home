
import React from 'react';
import { DashboardIcon, CalculatorIcon, UsersIcon, WaterIcon, ReceiptIcon, PencilSquareIcon, KeyIcon, ArchiveBoxIcon, ClipboardDocumentListIcon, CarIcon, SunIcon, MoonIcon } from '../ui/Icons';
import type { Role } from '../../types';
import { useAuth, useTheme } from '../../App';

// FIX: Define Page type to match App.tsx state for type safety.
type Page = 'overview' | 'billing' | 'residents' | 'vehicles' | 'water' | 'pricing' | 'users' | 'settings' | 'backup' | 'activityLog';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  role: Role;
}

const mainNavItems: { id: Page; label: string; roles: Role[]; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Tổng quan', roles: ['Admin', 'Accountant', 'Operator'], icon: <DashboardIcon /> },
    { id: 'billing', label: 'Tính phí & Gửi phiếu', roles: ['Admin', 'Accountant'], icon: <CalculatorIcon /> },
    { id: 'residents', label: 'Quản lý Cư dân', roles: ['Admin', 'Accountant', 'Operator'], icon: <UsersIcon /> },
    { id: 'vehicles', label: 'Quản lý Phương tiện', roles: ['Admin', 'Accountant', 'Operator'], icon: <CarIcon /> },
    { id: 'water', label: 'Quản lý Nước', roles: ['Admin', 'Accountant', 'Operator'], icon: <WaterIcon /> },
];

const settingsNavItems: { id: Page; label: string; roles: Role[]; icon: React.ReactNode }[] = [
    { id: 'pricing', label: 'Quản lý Đơn giá', roles: ['Admin', 'Accountant'], icon: <ReceiptIcon /> },
    { id: 'settings', label: 'Cài đặt phiếu báo', roles: ['Admin', 'Accountant'], icon: <PencilSquareIcon /> },
    { id: 'users', label: 'Quản lý Người dùng', roles: ['Admin'], icon: <KeyIcon /> },
    { id: 'backup', label: 'Backup & Restore', roles: ['Admin'], icon: <ArchiveBoxIcon /> },
    { id: 'activityLog', label: 'Activity Log', roles: ['Admin'], icon: <ClipboardDocumentListIcon /> },
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, role }) => {
  const { theme, toggleTheme } = useTheme();

  const NavLink: React.FC<{ id: Page; label: string; icon: React.ReactNode }> = ({ id, label, icon }) => {
    const isActive = activePage === id;
    return (
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); setActivePage(id); }}
        className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
          isActive
            ? 'bg-primary text-white'
            : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-dark-bg-secondary'
        }`}
      >
        <span className="mr-3">{icon}</span>
        {label}
      </a>
    );
  };

  return (
    <aside className="w-64 bg-light-bg-secondary dark:bg-dark-bg-secondary flex-shrink-0 flex flex-col border-r border-light-border dark:border-dark-border h-full">
      <div className="p-4 border-b border-light-border dark:border-dark-border">
        {/* Branding Section */}
        <div className="flex flex-col gap-4">
            {/* Logo & App Name */}
            <div className="flex items-center gap-3 px-1">
                <div className="bg-[#008b4b] text-white p-1.5 rounded-xl shadow-sm flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                </div>
                <div className="flex flex-col justify-center -space-y-1">
                    <span className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Q-Home</span>
                    <span className="text-xl font-bold text-gray-700 dark:text-gray-300 tracking-tight">Manager</span>
                </div>
            </div>

            {/* Building Name Badge */}
            <div className="w-full bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 rounded-md py-1.5 px-2 text-center shadow-sm">
                <span className="text-yellow-800 dark:text-yellow-400 text-xs font-bold uppercase tracking-wide block">
                    HUD3 Linh Đàm
                </span>
            </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {mainNavItems.filter(item => item.roles.includes(role)).map(item => (
          <NavLink key={item.id} id={item.id} label={item.label} icon={item.icon} />
        ))}

        <div className="pt-4 mt-4 border-t border-light-border dark:border-dark-border">
            <h3 className="px-4 text-xs font-semibold uppercase text-gray-500 tracking-wider">Cài đặt</h3>
            <div className="mt-2 space-y-2">
                {settingsNavItems.filter(item => item.roles.includes(role)).map(item => (
                  <NavLink key={item.id} id={item.id} label={item.label} icon={item.icon} />
                ))}
            </div>
        </div>
      </nav>

      {/* Footer Section */}
      <div className="p-4 border-t border-light-border dark:border-dark-border bg-gray-50 dark:bg-dark-bg-secondary">
        <button 
            onClick={toggleTheme} 
            className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150 text-light-text-primary dark:text-dark-text-primary bg-white dark:bg-dark-bg border border-light-border dark:border-dark-border hover:bg-gray-100 dark:hover:bg-gray-700 mb-4 shadow-sm"
        >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            <span>{theme === 'light' ? 'Chế độ Tối' : 'Chế độ Sáng'}</span>
        </button>
        
        <div className="text-center space-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-400">Q-Home Manager v2.0</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Developed by Quynh Nguyen</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
