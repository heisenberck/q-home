import React, { useState, useRef, useEffect } from 'react';
import { UserCircleIcon, ArrowRightOnRectangleIcon, UserIcon, UploadIcon, TrashIcon } from '../ui/Icons';
import type { UserPermission } from '../../types';
import { useAuth, useNotification } from '../../App';
import Modal from '../ui/Modal';

interface HeaderProps {
  pageTitle: string;
}

const Header: React.FC<HeaderProps> = ({ pageTitle }) => {
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

  const ProfileModal = () => {
    const [formData, setFormData] = useState({ 
        Username: currentUser.Username || '',
        avatarUrl: currentUser.avatarUrl || ''
    });

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
        updateUser({ ...currentUser, ...formData });
        showToast('Cập nhật thông tin thành công.', 'success');
        setIsProfileModalOpen(false);
    };

    const inputClasses = "w-full p-2 border rounded-md bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm transition-colors";
    const labelClasses = "block text-sm font-medium text-gray-700 mb-1";

    return (
        <Modal title="Hồ sơ cá nhân" onClose={() => setIsProfileModalOpen(false)} size="md">
            <form onSubmit={handleSave} className="space-y-6">
                <div className="flex flex-col items-center gap-3">
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 shadow-inner bg-gray-100 flex items-center justify-center">
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
                    <input type="email" value={currentUser.Email} disabled required className={`${inputClasses} bg-gray-100 cursor-not-allowed`}/>
                </div>
                <div>
                    <label className={labelClasses}>Tên đăng nhập</label>
                    <input type="text" value={formData.Username} onChange={e => setFormData({...formData, Username: e.target.value})} className={inputClasses} placeholder="Đặt tên đăng nhập"/>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <button type="button" onClick={() => setIsProfileModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
                    <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-focus">Lưu thay đổi</button>
                </div>
            </form>
        </Modal>
    )
  }

  return (
    <header className="w-full bg-white border-b border-gray-200 flex items-center justify-between p-4 flex-shrink-0">
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
                        className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                ) : (
                    <UserCircleIcon className="w-8 h-8 text-gray-500" />
                )}
                <div className="text-left hidden md:block">
                    <p className="text-sm font-semibold">{getUsername(currentUser)}</p>
                    <p className="text-xs text-gray-500">{currentUser.Role}</p>
                </div>
            </button>
            {isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border z-40 animate-fade-in-down">
                    <div className="p-3 border-b">
                        <p className="text-sm font-semibold">Đang đăng nhập với</p>
                        <p className="text-sm truncate font-bold">{currentUser.Email}</p>
                    </div>
                    
                    <button 
                         onClick={() => { setIsMenuOpen(false); setIsProfileModalOpen(true); }}
                         className="flex items-center w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-100"
                    >
                         <UserIcon className="w-5 h-5 mr-3 text-gray-500" />
                         Hồ sơ cá nhân
                    </button>

                    <div className="border-t">
                        <button 
                            onClick={() => { setIsMenuOpen(false); logout(); }}
                            className="flex items-center w-full px-4 py-3 text-sm text-left text-red-600 hover:bg-red-50"
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