
import React, { useState, useMemo } from 'react';
import type { UserPermission, Role, Unit } from '../../types';
import { useAuth, useNotification } from '../../App';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { 
    KeyIcon, PencilSquareIcon,
    SearchIcon, ShieldCheckIcon, UserIcon, PlusIcon,
    UserGroupIcon, ArrowPathIcon, BuildingIcon, LockClosedIcon,
    TrashIcon, XMarkIcon
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
    { id: 'residents', label: 'Quản lý Cư dân' },
    { id: 'vehicles', label: 'Quản lý Phương tiện' },
    { id: 'water', label: 'Quản lý Nước' },
    { id: 'billing', label: 'Quản lý Tài chính' },
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
        password: user?.password || '123456',
        mustChangePassword: user?.mustChangePassword ?? true,
        permissions: user?.permissions || []
    });

    const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set(user?.permissions || []));

    const handlePermissionToggle = (moduleId: string) => {
        const next = new Set(selectedPermissions);
        if (next.has(moduleId)) next.delete(moduleId);
        else next.add(moduleId);
        setSelectedPermissions(next);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.Username) { 
            showToast('Vui lòng nhập Tên đăng nhập (ID).', 'error'); 
            return; 
        }
        
        const finalData = { 
            ...formData, 
            permissions: Array.from(selectedPermissions) 
        };

        if (!isEdit) {
            if (allUsers.some(u => (u.Username || '').toLowerCase() === (formData.Username || '').toLowerCase())) {
                showToast('Tên đăng nhập (Mã căn) đã tồn tại.', 'error'); return;
            }
            if (!finalData.Email) {
                finalData.Email = `${formData.Username}@resident.q-home.vn`.toLowerCase();
            }
        }

        onSave(finalData);
    };

    const canHavePermissions = formData.Role !== 'Resident';
    const inputStyle = "w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm shadow-sm transition-all";

    return (
        <Modal title={isEdit ? `Cập nhật: ${user?.Username || 'Người dùng'}` : "Thêm người dùng mới"} onClose={onClose} size="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Tên đăng nhập (ID) <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            required 
                            value={formData.Username} 
                            onChange={e => setFormData({...formData, Username: e.target.value})} 
                            className={`${inputStyle} ${isEdit ? 'bg-gray-100 cursor-not-allowed font-bold' : ''}`} 
                            disabled={isEdit} 
                            placeholder="Mã căn hộ hoặc ID nhân viên"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Email liên hệ</label>
                        <input 
                            type="email" 
                            value={formData.contact_email || ''} 
                            onChange={e => setFormData({...formData, contact_email: e.target.value})} 
                            className={inputStyle} 
                            placeholder="Nhập email cá nhân..."
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Tên hiển thị</label>
                        <input type="text" value={formData.DisplayName} onChange={e => setFormData({...formData, DisplayName: e.target.value})} className={inputStyle} placeholder="VD: Nguyễn Văn A" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Trạng thái</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className={inputStyle}>
                            <option value="Active">Hoạt động</option>
                            <option value="Disabled">Vô hiệu hóa</option>
                        </select>
                    </div>
                </div>

                {canHavePermissions && (
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 shadow-inner">
                        <h4 className="font-black text-gray-800 mb-3 flex items-center gap-2 text-xs uppercase tracking-widest">
                            <ShieldCheckIcon className="w-5 h-5 text-primary"/> Phân quyền Module
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {AVAILABLE_MODULES.map(mod => (
                                <label key={mod.id} className="flex items-center space-x-3 cursor-pointer p-2.5 bg-white rounded-xl border border-gray-100 hover:border-primary/30 transition-all shadow-sm">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedPermissions.has(mod.id)} 
                                        onChange={() => handlePermissionToggle(mod.id)} 
                                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" 
                                    />
                                    <span className="text-sm font-semibold text-gray-700">{mod.label}</span>
                                </label>
                            ))}
                        </div>
                        <p className="mt-4 text-[10px] text-gray-400 italic bg-white/50 p-2 rounded-lg border border-dashed border-gray-200">
                            * Admin mặc định có quyền truy cập tất cả module bất kể cài đặt ở đây.
                        </p>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button>
                    <button type="submit" className="px-5 py-2.5 bg-primary text-white font-black rounded-xl hover:bg-primary-focus shadow-lg shadow-primary/20 transition-all active:scale-95">{isEdit ? 'Lưu thay đổi' : 'Tạo người dùng'}</button>
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
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [isSyncLocked, setIsSyncLocked] = useState(false);
    
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserPermission | null>(null);
    const [passwordModalState, setPasswordModalState] = useState<{ isOpen: boolean; user: UserPermission | null }>({ isOpen: false, user: null });

    // Stats Calculation
    const stats = useMemo(() => ({
        total: users.filter(u => u?.Username !== 'Admin0').length,
        admin: users.filter(u => u?.Role === 'Admin' && u?.Username !== 'Admin0').length,
        staff: users.filter(u => ['Accountant', 'Operator', 'Viewer'].includes(u?.Role || '')).length,
        residents: users.filter(u => u?.Role === 'Resident').length
    }), [users]);

    // Filtering - GOD-MODE: Hide Admin0 from the list
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            if (!user || user.Username === 'Admin0') return false;
            
            const userRole = user.Role || '';
            const userStatus = user.status || '';

            if (roleFilter !== 'all') {
                if (roleFilter === 'staff') {
                    if (!['Accountant', 'Operator', 'Viewer'].includes(userRole)) return false;
                } else if (userRole !== roleFilter) {
                    return false;
                }
            }
            
            if (statusFilter !== 'all' && userStatus !== statusFilter) return false;

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

    const handleSaveUser = (userToSave: UserPermission) => {
        const exists = users.some(u => u.Username === userToSave.Username);
        const updatedList = exists 
            ? users.map(u => u.Username === userToSave.Username ? userToSave : u) 
            : [...users, userToSave];
        
        persistData(updatedList, exists ? `Cập nhật user: ${userToSave.Username}` : `Thêm user mới: ${userToSave.Username}`);
        showToast(exists ? 'Cập nhật thành công.' : 'Tạo mới thành công.', 'success');
        setIsUserModalOpen(false);
    };

    const handleBulkDelete = () => {
        if (selectedUsers.size === 0) return;
        
        const safeToDelete = Array.from(selectedUsers).filter(username => {
            const u = users.find(user => user.Username === username);
            // Cannot delete Admin or Self
            return u && u.Role !== 'Admin' && u.Username !== currentUser?.Username && u.Username !== 'Admin0';
        });

        if (safeToDelete.length === 0) {
            showToast('Không thể xóa quản trị viên hoặc tài khoản của chính bạn.', 'warn');
            return;
        }

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
            showToast('Dữ liệu đã đồng bộ.', 'info');
            setIsSyncLocked(true);
            return;
        }

        if (window.confirm(`Tạo tự động ${missingUnits.length} tài khoản?`)) {
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
                permissions: []
            }));
            persistData([...users, ...newResidents], `Đồng bộ: Tạo ${newResidents.length} tài khoản cư dân.`);
            showToast(`Đã tạo ${newResidents.length} tài khoản.`, 'success');
            setIsSyncLocked(true);
        }
    };

    const handlePasswordChange = (newPassword: string) => {
        if (!passwordModalState.user) return;
        const targetUsername = passwordModalState.user.Username || '';
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

    const handleToggleFilter = (filter: string) => {
        setRoleFilter(prev => prev === filter ? 'all' : filter);
    };

    const cardActiveClass = "ring-4 ring-primary/20 bg-primary/5 border-primary shadow-xl scale-[1.03] transition-all duration-300";

    return (
        <div className="h-full flex flex-col space-y-6">
            {isUserModalOpen && <UserModal user={editingUser} onSave={handleSaveUser} onClose={() => setIsUserModalOpen(false)} allUsers={users} />}
            {passwordModalState.isOpen && passwordModalState.user && <PasswordModal user={passwordModalState.user} onSave={handlePasswordChange} onClose={() => setPasswordModalState({ isOpen: false, user: null })} />}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                <StatCard 
                    label="Tổng User" 
                    value={stats.total} 
                    icon={<UserGroupIcon className="w-6 h-6 text-gray-600"/>} 
                    className={`border-l-4 border-gray-500 cursor-pointer hover:shadow-md transition-all ${roleFilter === 'all' ? cardActiveClass : ''}`}
                    onClick={() => setRoleFilter('all')}
                />
                <StatCard 
                    label="Quản trị viên" 
                    value={stats.admin} 
                    icon={<ShieldCheckIcon className="w-6 h-6 text-red-600"/>} 
                    iconBgClass="bg-red-100" 
                    className={`border-l-4 border-red-500 cursor-pointer hover:shadow-md transition-all ${roleFilter === 'Admin' ? cardActiveClass : ''}`}
                    onClick={() => handleToggleFilter('Admin')}
                />
                <StatCard 
                    label="Nhân viên" 
                    value={stats.staff} 
                    icon={<UserIcon className="w-6 h-6 text-blue-600"/>} 
                    iconBgClass="bg-blue-100" 
                    className={`border-l-4 border-blue-500 cursor-pointer hover:shadow-md transition-all ${roleFilter === 'staff' ? cardActiveClass : ''}`}
                    onClick={() => handleToggleFilter('staff')}
                />
                <StatCard 
                    label="Cư dân" 
                    value={stats.residents} 
                    icon={<BuildingIcon className="w-6 h-6 text-green-600"/>} 
                    iconBgClass="bg-green-100" 
                    className={`border-l-4 border-green-500 cursor-pointer hover:shadow-md transition-all ${roleFilter === 'Resident' ? cardActiveClass : ''}`}
                    onClick={() => handleToggleFilter('Resident')}
                />
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-4 shrink-0">
                <div className="relative flex-grow w-full md:w-auto">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input type="text" placeholder="Tìm kiếm tên, username..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-11 pl-11 pr-4 border border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm shadow-sm transition-all"/>
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="h-11 px-4 border border-gray-200 rounded-xl bg-white text-gray-900 text-sm font-semibold focus:ring-2 focus:ring-primary outline-none cursor-pointer">
                    <option value="all">Tất cả vai trò</option>
                    <option value="Admin">Admin</option>
                    <option value="staff">Nhân viên (Chung)</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Operator">Operator</option>
                    <option value="Resident">Resident</option>
                </select>
                <div className="flex gap-2 w-full md:w-auto">
                    {isAdmin && (
                        <button onClick={handleSyncUsers} className="flex-1 md:flex-none px-5 h-11 border border-blue-600 text-blue-600 font-bold rounded-xl hover:bg-blue-50 flex items-center justify-center gap-2 transition-colors">
                            <ArrowPathIcon className="w-5 h-5" /> Đồng bộ
                        </button>
                    )}
                    <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="flex-1 md:flex-none px-6 h-11 bg-primary text-white font-black rounded-xl hover:bg-primary-focus flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95">
                        <PlusIcon className="w-5 h-5" /> Thêm User
                    </button>
                </div>
            </div>

            {/* BẢNG DANH SÁCH - Đã loại bỏ overflow-hidden ở root và điều chỉnh flex-1 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col min-h-0 min-h-[500px]">
                <div className="overflow-auto flex-1 scrollbar-thin scrollbar-thumb-gray-200">
                    <table className="min-w-full table-fixed">
                        <thead className="bg-gray-50/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100">
                            <tr>
                                <th className="w-16 px-4 py-4 text-center">
                                    <input type="checkbox" checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer transition-all" />
                                </th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Người dùng</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Tên hiển thị</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Vai trò</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Trạng thái</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {filteredUsers.map(user => {
                                const username = user.Username || '---';
                                const userRole = user.Role || '---';
                                const isSelected = selectedUsers.has(username);
                                return (
                                <tr key={username} className={`group hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                    <td className="px-4 py-4 text-center">
                                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelectUser(username)} className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer transition-all" disabled={userRole === 'Admin'} />
                                    </td>
                                    <td className="px-6 py-4 font-black text-gray-900">{username}</td>
                                    <td className="px-6 py-4 text-gray-600 font-medium">{user.DisplayName || '---'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${
                                            userRole === 'Admin' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                                        }`}>{userRole}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.status === 'Active' ? 
                                            <span className="text-[10px] font-black text-green-700 bg-green-50 px-2.5 py-1 rounded-lg border border-green-100 uppercase tracking-widest">Active</span> : 
                                            <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200 uppercase tracking-widest">Disabled</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-all" title="Chỉnh sửa"><PencilSquareIcon className="w-5 h-5" /></button>
                                            <button onClick={() => setPasswordModalState({ isOpen: true, user })} className="p-2 text-orange-600 hover:bg-orange-100 rounded-xl transition-all" title="Đổi mật khẩu"><KeyIcon className="w-5 h-5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="p-20 text-center flex flex-col items-center justify-center">
                            <SearchIcon className="w-16 h-16 text-gray-200 mb-4" />
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs italic">Không tìm thấy người dùng phù hợp.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* FLOATBAR - Floating Action Bar */}
            {selectedUsers.size > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-md text-white rounded-full shadow-2xl px-6 py-3 flex items-center gap-6 z-50 animate-slide-up ring-1 ring-white/10">
                    <div className="flex items-center gap-3 border-r border-white/20 pr-5">
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[10px] font-black shadow-inner ring-2 ring-primary/30">{selectedUsers.size}</div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Đã chọn</span>
                        <button onClick={() => setSelectedUsers(new Set())} className="p-1 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-colors">
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-900/20"
                        >
                            <TrashIcon className="w-4 h-4" /> Xóa hàng loạt
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersPage;
