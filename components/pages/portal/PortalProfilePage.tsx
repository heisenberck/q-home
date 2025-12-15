
import React, { useState, useEffect, useMemo } from 'react';
import type { Owner, UserPermission, ProfileRequest } from '../../../types';
import { useAuth, useNotification } from '../../../App';
import { 
    ArrowRightOnRectangleIcon, UserCircleIcon, UploadIcon, WarningIcon, 
    PencilSquareIcon, CheckCircleIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon,
    UserIcon, PhoneArrowUpRightIcon, EnvelopeIcon, HomeIcon, KeyIcon
} from '../../ui/Icons';
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

    // --- Local State ---
    const [pendingRequest, setPendingRequest] = useState<ProfileRequest | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false); // Mode State
    const [isExpanded, setIsExpanded] = useState(true); // Collapsible State

    // Initialize Form Data
    const [formData, setFormData] = useState({
        DisplayName: user.DisplayName || owner.OwnerName || '',
        Phone: owner.Phone || '',
        Email: user.contact_email || owner.Email || '',
        title: owner.title || 'Anh',
        secondOwnerName: owner.secondOwnerName || '',
        secondOwnerPhone: owner.secondOwnerPhone || '',
        UnitStatus: currentUnit?.Status || 'Owner',
    });

    // Sync state when props change (only if not editing)
    useEffect(() => {
        if (!isEditing) {
            setFormData({
                DisplayName: user.DisplayName || owner.OwnerName || '',
                Phone: owner.Phone || '',
                Email: user.contact_email || owner.Email || '',
                title: owner.title || 'Anh',
                secondOwnerName: owner.secondOwnerName || '',
                secondOwnerPhone: owner.secondOwnerPhone || '',
                UnitStatus: currentUnit?.Status || 'Owner',
            });
        }
    }, [user, owner, currentUnit, isEditing]);

    useEffect(() => {
        const checkPending = async () => {
            if (!IS_PROD || !user.residentId) return;
            const request = await getPendingProfileRequest(user.residentId);
            if (request) setPendingRequest(request);
        };
        checkPending();
    }, [IS_PROD, user.residentId]);

    // --- Handlers ---

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleCancel = () => {
        setIsEditing(false);
        setFormData({
            DisplayName: user.DisplayName || owner.OwnerName || '',
            Phone: owner.Phone || '',
            Email: user.contact_email || owner.Email || '',
            title: owner.title || 'Anh',
            secondOwnerName: owner.secondOwnerName || '',
            secondOwnerPhone: owner.secondOwnerPhone || '',
            UnitStatus: currentUnit?.Status || 'Owner',
        });
    };
    
    // Updated: Avatar Change now calls updateResidentAvatar directly (Dual Sync)
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
                showToast('Đã cập nhật ảnh (Mock Mode)', 'success');
                return;
            }

            try {
                showToast('Đang cập nhật ảnh...', 'info');
                // Call Direct Update (No Request creation)
                await updateResidentAvatar(owner.OwnerID, base64, user.Email);
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
            onUpdateOwner({ ...owner, OwnerName: formData.DisplayName, Phone: formData.Phone, Email: formData.Email });
            setIsEditing(false);
            showToast('Đã lưu (Mock Mode)', 'success');
            return;
        }

        // Detect Changes
        const changes: any = {};
        if (formData.DisplayName !== (user.DisplayName || owner.OwnerName)) changes.displayName = formData.DisplayName;
        if (formData.Phone !== owner.Phone) changes.phoneNumber = formData.Phone;
        if (formData.Email !== (user.contact_email || owner.Email)) changes.contactEmail = formData.Email;
        
        // Map Secondary Contact Fields
        if (formData.secondOwnerName !== owner.secondOwnerName) changes.spouseName = formData.secondOwnerName;
        if (formData.secondOwnerPhone !== owner.secondOwnerPhone) changes.spousePhone = formData.secondOwnerPhone;
        
        if (currentUnit && formData.UnitStatus !== currentUnit.Status) changes.unitStatus = formData.UnitStatus as any;

        if (Object.keys(changes).length === 0) {
            setIsEditing(false);
            showToast('Không có thay đổi nào.', 'info');
            return;
        }

        setIsLoading(true);
        try {
            const newReq = await submitUserProfileUpdate(user.Email, user.residentId!, owner.OwnerID, changes);
            setPendingRequest(newReq);
            refreshSystemData(true); 
            setIsEditing(false);
            showToast('Đã lưu hồ sơ và gửi yêu cầu cập nhật tới BQL.', 'success');
        } catch (error) {
            console.error(error);
            showToast('Lỗi khi lưu hồ sơ.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Dynamic Styles for View vs Edit ---
    const getFieldClass = (editable: boolean) => {
        return editable 
            ? "w-full p-2.5 border rounded-lg bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm"
            : "w-full p-2.5 bg-transparent border-none text-gray-800 font-semibold px-0"; // "View Mode" look
    };

    return (
        <div className="p-4 space-y-6 pb-24">
            
            {/* 1. Header Card (Avatar & Status) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-3 relative">
                {pendingRequest && (
                    <div className="absolute top-4 left-4 right-4 bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded-lg flex items-center gap-2 text-xs md:text-sm animate-fade-in-down">
                        <WarningIcon className="w-5 h-5 flex-shrink-0" />
                        <span>Có yêu cầu cập nhật đang chờ BQL duyệt.</span>
                    </div>
                )}

                <div className="relative group mt-6">
                    <div className="w-28 h-28 rounded-full bg-gray-100 border-4 border-white shadow-md overflow-hidden">
                       {owner.avatarUrl ? (
                            <img src={owner.avatarUrl} alt="Avatar" className="w-full h-full object-cover"/>
                       ) : (
                            <UserCircleIcon className="w-full h-full text-gray-300"/>
                       )}
                    </div>
                    {/* Avatar Upload is ALWAYS active, decoupled from form editing */}
                    <label htmlFor="avatar-upload" className="absolute bottom-1 right-1 bg-white text-gray-600 p-2 rounded-full cursor-pointer hover:text-primary shadow-md border border-gray-200 transition-transform hover:scale-105" title="Đổi ảnh ngay">
                        <UploadIcon className="w-4 h-4" />
                    </label>
                    <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{user.DisplayName || owner.OwnerName}</h2>
                    <p className="text-sm text-gray-500 font-medium">Căn hộ {user.residentId}</p>
                </div>
            </div>

            {/* 2. Collapsible Profile Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ease-in-out">
                {/* Header / Toggle */}
                <div 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-100"
                >
                    <div className="flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-gray-800">Thông tin cá nhân</h3>
                    </div>
                    {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
                </div>

                {/* Form Body */}
                {isExpanded && (
                    <div className="p-5 animate-fade-in-down">
                        <form onSubmit={handleSave} className="space-y-6">
                            
                            {/* Section 1: Main Contact */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Danh xưng</label>
                                        {isEditing ? (
                                            <select name="title" value={formData.title} onChange={handleChange} className={getFieldClass(true)}>
                                                <option value="Anh">Anh</option>
                                                <option value="Chị">Chị</option>
                                                <option value="Ông">Ông</option>
                                                <option value="Bà">Bà</option>
                                            </select>
                                        ) : (
                                            <div className={getFieldClass(false)}>{formData.title}</div>
                                        )}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Họ và tên Chủ hộ</label>
                                        <input 
                                            name="DisplayName" 
                                            value={formData.DisplayName} 
                                            onChange={handleChange} 
                                            disabled={!isEditing} 
                                            className={getFieldClass(isEditing)}
                                            placeholder="Nhập họ tên hiển thị" 
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                                            Số điện thoại <PhoneArrowUpRightIcon className="w-3 h-3"/>
                                        </label>
                                        <input 
                                            name="Phone" 
                                            value={formData.Phone} 
                                            onChange={handleChange} 
                                            disabled={!isEditing} 
                                            className={getFieldClass(isEditing)}
                                            placeholder="Nhập số điện thoại" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                                            Email liên hệ <EnvelopeIcon className="w-3 h-3"/>
                                        </label>
                                        <input 
                                            type="email" 
                                            name="Email" 
                                            value={formData.Email} 
                                            onChange={handleChange} 
                                            disabled={!isEditing} 
                                            className={getFieldClass(isEditing)}
                                            placeholder="email@example.com" 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Secondary Contact (New Section) */}
                            <div className="border-t border-gray-100 pt-4 space-y-4">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Người liên hệ thứ 2</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Họ tên Vợ/Chồng/Khách thuê</label>
                                        <input 
                                            name="secondOwnerName" 
                                            value={formData.secondOwnerName} 
                                            onChange={handleChange} 
                                            disabled={!isEditing} 
                                            className={getFieldClass(isEditing)}
                                            placeholder={isEditing ? "Nhập tên người liên hệ 2" : "Chưa cập nhật"} 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">SĐT Vợ/Chồng/Khách thuê</label>
                                        <input 
                                            name="secondOwnerPhone" 
                                            value={formData.secondOwnerPhone} 
                                            onChange={handleChange} 
                                            disabled={!isEditing} 
                                            className={getFieldClass(isEditing)}
                                            placeholder={isEditing ? "Nhập SĐT người liên hệ 2" : "Chưa cập nhật"} 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Unit Status */}
                            <div className="pt-4 border-t border-gray-100">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Tình trạng căn hộ</label>
                                {isEditing ? (
                                    <select name="UnitStatus" value={formData.UnitStatus} onChange={handleChange} className={getFieldClass(true)}>
                                        <option value="Owner">Chính chủ đang ở</option>
                                        <option value="Rent">Cho thuê</option>
                                        <option value="Business">Kinh doanh / Để trống</option>
                                    </select>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                            formData.UnitStatus === 'Owner' ? 'bg-green-100 text-green-700' : 
                                            formData.UnitStatus === 'Rent' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                        }`}>
                                            {formData.UnitStatus === 'Owner' ? 'Chính chủ' : formData.UnitStatus === 'Rent' ? 'Cho thuê' : 'Kinh doanh'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                                {!isEditing ? (
                                    <button 
                                        type="button" 
                                        onClick={() => setIsEditing(true)}
                                        className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 hover:text-primary transition-all flex items-center gap-2 text-sm"
                                    >
                                        <PencilSquareIcon className="w-4 h-4" /> Chỉnh sửa
                                    </button>
                                ) : (
                                    <>
                                        <button 
                                            type="button" 
                                            onClick={handleCancel}
                                            disabled={isLoading}
                                            className="px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm"
                                        >
                                            Hủy bỏ
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={isLoading}
                                            className="px-5 py-2.5 bg-primary text-white font-bold rounded-lg shadow-md hover:bg-primary-focus transition-all flex items-center gap-2 text-sm disabled:opacity-70"
                                        >
                                            {isLoading ? 'Đang lưu...' : <><CheckCircleIcon className="w-4 h-4"/> Lưu thay đổi</>}
                                        </button>
                                    </>
                                )}
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* 3. Account Actions */}
            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                <button type="button" onClick={onChangePassword} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-lg transition-colors group text-left">
                    <div className="p-2 bg-gray-100 rounded-full group-hover:bg-white group-hover:shadow-sm transition-all"><KeyIcon className="w-5 h-5 text-gray-600"/></div>
                    <span className="font-semibold text-gray-700 flex-grow">Đổi mật khẩu</span>
                    <ChevronDownIcon className="w-4 h-4 text-gray-400 -rotate-90" />
                </button>
                <div className="h-px bg-gray-100 mx-4"></div>
                <button type="button" onClick={logout} className="w-full flex items-center gap-3 p-4 hover:bg-red-50 rounded-lg transition-colors group text-left">
                    <div className="p-2 bg-red-50 rounded-full group-hover:bg-white group-hover:shadow-sm transition-all"><ArrowRightOnRectangleIcon className="w-5 h-5 text-red-600"/></div>
                    <span className="font-semibold text-red-600 flex-grow">Đăng xuất</span>
                </button>
            </div>
        </div>
    );
};

export default PortalProfilePage;
