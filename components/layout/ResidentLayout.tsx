
import React from 'react';
import { 
    HomeIcon, ReceiptIcon, ChatBubbleLeftEllipsisIcon, MegaphoneIcon, 
    UserCircleIcon, ChevronLeftIcon
} from '../ui/Icons';
import type { UserPermission, Owner, ResidentNotification } from '../../types';
import ResidentNotificationBell from '../common/ResidentNotificationBell';

export type PortalPage = 'portalHome' | 'portalNews' | 'portalBilling' | 'portalContact' | 'portalProfile';

interface ResidentLayoutProps {
  children: React.ReactNode;
  activePage: PortalPage;
  setActivePage: (page: PortalPage) => void;
  user: UserPermission;
  owner: Owner | null;
  onUpdateOwner: (updatedOwner: Owner) => void;
  onChangePassword: () => void;
  notifications: {
    unreadNews: number;
    hasUnpaidBill: boolean;
    unreadList: ResidentNotification[];
  };
  onMarkNewsAsRead?: () => void;
}

const navItems = [
  { id: 'portalHome' as PortalPage, label: 'Trang chủ', icon: <HomeIcon /> },
  { id: 'portalNews' as PortalPage, label: 'Thông báo', icon: <MegaphoneIcon /> },
  { id: 'portalBilling' as PortalPage, label: 'Hóa đơn', icon: <ReceiptIcon /> },
  { id: 'portalContact' as PortalPage, label: 'Liên hệ', icon: <ChatBubbleLeftEllipsisIcon /> },
  { id: 'portalProfile' as PortalPage, label: 'Cá nhân', icon: <UserCircleIcon /> },
];

const pageTitles: Record<PortalPage, string> = {
    portalHome: 'Trang chủ',
    portalNews: 'Tin tức & Sự kiện',
    portalBilling: 'Hóa đơn & Thanh toán',
    portalContact: 'Liên hệ & Phản hồi',
    portalProfile: 'Hồ sơ cá nhân',
};

const ResidentLayout: React.FC<ResidentLayoutProps> = ({ children, activePage, setActivePage, user, owner, notifications, onMarkNewsAsRead }) => {
  const greetingName = owner ? `${owner.title || ''} ${owner.OwnerName.split(' ').pop()}` : `Cư dân`;
  const apartmentName = user.residentId ? `Căn hộ ${user.residentId}` : '';
  const isHomePage = activePage === 'portalHome';
    
  return (
    <div className="flex flex-col h-screen bg-light-bg">
        {isHomePage ? (
            <header className="sticky top-0 z-40 bg-primary text-white shadow-md p-4 flex justify-between items-center h-20">
                <div>
                    <h1 className="text-xl font-bold">Xin chào, {greetingName}</h1>
                    <p className="text-sm opacity-80">{apartmentName}</p>
                </div>
                <div className="flex items-center gap-4">
                    <ResidentNotificationBell 
                        residentId={user.residentId!} 
                        onNavigate={setActivePage} 
                    />
                    <button onClick={() => setActivePage('portalProfile')} className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30 flex-shrink-0 overflow-hidden active:scale-90 transition-transform">
                        {owner?.avatarUrl ? <img src={owner.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <UserCircleIcon className="w-10 h-10" />}
                    </button>
                </div>
            </header>
        ) : (
             <header className="sticky top-0 z-40 bg-white text-gray-800 shadow-sm p-4 flex items-center justify-center h-16 relative">
                 <button onClick={() => setActivePage('portalHome')} className="absolute left-4 p-2 rounded-full hover:bg-gray-100 active:scale-90 transition-transform">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-black mx-auto tracking-tight">{pageTitles[activePage]}</h1>
                <div className="absolute right-4 text-gray-400">
                    <ResidentNotificationBell 
                        residentId={user.residentId!} 
                        onNavigate={setActivePage} 
                    />
                </div>
            </header>
        )}

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-lg mx-auto">
            {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-light-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-40">
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {navItems.map(item => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                    if (item.id === 'portalNews' && onMarkNewsAsRead) {
                        onMarkNewsAsRead();
                    }
                    setActivePage(item.id);
                }}
                className={`flex flex-col items-center justify-center w-full pt-3 pb-2 transition-all ${isActive ? 'text-primary' : 'text-light-text-secondary opacity-60'}`}
              >
                <div className="relative">
                  {React.cloneElement(item.icon, { className: `w-6 h-6 transition-transform ${isActive ? 'scale-110 -translate-y-0.5' : ''}` })}
                  {item.id === 'portalNews' && notifications.unreadNews > 0 && (
                    <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                  )}
                  {item.id === 'portalBilling' && notifications.hasUnpaidBill && (
                    <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                  )}
                </div>
                <span className={`text-[9px] mt-1 uppercase tracking-widest ${isActive ? 'font-black' : 'font-bold'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default ResidentLayout;
