

import React, { useState } from 'react';
import { useAuth, useTheme } from '../App';
import { MOCK_USER_PERMISSIONS } from '../constants';
import { Role } from '../types';

// --- START: Icons ---
const DashboardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const CalculatorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 3h.008v.008H8.25v-.008zm0 3h.008v.008H8.25v-.008zm3-6h.008v.008H11.25v-.008zm0 3h.008v.008H11.25v-.008zm0 3h.008v.008H11.25v-.008zm3-6h.008v.008H14.25v-.008zm0 3h.008v.008H14.25v-.008zM4.5 3.75v16.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V3.75m-15 0h15M4.5 3.75a2.25 2.25 0 012.25-2.25h10.5a2.25 2.25 0 012.25 2.25m-15 0h15" />
    </svg>
);
const UsersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-4.661c.34-.169.684-.316 1.022-.445l.203-.064M15 19.128a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0a1.5 1.5 0 01-3 0M9 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);
const WaterMeterIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
       <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
       <circle cx="12" cy="12" r="9"></circle>
       <path d="M12 12l3.5 -3.5"></path>
       <path d="M9 15l-1 -1"></path>
       <path d="M15 9l1 -1"></path>
    </svg>
);
const ReceiptIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
);
const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);
// --- END: Icons ---

const MenuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-16 6h16" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

const MoonIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
);


interface SidebarProps {
    activePage: string;
    setActivePage: (page: string) => void;
}

const navItems: { id: string; label: string; roles: Role[]; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Tổng quan', roles: ['Admin', 'Accountant', 'Operator'], icon: <DashboardIcon /> },
    { id: 'charges', label: 'Tính phí & Gửi phiếu', roles: ['Admin', 'Accountant'], icon: <CalculatorIcon /> },
    { id: 'residents', label: 'Quản lý Cư dân', roles: ['Admin', 'Accountant', 'Operator'], icon: <UsersIcon /> },
    { id: 'water', label: 'Quản lý Nước', roles: ['Admin', 'Accountant', 'Operator'], icon: <WaterMeterIcon /> },
    { id: 'tariffs', label: 'Quản lý Đơn giá', roles: ['Admin', 'Accountant'], icon: <ReceiptIcon /> },
    { id: 'users', label: 'Quản lý Users', roles: ['Admin'], icon: <SettingsIcon /> },
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
    const [isOpen, setIsOpen] = useState(false);
    // FIX: Destructure 'switchUserRequest' from the useAuth hook instead of the non-existent 'login' function.
    const { user, role, switchUserRequest } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const handleNavClick = (page: string) => {
        setActivePage(page);
        if (isOpen) {
            setIsOpen(false);
        }
    };

    const NavContent = () => (
        <div className="flex flex-col h-full bg-secondary dark:bg-dark-background shadow-lg">
            <div className="p-4 border-b dark:border-dark-border-color flex items-center gap-2">
                <h1 className="text-xl font-bold text-primary">BQL HUD3</h1>
                 <span className="bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full">v2.0</span>
            </div>

            <div className="p-4 border-b dark:border-dark-border-color">
                <label htmlFor="user-select" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">Người dùng hiện tại:</label>
                <select 
                    id="user-select"
                    value={user?.Email || ''}
                    // FIX: Implement the onChange handler to find the correct user object and call 'switchUserRequest' to initiate the user switch flow, which includes a password modal.
                    onChange={(e) => {
                        const selectedEmail = e.target.value;
                        if (user?.Email === selectedEmail) return;
                        const userToSwitch = MOCK_USER_PERMISSIONS.find(u => u.Email === selectedEmail);
                        if (userToSwitch) {
                            switchUserRequest(userToSwitch);
                        }
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary bg-background dark:bg-dark-secondary dark:border-dark-border-color dark:text-dark-text-primary"
                >
                    {MOCK_USER_PERMISSIONS.map(u => (
                        // FIX: Use `u.status` to check if a user is active, as `u.Active` does not exist on the UserPermission type.
                        <option key={u.Email} value={u.Email} disabled={u.status !== 'Active'}>
                            {u.Email} ({u.Role})
                        </option>
                    ))}
                </select>
                <p className="mt-2 text-xs text-text-secondary dark:text-dark-text-secondary">
                    {user ? `Vai trò: ${role}` : 'Chưa đăng nhập'}
                </p>
            </div>
            
            <nav className="flex-1 px-4 py-2 space-y-2">
                {navItems.filter(item => item.roles.includes(role)).map(item => (
                    <a
                        key={item.id}
                        href="#"
                        onClick={(e) => { e.preventDefault(); handleNavClick(item.id); }}
                        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                            activePage === item.id 
                            ? 'bg-primary text-white' 
                            : 'text-text-primary dark:text-dark-text-primary hover:bg-gray-200 dark:hover:bg-dark-secondary'
                        }`}
                    >
                        {item.icon}
                        {item.label}
                    </a>
                ))}
            </nav>

            <div className="p-4 mt-auto border-t dark:border-dark-border-color">
                <button 
                    onClick={toggleTheme} 
                    className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150 text-text-primary dark:text-dark-text-primary bg-background dark:bg-dark-secondary hover:bg-gray-300 dark:hover:bg-slate-700 mb-2"
                >
                    {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                    <span>{theme === 'light' ? 'Chế độ Tối' : 'Chế độ Sáng'}</span>
                </button>
                <p className="text-xs text-text-secondary dark:text-dark-text-secondary text-center">&copy; {new Date().getFullYear()} BQL HUD3 Linh Đàm</p>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile menu button */}
            <button 
                className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-primary text-white rounded-full shadow-lg"
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <CloseIcon /> : <MenuIcon />}
            </button>

            {/* Mobile Sidebar */}
            <div className={`fixed inset-0 z-20 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:hidden`}>
                <NavContent />
            </div>

            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-64 h-full">
                <NavContent />
            </aside>
        </>
    );
};

export default Sidebar;