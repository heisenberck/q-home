
import React, { useState, useRef, useEffect } from 'react';
import { 
    UserCircleIcon, ArrowRightOnRectangleIcon, UserIcon, UploadIcon, TrashIcon,
    SettingsIcon, KeyIcon, ArchiveBoxIcon, ClipboardDocumentListIcon, LockClosedIcon
} from '../ui/Icons';
import type { UserPermission } from '../../types';
import { useAuth, useNotification } from '../../App';
import Modal from '../ui/Modal';
import { AdminPage } from '../../App';

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

  const getUsername = (user: UserPermission) => user.Username || user.Email.split('@')[0];

  const handleMenuNavigation = (page: AdminPage) => {
      onNavigate(page);
      setIsMenuOpen(false);
  };

  const ProfileModal = () => {
    const [formData, setFormData] = useState({ 
        Username: currentUser.Username || '',
        DisplayName: currentUser.DisplayName || '', // New Display Name
        Email: currentUser.Email || '',
        avatarUrl: currentUser.avatarUrl || ''
    });
    
    // Password state
    const [changePassword, setChangePassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { 
                showToast('Kích thước ảnh gốc phải nhỏ hơn 5MB.', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const MAX_WIDTH = 256;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_WIDTH) {
                            width *= MAX_WIDTH / height;
                            height = MAX_WIDTH;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    setFormData(prev => ({ ...prev, avatarUrl: dataUrl }));
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveAvatar = () => {
        setFormData(prev => ({ ...prev, avatarUrl: '' }));
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Basic Validation
        if (!formData.Email.trim()) {
            showToast('Vui lòng nhập Email.', 'error');
            return;
        }

        // Password Validation
        let passwordToUpdate = currentUser.password;
        if (changePassword) {
            if (newPassword.length < 6) {
                showToast('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
                return;
            }
            if (newPassword !== confirmPassword) {
                showToast('Mật khẩu xác nhận không khớp.', 'error');
                return;
            }
            passwordToUpdate = newPassword;
        }

        const updatedUser: UserPermission = {
            ...currentUser,
            DisplayName: formData.DisplayName, // Save Display Name
            Email: formData.Email, // Save (potentially new) Email
            avatarUrl: formData.avatarUrl,
            password: passwordToUpdate,
            mustChangePassword: false 
        };

        // Pass old email to handle key changes if necessary
        updateUser(updatedUser, currentUser.Email);
        setIsProfileModalOpen(false);
    };

    const inputClasses = "w-full p-2.5 border rounded-lg bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm transition-colors text-sm";
    const disabledInputClasses = "w-full p-2.5 border rounded-lg bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed shadow-sm text-sm";
    const labelClasses = "block text-sm font-semibold text-gray-700 mb-1.5";

    return (
        <Modal title="Hồ sơ cá nhân" onClose={() => setIsProfileModalOpen(false)} size="md">
            <form onSubmit={handleSave} className="space-y-5">
                <div className="flex flex-col items-center gap-3 pb-2 border-b border-gray-100">
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 shadow-inner bg-gray-50 flex items-center justify-center">
                            {formData.avatarUrl ? (
                                <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <UserCircleIcon className="w-24 h-24 text-gray-300" />
                            )}
                        </div>
                        <label 
                            htmlFor="avatar-upload" 
                            className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full cursor-pointer shadow-lg hover:bg-primary-focus transition-transform transform hover:scale-105"
                            title="Đổi ảnh đại diện"
                        >
                            <UploadIcon className="w-4 h-4" />
                            <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </label>
                    </div>
                    {formData.avatarUrl && (
                        <button 
                            type="button" 
                            onClick={handleRemoveAvatar}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium"
                        >
                            <TrashIcon className="w-3 h-3" /> Xoá ảnh
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {/* Fixed Username */}
                    <div>
                        <label className={labelClasses}>Tên đăng nhập (Hệ thống)</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={formData.Username} 
                                readOnly
                                disabled
                                className={disabledInputClasses}
                            />
                            <LockClosedIcon className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
                        </div>
                    </div>

                    {/* Editable Display Name */}
                    <div>
                        <label className={labelClasses}>Tên hiển thị (Người dùng)</label>
                        <input 
                            type="text" 
                            value={formData.DisplayName} 
                            onChange={e => setFormData({...formData, DisplayName: e.target.value})} 
                            className={inputClasses} 
                            placeholder="VD: Nguyễn Văn A"
                        />
                    </div>
                    
                    {/* Editable Email */}
                    <div>
                        <label className={labelClasses}>Email (Dùng để khôi phục MK)</label>
                        <input 
                            type="email" 
                            value={formData.Email} 
                            onChange={e => setFormData({...formData, Email: e.target.value})} 
                            className={inputClasses}
                            required
                        />
                    </div>
                </div>

                <div className="pt-2">
                    <div className="flex items-center gap-2 mb-3">
                        <input 
                            type="checkbox" 
                            id="changePassword" 
                            checked={changePassword} 
                            onChange={e => setChangePassword(e.target.checked)}
                            className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                        />
                        <label htmlFor="changePassword" className="text-sm font-semibold text-gray-700 cursor-pointer select-none flex items-center gap-2">
                            <KeyIcon className="w-4 h-4 text-gray-500"/> Đổi mật khẩu
                        </label>
                    </div>

                    {changePassword && (
                        <div className="grid grid-cols-1 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 animate-fade-in-down">
                            <div>
                                <label className={labelClasses}>Mật khẩu mới</label>
                                <input 
                                    type="password" 
                                    value={newPassword} 
                                    onChange={e => setNewPassword(e.target.value)} 
                                    className={inputClasses}
                                    placeholder="Ít nhất 6 ký tự"
                                />
                            </div>
                            <div>
                                <label className={labelClasses}>Xác nhận mật khẩu</label>
                                <input 
                                    type="password" 
                                    value={confirmPassword} 
                                    onChange={e => setConfirmPassword(e.target.value)} 
                                    className={inputClasses}
                                    placeholder="Nhập lại mật khẩu mới"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button type="button" onClick={() => setIsProfileModalOpen(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">Hủy</button>
                    <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-focus shadow-sm text-sm font-bold transition-colors">Lưu thay đổi</button>
                </div>
            </form>
        </Modal>
    )
  }

  const role = currentUser.Role;
  const isAdmin = role === 'Admin';
  const isAccountant = role === 'Accountant';

  return (
    <header className="w-full bg-white border-b border-gray-200 flex items-center justify-between p-4 flex-shrink-0 h-[88px]">
      {isProfileModalOpen && <ProfileModal />}
      <h1 className="text-2xl font-bold text-gray-800 hidden sm:block">
        {pageTitle}
      </h1>
      <div className="flex items-center gap-4 ml-auto">
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
                    {/* Display Name takes priority, then Username, then Email part */}
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
