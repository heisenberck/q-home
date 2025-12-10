import React, { useState } from 'react';
import type { Owner, UserPermission } from '../../../types';
import { useAuth } from '../../../App';
import { ArrowRightOnRectangleIcon, UserCircleIcon, UploadIcon } from '../../ui/Icons';

interface PortalProfilePageProps {
    user: UserPermission;
    owner: Owner;
    onUpdateOwner: (owner: Owner) => void;
    onChangePassword: () => void;
}

const PortalProfilePage: React.FC<PortalProfilePageProps> = ({ user, owner, onUpdateOwner, onChangePassword }) => {
    const { logout } = useAuth();
    const [formData, setFormData] = useState({
        OwnerName: owner.OwnerName || '',
        Phone: owner.Phone || '',
        Email: owner.Email || '',
        title: owner.title || 'Anh',
        avatarUrl: owner.avatarUrl || ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setFormData(prev => ({ ...prev, avatarUrl: event.target?.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdateOwner({ ...owner, ...formData });
    };

    const inputStyle = "w-full p-3 border rounded-lg bg-gray-50 border-gray-300 text-gray-900 focus:ring-primary focus:border-primary";

    return (
        <div className="p-4 space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                <div className="flex flex-col items-center text-center space-y-2">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-gray-200 overflow-hidden">
                           {formData.avatarUrl ? (
                                <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover"/>
                           ) : (
                                <UserCircleIcon className="w-full h-full text-gray-400"/>
                           )}
                        </div>
                        <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-primary p-2 rounded-full cursor-pointer hover:bg-primary-focus">
                            <UploadIcon className="w-4 h-4 text-white" />
                        </label>
                        <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </div>
                    <h2 className="text-xl font-bold">{owner.OwnerName}</h2>
                    <p className="text-sm text-gray-500">Căn hộ {user.residentId}</p>
                </div>
                
                <form onSubmit={handleSave} className="space-y-4 pt-4 border-t">
                    <h3 className="font-bold text-lg">Chỉnh sửa hồ sơ</h3>
                    <div>
                        <label className="font-medium text-sm">Danh xưng</label>
                        <select name="title" value={formData.title} onChange={handleChange} className={inputStyle}>
                            <option value="Anh">Anh</option>
                            <option value="Chị">Chị</option>
                            <option value="Ông">Ông</option>
                            <option value="Bà">Bà</option>
                        </select>
                    </div>
                    <div>
                        <label className="font-medium text-sm">Họ và tên</label>
                        <input name="OwnerName" value={formData.OwnerName} onChange={handleChange} className={inputStyle} />
                    </div>
                     <div>
                        <label className="font-medium text-sm">Số điện thoại</label>
                        <input name="Phone" value={formData.Phone} onChange={handleChange} className={inputStyle} />
                    </div>
                    <div>
                        <label className="font-medium text-sm">Email</label>
                        <input type="email" name="Email" value={formData.Email} onChange={handleChange} className={inputStyle} />
                    </div>
                    <button type="submit" className="w-full p-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-focus">Lưu thay đổi</button>
                </form>

                <div className="pt-4 border-t space-y-3">
                    <button type="button" onClick={onChangePassword} className="w-full text-left p-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-gray-800">Đổi mật khẩu</button>
                     <button type="button" onClick={logout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100">
                        <ArrowRightOnRectangleIcon className="w-5 h-5" /> Đăng xuất
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PortalProfilePage;