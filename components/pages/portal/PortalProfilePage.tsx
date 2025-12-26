// Added missing React import
import React, { useState, useEffect, useMemo } from 'react';
import type { Owner, UserPermission, ProfileRequest, Vehicle } from '../../../types';
import { useAuth, useNotification } from '../../../App';
import { 
    ArrowRightOnRectangleIcon, UserCircleIcon, UploadIcon, WarningIcon, 
    PencilSquareIcon, CheckCircleIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon,
    UserIcon, PhoneArrowUpRightIcon, EnvelopeIcon, HomeIcon, KeyIcon,
    CarIcon, MotorbikeIcon, EBikeIcon, BikeIcon, ShieldCheckIcon, ClockIcon,
    CheckIcon
} from '../../ui/Icons';
import { submitUserProfileUpdate, getPendingProfileRequest, updateResidentAvatar, saveVehicles } from '../../../services';
import { useSmartSystemData } from '../../../hooks/useSmartData';
import { isProduction } from '../../../utils/env';
import { translateVehicleType } from '../../../utils/helpers';
import Spinner from '../../ui/Spinner';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';

interface PortalProfilePageProps {
    user: UserPermission;
    owner: Owner | null;
    onUpdateOwner: (owner: Owner) => void;
    onChangePassword: () => void;
}

const VehicleItem: React.FC<{ 
    vehicle: Vehicle, 
    onUpdateName: (v: Vehicle, newName: string) => Promise<void> 
}> = ({ vehicle, onUpdateName }) => {
    const [tempName, setTempName] = useState(vehicle.VehicleName || '');
    const [isSaving, setIsSaving] = useState(false);
    const isCar = vehicle.Type === 'car' || vehicle.Type === 'car_a';
    const hasChanged = tempName !== (vehicle.VehicleName || '');

    const getIcon = () => {
        switch (vehicle.Type) {
            case 'car':
            case 'car_a': return <CarIcon className="w-5 h-5 text-blue-600" />;
            case 'motorbike': return <MotorbikeIcon className="w-5 h-5 text-orange-600" />;
            case 'ebike': return <EBikeIcon className="w-5 h-5 text-emerald-600" />;
            case 'bicycle': return <BikeIcon className="w-5 h-5 text-purple-600" />;
            default: return <CarIcon className="w-5 h-5" />;
        }
    };

    const getStatusBadge = () => {
        if (!isCar) return null;

        if (vehicle.parkingStatus === 'Lốt chính') {
            return <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-green-100 text-green-700 rounded-md border border-green-200">Lốt chính</span>;
        }
        if (vehicle.parkingStatus === 'Lốt tạm') {
            return <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-blue-100 text-blue-700 rounded-md border border-blue-200">Lốt phụ</span>;
        }
        if (vehicle.parkingStatus === 'Xếp lốt') {
            return <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-red-100 text-red-700 rounded-md border border-red-200">Đang chờ</span>;
        }
        return null;
    };

    const handleSave = async () => {
        if (!hasChanged || isSaving) return;
        setIsSaving(true);
        try {
            await onUpdateName(vehicle, tempName);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 group transition-all hover:bg-white hover:shadow-md hover:border-primary/20">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center border border-gray-100 shrink-0 group-hover:scale-105 transition-transform">
                {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <p className="font-mono font-black text-gray-900 tracking-tight text-base uppercase">{vehicle.PlateNumber}</p>
                    {getStatusBadge()}
                </div>
                
                <div className="relative flex items-center gap-2 group/name">
                    <input 
                        type="text" 
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        placeholder={translateVehicleType(vehicle.Type as any)}
                        className={`text-xs font-bold uppercase tracking-tight truncate w-full bg-transparent border-b border-transparent focus:border-primary/30 focus:outline-none py-0.5 transition-all ${hasChanged ? 'text-primary' : 'text-gray-500'}`}
                    />
                    {hasChanged && (
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="shrink-0 p-1 bg-primary text-white rounded-md shadow-sm hover:bg-primary-focus transition-all animate-fade-in-down"
                        >
                            {isSaving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <CheckIcon className="w-3 h-3"/>}
                        </button>
                    )}
                </div>
            </div>
            <div className="text-[10px] text-gray-400 font-bold text-right hidden sm:block">
                <p className="uppercase">Từ ngày</p>
                <p className="text-gray-600">{new Date(vehicle.StartDate).toLocaleDateString('vi-VN')}</p>
            </div>
        </div>
    );
};

const PortalProfilePage: React.FC<PortalProfilePageProps> = ({ user, owner, onUpdateOwner, onChangePassword }) => {
    const { logout } = useAuth();
    const { showToast } = useNotification();
    const { units, vehicles, refreshSystemData } = useSmartSystemData(user); 
    const IS_PROD = isProduction();

    const [formData, setFormData] = useState({
        DisplayName: user?.DisplayName || owner?.OwnerName || '',
        Phone: owner?.Phone || '',
        Email: user?.contact_email || owner?.Email || '',
        title: (user as any)?.title || owner?.title || 'Anh',
        secondOwnerName: owner?.secondOwnerName || '',
        secondOwnerPhone: owner?.secondOwnerPhone || '',
        UnitStatus: 'Owner'
    });

    const currentUnit = useMemo(() => units.find(u => u.UnitID === user.residentId), [units, user.residentId]);
    
    useEffect(() => {
        if (currentUnit) {
            setFormData(prev => ({ ...prev, UnitStatus: currentUnit.Status }));
        }
    }, [currentUnit]);

    const sortedVehicles = useMemo(() => {
        const priority: Record<string, number> = { 'car': 1, 'car_a': 1, 'motorbike': 2, 'ebike': 3, 'bicycle': 4 };
        return [...vehicles]
            .filter(v => v.UnitID === user.residentId && v.isActive)
            .sort((a, b) => {
                const pA = priority[a.Type] || 99;
                const pB = priority[b.Type] || 99;
                if (pA !== pB) return pA - pB;
                return new Date(a.StartDate).getTime() - new Date(b.StartDate).getTime();
            });
    }, [vehicles, user.residentId]);

    const [pendingRequest, setPendingRequest] = useState<ProfileRequest | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isInfoExpanded, setIsInfoExpanded] = useState(true);
    const [isVehiclesExpanded, setIsVehiclesExpanded] = useState(false);

    useEffect(() => {
        if (owner && !isEditing) {
            setFormData({
                DisplayName: user.DisplayName || owner.OwnerName || '',
                Phone: owner.Phone || '',
                Email: user.contact_email || owner.Email || '',
                title: (user as any).title || owner.title || 'Anh',
                secondOwnerName: owner.secondOwnerName || '',
                secondOwnerPhone: owner.secondOwnerPhone || '',
                UnitStatus: currentUnit?.Status || 'Owner',
            });
        }
    }, [user, owner, currentUnit, isEditing]);

    useEffect(() => {
        if (!IS_PROD || !user.residentId) return;

        const q = query(
            collection(db, 'profileRequests'), 
            where('residentId', '==', user.residentId), 
            where('status', '==', 'PENDING'), 
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                setPendingRequest(snapshot.docs[0].data() as ProfileRequest);
            } else {
                setPendingRequest(null);
            }
        });

        return () => unsubscribe();
    }, [IS_PROD, user.residentId]);

    if (!owner) {
        return (
            <div className="p-20 flex flex-col items-center justify-center space-y-4">
                <Spinner />
                <p className="text-sm text-gray-500 font-bold uppercase tracking-widest animate-pulse">Đang tải hồ sơ...</p>
            </div>
        );
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleUpdateVehicleName = async (vehicle: Vehicle, newName: string) => {
        if (!IS_PROD) {
            showToast('Đã cập nhật tên xe (Chế độ Mock)', 'success');
            return;
        }
        try {
            const updatedVehicle = { ...vehicle, VehicleName: newName, updatedAt: new Date().toISOString() };
            await saveVehicles([updatedVehicle], { email: user.Email, role: user.Role }, "Cư dân cập nhật tên xe");
            showToast(`Đã cập nhật thông tin xe ${vehicle.PlateNumber}`, 'success');
            refreshSystemData(true);
        } catch (error) {
            showToast('Lỗi khi cập nhật tên xe.', 'error');
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setFormData({
            DisplayName: user.DisplayName || owner.OwnerName || '',
            Phone: owner.Phone || '',
            Email: user.contact_email || owner.Email || '',
            title: (user as any).title || owner.title || 'Anh',
            secondOwnerName: owner.secondOwnerName || '',
            secondOwnerPhone: owner.secondOwnerPhone || '',
            UnitStatus: currentUnit?.Status || 'Owner',
        });
    };
    
    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            onUpdateOwner({ ...owner, avatarUrl: base64 });
            if (!IS_PROD) {
                showToast('Đã cập nhật ảnh (Mock Mode)', 'success');
                return;
            }
            try {
                showToast('Đang cập nhật ảnh...', 'info');
                await updateResidentAvatar(owner.OwnerID, base64, user.Email);
                showToast('Cập nhật ảnh đại diện thành công!', 'success');
                refreshSystemData(true);
            } catch (error) {
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
        
        const changes: any = {};
        
        if (formData.DisplayName !== (user.DisplayName || owner.OwnerName)) {
            changes.OwnerName = formData.DisplayName;
        }
        
        if (formData.Phone !== owner.Phone) changes.Phone = formData.Phone;
        if (formData.Email !== (user.contact_email || owner.Email)) changes.Email = formData.Email;
        if (formData.title !== (owner.title || 'Anh')) changes.title = formData.title;
        if (formData.secondOwnerName !== (owner.secondOwnerName || '')) changes.secondOwnerName = formData.secondOwnerName;
        if (formData.secondOwnerPhone !== (owner.secondOwnerPhone || '')) changes.secondOwnerPhone = formData.secondOwnerPhone;
        if (formData.UnitStatus !== (currentUnit?.Status || 'Owner')) changes.UnitStatus = formData.UnitStatus;

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
            showToast('Đã gửi yêu cầu cập nhật hồ sơ tới BQL.', 'success');
        } catch (error: any) {
            console.error("Profile update error:", error);
            const errorMsg = error.code === 'permission-denied' 
                ? 'Bạn không có quyền thực hiện thao tác này.' 
                : (error.message || 'Lỗi không xác định.');
            showToast(`Lỗi khi lưu hồ sơ: ${errorMsg}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const getFieldClass = (editable: boolean) => {
        return editable 
            ? "w-full p-2.5 border rounded-lg bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm"
            : "w-full p-2.5 bg-transparent border-none text-gray-800 font-semibold px-0";
    };

    return (
        <div className="p-4 space-y-6 pb-24">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-3 relative">
                {pendingRequest && (
                    <div className="absolute top-4 left-4 right-4 bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded-lg flex items-center gap-2 text-xs md:text-sm animate-fade-in-down">
                        <WarningIcon className="w-5 h-5 flex-shrink-0" />
                        <span>Có yêu cầu cập nhật đang chờ BQL duyệt.</span>
                    </div>
                )}
                <div className="relative group mt-6">
                    <div className="w-28 h-28 rounded-full bg-gray-100 border-4 border-white shadow-md overflow-hidden">
                       {owner.avatarUrl ? <img src={owner.avatarUrl} alt="Avatar" className="w-full h-full object-cover"/> : <UserCircleIcon className="w-full h-full text-gray-300"/>}
                    </div>
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300">
                <div onClick={() => setIsInfoExpanded(!isInfoExpanded)} className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-gray-800">Thông tin cá nhân</h3>
                    </div>
                    {isInfoExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
                </div>
                {isInfoExpanded && (
                    <div className="p-5 animate-fade-in-down">
                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Danh xưng</label>
                                        {isEditing ? (
                                            <select name="title" value={formData.title} onChange={handleChange} className={getFieldClass(true)}>
                                                <option value="Anh">Anh</option><option value="Chị">Chị</option><option value="Ông">Ông</option><option value="Bà">Bà</option>
                                            </select>
                                        ) : <div className={getFieldClass(false)}>{formData.title}</div>}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Họ và tên Chủ hộ</label>
                                        <input name="DisplayName" value={formData.DisplayName} onChange={handleChange} disabled={!isEditing} className={getFieldClass(isEditing)} placeholder="Nhập họ tên hiển thị" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">Số điện thoại <PhoneArrowUpRightIcon className="w-3 h-3"/></label>
                                        <input name="Phone" value={formData.Phone} onChange={handleChange} disabled={!isEditing} className={getFieldClass(isEditing)} placeholder="Nhập số điện thoại" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">Email liên hệ <EnvelopeIcon className="w-3 h-3"/></label>
                                        <input type="email" name="Email" value={formData.Email} onChange={handleChange} disabled={!isEditing} className={getFieldClass(isEditing)} placeholder="email@example.com" />
                                    </div>
                                </div>
                            </div>
                            <div className="border-t border-gray-100 pt-4 space-y-4">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Người liên hệ thứ 2</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Họ tên Vợ/Chồng/Khách thuê</label><input name="secondOwnerName" value={formData.secondOwnerName} onChange={handleChange} disabled={!isEditing} className={getFieldClass(isEditing)} placeholder={isEditing ? "Nhập tên người liên hệ 2" : "Chưa cập nhật"} /></div>
                                    <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">SĐT Vợ/Chồng/Khách thuê</label><input name="secondOwnerPhone" value={formData.secondOwnerPhone} onChange={handleChange} disabled={!isEditing} className={getFieldClass(isEditing)} placeholder={isEditing ? "Nhập SĐT người liên hệ 2" : "Chưa cập nhật"} /></div>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-gray-100">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Tình trạng căn hộ</label>
                                {isEditing ? (
                                    <select name="UnitStatus" value={formData.UnitStatus} onChange={handleChange} className={getFieldClass(true)}>
                                        <option value="Owner">Chính chủ đang ở</option><option value="Rent">Cho thuê</option><option value="Business">Kinh doanh / Để trống</option>
                                    </select>
                                ) : <div className="flex items-center gap-2"><span className={`px-3 py-1 rounded-full text-xs font-bold ${formData.UnitStatus === 'Owner' ? 'bg-green-100 text-green-700' : formData.UnitStatus === 'Rent' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{formData.UnitStatus === 'Owner' ? 'Chính chủ' : formData.UnitStatus === 'Rent' ? 'Cho thuê' : 'Kinh doanh'}</span></div>}
                            </div>
                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                                {!isEditing ? (
                                    <button type="button" onClick={() => setIsEditing(true)} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 hover:text-primary transition-all flex items-center gap-2 text-sm"><PencilSquareIcon className="w-4 h-4" /> Chỉnh sửa</button>
                                ) : <>
                                    <button type="button" onClick={handleCancel} disabled={isLoading} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm">Hủy bỏ</button>
                                    <button type="submit" disabled={isLoading} className="px-5 py-2.5 bg-primary text-white font-bold rounded-lg shadow-md hover:bg-primary-focus transition-all flex items-center gap-2 text-sm disabled:opacity-70">{isLoading ? 'Đang lưu...' : <><CheckCircleIcon className="w-4 h-4"/> Lưu thay đổi</>}</button>
                                </>}
                            </div>
                        </form>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300">
                <div onClick={() => setIsVehiclesExpanded(!isVehiclesExpanded)} className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <CarIcon className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-gray-800">Phương tiện đã đăng ký</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-white px-1.5 py-0.5 rounded border text-gray-400">{sortedVehicles.length} xe</span>
                        {isVehiclesExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
                    </div>
                </div>
                {isVehiclesExpanded && (
                    <div className="p-5 animate-fade-in-down space-y-3">
                        {sortedVehicles.length > 0 ? (
                            <>
                                <div className="space-y-3">
                                    {sortedVehicles.map(vehicle => (
                                        <VehicleItem 
                                            key={vehicle.VehicleId} 
                                            vehicle={vehicle} 
                                            onUpdateName={handleUpdateVehicleName}
                                        />
                                    ))}
                                </div>
                                <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
                                    <ShieldCheckIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[11px] text-blue-700 leading-relaxed font-bold italic mb-1">
                                            Lưu ý vận hành:
                                        </p>
                                        <ul className="text-[10px] text-blue-600 space-y-1 list-disc ml-3 font-medium">
                                            <li>Chỉ ô tô mới hiển thị trạng thái lốt đỗ cố định.</li>
                                            <li>Để đăng ký xe mới hoặc đổi biển số, vui lòng liên hệ BQL tại sảnh tầng 1.</li>
                                            <li>Bạn có thể tự cập nhật tên loại xe (VD: Honda Vision, Vinfast VF8) để dễ quản lý.</li>
                                        </ul>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-10 opacity-40">
                                <CarIcon className="w-12 h-12 mx-auto mb-3" />
                                <p className="font-black uppercase tracking-widest text-[10px]">Chưa đăng ký phương tiện</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

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
