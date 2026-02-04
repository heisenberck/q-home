
import React, { useState, useMemo, useEffect } from 'react';
import type { UserPermission, Role, Unit } from '../../types';
import { useAuth, useNotification } from '../../App';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { 
    KeyIcon, CheckCircleIcon, WarningIcon, PencilSquareIcon,
    SearchIcon, TrashIcon, ShieldCheckIcon, UserIcon, PlusIcon,
    UserGroupIcon, ArrowPathIcon, BuildingIcon, LockClosedIcon,
    CheckIcon
} from '../ui/Icons';
import { isProduction } from '../../utils/env';
import { saveUsers } from '../../services';

interface UsersPageProps {
    users: UserPermission[];
    setUsers: (updater: React.SetStateAction<UserPermission[]>, logPayload?: any) => void;
    units: Unit[];
    role: Role;
}

const AVAILABLE_MODULES = [
    { id: 'overview', label: 'Trang tổng quan' }, // Added overview module
    { id: 'residents', label: 'Quản lý Cư dân' },
    { id: 'vehicles', label: 'Quản lý Phương tiện' },
    { id: 'water', label: 'Quản lý Nước' },
    { id: 'billing', label: 'Tính phí & Gửi phiếu' },
    { id: 'newsManagement', label: 'Quản lý Tin tức' },
    { id: 'feedbackManagement', label: 'Quản lý Phản hồi' },
];

const IS_PROD = isProduction();

// --- Components ---

const PasswordModal: React.FC<{ user: UserPermission, onSave: (pw: string) => void, onClose: () => void }> = ({ user, onSave, onClose }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (password.length < 6) { setError('Mật khẩu phải từ 6 ký tự trở lên.'); return; }
        if (password !== confirm) { setError('Mật khẩu không khớp!'); return; }
        onSave(password);
    };

    return (
        <Modal title={`Đặt mật khẩu mới: ${user.Username || user.Email}`} onClose={onClose} size="sm">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary outline-none" />
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Hủy</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-focus">Lưu thay đổi</button>
                </div>
            </div>
        </Modal>
    );
};

const UserModal: React.FC<{ 
    user?: UserPermission | null; 
    onSave: (data: UserPermission) => void; 
    onClose: () => void;
    allUsers: UserPermission[];
}> = ({ user, onSave, onClose, allUsers }) => {
    const { showToast } = useNotification();
    const isEdit = !!user;

    const [formData, setFormData] = useState<UserPermission>({
        Email: user?.Email || '', 
        contact_email: user?.contact_email || '', 
        Username: user?.Username || '',
        DisplayName: user?.DisplayName || '',
        Role: user?.Role || 'Viewer',
        status: user?.status || 'Active',
        password: user?.password || '123456a@',
        mustChangePassword: user?.mustChangePassword ?? true,
        permissions: user?.permissions || []
    });

    const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set(user?.permissions || []));

    // Update state if user prop changes
    useEffect(() => {
        if (user) {
            setFormData({
                Email: user.Email || '',
                contact_email: user.contact_email || '',
                Username: user.Username || '',
                DisplayName: user.DisplayName || '',
                Role: user.Role || 'Viewer',
                status: user.status || 'Active',
                password: user.password || '',
                mustChangePassword: user.mustChangePassword ?? false,
                permissions: user.permissions || []
            });
            setSelectedPermissions(new Set(user.permissions || []));
        }
    }, [user]);

    const handlePermissionToggle = (moduleId: string) => {
        const next = new Set(selectedPermissions);
        if (next.has(moduleId)) next.delete(moduleId);
        else next.add(moduleId);
        setSelectedPermissions(next);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.Email || !formData.Username) { 
            showToast('Vui lòng nhập Email và Tên đăng nhập.', 'error'); 
            return; 
        }
        
        if (!isEdit) {
            if (allUsers.some(u => u.Email.toLowerCase() === formData.Email.toLowerCase())) {
                showToast('Email đã tồn tại.', 'error'); return;
            }
        }

        onSave({ 
            ...formData, 
            permissions: Array.from(selectedPermissions),
        });
    };

    const isStaff = ['Accountant', 'Operator', 'Viewer', 'Admin'].includes(formData.Role);
    const inputStyle = "w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary outline-none transition-all";

    return (
        <Modal title={isEdit ? `Cập nhật: ${user?.Username || user?.Email}` : "Thêm người dùng mới"} onClose={onClose} size="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email (ID) <span className="text-red-500">*</span></label>
                        <input 
                            type="email" 
                            required 
                            value={formData.Email} 
                            onChange={e => setFormData({...formData, Email: e.target.value})} 
                            className={`${inputStyle} ${isEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`} 
                            disabled={isEdit} 
                            placeholder="email@domain.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập / Mã căn <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            required 
                            value={formData.Username} 
                            onChange={e => setFormData({...formData, Username: e.target.value})} 
                            className={inputStyle} 
                            placeholder="Mã căn hộ hoặc ID nhân viên"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email liên hệ (Phụ)</label>
                        <input 
                            type="email" 
                            value={formData.contact_email || ''} 
                            onChange={e => setFormData({...formData, contact_email: e.target.value})} 
                            className={inputStyle} 
                            placeholder="Nhập email cá nhân..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
                        <input type="text" value={formData.DisplayName} onChange={e => setFormData({...formData, DisplayName: e.target.value})} className={inputStyle} placeholder="VD: Nguyễn Văn A" />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                        <select 
                            value={formData.Role} 
                            onChange={e => setFormData({...formData, Role: e.target.value as Role})} 
                            className={inputStyle} 
                            disabled={isEdit && user?.Role === 'Admin'} 
                        >
                            <option value="Admin">Admin (Quản trị)</option>
                            <option value="Accountant">Accountant (Kế toán)</option>
                            <option value="Operator">Operator (Vận hành)</option>
                            <option value="Viewer">Viewer (Xem)</option>
                            <option value="Resident">Resident (Cư dân)</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                        <select 
                            value={formData.status} 
                            onChange={e => setFormData({...formData, status: e.target.value as any})} 
                            className={`${inputStyle} ${formData.status === 'Active' ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}`}
                        >
                            <option value="Active">Hoạt động</option>
                            <option value="Disabled">Vô hiệu hóa</option>
                        </select>
                    </div>
                </div>

                {isStaff && (
                    <div className={`p-4 rounded-xl border ${formData.Role === 'Admin' ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className={`font-bold flex items-center gap-2 ${formData.Role === 'Admin' ? 'text-orange-800' : 'text-gray-800'}`}>
                                <ShieldCheckIcon className="w-5 h-5"/> Phân quyền Module
                            </h4>
                            {formData.Role === 'Admin' && <span className="text-[10px] bg-orange-200 text-orange-800 px-2 py-1 rounded-md font-bold uppercase">Full Access</span>}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {AVAILABLE_MODULES.map(mod => (
                                <label key={mod.id} className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${selectedPermissions.has(mod.id) ? 'bg-white shadow-sm' : ''} ${formData.Role === 'Admin' ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer hover:bg-white'}`}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedPermissions.has(mod.id) ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}>
                                        {selectedPermissions.has(mod.id) && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="hidden"
                                        checked={selectedPermissions.has(mod.id)} 
                                        onChange={() => handlePermissionToggle(mod.id)} 
                                        disabled={formData.Role === 'Admin'}
                                    />
                                    <span className="text-sm text-gray-700 font-medium">{mod.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Hủy bỏ</button>
                    <button type="submit" className="px-5 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-focus shadow-lg shadow-primary/30">
                        {isEdit ? 'Lưu thay đổi' : 'Tạo người dùng'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

// --- Main Page ---

const UsersPage: React.FC<UsersPageProps> = ({ users = [], setUsers, units = [], role }) => {
    const { showToast } = useNotification();
    const { user: currentUser, handleDeleteUsers } = useAuth() as any; 
    
    const isAdmin = role === 'Admin';

    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set()); // Stores EMAILS
    const [isSyncLocked, setIsSyncLocked] = useState(false);
    
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserPermission | null>(null);
    const [passwordModalState, setPasswordModalState] = useState<{ isOpen: boolean; user: UserPermission | null }>({ isOpen: false, user: null });

    // Stats Calculation
    const stats = useMemo(() => ({
        total: users.length,
        admin: users.filter(u => u?.Role === 'Admin').length,
        staff: users.filter(u => ['Accountant', 'Operator', 'Viewer'].includes(u?.Role)).length,
        residents: users.filter(u => u?.Role === 'Resident').length
    }), [users]);

    // Filtering
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            if (!user) return false;
            
            if (roleFilter !== 'all') {
                if (roleFilter === 'Staff_Group') {
                    if (!['Accountant', 'Operator', 'Viewer'].includes(user.Role)) return false;
                } else if (user.Role !== roleFilter) {
                    return false;
                }
            }

            if (statusFilter !== 'all' && user.status !== statusFilter) return false;
            
            const s = (searchTerm || '').trim().toLowerCase();
            if (!s) return true;
            
            const safeEmail = (user.Email || '').toLowerCase();
            const safeUsername = (user.Username || '').toLowerCase();
            const safeDisplayName = (user.DisplayName || '').toLowerCase();
            return safeEmail.includes(s) || safeUsername.includes(s) || safeDisplayName.includes(s);
        });
    }, [users, searchTerm, roleFilter, statusFilter]);

    // --- Core Logic Handlers (Dual Env) ---

    const persistData = async (newUsers: UserPermission[], actionSummary: string) => {
        setUsers(newUsers, {
            module: 'System',
            action: 'UPDATE_USERS',
            summary: actionSummary,
            before_snapshot: users
        });

        if (IS_PROD) {
            try {
                await saveUsers(newUsers);
            } catch (error) {
                showToast('Lỗi lưu dữ liệu vào hệ thống.', 'error');
            }
        }
    };

    const handleSaveUser = (userToSave: UserPermission) => {
        const exists = users.some(u => u.Email === userToSave.Email);
        
        const updatedList = exists 
            ? users.map(u => u.Email === userToSave.Email ? userToSave : u)
            : [userToSave, ...users]; 
        
        const summary = exists ? `Cập nhật user: ${userToSave.Email} (${userToSave.Role})` : `Thêm user mới: ${userToSave.Email}`;
        persistData(updatedList, summary);
        
        showToast(exists ? 'Cập nhật thông tin thành công.' : 'Tạo người dùng thành công.', 'success');
        setIsUserModalOpen(false);
    };

    const handleBulkDelete = () => {
        if (selectedUsers.size === 0) return;
        
        const safeToDelete = Array.from(selectedUsers).filter(email => {
            const u = users.find(user => user.Email === email);
            return u && u.Role !== 'Admin' && u.Email !== currentUser?.Email;
        });

        if (safeToDelete.length < selectedUsers.size) {
            showToast('Một số tài khoản Admin hoặc tài khoản của bạn đã bị bỏ qua khỏi danh sách xóa.', 'warn');
        }

        if (safeToDelete.length === 0) return;

        if (confirm(`Xác nhận xóa ${safeToDelete.length} người dùng?`)) {
            const updatedList = users.filter(u => !safeToDelete.includes(u.Email));
            persistData(updatedList, `Xóa ${safeToDelete.length} người dùng`);
            handleDeleteUsers(safeToDelete);
            
            showToast(`Đã xóa ${safeToDelete.length} người dùng.`, 'success');
            setSelectedUsers(new Set());
        }
    };

    const handleSyncUsers = () => {
        if (!isAdmin || isSyncLocked) return;
        const existingUsernames = new Set(users.map(u => (u.Username || '').toLowerCase()));
        const missingUnits = units.filter(unit => !existingUsernames.has(unit.UnitID.toLowerCase()));

        if (missingUnits.length === 0) {
            showToast('Dữ liệu đã đồng bộ. Tất cả căn hộ đều có tài khoản.', 'info');
            setIsSyncLocked(true);
            return;
        }

        if (window.confirm(`Tìm thấy ${missingUnits.length} căn hộ chưa có tài khoản. Tạo tự động?`)) {
            const newResidents: UserPermission[] = missingUnits.map(unit => ({
                Email: `${unit.UnitID.toLowerCase()}@resident.q-home.vn`, 
                contact_email: '', 
                Username: unit.UnitID, 
                DisplayName: `Cư dân ${unit.UnitID}`, 
                Role: 'Resident',
                status: 'Active',
                password: '123456',
                mustChangePassword: true,
                residentId: unit.UnitID,
            }));

            const updatedList = [...users, ...newResidents];
            persistData(updatedList, `Đồng bộ: Tạo ${newResidents.length} tài khoản cư dân.`);
            showToast(`Đã tạo thêm ${newResidents.length} tài khoản cư dân.`, 'success');
            setIsSyncLocked(true);
        }
    };

    const handlePasswordChange = (newPassword: string) => {
        if (!passwordModalState.user) return;
        const targetEmail = passwordModalState.user.Email;
        
        const updatedList = users.map(u => u.Email === targetEmail ? { ...u, password: newPassword, mustChangePassword: false } : u);
        persistData(updatedList, `Đổi mật khẩu cho: ${targetEmail}`);
        showToast('Đổi mật khẩu thành công.', 'success');
        setPasswordModalState({ isOpen: false, user: null });
    };

    const toggleSelectAll = () => {
        if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set());
        else setSelectedUsers(new Set(filteredUsers.map(u => u.Email || '')));
    };

    const toggleSelectUser = (email: string) => {
        const next = new Set(selectedUsers);
        if (next.has(email)) next.delete(email);
        else next.add(email);
        setSelectedUsers(next);
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            {isUserModalOpen && <UserModal user={editingUser} onSave={handleSaveUser} onClose={() => setIsUserModalOpen(false)} allUsers={users} />}
            {passwordModalState.isOpen && passwordModalState.user && <PasswordModal user={passwordModalState.user} onSave={handlePasswordChange} onClose={() => setPasswordModalState({ isOpen: false, user: null })} />}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    label="Tổng User" 
                    value={stats.total} 
                    icon={<UserGroupIcon className="w-6 h-6 text-gray-600"/>} 
                    className={`border-l-4 border-gray-500 cursor-pointer transition-all hover:scale-[1.02] ${roleFilter === 'all' ? 'ring-2 ring-gray-400' : ''}`}
                    onClick={() => setRoleFilter('all')}
                />
                <StatCard 
                    label="Quản trị viên" 
                    value={stats.admin} 
                    icon={<ShieldCheckIcon className="w-6 h-6 text-red-600"/>} 
                    iconBgClass="bg-red-100" 
                    className={`border-l-4 border-red-500 cursor-pointer transition-all hover:scale-[1.02] ${roleFilter === 'Admin' ? 'ring-2 ring-red-500' : ''}`}
                    onClick={() => setRoleFilter('Admin')}
                />
                <StatCard 
                    label="Nhân viên" 
                    value={stats.staff} 
                    icon={<UserIcon className="w-6 h-6 text-blue-600"/>} 
                    iconBgClass="bg-blue-100" 
                    className={`border-l-4 border-blue-500 cursor-pointer transition-all hover:scale-[1.02] ${roleFilter === 'Staff_Group' ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setRoleFilter('Staff_Group')}
                />
                <StatCard 
                    label="Cư dân" 
                    value={stats.residents} 
                    icon={<BuildingIcon className="w-6 h-6 text-green-600"/>} 
                    iconBgClass="bg-green-100" 
                    className={`border-l-4 border-green-500 cursor-pointer transition-all hover:scale-[1.02] ${roleFilter === 'Resident' ? 'ring-2 ring-green-500' : ''}`}
                    onClick={() => setRoleFilter('Resident')}
                />
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-grow w-full md:w-auto">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input type="text" placeholder="Tìm tên, username, email liên hệ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-primary outline-none text-gray-900" />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-primary outline-none font-bold">
                    <option value="all">Tất cả vai trò</option>
                    <option value="Admin">Quản trị viên</option>
                    <option value="Staff_Group">Tất cả nhân viên</option>
                    <option value="Accountant">Kế toán</option>
                    <option value="Operator">Vận hành</option>
                    <option value="Viewer">Người xem</option>
                    <option value="Resident">Cư dân</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-primary outline-none">
                    <option value="all">Tất cả trạng thái</option>
                    <option value="Active">Hoạt động</option>
                    <option value="Disabled">Vô hiệu hóa</option>
                </select>
                {isAdmin && (
                    <div className="flex gap-2">
                        <button onClick={!isSyncLocked ? handleSyncUsers : undefined} onDoubleClick={isSyncLocked ? () => setIsSyncLocked(false) : undefined} className={`px-4 py-2.5 font-bold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors border shadow-sm ${isSyncLocked ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-blue-600 text-blue-600 hover:bg-blue-50'}`} title={isSyncLocked ? "Dữ liệu đã khớp. Nhấn đúp để mở khóa" : "Quét và tạo tài khoản cho căn hộ còn thiếu"}>
                            {isSyncLocked ? <LockClosedIcon className="w-5 h-5" /> : <ArrowPathIcon className="w-5 h-5" />}
                            {isSyncLocked ? "Đã đồng bộ" : "Đồng bộ Cư dân"}
                        </button>
                        <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-focus flex items-center gap-2 whitespace-nowrap shadow-sm">
                            <PlusIcon className="w-5 h-5" /> Thêm User
                        </button>
                    </div>
                )}
            </div>

            {selectedUsers.size > 0 && isAdmin && (
                <div className="bg-red-50 p-3 rounded-lg flex items-center justify-between border border-red-200 animate-fade-in-down">
                    <span className="text-red-700 font-medium ml-2">Đã chọn {selectedUsers.size} người dùng</span>
                    <button onClick={handleBulkDelete} className="px-4 py-1.5 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 flex items-center gap-2">
                        <TrashIcon className="w-4 h-4"/> Xóa đã chọn
                    </button>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden border border-gray-100">
                <div className="overflow-y-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="w-12 px-6 py-4 text-center">
                                    <input type="checkbox" checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Người dùng</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Tên hiển thị</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Vai trò</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Trạng thái</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Quyền hạn</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map(user => {
                                const username = user.Username || 'Unknown';
                                const displayName = user.DisplayName || '-';
                                const emailToDisplay = user.Email; 
                                const char = (displayName !== '-' ? displayName : username).charAt(0).toUpperCase();
                                
                                const isAdminRole = user.Role === 'Admin';
                                const isActive = user.status === 'Active';

                                return (
                                <tr key={user.Email} className={`hover:bg-gray-50 transition-colors ${!isActive ? 'bg-gray-50/50' : ''}`}>
                                    <td className="px-6 py-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedUsers.has(user.Email)} 
                                            onChange={() => toggleSelectUser(user.Email)} 
                                            className="w-4 h-4 rounded text-primary focus:ring-primary" 
                                            disabled={user.Role === 'Admin'} 
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${isActive ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-400 border border-red-100'}`}>
                                                {char}
                                            </div>
                                            <div>
                                                <div className={`font-bold ${isActive ? 'text-gray-900' : 'text-gray-500 line-through'}`}>{username}</div>
                                                <div className="text-xs text-gray-500">
                                                    {emailToDisplay}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                                        {displayName}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                            isAdminRole ? 'bg-red-50 text-red-700 border-red-200' : 
                                            user.Role === 'Resident' ? 'bg-green-50 text-green-700 border-green-200' :
                                            'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>{user.Role}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {isActive ? 
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-fit border border-green-200"><CheckCircleIcon className="w-3 h-3"/> Active</span> : 
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full w-fit border border-red-200 shadow-sm"><WarningIcon className="w-3 h-3"/> Disabled</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                            {isAdminRole ? (
                                                <span className="text-xs text-red-500 font-bold bg-red-50 border border-red-100 px-2 py-0.5 rounded">Toàn quyền</span>
                                            ) : (
                                                (user as UserPermission).permissions?.map(p => (
                                                    <span key={p} className="text-[10px] bg-white text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 shadow-sm">{AVAILABLE_MODULES.find(m=>m.id===p)?.label || p}</span>
                                                ))
                                            )}
                                            {(!isAdminRole && !(user as UserPermission).permissions?.length) && <span className="text-xs text-gray-400 italic">Chưa cấp quyền</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {isAdmin && (
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} disabled={user.Role === 'Admin' && user.Email !== currentUser?.Email} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30 border border-transparent hover:border-blue-100"><PencilSquareIcon className="w-5 h-5" /></button>
                                                <button onClick={() => setPasswordModalState({ isOpen: true, user })} disabled={user.Role === 'Admin' && user.Email !== currentUser?.Email} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-30 border border-transparent hover:border-orange-100"><KeyIcon className="w-5 h-5" /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && <div className="p-8 text-center text-gray-500">Không tìm thấy người dùng nào.</div>}
                </div>
            </div>
        </div>
    );
};

export default UsersPage;
