
import React, { useState, useMemo } from 'react';
import { 
    PieChartIcon, CalculatorIcon, UsersIcon, WaterIcon, ReceiptIcon, 
    CarIcon, MegaphoneIcon, ChatBubbleLeftEllipsisIcon,
    ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon,
    BuildingIcon 
} from '../ui/Icons';
import type { Role, UserPermission } from '../../types';
import { useSettings, useAuth } from '../../App';
import { isProduction } from '../../utils/env';
import SystemStatusFooter from './SystemStatusFooter';

type Page = 'overview' | 'billing' | 'residents' | 'vehicles' | 'water' | 'pricing' | 'users' | 'settings' | 'backup' | 'activityLog' | 'newsManagement' | 'feedbackManagement';

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
            { id: 'pricing', label: 'Quản lý Đơn giá', icon: <ReceiptIcon /> },
        ]
    },
    {
        id: 'comm_group',
        label: 'Thông báo',
        items: [
            { id: 'newsManagement', label: 'Quản lý Tin tức', icon: <MegaphoneIcon /> },
            { id: 'feedbackManagement', label: 'Quản lý Phản hồi', icon: <ChatBubbleLeftEllipsisIcon /> },
        ]
    }
];

interface ExtendedUser extends UserPermission {
    permissions?: string[];
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, role }) => {
  const { invoiceSettings } = useSettings();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['residents_group', 'finance_group', 'comm_group']));

  const isDev = !isProduction();
  const extendedUser = user as ExtendedUser;

  // --- DYNAMIC BRANDING LOGIC ---
  const buildingName = invoiceSettings?.buildingName?.toUpperCase() || 'Q-HOME MANAGER';

  // Filter Menu based on Permissions
  const filteredMenuGroups = useMemo(() => {
      if (role === 'Admin') return menuGroups;
      const userPermissions = new Set(extendedUser.permissions || []);

      return menuGroups.map(group => {
          if ('items' in group) {
              const visibleItems = group.items.filter(item => {
                  let permissionKey = item.id;
                  if (item.id === 'pricing') permissionKey = 'billing';
                  return userPermissions.has(permissionKey);
              });
              if (visibleItems.length > 0) return { ...group, items: visibleItems };
              return null;
          } else {
              if (group.id === 'overview') return group;
              return null;
          }
      }).filter(Boolean) as (MenuItem | MenuGroup)[];
  }, [role, extendedUser.permissions]);

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
    <aside className={`${isCollapsed ? 'w-20' : 'w-72'} bg-white flex-shrink-0 flex flex-col border-r border-gray-200 h-full transition-all duration-300 ease-in-out shadow-xl z-20`}>
      
      {/* 1. BRANDING HEADER */}
      <div className="h-[88px] flex items-center justify-center border-b border-gray-100 bg-white">
          <div className={`flex items-center gap-3 px-4 w-full ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
            <div className="bg-gradient-to-tr from-slate-800 to-slate-700 text-white p-2 rounded-lg shadow-sm flex-shrink-0">
                <BuildingIcon className="w-6 h-6" />
            </div>
            
            {!isCollapsed && (
                <div className="flex flex-col min-w-0 animate-fade-in-down">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-widest leading-none mb-0.5">
                        Management
                    </span>
                    <span 
                        className="text-sm font-extrabold text-slate-800 uppercase tracking-tight truncate leading-tight" 
                        title={buildingName}
                    >
                        {buildingName}
                    </span>
                </div>
            )}
          </div>
      </div>
      
      {/* 2. NAVIGATION */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {filteredMenuGroups.map((item) => {
            if ('items' in item) {
                const isExpanded = expandedGroups.has(item.id);
                const hasActiveChild = item.items.some(child => child.id === activePage);
                
                return (
                    <div key={item.id} className="mb-3">
                        <button
                            onClick={() => handleGroupClick(item.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-200 group
                                ${hasActiveChild ? 'text-primary bg-primary/5' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}
                                ${isCollapsed ? 'justify-center' : ''}
                            `}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <div className="flex items-center gap-3">
                                {isCollapsed ? (
                                    <div className={`relative ${hasActiveChild ? 'text-primary' : 'text-gray-400'}`}>
                                        {item.items[0].icon} 
                                    </div>
                                ) : (
                                    <span>{item.label}</span>
                                )}
                            </div>
                            {!isCollapsed && (
                                <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                    <ChevronDownIcon className="w-3 h-3 opacity-50"/>
                                </span>
                            )}
                        </button>
                        
                        {(!isCollapsed && isExpanded) && (
                            <div className="mt-1 space-y-0.5">
                                {item.items.map(subItem => {
                                    const isActive = activePage === subItem.id;
                                    return (
                                        <a
                                            key={subItem.id}
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); setActivePage(subItem.id); }}
                                            className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 relative ml-2 border-l-2
                                                ${isActive ? 'border-primary text-gray-900 bg-gray-50' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-200'}
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
                        className={`flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all duration-200 mb-6
                            ${isActive ? 'bg-slate-800 text-white shadow-lg shadow-slate-300' : 'text-gray-600 hover:bg-gray-100'}
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

      {/* 3. FOOTER */}
      <div className="mt-auto px-3 pb-4 pt-2 border-t border-transparent space-y-3">
        
        {/* System Monitor (Only shown when expanded for better UI, or condensed if needed) */}
        {!isCollapsed && (
            <div className="animate-fade-in-down">
                <SystemStatusFooter />
            </div>
        )}

        {/* Signature Badge */}
        {!isCollapsed ? (
            <div className="text-center animate-fade-in-down select-none">
                <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold border mx-auto mb-2
                    ${isDev ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}
                `}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isDev ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    {isDev ? 'DEV MODE' : 'V3.0 (c) 2025 by QN'}
                </div>
            </div>
        ) : (
            <div className="flex justify-center">
                <span className="text-[10px] font-bold text-gray-300">v3.0</span>
            </div>
        )}
        
        {/* Toggle Button */}
        <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="w-full flex items-center justify-center py-2 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors rounded-lg"
            title="Thu gọn / Mở rộng"
        >
            {isCollapsed ? <ChevronRightIcon className="w-4 h-4"/> : <ChevronLeftIcon className="w-4 h-4"/>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
