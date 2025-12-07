

import React from 'react';
import { PieChartIcon, CalculatorIcon, UsersIcon, WaterIcon, ReceiptIcon, PencilSquareIcon, KeyIcon, ArchiveBoxIcon, ClipboardDocumentListIcon, CarIcon } from '../ui/Icons';
import type { Role } from '../../types';
import { useSettings } from '../../App';
import { isProduction } from '../../utils/env';

type Page = 'overview' | 'billing' | 'residents' | 'vehicles' | 'water' | 'pricing' | 'users' | 'settings' | 'backup' | 'activityLog';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  role: Role;
}

const mainNavItems: { id: Page; label: string; roles: Role[]; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Tổng quan', roles: ['Admin', 'Accountant', 'Operator', 'Viewer'], icon: <PieChartIcon /> },
    { id: 'billing', label: 'Tính phí & Gửi phiếu', roles: ['Admin', 'Accountant'], icon: <CalculatorIcon /> },
    { id: 'residents', label: 'Quản lý Cư dân', roles: ['Admin', 'Accountant', 'Operator'], icon: <UsersIcon /> },
    { id: 'vehicles', label: 'Quản lý Phương tiện', roles: ['Admin', 'Accountant', 'Operator'], icon: <CarIcon /> },
    { id: 'water', label: 'Quản lý Nước', roles: ['Admin', 'Accountant', 'Operator'], icon: <WaterIcon /> },
];

const settingsNavItems: { id: Page; label: string; roles: Role[]; icon: React.ReactNode }[] = [
    { id: 'pricing', label: 'Quản lý Đơn giá', roles: ['Admin', 'Accountant'], icon: <ReceiptIcon /> },
    { id: 'settings', label: 'Cài đặt', roles: ['Admin', 'Accountant'], icon: <PencilSquareIcon /> },
    { id: 'users', label: 'Quản lý Người dùng', roles: ['Admin'], icon: <KeyIcon /> },
    { id: 'backup', label: 'Backup & Restore', roles: ['Admin'], icon: <ArchiveBoxIcon /> },
    { id: 'activityLog', label: 'Nhật ký Hoạt động', roles: ['Admin'], icon: <ClipboardDocumentListIcon /> },
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, role }) => {
  const { invoiceSettings } = useSettings();
  const isDev = !isProduction();
  const themeClass = isDev 
    ? 'border-red-500 bg-red-50 text-red-700' 
    : 'border-emerald-500 bg-emerald-50 text-emerald-700';
  const versionText = isDev ? 'v2.0-DEV' : 'v2.0';


  const NavLink: React.FC<{ id: Page; label: string; icon: React.ReactNode }> = ({ id, label, icon }) => {
    const isActive = activePage === id;
    return (
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); setActivePage(id); }}
        className={`flex items-center px-4 py-3 text-sm font-semibold rounded-lg transition-colors duration-200 mx-2 ${
          isActive
            ? 'bg-primary text-white shadow-md'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <span className="mr-3">{icon}</span>
        {label}
      </a>
    );
  };

  return (
    <aside className="w-64 bg-white flex-shrink-0 flex flex-col border-r border-gray-200 h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 px-1">
            <div className="bg-primary text-white p-2 rounded-lg shadow-sm flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
            </div>
            <div className="flex flex-col justify-center">
                <span className="text-xl font-black text-gray-800 tracking-tight">Q-Home</span>
                <span className="text-lg font-bold text-gray-500 -mt-1">Manager</span>
            </div>
        </div>
        <div className="mt-4 w-full bg-yellow-100 border border-yellow-300 rounded-md py-1.5 px-2 text-center shadow-sm">
            <span className="text-yellow-800 text-xs font-bold uppercase tracking-wide block">
                {invoiceSettings.buildingName || 'Q-HOME MANAGER'}
            </span>
        </div>
      </div>
      
      <nav className="flex-1 p-2 space-y-1.5 overflow-y-auto">
        {mainNavItems.filter(item => item.roles.includes(role)).map(item => (
          <NavLink key={item.id} id={item.id} label={item.label} icon={item.icon} />
        ))}
        <div className="pt-4 mt-2">
            <h3 className="px-4 mb-2 text-xs font-semibold uppercase text-gray-400 tracking-wider">Hệ thống</h3>
            <div className="space-y-1.5">
                {settingsNavItems.filter(item => item.roles.includes(role)).map(item => (
                  <NavLink key={item.id} id={item.id} label={item.label} icon={item.icon} />
                ))}
            </div>
        </div>
      </nav>

      <div className={`mt-auto mx-4 mb-4 p-3 rounded-lg border-2 text-center ${themeClass}`}>
        <p className="text-xs font-bold">{versionText}</p>
        <p className="text-[10px] font-medium opacity-80">by Quynh Nguyen</p>
      </div>
    </aside>
  );
};

export default Sidebar;