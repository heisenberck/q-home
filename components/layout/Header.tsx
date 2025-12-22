
import React, { useState, useRef, useEffect } from 'react';
import { 
    UserCircleIcon, ArrowRightOnRectangleIcon, UserIcon, UploadIcon, TrashIcon,
    SettingsIcon, KeyIcon, ArchiveBoxIcon, ClipboardDocumentListIcon, LockClosedIcon,
    EyeIcon, EyeSlashIcon, CheckCircleIcon
} from '../ui/Icons';
import type { UserPermission } from '../../types';
import { useAuth, useNotification } from '../../App';
import Modal from '../ui/Modal';
import { AdminPage } from '../../App';
import NotificationBell from '../common/NotificationBell';
import { compressImageToWebP } from '../../utils/helpers';
import { isProduction } from '../../utils/env';

interface HeaderProps {
  pageTitle: string;
  onNavigate: (page: AdminPage) => void;
}

// Tách ProfileModal ra ngoài để tránh re-mounting lỗi state
const ProfileModal: React.FC<{
    user: UserPermission;
    onClose: () => void;
    onUpdate: (updated: UserPermission, email: string) => Promise<void>;
}> = ({ user, onClose, onUpdate }) => {
    const { showToast } = useNotification();
    const [name, setName] = useState(user?.DisplayName || '');
    const [avatar, setAvatar] = useState(user?.avatarUrl || '');
    const [personalEmail, setPersonalEmail] = useState(user?.contact_email || '');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            showToast('Đang xử lý ảnh...', 'info');
            const compressedBase64 = await compressImageToWebP(file);
            setAvatar(compressedBase64);
            showToast('Đã xử lý ảnh thành công. Nhấn Lưu để cập nhật.', 'success');
        } catch (error) {
            showToast('Lỗi xử lý ảnh.', 'error');
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const updated: UserPermission = { 
                ...user, 
                DisplayName: name, 
                avatarUrl: avatar,
                contact_email: personalEmail
            };

            if (newPassword.trim()) {
                if (newPassword.length < 6) {
                    showToast('Mật khẩu phải từ 6 ký tự.', 'warn');
                    setIsSaving(false);
                    return;
                }
                updated.password = newPassword.trim();
                updated.mustChangePassword = false;
            }

            await onUpdate(updated, user.Email);
            showToast('Đã cập nhật thông tin thành công', 'success');
            onClose();
        } catch (e) {
            console.error("Profile Save Error:", e);
            showToast('Lỗi khi cập nhật thông tin cá nhân', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const inputStyle = "w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all";
    const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5";

    return (
      <Modal title="Cài đặt cá nhân" onClose={onClose} size="md">
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-primary/10 shadow-inner flex items-center justify-center">
                    {avatar ? (
                        <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <UserCircleIcon className="w-16 h-16 text-gray-300" />
                    )}
                </div>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                    className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary-focus transition-transform active:scale-90 disabled:opacity-50"
                    title="Đổi ảnh đại diện"
                >
                    <UploadIcon className="w-4 h-4" />
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Bấm nút để tải ảnh từ máy</p>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-4">
                <div>
                    <label className={labelStyle}>Tên hiển thị</label>
                    <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className={`${inputStyle} pl-10`}
                            placeholder="Họ và tên của bạn"
                        />
                    </div>
                </div>
                <div>
                    <label className={labelStyle}>Email cá nhân</label>
                    <div className="relative">
                        <ArchiveBoxIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="email" 
                            value={personalEmail} 
                            onChange={e => setPersonalEmail(e.target.value)} 
                            className={`${inputStyle} pl-10`}
                            placeholder="nhanvien@gmail.com"
                        />
                    </div>
                    <p className="text-[9px] text-gray-400 mt-1.5 italic">* Dùng để nhận thông báo hệ thống</p>
                </div>
            </div>

            <div className="bg-orange-50/30 p-4 rounded-xl border border-orange-100/50">
                <label className={`${labelStyle} text-orange-600`}>Bảo mật tài khoản</label>
                <div className="relative">
                    <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                    <input 
                        type={showPassword ? "text" : "password"} 
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                        className={`${inputStyle} pl-10 border-orange-200 focus:ring-orange-500/20 focus:border-orange-500`}
                        placeholder="Nhập mật khẩu mới để thay đổi"
                    />
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end gap-3">
            <button onClick={onClose} disabled={isSaving} className="px-5 py-2.5 bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50">Hủy</button>
            <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-primary-focus flex items-center gap-2 disabled:opacity-50">
                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                Lưu thay đổi
            </button>
          </div>
        </div>
      </Modal>
    );
};

const Header: React.FC<HeaderProps> = ({ pageTitle, onNavigate }) => {
  const { user: currentUser, logout, updateUser } = useAuth();
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

  const handleMenuNavigation = (page: AdminPage) => {
    setIsMenuOpen(false);
    onNavigate(page);
  };

  if (!currentUser) return null;

  const role = currentUser.Role;
  const isAdmin = role === 'Admin';
  const isAccountant = role === 'Accountant';

  return (
    <header className="w-full bg-white border-b border-gray-200 flex items-center justify-between p-4 flex-shrink-0 h-[88px] z-30 shadow-sm">
      {isProfileModalOpen && (
          <ProfileModal 
            user={currentUser} 
            onClose={() => setIsProfileModalOpen(false)} 
            onUpdate={updateUser} 
          />
      )}
      <h1 className="text-2xl font-black text-gray-800 tracking-tight ml-2">
        {pageTitle}
      </h1>
      <div className="flex items-center gap-4 ml-auto">
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
                            <button 
                                onClick={() => handleMenuNavigation('settings')}
                                className="flex items-center w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors"
                            >
                                <SettingsIcon className="w-5 h-5 mr-3 text-gray-400" />
                                Cài đặt Hệ thống
                            </button>
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
