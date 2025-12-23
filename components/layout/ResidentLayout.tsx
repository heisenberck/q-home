
import React, { useState, useRef, useEffect } from 'react';
import { 
    HomeIcon, ReceiptIcon, ChatBubbleLeftEllipsisIcon, MegaphoneIcon, 
    UserCircleIcon, ChevronLeftIcon, BellIcon, XMarkIcon,
    BanknotesIcon, SparklesIcon, CheckCircleIcon, UserIcon, ClockIcon
} from '../ui/Icons';
import type { UserPermission, Owner, ResidentNotification } from '../../types';
import { timeAgo } from '../../utils/helpers';
import { markAllResidentNotificationsRead, markResidentNotificationRead } from '../../services/firebaseAPI';

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

const NotificationTray: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    list: ResidentNotification[];
    onNavigate: (page: PortalPage) => void;
    unitId: string;
}> = ({ isOpen, onClose, list, onNavigate, unitId }) => {
    const trayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => { if (isOpen && trayRef.current && !trayRef.current.contains(e.target as Node)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [isOpen, onClose]);

    const handleMarkAll = async () => {
        const ids = list.map(n => n.id);
        await markAllResidentNotificationsRead(unitId, ids);
    };

    const handleItemClick = async (n: ResidentNotification) => {
        await markResidentNotificationRead(n.id);
        onNavigate(n.link as PortalPage);
        onClose();
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'bill': return <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><BanknotesIcon className="w-5 h-5"/></div>;
            case 'news': return <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><MegaphoneIcon className="w-5 h-5"/></div>;
            case 'feedback': return <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><ChatBubbleLeftEllipsisIcon className="w-5 h-5"/></div>;
            case 'profile': return <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><UserIcon className="w-5 h-5"/></div>;
            default: return <div className="p-2 bg-gray-100 text-gray-600 rounded-lg"><SparklesIcon className="w-5 h-5"/></div>;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose}></div>
            <div ref={trayRef} className="relative w-full max-w-sm bg-white h-full shadow-2xl animate-slide-left flex flex-col">
                <header className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-black text-gray-800 uppercase tracking-tight">Trung tâm thông báo</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><XMarkIcon className="w-5 h-5 text-gray-500"/></button>
                </header>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {list.length > 0 ? (
                        <>
                            <div className="flex justify-between items-center mb-2 px-1">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{list.length} tin mới</span>
                                <button onClick={handleMarkAll} className="text-[10px] font-black text-primary uppercase hover:underline">Đã xem hết</button>
                            </div>
                            {list.map(n => (
                                <div key={n.id} onClick={() => handleItemClick(n)} className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 active:bg-slate-100 transition-all cursor-pointer group">
                                    <div className="shrink-0">{getIcon(n.type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-800 text-sm leading-snug group-hover:text-primary transition-colors">{n.title}</p>
                                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.body}</p>
                                        <div className="flex items-center gap-1.5 mt-2 text-[9px] font-bold text-gray-400 uppercase tracking-tight">
                                            <ClockIcon className="w-3 h-3"/>
                                            {timeAgo(n.createdAt?.toDate?.()?.toISOString() || new Date().toISOString())}
                                        </div>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 opacity-40">
                            <BellIcon className="w-16 h-16 mb-4"/>
                            <p className="font-black uppercase tracking-widest text-xs">Không có thông báo mới</p>
                        </div>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes slide-left { from { transform: translateX(100%); } to { transform: translateX(0); } }
                .animate-slide-left { animation: slide-left 0.3s ease-out; }
            `}</style>
        </div>
    );
};

const ResidentLayout: React.FC<ResidentLayoutProps> = ({ children, activePage, setActivePage, user, owner, notifications, onMarkNewsAsRead }) => {
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const greetingName = owner ? `${owner.title || ''} ${owner.OwnerName.split(' ').pop()}` : `Cư dân`;
  const apartmentName = user.residentId ? `Căn hộ ${user.residentId}` : '';
  const isHomePage = activePage === 'portalHome';
    
  return (
    <div className="flex flex-col h-screen bg-light-bg">
        <NotificationTray 
            isOpen={isTrayOpen} 
            onClose={() => setIsTrayOpen(false)} 
            list={notifications.unreadList} 
            onNavigate={setActivePage}
            unitId={user.residentId!}
        />

        {isHomePage ? (
            <header className="sticky top-0 z-40 bg-primary text-white shadow-md p-4 flex justify-between items-center h-20">
                <div>
                    <h1 className="text-xl font-bold">Xin chào, {greetingName}</h1>
                    <p className="text-sm opacity-80">{apartmentName}</p>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        className="relative p-2 rounded-full hover:bg-white/10 active:scale-90 transition-transform"
                        onClick={() => setIsTrayOpen(true)}
                    >
                        <BellIcon className="w-6 h-6" />
                        {notifications.unreadList.length > 0 && (
                             <span className="absolute top-1 right-1 block h-4 w-4 rounded-full bg-red-500 ring-2 ring-primary text-[9px] font-black flex items-center justify-center animate-bounce">
                                 {notifications.unreadList.length}
                             </span>
                        )}
                    </button>
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
                <button onClick={() => setIsTrayOpen(true)} className="absolute right-4 p-2 text-gray-400 hover:text-primary relative">
                    <BellIcon className="w-6 h-6"/>
                    {notifications.unreadList.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>}
                </button>
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
