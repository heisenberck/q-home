
import React, { useState, useEffect, useMemo } from 'react';
import type { Owner, UserPermission, ProfileRequest, Unit } from '../../../types';
import { useAuth, useNotification } from '../../../App';
import { ArrowRightOnRectangleIcon, UserCircleIcon, UploadIcon, WarningIcon, CheckCircleIcon } from '../../ui/Icons';
import { submitUserProfileUpdate, getPendingProfileRequest, updateResidentAvatar } from '../../../services';
import { useSmartSystemData } from '../../../hooks/useSmartData';
import { isProduction } from '../../../utils/env';

interface PortalProfilePageProps {
    user: UserPermission;
    owner: Owner;
    onUpdateOwner: (owner: Owner) => void;
    onChangePassword: () => void;
}

const PortalProfilePage: React.FC<PortalProfilePageProps> = ({ user, owner, onUpdateOwner, onChangePassword }) => {
    const { logout } = useAuth();
    const { showToast } = useNotification();
    const { units, refreshSystemData } = useSmartSystemData(); 
    const IS_PROD = isProduction();

    const currentUnit = useMemo(() => units.find(u => u.UnitID === user.residentId), [units, user.residentId]);

    const [pendingRequest, setPendingRequest] = useState<ProfileRequest | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Initial Form State
    const [formData, setFormData] = useState({
        OwnerName: owner.OwnerName || '',
        Phone: owner.Phone || '',
        Email: owner.Email || '',
        title: owner.title || 'Anh',
        secondOwnerName: owner.secondOwnerName || '',
        secondOwnerPhone: owner.secondOwnerPhone || '',
        UnitStatus: currentUnit?.Status || 'Owner',
    });

    useEffect(() => {
        const checkPending = async () => {
            if (!IS_PROD || !user.residentId) return;
            const request = await getPendingProfileRequest(user.residentId);
            if (request) {
                setPendingRequest(request);
            }
        };
        checkPending();
    }, [IS_PROD, user.residentId]);

    const isLocked = !!pendingRequest;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    // Updated: Uses the new submitUserProfileUpdate which handles both Instant UI Update + Admin Request
    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast('Kích thước ảnh phải nhỏ hơn 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            
            // Optimistic UI Update
            onUpdateOwner({ ...owner, avatarUrl: base64 });
            
            if (!IS_PROD) {
                showToast('Đã cập nhật (Mock Mode)', 'success');
                return;
            }

            try {
                showToast('Đang cập nhật ảnh...', 'info');
                // Use the new consolidated function even for just Avatar
                await submitUserProfileUpdate(
                    user.Email,
                    user.residentId!,
                    owner.OwnerID,
                    { avatarUrl: base64 }
                );
                
                showToast('Cập nhật ảnh đại diện thành công!', 'success');
                refreshSystemData(true);
            } catch (error) {
                console.error(error);
                showToast('Lỗi khi cập nhật ảnh.', 'error');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!IS_PROD) {
            onUpdateOwner({ ...owner, ...formData });
            showToast('Đã lưu (Mock Mode)', 'success');
            return;
        }

        // Detect Changes
        const changes: any = {};
        if (formData.OwnerName !== owner.OwnerName) changes.displayName = formData.OwnerName;
        if (formData.Phone !== owner.Phone) changes.phoneNumber = formData.Phone;
        if (formData.Email !== owner.Email) changes.contactEmail = formData.Email;
        if (formData.secondOwnerName !== owner.secondOwnerName) changes.spouseName = formData.secondOwnerName;
        if (formData.secondOwnerPhone !== owner.secondOwnerPhone) changes.spousePhone = formData.secondOwnerPhone;
        
        if (currentUnit && formData.UnitStatus !== currentUnit.Status) {
            changes.unitStatus = formData.UnitStatus as any;
        }

        if (Object.keys(changes).length === 0) {
            showToast('Không có thay đổi nào.', 'info');
            return;
        }

        setIsLoading(true);
        try {
            // Call the ONE-WAY FLOW service
            const newReq = await submitUserProfileUpdate(
                user.Email,
                user.residentId!,
                owner.OwnerID,
                changes
            );

            setPendingRequest(newReq);
            // Also refresh local data so the user sees the "Instant Update" on their profile UI immediately
            // (Note: The onUpdateOwner prop updates the parent state, but refreshSystemData ensures consistency)
            refreshSystemData(true); 
            
            showToast('Đã cập nhật hồ sơ và gửi yêu cầu xác nhận tới BQL.', 'success');
        } catch (error) {
            console.error(error);
            showToast('Lỗi khi lưu hồ sơ.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const inputStyle = `w-full p-3 border rounded-lg bg-gray-50 border-gray-300 text-gray-900 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed`;

    return (
        <div className="p-4 space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                
                {isLocked && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
                        <WarningIcon className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-orange-800 text-sm">Thông tin đang chờ xác nhận</h4>
                            <p className="text-xs text-orange-700 mt-1">
                                Bạn đã cập nhật thông tin. Thay đổi hiển thị ngay với bạn, nhưng cần BQL duyệt để áp dụng vào hồ sơ chính thức.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col items-center text-center space-y-2">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-gray-200 overflow-hidden">
                           {owner.avatarUrl ? (
                                <img src={owner.avatarUrl} alt="Avatar" className="w-full h-full object-cover"/>
                           ) : (
                                <UserCircleIcon className="w-full h-full text-gray-400"/>
                           )}
                        </div>
                        <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-primary p-2 rounded-full cursor-pointer hover:bg-primary-focus shadow-md transition-transform hover:scale-105" title="Đổi ảnh đại diện">
                            <UploadIcon className="w-4 h-4 text-white" />
                        </label>
                        <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </div>
                    {/* User display name from USER object (instant update), falling back to Owner object */}
                    <h2 className="text-xl font-bold">{user.DisplayName || owner.OwnerName}</h2>
                    <p className="text-sm text-gray-500">Căn hộ {user.residentId}</p>
                </div>
                
                <form onSubmit={handleSave} className="space-y-4 pt-4 border-t">
                    <h3 className="font-bold text-lg">Chỉnh sửa hồ sơ</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                            <label className="font-medium text-sm text-gray-700">Danh xưng</label>
                            <select name="title" value={formData.title} onChange={handleChange} className={inputStyle} disabled={isLocked}>
                                <option value="Anh">Anh</option>
                                <option value="Chị">Chị</option>
                                <option value="Ông">Ông</option>
                                <option value="Bà">Bà</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="font-medium text-sm text-gray-700">Họ và tên</label>
                            <input name="OwnerName" value={formData.OwnerName} onChange={handleChange} className={inputStyle} disabled={isLocked} />
                        </div>
                    </div>
                    
                    <div>
                        <label className="font-medium text-sm text-gray-700">Số điện thoại</label>
                        <input name="Phone" value={formData.Phone} onChange={handleChange} className={inputStyle} disabled={isLocked} />
                    </div>
                    <div>
                        <label className="font-medium text-sm text-gray-700">Email (Đăng nhập/Liên hệ)</label>
                        <input type="email" name="Email" value={formData.Email} onChange={handleChange} className={inputStyle} disabled={isLocked} />
                    </div>

                    <div>
                        <label className="font-medium text-sm text-gray-700">Tình trạng căn hộ</label>
                        <select name="UnitStatus" value={formData.UnitStatus} onChange={handleChange} className={inputStyle} disabled={isLocked}>
                            <option value="Owner">Chính chủ ở</option>
                            <option value="Rent">Cho thuê</option>
                            <option value="Business">Kinh doanh / Để trống</option>
                        </select>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-3">Thông tin Vợ/Chồng/Khách thuê</p>
                        <div className="space-y-4">
                            <div>
                                <label className="font-medium text-sm text-gray-700">Họ và tên</label>
                                <input name="secondOwnerName" value={formData.secondOwnerName} onChange={handleChange} className={inputStyle} placeholder="Chưa có thông tin" disabled={isLocked} />
                            </div>
                            <div>
                                <label className="font-medium text-sm text-gray-700">Số điện thoại liên hệ</label>
                                <input name="secondOwnerPhone" value={formData.secondOwnerPhone} onChange={handleChange} className={inputStyle} placeholder="Chưa có thông tin" disabled={isLocked} />
                            </div>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLocked || isLoading} 
                        className={`w-full p-3 font-bold rounded-lg transition-all ${
                            isLocked 
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'bg-primary text-white hover:bg-primary-focus shadow-md'
                        }`}
                    >
                        {isLocked ? 'Đang chờ duyệt...' : (isLoading ? 'Đang gửi...' : 'Lưu thay đổi')}
                    </button>
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
