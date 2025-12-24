
import React, { useState, useMemo } from 'react';
import type { UserPermission, Role, Unit } from '../../types';
import { useAuth, useNotification } from '../../App';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { 
    KeyIcon, CheckCircleIcon, WarningIcon, PencilSquareIcon,
    SearchIcon, TrashIcon, ShieldCheckIcon, UserIcon, PlusIcon,
    UserGroupIcon, ArrowPathIcon, BuildingIcon, LockClosedIcon,
    EyeIcon, PencilIcon, CheckIcon
} from '../ui/Icons';
import { isProduction } from '../../utils/env';
import { saveUsers } from '../../services';

interface UsersPageProps {
    users: UserPermission[];
    setUsers: (updater: React.SetStateAction<UserPermission[]>, logPayload?: any) => void;
    units: Unit[];
    role: Role;
}

type ExtendedUser = UserPermission & {
    permissions?: string[];
};

const AVAILABLE_MODULES = [
    { id: 'residents', label: 'Quản lý Cư dân' },
    { id: 'vehicles', label: 'Quản lý Phương tiện' },
    { id: 'water', label: 'Quản lý Nước' },
    { id: 'billing', label: 'Tính phí & Gửi phiếu' },
    { id: 'newsManagement', label: 'Quản lý Tin tức' },
    { id: 'serviceRegistration', label: 'Quản lý Đăng ký' },
    { id: 'feedbackManagement', label: 'Quản lý Phản hồi' },
];

const PERMISSION_ACTIONS = [
    { id: 'read', label: 'Xem', icon: <EyeIcon className="w-3 h-3"/>, color: 'text-blue-600' },
    { id: 'write', label: 'Sửa', icon: <PencilSquareIcon className="w-3 h-3"/>, color: 'text-orange-600' },
    { id: 'delete', label: 'Xóa', icon: <TrashIcon className="w-3 h-3"/>, color: 'text-red-600' },
];

const IS_PROD = isProduction();

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
        <Modal title={`Đặt mật khẩu mới: ${user.Username || 'User'}`} onClose={onClose} size="sm">
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
    user?: ExtendedUser | null; 
    onSave: (data: ExtendedUser) => void; 
    onClose: () => void;
    allUsers: UserPermission[];
}> = ({ user, onSave, onClose, allUsers }) => {
    const { showToast } = useNotification();
    const isEdit = !!user;

    const [formData, setFormData] = useState<ExtendedUser>({
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

    const handleActionToggle = (moduleId: string, actionId: string) => {
        const permKey = `${moduleId}:${actionId}`;
        const next = new Set(selectedPermissions);
        
        if (next.has(permKey)) {
            next.delete(permKey);
            // Nếu bỏ "Xem" (read), thì cũng bỏ luôn "Sửa" và "Xóa"
            if (actionId === 'read') {
                next.delete(`${moduleId}:write`);
                next.delete(`${moduleId}:delete`);
            }
        } else {
            next.add(permKey);
            // Nếu chọn "Sửa" hoặc "Xóa", thì tự động chọn "Xem"
            if (actionId === 'write' || actionId === 'delete') {
                next.add(`${moduleId}:read`);
            }
        }
        setSelectedPermissions(next);
    };

    const handleModuleToggle = (moduleId: string) => {
        const next = new Set(selectedPermissions);
        const isAccessing = next.has(`${moduleId}:read`);
        
        if (isAccessing) {
            next.delete(`${moduleId}:read`);
            next.delete(`${moduleId}:write`);
            next.delete(`${moduleId}:delete`);
        } else {
            next.add(`${moduleId}:read`);
        }
        setSelectedPermissions(next);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.Username) { showToast('Vui lòng nhập Tên đăng nhập (ID).', 'error'); return; }
        if (!isEdit) {
            if (allUsers.some(u => (u.Username || '').toLowerCase() === (formData.Username || '').toLowerCase())) {
                showToast('Tên đăng nhập (Mã căn) đã tồn tại.', 'error'); return;
            }
            if (!formData.Email) {
                formData.Email = `${formData.Username}@resident.q-home.vn`.toLowerCase();
            }
        }
        onSave({ ...formData, permissions: Array.from(selectedPermissions) });
    };

    const isStaff = ['Accountant', 'Operator', 'Viewer'].includes(formData.Role);
    const inputStyle = "w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary outline-none";

    return (
        <Modal title={isEdit ? `Cập nhật: ${user?.Username || 'Người dùng'}` : "Thêm người dùng mới"} onClose={onClose} size="2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tên đăng nhập (ID) <span className="text-red-500">*</span></label>
                        <input type="text" required value={formData.Username} onChange={e => setFormData({...formData, Username: e.target.value})} className={`${inputStyle} ${isEdit ? 'bg-gray-50 cursor-not-allowed font-bold' : ''}`} disabled={isEdit} placeholder="Mã căn hộ hoặc ID nhân viên" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Email liên hệ</label>
                        <input type="email" value={formData.contact_email || ''} onChange={e => setFormData({...formData, contact_email: e.target.value})} className={inputStyle} placeholder="Nhập email cá nhân..." />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tên hiển thị</label>
                        <input type="text" value={formData.DisplayName} onChange={e => setFormData({...formData, DisplayName: e.target.value})} className={inputStyle} placeholder="VD: Nguyễn Văn A" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Vai trò</label>
                            <select value={formData.Role} onChange={e => setFormData({...formData, Role: e.target.value as Role})} className={inputStyle} disabled={isEdit && user?.Role === 'Admin'}>
                                <option value="Admin">Admin</option>
                                <option value="Accountant">Accountant</option>
                                <option value="Operator">Operator</option>
                                <option value="Viewer">Viewer</option>
                                <option value="Resident">Resident</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Trạng thái</label>
                            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className={inputStyle}>
                                <option value="Active">Hoạt động</option>
                                <option value="Disabled">Vô hiệu hóa</option>
                            </select>
                        </div>
                    </div>
                </div>

                {isStaff && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-black text-gray-800 text-xs uppercase tracking-widest flex items-center gap-2">
                                <ShieldCheckIcon className="w-5 h-5 text-primary"/> Phân quyền Module chi tiết
                            </h4>
                        </div>
                        
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-inner">
                            <table className="min-w-full text-xs">
                                <thead className="bg-slate-100 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left font-black text-gray-500 uppercase tracking-wider">Module</th>
                                        {PERMISSION_ACTIONS.map(action => (
                                            <th key={action.id} className="px-2 py-2.5 text-center font-black text-gray-500 uppercase tracking-wider w-20">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    {action.icon}
                                                    <span>{action.label}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {AVAILABLE_MODULES.map(mod => {
                                        const isAccessed = selectedPermissions.has(`${mod.id}:read`);
                                        return (
                                            <tr key={mod.id} className={`hover:bg-slate-50 transition-colors ${isAccessed ? 'bg-blue-50/20' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isAccessed} 
                                                            onChange={() => handleModuleToggle(mod.id)}
                                                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                                                        />
                                                        <span className={`font-bold ${isAccessed ? 'text-gray-900' : 'text-gray-400'}`}>{mod.label}</span>
                                                    </div>
                                                </td>
                                                {PERMISSION_ACTIONS.map(action => {
                                                    const permKey = `${mod.id}:${action.id}`;
                                                    const isChecked = selectedPermissions.has(permKey);
                                                    return (
                                                        <td key={action.id} className="px-2 py-3 text-center">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isChecked} 
                                                                onChange={() => handleActionToggle(mod.id, action.id)}
                                                                className={`w-5 h-5 border-gray-300 rounded focus:ring-primary cursor-pointer transition-all ${action.color.replace('text', 'text')}`}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 text-[10px] text-slate-400 italic px-1 font-medium">
                            * Lưu ý: Quyền "Sửa" hoặc "Xóa" yêu cầu quyền "Xem" tương ứng được kích hoạt.
                        </p>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">Hủy bỏ</button>
                    <button type="submit" className="px-8 py-2.5 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-focus transition-all">
                        {isEdit ? 'Lưu thay đổi' : 'Tạo người dùng'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const UsersPage: React.FC<UsersPageProps> = ({ users = [], setUsers, units = [], role }) => {
    const { showToast } = useNotification();
    const { user: currentUser, handleDeleteUsers } = useAuth() as any; 
    
    const isAdmin = role === 'Admin';

    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [isSyncLocked, setIsSyncLocked] = useState(false);
    
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<ExtendedUser | null>(null);
    const [passwordModalState, setPasswordModalState] = useState<{ isOpen: boolean; user: UserPermission | null }>({ isOpen: false, user: null });

    const stats = useMemo(() => ({
        total: users.length,
        admin: users.filter(u => u?.Role === 'Admin').length,
        staff: users.filter(u => ['Accountant', 'Operator', 'Viewer'].includes(u?.Role)).length,
        residents: users.filter(u => u?.Role === 'Resident').length
    }), [users]);

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            if (!user) return false;
            if (roleFilter !== 'all' && user.Role !== roleFilter) return false;
            if (statusFilter !== 'all' && user.status !== statusFilter) return false;

            const s = (searchTerm || '').trim().toLowerCase();
            if (!s) return true;

            const safeContactEmail = (user.contact_email || '').toLowerCase();
            const safeUsername = (user.Username || '').toLowerCase();
            const safeDisplayName = (user.DisplayName || '').toLowerCase();

            return safeContactEmail.includes(s) || safeUsername.includes(s) || safeDisplayName.includes(s);
        });
    }, [users, searchTerm, roleFilter, statusFilter]);

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

    const handleSaveUser = (userToSave: ExtendedUser) => {
        const exists = users.some(u => u.Username === userToSave.Username);
        const updatedList = exists 
            ? users.map(u => u.Username === userToSave.Username ? userToSave : u) 
            : [...users, userToSave];
        
        const summary = exists ? `Cập nhật user: ${userToSave.Username}` : `Thêm user mới: ${userToSave.Username}`;
        persistData(updatedList, summary);
        
        showToast(exists ? 'Cập nhật thành công.' : 'Tạo mới thành công.', 'success');
        setIsUserModalOpen(false);
    };

    const handleBulkDelete = () => {
        if (selectedUsers.size === 0) return;
        const safeToDelete = Array.from(selectedUsers).filter(username => {
            const u = users.find(user => user.Username === username);
            return u && u.Role !== 'Admin' && u.Username !== currentUser?.Username;
        });

        if (safeToDelete.length < selectedUsers.size) {
            showToast('Một số tài khoản Admin hoặc tài khoản của bạn đã bị bỏ qua khỏi danh sách xóa.', 'warn');
        }

        if (safeToDelete.length === 0) return;
        if (confirm(`Xác nhận xóa ${safeToDelete.length} người dùng?`)) {
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
        const targetUsername = passwordModalState.user.Username;
        const updatedList = users.map(u => u.Username === targetUsername ? { ...u, password: newPassword, mustChangePassword: false } : u);
        persistData(updatedList, `Đổi mật khẩu cho: ${targetUsername}`);
        showToast('Đổi mật khẩu thành công.', 'success');
        setPasswordModalState({ isOpen: false, user: null });
    };

    const toggleSelectAll = () => {
        if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set());
        else setSelectedUsers(new Set(filteredUsers.map(u => u.Username || '')));
    };

    const toggleSelectUser = (username: string) => {
        const next = new Set(selectedUsers);
        if (next.has(username)) next.delete(username);
        else next.add(username);
        setSelectedUsers(next);
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            {isUserModalOpen && <UserModal user={editingUser} onSave={handleSaveUser} onClose={() => setIsUserModalOpen(false)} allUsers={users} />}
            {passwordModalState.isOpen && passwordModalState.user && <PasswordModal user={passwordModalState.user} onSave={handlePasswordChange} onClose={() => setPasswordModalState({ isOpen: false, user: null })} />}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Tổng User" value={stats.total} icon={<UserGroupIcon className="w-6 h-6 text-gray-600"/>} className="border-l-4 border-gray-500"/>
                <StatCard label="Quản trị viên" value={stats.admin} icon={<ShieldCheckIcon className="w-6 h-6 text-red-600"/>} iconBgClass="bg-red-100" className="border-l-4 border-red-500"/>
                <StatCard label="Nhân viên" value={stats.staff} icon={<UserIcon className="w-6 h-6 text-blue-600"/>} iconBgClass="bg-blue-100" className="border-l-4 border-blue-500"/>
                <StatCard label="Cư dân" value={stats.residents} icon={<BuildingIcon className="w-6 h-6 text-green-600"/>} iconBgClass="bg-green-100" className="border-l-4 border-green-500"/>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-grow w-full md:w-auto">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input type="text" placeholder="Tìm tên, username, email liên hệ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-primary outline-none text-gray-900" />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-primary outline-none">
                    <option value="all">Tất cả vai trò</option>
                    <option value="Admin">Admin</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Operator">Operator</option>
                    <option value="Viewer">Viewer</option>
                    <option value="Resident">Resident</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-primary outline-none">
                    <option value="all">Tất cả trạng thái</option>
                    <option value="Active">Hoạt động</option>
                    <option value="Disabled">Vô hiệu hóa</option>
                </select>
                {isAdmin && (
                    <div className="flex gap-2">
                        <button onClick={!isSyncLocked ? handleSyncUsers : undefined} onDoubleClick={isSyncLocked ? () => setIsSyncLocked(false) : undefined} className={`px-4 py-2.5 font-bold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors border shadow-sm ${isSyncLocked ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-default' : 'border-blue-600 text-blue-600 hover:bg-blue-50'}`}>{isSyncLocked ? <LockClosedIcon className="w-5 h-5" /> : <ArrowPathIcon className="w-5 h-5" />}{isSyncLocked ? "Đã đồng bộ" : "Đồng bộ Cư dân"}</button>
                        <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-focus flex items-center gap-2 whitespace-nowrap shadow-sm"><PlusIcon className="w-5 h-5" /> Thêm User</button>
                    </div>
                )}
            </div>

            {selectedUsers.size > 0 && isAdmin && (
                <div className="bg-red-50 p-3 rounded-lg flex items-center justify-between border border-red-200 animate-fade-in-down">
                    <span className="text-red-700 font-medium ml-2">Đã chọn {selectedUsers.size} người dùng</span>
                    <button onClick={handleBulkDelete} className="px-4 py-1.5 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 flex items-center gap-2"><TrashIcon className="w-4 h-4"/> Xóa đã chọn</button>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden border border-gray-100">
                <div className="overflow-y-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="w-12 px-6 py-4 text-center"><input type="checkbox" checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded text-primary focus:ring-primary" /></th>
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
                                const emailToDisplay = user.contact_email; 
                                const char = (displayName !== '-' ? displayName : username).charAt(0).toUpperCase();

                                return (
                                <tr key={username} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-center"><input type="checkbox" checked={selectedUsers.has(username)} onChange={() => toggleSelectUser(username)} className="w-4 h-4 rounded text-primary focus:ring-primary" disabled={user.Role === 'Admin'} /></td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 uppercase font-bold">{char}</div>
                                            <div>
                                                <div className="font-bold text-gray-900">{username}</div>
                                                <div className="text-xs text-gray-500">{emailToDisplay ? <span>{emailToDisplay}</span> : <span className="text-gray-400 italic">Chưa cập nhật</span>}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">{displayName}</td>
                                    <td className="px-6 py-4"><span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${user.Role === 'Admin' ? 'bg-red-50 text-red-700 border-red-200' : user.Role === 'Resident' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{user.Role}</span></td>
                                    <td className="px-6 py-4">{user.status === 'Active' ? <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-fit"><CheckCircleIcon className="w-3 h-3"/> Active</span> : <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full w-fit"><WarningIcon className="w-3 h-3"/> Disabled</span>}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1 max-w-[250px]">
                                            {user.Role === 'Admin' ? (
                                                <span className="text-xs text-red-500 font-bold">Toàn quyền</span>
                                            ) : (user as ExtendedUser).permissions?.length ? (
                                                (() => {
                                                    const moduleMap: Record<string, Set<string>> = {};
                                                    (user as ExtendedUser).permissions?.forEach(p => {
                                                        const [mod, act] = p.split(':');
                                                        if (!moduleMap[mod]) moduleMap[mod] = new Set();
                                                        if (act) moduleMap[mod].add(act);
                                                    });

                                                    return Object.entries(moduleMap).map(([modId, acts]) => {
                                                        const label = AVAILABLE_MODULES.find(m => m.id === modId)?.label || modId;
                                                        const actLabels = Array.from(acts).map(a => a === 'read' ? 'R' : a === 'write' ? 'W' : 'D').join('/');
                                                        return (
                                                            <span key={modId} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1 font-bold">
                                                                {label} <span className="text-primary opacity-60">[{actLabels}]</span>
                                                            </span>
                                                        );
                                                    });
                                                })()
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Cơ bản</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">{isAdmin && (<div className="flex justify-center gap-2"><button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} disabled={user.Role === 'Admin' && user.Username !== currentUser?.Username} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30"><PencilSquareIcon className="w-5 h-5" /></button><button onClick={() => setPasswordModalState({ isOpen: true, user })} disabled={user.Role === 'Admin' && user.Username !== currentUser?.Username} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-30"><KeyIcon className="w-5 h-5" /></button></div>)}</td>
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
