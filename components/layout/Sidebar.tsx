
import React, { useState, useMemo } from 'react';
import { 
    PieChartIcon, CalculatorIcon, UsersIcon, WaterIcon, ReceiptIcon, 
    CarIcon, MegaphoneIcon, ChatBubbleLeftEllipsisIcon,
    ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon,
    PiggyBankIcon
} from '../ui/Icons';
import type { Role, UserPermission } from '../../types';
import { useSettings, useAuth } from '../../App';
import { isProduction } from '../../utils/env';
import InstallPWA from '../common/InstallPWA';

// Added local icon for Finance
const BanknotesIconLocal: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
);

type Page = 'overview' | 'billing' | 'residents' | 'vehicles' | 'water' | 'pricing' | 'users' | 'settings' | 'backup' | 'activityLog' | 'newsManagement' | 'feedbackManagement' | 'vas';

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
        label: 'Quản lý cư dân',
        items: [
            { id: 'residents', label: 'Cư dân', icon: <UsersIcon /> },
            { id: 'vehicles', label: 'Phương tiện', icon: <CarIcon /> },
            { id: 'water', label: 'Nước', icon: <WaterIcon /> },
        ]
    },
    {
        id: 'finance_group',
        label: 'Quản lý tài chính',
        items: [
            { id: 'billing', label: 'Bảng tính phí', icon: <CalculatorIcon /> },
            { id: 'vas', label: 'Dịch vụ GTGT', icon: <BanknotesIconLocal /> },
            { id: 'pricing', label: 'Quản lý đơn giá', icon: <ReceiptIcon /> },
        ]
    },
    {
        id: 'comm_group',
        label: 'Thông báo',
        items: [
            { id: 'newsManagement', label: 'Quản lý tin tức', icon: <MegaphoneIcon /> },
            { id: 'feedbackManagement', label: 'Quản lý phản ánh', icon: <ChatBubbleLeftEllipsisIcon /> },
        ]
    }
];

// ... rest of sidebar component logic ...

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, role }) => {
  const { invoiceSettings } = useSettings();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['residents_group', 'finance_group', 'comm_group']));

  const isDev = !isProduction();
  const themeClass = isDev 
    ? 'border-red-500 bg-red-50 text-red-700' 
    : 'border-emerald-500 bg-emerald-50 text-emerald-700';
  const versionText = isDev ? 'v2.1-DEV' : 'v2.1';

  const extendedUser = user as any;

  // Filter Menu based on Permissions
  const filteredMenuGroups = useMemo(() => {
      if (role === 'Admin') return menuGroups;

      const userPermissions = new Set(extendedUser?.permissions || []);

      return menuGroups.map(group => {
          if ('items' in group) {
              const visibleItems = group.items.filter(item => {
                  let permissionKey = item.id;
                  if (item.id === 'pricing') permissionKey = 'billing';
                  if (item.id === 'vas') permissionKey = 'billing';
                  return userPermissions.has(permissionKey);
              });

              if (visibleItems.length > 0) {
                  return { ...group, items: visibleItems };
              }
              return null;
          } else {
              if (group.id === 'overview') return group;
              return null;
          }
      }).filter(Boolean) as (MenuItem | MenuGroup)[];
  }, [role, extendedUser?.permissions]);

  const toggleGroup = (groupId: string) => {
      setExpandedGroups(prev => {
          const next = new Set(prev);
          if (next.has(groupId)) next.delete(groupId);
          else next.add(groupId);
          return next;
      });
  };

  const handleGroupClick = (groupId: string) => {
      if (isCollapsed) {
          setIsCollapsed(false);
          setExpandedGroups(new Set([groupId]));
      } else {
          toggleGroup(groupId);
      }
  };

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white flex-shrink-0 flex flex-col border-r border-gray-200 h-full transition-all duration-300 ease-in-out`}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between h-[88px]">
        {!isCollapsed && (
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="bg-primary text-white p-2 rounded-lg shadow-sm flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                </div>
                <div className="flex flex-col justify-center min-w-0">
                    <span className="text-lg font-black text-gray-800 tracking-tight truncate">Q-Home</span>
                    <span className="text-xs font-bold text-gray-500 uppercase truncate max-w-[120px]">
                        {invoiceSettings.buildingName || 'Manager'}
                    </span>
                </div>
            </div>
        )}
        {isCollapsed && (
             <div className="w-full flex justify-center">
                <div className="bg-primary text-white p-2 rounded-lg shadow-sm">
                    <span className="font-bold text-lg">Q</span>
                </div>
             </div>
        )}
      </div>
      
      <nav className="flex-1 p-2 space-y-2 overflow-y-auto overflow-x-hidden">
        {filteredMenuGroups.map((item) => {
            if ('items' in item) {
                const isExpanded = expandedGroups.has(item.id);
                const hasActiveChild = item.items.some(child => child.id === activePage);
                
                return (
                    <div key={item.id} className="mb-1">
                        <button
                            onClick={() => handleGroupClick(item.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-200
                                ${hasActiveChild ? 'bg-gray-50 text-primary' : 'text-gray-600 hover:bg-gray-100'}
                                ${isCollapsed ? 'justify-center' : ''}
                            `}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <div className="flex items-center">
                                {isCollapsed ? (
                                    <div className="relative group">
                                        {item.items[0].icon} 
                                        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-gray-400 rounded-full border border-white"></div>
                                    </div>
                                ) : (
                                    <span className="uppercase text-xs font-bold text-gray-400 tracking-wider">{item.label}</span>
                                )}
                            </div>
                            {!isCollapsed && (
                                <span className="text-gray-400">
                                    {isExpanded ? <ChevronUpIcon className="w-4 h-4"/> : <ChevronDownIcon className="w-4 h-4"/>}
                                </span>
                            )}
                        </button>
                        
                        {(!isCollapsed && isExpanded) && (
                            <div className="mt-1 space-y-1 ml-1">
                                {item.items.map(subItem => {
                                    const isActive = activePage === subItem.id;
                                    return (
                                        <a
                                            key={subItem.id}
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); setActivePage(subItem.id); }}
                                            className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200
                                                ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                                            `}
                                        >
                                            <span className={`mr-3 ${isActive ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'}`}>
                                                {subItem.icon}
                                            </span>
                                            {subItem.label}
                                        </a>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            } else {
                const isActive = activePage === item.id;
                return (
                    <a
                        key={item.id}
                        href="#"
                        onClick={(e) => { e.preventDefault(); setActivePage(item.id); }}
                        className={`flex items-center pl-5 pr-3 py-3 text-sm font-semibold rounded-lg transition-colors duration-200 mb-2
                            ${isActive ? 'bg-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}
                            ${isCollapsed ? 'justify-center' : ''}
                        `}
                        title={isCollapsed ? item.label : undefined}
                    >
                        <span className={isCollapsed ? '' : 'mr-3'}>{item.icon}</span>
                        {!isCollapsed && item.label}
                    </a>
                );
            }
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 flex flex-col gap-2">
        {!isCollapsed && <InstallPWA />}
        
        {!isCollapsed && (
            <div className={`p-2 rounded-lg border text-center ${themeClass}`}>
                <p className="text-[10px] font-bold">{versionText}</p>
            </div>
        )}
        <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
            {isCollapsed ? <ChevronRightIcon className="w-5 h-5"/> : <ChevronLeftIcon className="w-5 h-5"/>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
