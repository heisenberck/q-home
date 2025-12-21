
import React, { useState } from 'react';
import { 
    HomeIcon, ReceiptIcon, ChatBubbleLeftEllipsisIcon, 
    MegaphoneIcon, UserCircleIcon, ChevronLeftIcon, 
    BellIcon, XMarkIcon, ClockIcon 
} from '../ui/Icons';
import type { UserPermission, Owner } from '../../types';
import { useNotifications, NotificationItem } from '../../hooks/useNotifications';
import { timeAgo } from '../../utils/helpers';

export type PortalPage = 'portalHome' | 'portalNews' | 'portalBilling' | 'portalContact' | 'portalProfile';

interface ResidentLayoutProps {
  children: React.ReactNode;
  activePage: PortalPage;
  setActivePage: (page: PortalPage) => void;
  user: UserPermission;
  owner: Owner | null;
  onUpdateOwner: (updatedOwner: Owner) => void;
  onChangePassword: () => void;
  notifications?: any; // Kept for interface compatibility but overwritten internally
  onMarkNewsAsRead?: () => void;
  onMarkBellAsRead?: () => void;
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

const ResidentLayout: React.FC<ResidentLayoutProps> = ({ children, activePage, setActivePage, user, owner }) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { notifications, unreadCount, markAsRead } = useNotifications(user.Username || user.Email);

  const greetingName = owner ? `${owner.title || ''} ${owner.OwnerName.split(' ').pop()}` : `Cư dân`;
  const apartmentName = user.residentId ? `Căn hộ ${user.residentId}` : '';
  const isHomePage = activePage === 'portalHome';

  const handleNotifClick = (notif: NotificationItem) => {
      markAsRead(notif.id);
      if (notif.link) {
          setActivePage(notif.link as PortalPage);
      }
      setIsNotifOpen(false);
  };
    
  return (
    <div className="flex flex-col h-screen bg-light-bg overflow-hidden">
        {/* NOTIFICATION OVERLAY */}
        {isNotifOpen && (
            <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-fade-in flex justify-end">
                <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-slide-left">
                    <div className="p-4 border-b flex justify-between items-center bg-primary text-white">
                        <h3 className="font-bold text-lg">Thông báo của bạn</h3>
                        <button onClick={() => setIsNotifOpen(false)} className="p-1 hover:bg-white/20 rounded-full">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {notifications.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                                {notifications.map(notif => (
                                    <div 
                                        key={notif.id} 
                                        onClick={() => handleNotifClick(notif)}
                                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors relative ${!notif.isRead ? 'bg-blue-50/50' : ''}`}
                                    >
                                        {!notif.isRead && <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full"></div>}
                                        <h4 className={`text-sm font-bold ${!notif.isRead ? 'text-blue-900' : 'text-gray-800'}`}>{notif.title}</h4>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.body}</p>
                                        <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400 font-medium">
                                            <ClockIcon className="w-3 h-3" />
                                            {timeAgo(notif.createdAt?.toDate ? notif.createdAt.toDate().toISOString() : notif.createdAt)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center text-gray-400">
                                <BellIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">Bạn chưa có thông báo nào.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {isHomePage ? (
            <header className="sticky top-0 z-40 bg-primary text-white shadow-md p-4 flex justify-between items-center h-20">
                <div>
                    <h1 className="text-xl font-bold">Xin chào, {greetingName}</h1>
                    <p className="text-sm opacity-80">{apartmentName}</p>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                        onClick={() => setIsNotifOpen(true)}
                    >
                        <BellIcon className="w-6 h-6" />
                        {unreadCount > 0 && (
                             <span className="absolute top-1.5 right-1.5 block h-4 w-4 rounded-full bg-red-500 text-[10px] font-black flex items-center justify-center ring-2 ring-primary">
                                 {unreadCount > 9 ? '9+' : unreadCount}
                             </span>
                        )}
                    </button>
                    <button onClick={() => setActivePage('portalProfile')} className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30 flex-shrink-0">
                        {owner?.avatarUrl ? <img src={owner.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" /> : <UserCircleIcon className="w-10 h-10" />}
                    </button>
                </div>
            </header>
        ) : (
             <header className="sticky top-0 z-40 bg-white text-gray-800 shadow-sm p-4 flex items-center h-16">
                 <button onClick={() => setActivePage('portalHome')} className="p-2 rounded-full hover:bg-gray-100">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-bold flex-1 text-center pr-10">{pageTitles[activePage]}</h1>
            </header>
        )}

      <main className="flex-1 overflow-y-auto pb-24">
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
                onClick={() => setActivePage(item.id)}
                className={`flex flex-col items-center justify-center w-full pt-3 pb-2 transition-colors ${isActive ? 'text-primary' : 'text-light-text-secondary'}`}
              >
                <div className="relative">
                  {React.cloneElement(item.icon, { className: 'w-6 h-6' })}
                  {item.id === 'portalBilling' && notifications?.some((n: any) => !n.isRead && n.type === 'bill') && (
                    <span className="absolute -top-1 -right-1 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>
                  )}
                </div>
                <span className={`text-[10px] mt-1 uppercase tracking-tighter ${isActive ? 'font-black' : 'font-bold opacity-60'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default ResidentLayout;
