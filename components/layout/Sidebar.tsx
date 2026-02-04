
import React, { useState, useMemo } from 'react';
import { 
    PieChartIcon, CalculatorIcon, UsersIcon, WaterIcon, ReceiptIcon, 
    CarIcon, MegaphoneIcon, ChatBubbleLeftEllipsisIcon,
    ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon,
    ArrowPathIcon, BanknotesIcon, TrendingDownIcon,
    ClipboardCheckIcon
} from '../ui/Icons';
import type { Role } from '../../types';
import { useSettings, useAuth } from '../../App';
import InstallPWA from '../common/InstallPWA';

type Page = 'overview' | 'billing' | 'residents' | 'vehicles' | 'water' | 'pricing' | 'users' | 'settings' | 'backup' | 'activityLog' | 'newsManagement' | 'feedbackManagement' | 'vas' | 'expenses';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  role: Role;
}

type MenuItem = {
    id: Page;
    label: string;
    icon: React.ReactNode;
};

type MenuGroup = {
    id: string;
    label: string;
    items: MenuItem[];
};

const menuGroups: (MenuItem | MenuGroup)[] = [
    { id: 'overview', label: 'Tổng quan', icon: <PieChartIcon /> },
    {
        id: 'residents_group',
        label: 'Quản lý Cư dân',
        items: [
            { id: 'residents', label: 'Cư dân', icon: <UsersIcon /> },
            { id: 'vehicles', label: 'Phương tiện', icon: <CarIcon /> },
            { id: 'water', label: 'Nước', icon: <WaterIcon /> },
        ]
    },
    {
        id: 'finance_group',
        label: 'Quản lý Tài chính',
        items: [
            { id: 'billing', label: 'Bảng tính phí', icon: <CalculatorIcon /> },
            { id: 'vas', label: 'Dịch vụ GTGT', icon: <BanknotesIcon /> },
            { id: 'expenses', label: 'Chi phí Vận hành', icon: <TrendingDownIcon /> },
            { id: 'pricing', label: 'Quản lý Đơn giá', icon: <ReceiptIcon /> },
        ]
    },
    {
        id: 'comm_group',
        label: 'Thông báo & Đăng ký',
        items: [
            { id: 'newsManagement', label: 'Quản lý Tin tức', icon: <MegaphoneIcon /> },
            { id: 'feedbackManagement', label: 'Quản lý Phản hồi', icon: <ChatBubbleLeftEllipsisIcon /> },
        ]
    }
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, role }) => {
  const { invoiceSettings } = useSettings();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['residents_group', 'finance_group', 'comm_group']));

  const filteredMenuGroups = useMemo(() => {
      if (role === 'Admin') return menuGroups;

      const userPermissions = new Set(user?.permissions || []);

      return menuGroups.map(group => {
          if ('items' in group) {
              const visibleItems = group.items.filter(item => {
                  let permissionKey = item.id;
                  if (item.id === 'pricing' || item.id === 'vas' || item.id === 'expenses') permissionKey = 'billing';
                  return userPermissions.has(permissionKey);
              });
              return visibleItems.length > 0 ? { ...group, items: visibleItems } : null;
          } else {
              if (group.id === 'overview') {
                  return userPermissions.has('overview') ? group : null;
              }
              return null;
          }
      }).filter(Boolean) as (MenuItem | MenuGroup)[];
  }, [role, user?.permissions]);

  const toggleGroup = (groupId: string) => {
      setExpandedGroups(prev => {
          const next = new Set(prev);
          if (next.has(groupId)) next.delete(groupId);
          else next.add(groupId);
          return next;
      });
  };

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white flex-shrink-0 flex flex-col border-r border-gray-200 h-full transition-all duration-300 ease-in-out`}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between h-[88px]">
        {!isCollapsed && (
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="bg-primary text-white p-2 rounded-lg shadow-sm flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                </div>
                <div className="flex flex-col justify-center min-w-0"><span className="text-lg font-black text-gray-800 tracking-tight truncate">Q-Home</span><span className="text-xs font-bold text-gray-500 uppercase truncate max-w-[120px]">{invoiceSettings.buildingName || 'Manager'}</span></div>
            </div>
        )}
        {isCollapsed && <div className="w-full flex justify-center"><div className="bg-primary text-white p-2 rounded-lg shadow-sm"><span className="font-bold text-lg">Q</span></div></div>}
      </div>
      
      <nav className="flex-1 p-2 space-y-2 overflow-y-auto overflow-x-hidden">
        {filteredMenuGroups.map((item) => {
            if ('items' in item) {
                const isExpanded = expandedGroups.has(item.id);
                const hasActiveChild = item.items.some(child => child.id === activePage);
                return (
                    <div key={item.id} className="mb-1">
                        <button onClick={() => !isCollapsed && toggleGroup(item.id)} className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${hasActiveChild ? 'bg-gray-50 text-primary' : 'text-gray-600 hover:bg-gray-100'} ${isCollapsed ? 'justify-center' : ''}`} title={isCollapsed ? item.label : undefined}>
                            <div className="flex items-center">{isCollapsed ? <div className="relative group">{item.items[0].icon}<div className="absolute -bottom-1 -right-1 w-2 h-2 bg-gray-400 rounded-full border border-white"></div></div> : <span className="uppercase text-xs font-bold text-gray-400 tracking-wider">{item.label}</span>}</div>
                            {!isCollapsed && <span className="text-gray-400">{isExpanded ? <ChevronUpIcon className="w-4 h-4"/> : <ChevronDownIcon className="w-4 h-4"/>}</span>}
                        </button>
                        {!isCollapsed && isExpanded && (
                            <div className="mt-1 space-y-1 ml-1">{item.items.map(subItem => {
                                const isActive = activePage === subItem.id;
                                return (<a key={subItem.id} href="#" onClick={(e) => { e.preventDefault(); setActivePage(subItem.id); }} className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}><span className={`mr-3 ${isActive ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'}`}>{subItem.icon}</span>{subItem.label}</a>);
                            })}</div>
                        )}
                    </div>
                );
            } else {
                const isActive = activePage === item.id;
                return (<a key={item.id} href="#" onClick={(e) => { e.preventDefault(); setActivePage(item.id); }} className={`flex items-center pl-5 pr-3 py-3 text-sm font-semibold rounded-lg transition-colors mb-2 ${isActive ? 'bg-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'} ${isCollapsed ? 'justify-center' : ''}`} title={isCollapsed ? item.label : undefined}><span className={isCollapsed ? '' : 'mr-3'}>{item.icon}</span>{!isCollapsed && item.label}</a>);
            }
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 flex flex-col gap-2">
        {!isCollapsed && <button onClick={() => window.dispatchEvent(new CustomEvent('REFRESH_RESIDENTS'))} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all font-bold text-xs active:scale-95"><ArrowPathIcon className="w-4 h-4" /> Làm mới dữ liệu</button>}
        {!isCollapsed && <InstallPWA />}
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">{isCollapsed ? <ChevronRightIcon className="w-5 h-5"/> : <ChevronLeftIcon className="w-5 h-5"/>}</button>
      </div>
    </aside>
  );
};

export default Sidebar;
