
import React, { useState, useRef, useEffect } from 'react';
import { 
    UserCircleIcon, ArrowRightOnRectangleIcon, UserIcon, UploadIcon, TrashIcon,
    SettingsIcon, KeyIcon, ArchiveBoxIcon, ClipboardDocumentListIcon, LockClosedIcon
} from '../ui/Icons';
import type { UserPermission } from '../../types';
import { useAuth, useNotification } from '../../App';
import Modal from '../ui/Modal';
import { AdminPage } from '../../App';
import NotificationBell from '../common/NotificationBell'; // Import mới

interface HeaderProps {
  pageTitle: string;
  onNavigate: (page: AdminPage) => void;
}

const Header: React.FC<HeaderProps> = ({ pageTitle, onNavigate }) => {
  const { user: currentUser, logout, updateUser } = useAuth();
  const { showToast } = useNotification();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
              setIsMenuOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // FIX: Added missing handleMenuNavigation logic
  const handleMenuNavigation = (page: AdminPage) => {
    setIsMenuOpen(false);
    onNavigate(page);
  };

  // FIX: Added missing ProfileModal logic
  const ProfileModal = () => {
    const [name, setName] = useState(currentUser?.DisplayName || '');
    const [avatar, setAvatar] = useState(currentUser?.avatarUrl || '');

    const handleSave = () => {
        if (!currentUser) return;
        const updated = { ...currentUser, DisplayName: name, avatarUrl: avatar };
        updateUser(updated, currentUser.Email);
        showToast('Đã cập nhật thông tin cá nhân', 'success');
        setIsProfileModalOpen(false);
    };

    return (
      <Modal title="Cài đặt cá nhân" onClose={() => setIsProfileModalOpen(false)} size="md">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border">
              {avatar ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" /> : <UserCircleIcon className="w-full h-full text-gray-400" />}
            </div>
            <div className="w-full">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL Ảnh đại diện</label>
                <input type="text" placeholder="https://..." value={avatar} onChange={e => setAvatar(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên hiển thị</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary outline-none" />
          </div>
          <div className="pt-4 border-t flex justify-end gap-2">
            <button onClick={() => setIsProfileModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded text-sm font-semibold hover:bg-gray-200">Hủy</button>
            <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded text-sm font-semibold hover:bg-primary-focus">Lưu thay đổi</button>
          </div>
        </div>
      </Modal>
    );
  };

  if (!currentUser) return null;

  const role = currentUser.Role;
  const isAdmin = role === 'Admin';
  const isAccountant = role === 'Accountant';

  return (
    <header className="w-full bg-white border-b border-gray-200 flex items-center justify-between p-4 flex-shrink-0 h-[88px] z-30 shadow-sm">
      {isProfileModalOpen && <ProfileModal />}
      <h1 className="text-2xl font-black text-gray-800 tracking-tight ml-2">
        {pageTitle}
      </h1>
      <div className="flex items-center gap-4 ml-auto">
        
        {/* Tích hợp NotificationBell tại đây */}
        <NotificationBell />

        <div ref={menuRef} className="relative">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-3 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                {currentUser.avatarUrl ? (
                    <img 
                        src={currentUser.avatarUrl} 
                        alt="Avatar" 
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                ) : (
                    <UserCircleIcon className="w-10 h-10 text-gray-500" />
                )}
                <div className="text-left hidden md:block">
                    <p className="text-sm font-semibold">{currentUser.DisplayName || currentUser.Username || currentUser.Email.split('@')[0]}</p>
                    <p className="text-xs text-gray-500">{currentUser.Role}</p>
                </div>
            </button>
            
            {isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-100 z-50 animate-fade-in-down ring-1 ring-black ring-opacity-5">
                    <div className="p-4 border-b bg-gray-50 rounded-t-lg">
                        <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Đang đăng nhập</p>
                        <p className="text-sm truncate font-bold text-gray-900">{currentUser.Email}</p>
                    </div>
                    
                    <div className="py-2">
                        <button 
                             onClick={() => { setIsMenuOpen(false); setIsProfileModalOpen(true); }}
                             className="flex items-center w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors"
                        >
                             <UserIcon className="w-5 h-5 mr-3 text-gray-400" />
                             Cài đặt cá nhân
                        </button>
                    </div>

                    {(isAdmin || isAccountant) && (
                        <div className="border-t py-2">
                            <p className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quản trị hệ thống</p>
                            
                            {(isAdmin || isAccountant) && (
                                <button 
                                    onClick={() => handleMenuNavigation('settings')}
                                    className="flex items-center w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors"
                                >
                                    <SettingsIcon className="w-5 h-5 mr-3 text-gray-400" />
                                    Cài đặt Hệ thống
                                </button>
                            )}
                            
                            {isAdmin && (
                                <>
                                    <button 
                                        onClick={() => handleMenuNavigation('users')}
                                        className="flex items-center w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors"
                                    >
                                        <KeyIcon className="w-5 h-5 mr-3 text-gray-400" />
                                        Quản lý Người dùng
                                    </button>
                                    <button 
                                        onClick={() => handleMenuNavigation('backup')}
                                        className="flex items-center w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors"
                                    >
                                        <ArchiveBoxIcon className="w-5 h-5 mr-3 text-gray-400" />
                                        Backup & Restore
                                    </button>
                                    <button 
                                        onClick={() => handleMenuNavigation('activityLog')}
                                        className="flex items-center w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors"
                                    >
                                        <ClipboardDocumentListIcon className="w-5 h-5 mr-3 text-gray-400" />
                                        Nhật ký Hoạt động
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    <div className="border-t py-2 bg-gray-50 rounded-b-lg">
                        <button 
                            onClick={() => { setIsMenuOpen(false); logout(); }}
                            className="flex items-center w-full px-4 py-2.5 text-sm text-left text-red-600 hover:bg-red-50 transition-colors font-medium"
                        >
                            <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
                            Đăng xuất
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;
