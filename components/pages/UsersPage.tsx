
import React, { useState, useMemo } from 'react';
import type { UserPermission, Role, Unit } from '../../types';
import { useAuth, useNotification } from '../../App';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { 
    KeyIcon, CheckCircleIcon, WarningIcon, PencilSquareIcon,
    SearchIcon, TrashIcon, ShieldCheckIcon, UserIcon, PlusIcon,
    UserGroupIcon, ArrowPathIcon, BuildingIcon
} from '../ui/Icons';
import { isProduction } from '../../utils/env';
import { saveUsers } from '../../services';

interface UsersPageProps {
    users: UserPermission[];
    setUsers: (updater: React.SetStateAction<UserPermission[]>, logPayload?: any) => void;
    units: Unit[]; // Added units prop for Sync functionality
    role: Role;
}

// Extended type for permission handling
type ExtendedUser = UserPermission & {
    permissions?: string[];
};

const AVAILABLE_MODULES = [
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
    user?: ExtendedUser | null; 
    onSave: (data: ExtendedUser) => void; 
    onClose: () => void;
    allUsers: UserPermission[];
}> = ({ user, onSave, onClose, allUsers }) => {
    const { showToast } = useNotification();
    const isEdit = !!user;

    const [formData, setFormData] = useState<ExtendedUser>({
        Email: user?.Email || '',
        Username: user?.Username || '',
        Role: user?.Role || 'Viewer',
        status: user?.status || 'Active',
        password: user?.password || '123456a@',
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
        if (!formData.Email || !formData.Username) { showToast('Vui lòng nhập đủ thông tin.', 'error'); return; }
        
        if (!isEdit || (isEdit && user.Email !== formData.Email)) {
            if (allUsers.some(u => u.Email.toLowerCase() === formData.Email.toLowerCase())) {
                showToast('Email đã tồn tại.', 'error'); return;
            }
        }

        onSave({ ...formData, permissions: Array.from(selectedPermissions) });
    };

    const isStaff = ['Accountant', 'Operator', 'Viewer'].includes(formData.Role);
    const inputStyle = "w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary outline-none";

    return (
        <Modal title={isEdit ? `Cập nhật: ${user.Username}` : "Thêm người dùng mới"} onClose={onClose} size="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                        <input type="email" required value={formData.Email} onChange={e => setFormData({...formData, Email: e.target.value})} className={`${inputStyle} ${isEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`} disabled={isEdit} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị <span className="text-red-500">*</span></label>
                        <input type="text" required value={formData.Username} onChange={e => setFormData({...formData, Username: e.target.value})} className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                        <select value={formData.Role} onChange={e => setFormData({...formData, Role: e.target.value as Role})} className={inputStyle} disabled={isEdit && user.Role === 'Admin'}>
                            <option value="Admin">Admin</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Operator">Operator</option>
                            <option value="Viewer">Viewer</option>
                            <option value="Resident">Resident</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className={inputStyle}>
                            <option value="Active">Hoạt động</option>
                            <option value="Disabled">Vô hiệu hóa</option>
                        </select>
                    </div>
                </div>

                {isStaff && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><ShieldCheckIcon className="w-5 h-5 text-primary"/> Phân quyền Module</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {AVAILABLE_MODULES.map(mod => (
                                <label key={mod.id} className="flex items-center space-x-3 cursor-pointer">
                                    <input type="checkbox" checked={selectedPermissions.has(mod.id)} onChange={() => handlePermissionToggle(mod.id)} className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
                                    <span className="text-sm text-gray-700">{mod.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Hủy bỏ</button>
                    <button type="submit" className="px-5 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-focus">{isEdit ? 'Lưu thay đổi' : 'Tạo người dùng'}</button>
                </div>
            </form>
        </Modal>
    );
};

// --- Main Page ---

const UsersPage: React.FC<UsersPageProps> = ({ users, setUsers, units, role }) => {
    const { showToast } = useNotification();
    const { user: currentUser } = useAuth();
    const isAdmin = role === 'Admin';

    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<ExtendedUser | null>(null);
    const [passwordModalState, setPasswordModalState] = useState<{ isOpen: boolean; user: UserPermission | null }>({ isOpen: false, user: null });

    // Stats Calculation
    const stats = useMemo(() => ({
        total: users.length,
        admin: users.filter(u => u.Role === 'Admin').length,
        staff: users.filter(u => ['Accountant', 'Operator', 'Viewer'].includes(u.Role)).length,
        residents: users.filter(u => u.Role === 'Resident').length
    }), [users]);

    // Filtering
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            if (roleFilter !== 'all' && user.Role !== roleFilter) return false;
            if (statusFilter !== 'all' && user.status !== statusFilter) return false;
            const s = searchTerm.toLowerCase();
            return !s || user.Email.toLowerCase().includes(s) || (user.Username || '').toLowerCase().includes(s);
        });
    }, [users, searchTerm, roleFilter, statusFilter]);

    // --- Core Logic Handlers (Dual Env) ---

    const persistData = async (newUsers: UserPermission[], actionSummary: string) => {
        // 1. Optimistic Update (For UI)
        setUsers(newUsers, {
            module: 'System',
            action: 'UPDATE_USERS',
            summary: actionSummary,
            before_snapshot: users
        });

        // 2. Prod Sync (For DB)
        if (IS_PROD) {
            try {
                await saveUsers(newUsers);
            } catch (error) {
                showToast('Lỗi lưu dữ liệu vào hệ thống.', 'error');
                // In a real app, we might revert state here
            }
        } else {
            console.log(`[DEV] Would save ${newUsers.length} users to DB.`);
        }
    };

    const handleSaveUser = (userToSave: ExtendedUser) => {
        const exists = users.some(u => u.Email === userToSave.Email);
        const updatedList = exists 
            ? users.map(u => u.Email === userToSave.Email ? userToSave : u) 
            : [...users, userToSave];
        
        const summary = exists ? `Cập nhật user: ${userToSave.Email}` : `Thêm user mới: ${userToSave.Email}`;
        persistData(updatedList, summary);
        
        showToast(exists ? 'Cập nhật thành công.' : 'Tạo mới thành công.', 'success');
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
            const updatedList = users.filter(u => !selectedUsers.has(u.Email));
            persistData(updatedList, `Xóa ${safeToDelete.length} người dùng.`);
            showToast(`Đã xóa ${safeToDelete.length} người dùng.`, 'success');
            setSelectedUsers(new Set());
        }
    };

    const handleSyncResidents = () => {
        if (!isAdmin) return;
        if (!confirm('Hệ thống sẽ tự động tạo tài khoản cho tất cả các căn hộ chưa có tài khoản. Tiếp tục?')) return;

        const existingUsernames = new Set(users.map(u => u.Username?.toLowerCase()));
        const newResidents: UserPermission[] = [];

        units.forEach(unit => {
            const unitId = unit.UnitID;
            if (!existingUsernames.has(unitId.toLowerCase())) {
                newResidents.push({
                    Email: `${unitId.toLowerCase()}@resident.q-home.vn`,
                    Username: unitId,
                    Role: 'Resident',
                    status: 'Active',
                    password: '123456',
                    mustChangePassword: true,
                    residentId: unitId,
                });
            }
        });

        if (newResidents.length === 0) {
            showToast('Tất cả căn hộ đều đã có tài khoản.', 'info');
            return;
        }

        const updatedList = [...users, ...newResidents];
        persistData(updatedList, `Đồng bộ: Tạo ${newResidents.length} tài khoản cư dân.`);
        showToast(`Đã tạo thêm ${newResidents.length} tài khoản cư dân.`, 'success');
    };

    const handlePasswordChange = (newPassword: string) => {
        if (!passwordModalState.user) return;
        const targetEmail = passwordModalState.user.Email;
        const updatedList = users.map(u => u.Email === targetEmail ? { ...u, password: newPassword, mustChangePassword: false } : u);
        
        persistData(updatedList, `Đổi mật khẩu cho: ${targetEmail}`);
        showToast('Đổi mật khẩu thành công.', 'success');
        setPasswordModalState({ isOpen: false, user: null });
    };

    // --- UI Helpers ---

    const toggleSelectAll = () => {
        if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set());
        else setSelectedUsers(new Set(filteredUsers.map(u => u.Email)));
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

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Tổng User" value={stats.total} icon={<UserGroupIcon className="w-6 h-6 text-gray-600"/>} className="border-l-4 border-gray-500"/>
                <StatCard label="Quản trị viên" value={stats.admin} icon={<ShieldCheckIcon className="w-6 h-6 text-red-600"/>} iconBgClass="bg-red-100" className="border-l-4 border-red-500"/>
                <StatCard label="Nhân viên" value={stats.staff} icon={<UserIcon className="w-6 h-6 text-blue-600"/>} iconBgClass="bg-blue-100" className="border-l-4 border-blue-500"/>
                <StatCard label="Cư dân" value={stats.residents} icon={<BuildingIcon className="w-6 h-6 text-green-600"/>} iconBgClass="bg-green-100" className="border-l-4 border-green-500"/>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-grow w-full md:w-auto">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input type="text" placeholder="Tìm tên, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-primary outline-none text-gray-900" />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-primary outline-none">
                    <option value="all">Tất cả vai trò</option>
                    <option value="Admin">Admin</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Operator">Operator</option>
                    <option value="Resident">Resident</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-primary outline-none">
                    <option value="all">Tất cả trạng thái</option>
                    <option value="Active">Hoạt động</option>
                    <option value="Disabled">Vô hiệu hóa</option>
                </select>
                {isAdmin && (
                    <div className="flex gap-2">
                        <button onClick={handleSyncResidents} className="px-4 py-2.5 border border-blue-600 text-blue-600 font-bold rounded-lg hover:bg-blue-50 flex items-center gap-2 whitespace-nowrap">
                            <ArrowPathIcon className="w-5 h-5" /> Đồng bộ Cư dân
                        </button>
                        <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-focus flex items-center gap-2 whitespace-nowrap shadow-sm">
                            <PlusIcon className="w-5 h-5" /> Thêm User
                        </button>
                    </div>
                )}
            </div>

            {/* Bulk Action Bar */}
            {selectedUsers.size > 0 && isAdmin && (
                <div className="bg-red-50 p-3 rounded-lg flex items-center justify-between border border-red-200 animate-fade-in-down">
                    <span className="text-red-700 font-medium ml-2">Đã chọn {selectedUsers.size} người dùng</span>
                    <button onClick={handleBulkDelete} className="px-4 py-1.5 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 flex items-center gap-2">
                        <TrashIcon className="w-4 h-4"/> Xóa đã chọn
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden border border-gray-100">
                <div className="overflow-y-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="w-12 px-6 py-4 text-center">
                                    <input type="checkbox" checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Người dùng</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Vai trò</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Trạng thái</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Quyền hạn</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map(user => (
                                <tr key={user.Email} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-center">
                                        <input type="checkbox" checked={selectedUsers.has(user.Email)} onChange={() => toggleSelectUser(user.Email)} className="w-4 h-4 rounded text-primary focus:ring-primary" disabled={user.Role === 'Admin'} />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 uppercase font-bold">
                                                {user.Username?.charAt(0) || user.Email.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900">{user.Username}</div>
                                                <div className="text-xs text-gray-500">{user.Email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                            user.Role === 'Admin' ? 'bg-red-50 text-red-700 border-red-200' : 
                                            user.Role === 'Resident' ? 'bg-green-50 text-green-700 border-green-200' :
                                            'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>{user.Role}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.status === 'Active' ? 
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-fit"><CheckCircleIcon className="w-3 h-3"/> Active</span> : 
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full w-fit"><WarningIcon className="w-3 h-3"/> Disabled</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                            {(user as ExtendedUser).permissions?.map(p => (
                                                <span key={p} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{AVAILABLE_MODULES.find(m=>m.id===p)?.label || p}</span>
                                            ))}
                                            {(!user.Role.includes('Admin') && !(user as ExtendedUser).permissions?.length) && <span className="text-xs text-gray-400 italic">Cơ bản</span>}
                                            {user.Role === 'Admin' && <span className="text-xs text-red-500 font-bold">Toàn quyền</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {isAdmin && (
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} disabled={user.Role === 'Admin' && user.Email !== currentUser?.Email} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30"><PencilSquareIcon className="w-5 h-5" /></button>
                                                <button onClick={() => setPasswordModalState({ isOpen: true, user })} disabled={user.Role === 'Admin' && user.Email !== currentUser?.Email} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-30"><KeyIcon className="w-5 h-5" /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && <div className="p-8 text-center text-gray-500">Không tìm thấy người dùng nào.</div>}
                </div>
            </div>
        </div>
    );
};

export default UsersPage;
