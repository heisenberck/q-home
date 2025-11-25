
import React, { useState, useRef, useEffect } from 'react';
import { UserCircleIcon, CheckCircleIcon, ArrowRightOnRectangleIcon, UserIcon, KeyIcon, UploadIcon, TrashIcon } from '../ui/Icons';
import type { UserPermission } from '../../types';
import { useAuth, useNotification } from '../../App';
import Modal from '../ui/Modal';

interface HeaderProps {
  pageTitle: string;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  currentUser: UserPermission;
  allUsers: UserPermission[];
  onSwitchUserRequest: (user: UserPermission) => void;
}

const Header: React.FC<HeaderProps> = ({ pageTitle, currentUser, allUsers, onSwitchUserRequest }) => {
  const { logout, updateUser } = useAuth();
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

  const handleSelectUser = (user: UserPermission) => {
      setIsMenuOpen(false);
      if (user.Email !== currentUser.Email) {
          onSwitchUserRequest(user);
      }
  };

  const getUsername = (user: UserPermission) => user.Username || user.Email.split('@')[0];

  const ProfileModal = () => {
    const [formData, setFormData] = useState({ 
        Email: currentUser.Email, 
        Username: currentUser.Username || '',
        avatarUrl: currentUser.avatarUrl || ''
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB Limit before compression
                showToast('Kích thước ảnh gốc phải nhỏ hơn 5MB.', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const MAX_WIDTH = 256;
                    const MAX_HEIGHT = 256;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        showToast('Không thể xử lý ảnh.', 'error');
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // 80% quality JPEG

                    const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
                    const padding = (dataUrl.charAt(dataUrl.length - 2) === '=') ? 2 : ((dataUrl.charAt(dataUrl.length - 1) === '=') ? 1 : 0);
                    const fileSizeInBytes = base64Length * 0.75 - padding;

                    if (fileSizeInBytes > 200 * 1024) { // Check if it's over 200KB
                         showToast('Ảnh sau khi nén vẫn lớn hơn 200KB. Vui lòng chọn ảnh khác.', 'warn');
                    }
                    
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
        // Check uniqueness exclude self
        const emailExists = allUsers.some(u => u.Email === formData.Email && u.Email !== currentUser.Email);
        if (emailExists) {
            showToast('Email đã được sử dụng.', 'error');
            return;
        }
        const usernameExists = allUsers.some(u => u.Username === formData.Username && u.Username !== currentUser.Username);
        if (usernameExists && formData.Username) {
            showToast('Tên đăng nhập đã được sử dụng.', 'error');
            return;
        }

        updateUser({ ...currentUser, ...formData });
        showToast('Cập nhật thông tin thành công.', 'success');
        setIsProfileModalOpen(false);
    };

    const inputClasses = "w-full p-2 border rounded-md bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm transition-colors";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

    return (
        <Modal title="Hồ sơ cá nhân" onClose={() => setIsProfileModalOpen(false)} size="md">
            <form onSubmit={handleSave} className="space-y-6">
                {/* Avatar Upload Section */}
                <div className="flex flex-col items-center gap-3">
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600 shadow-inner bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            {formData.avatarUrl ? (
                                <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <UserCircleIcon className="w-24 h-24 text-gray-400" />
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
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                            <TrashIcon className="w-3 h-3" /> Xoá ảnh
                        </button>
                    )}
                </div>

                <div>
                    <label className={labelClasses}>Email</label>
                    <input type="email" value={formData.Email} onChange={e => setFormData({...formData, Email: e.target.value})} required className={inputClasses}/>
                </div>
                <div>
                    <label className={labelClasses}>Tên đăng nhập</label>
                    <input type="text" value={formData.Username} onChange={e => setFormData({...formData, Username: e.target.value})} className={inputClasses} placeholder="Đặt tên đăng nhập"/>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-600">
                    <button type="button" onClick={() => setIsProfileModalOpen(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Hủy</button>
                    <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-focus">Lưu thay đổi</button>
                </div>
            </form>
        </Modal>
    )
  }

  return (
    <header className="w-full bg-light-bg-secondary dark:bg-dark-bg-secondary border-b border-light-border dark:border-dark-border flex items-center justify-between p-4 flex-shrink-0">
      {isProfileModalOpen && <ProfileModal />}
      <h1 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary hidden sm:block">
        {pageTitle}
      </h1>
      <div className="flex items-center gap-4">
        <div ref={menuRef} className="relative">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="user-menu-button">
                {currentUser.avatarUrl ? (
                    <img 
                        src={currentUser.avatarUrl} 
                        alt="Avatar" 
                        className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-600 shadow-sm"
                    />
                ) : (
                    <UserCircleIcon className="w-8 h-8 text-gray-500" />
                )}
                <div className="text-left hidden md:block">
                    <p className="text-sm font-semibold">{getUsername(currentUser)}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{currentUser.Role}</p>
                </div>
            </button>
            {isMenuOpen && (
                <div className="user-menu-dropdown">
                    <div className="p-3 border-b dark:border-dark-border">
                        <p className="text-sm font-semibold">Signed in as</p>
                        <p className="text-sm truncate font-bold">{currentUser.Email}</p>
                    </div>
                    
                    {/* Profile Action */}
                    <button 
                         onClick={() => { setIsMenuOpen(false); setIsProfileModalOpen(true); }}
                         className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-bg-secondary transition-colors"
                    >
                         <UserIcon className="w-5 h-5 mr-2 text-gray-500" />
                         Hồ sơ cá nhân
                    </button>

                    <div className="py-1 max-h-64 overflow-y-auto border-t dark:border-dark-border">
                        <p className="px-4 py-1 text-xs text-gray-500 uppercase font-bold mt-1">Switch Account</p>
                        {allUsers.map(user => (
                            <button
                                key={user.Email}
                                onClick={() => handleSelectUser(user)}
                                disabled={user.status !== 'Active'}
                                className={`user-menu-item ${currentUser.Email === user.Email ? 'active' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <div className="flex-1 text-left flex items-center gap-2">
                                     {user.avatarUrl ? (
                                        <img src={user.avatarUrl} className="w-6 h-6 rounded-full object-cover" alt="" />
                                    ) : (
                                        <UserCircleIcon className="w-6 h-6 text-gray-400" />
                                    )}
                                    <div>
                                        <p className="font-semibold text-sm">{getUsername(user)}</p>
                                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary leading-none">{user.Role}</p>
                                    </div>
                                </div>
                                {currentUser.Email === user.Email && <CheckCircleIcon className="w-5 h-5 text-primary" />}
                            </button>
                        ))}
                    </div>
                    <div className="border-t dark:border-dark-border">
                        <button 
                            onClick={() => { setIsMenuOpen(false); logout(); }}
                            className="flex items-center w-full px-4 py-3 text-sm text-left text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-dark-bg-secondary transition-colors"
                        >
                            <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
                            Sign out
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
