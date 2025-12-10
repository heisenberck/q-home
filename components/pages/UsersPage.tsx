
import React, { useState, useMemo, useEffect } from 'react';
import type { UserPermission, Role } from '../../types';
import { useAuth, useNotification } from '../../App';
import Modal from '../ui/Modal';
import { 
    KeyIcon, CheckCircleIcon, WarningIcon, PencilSquareIcon,
    SearchIcon, TrashIcon, ShieldCheckIcon, UserIcon, PlusIcon
} from '../ui/Icons';

interface UsersPageProps {
    users: UserPermission[];
    setUsers: (updater: React.SetStateAction<UserPermission[]>, logPayload?: any) => void;
    role: Role;
}

// Extended type locally to support permissions if not yet in global types
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

// --- Sub-components ---

const PasswordModal: React.FC<{ user: UserPermission, onSave: (pw: string) => void, onClose: () => void }> = ({ user, onSave, onClose }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (password.length < 6) {
            setError('Mật khẩu phải từ 6 ký tự trở lên.');
            return;
        }
        if (password !== confirm) {
            setError('Mật khẩu không khớp!');
            return;
        }
        onSave(password);
    };

    return (
        <Modal title={`Đặt mật khẩu mới cho ${user.Username || user.Email}`} onClose={onClose} size="sm">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none" />
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
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
        password: user?.password || '123456a@', // Default for new users
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
        
        // Basic Validation
        if (!formData.Email || !formData.Username) {
            showToast('Vui lòng nhập Email và Tên đăng nhập.', 'error');
            return;
        }

        // Uniqueness Check (Only for new users or if email changed)
        if (!isEdit || (isEdit && user.Email !== formData.Email)) {
            if (allUsers.some(u => u.Email.toLowerCase() === formData.Email.toLowerCase())) {
                showToast('Email đã tồn tại trong hệ thống.', 'error');
                return;
            }
        }

        // Prepare final data
        const finalData: ExtendedUser = {
            ...formData,
            permissions: Array.from(selectedPermissions)
        };

        onSave(finalData);
    };

    const isStaff = ['Accountant', 'Operator', 'Viewer'].includes(formData.Role);
    
    // Strict Light Mode Styles
    const inputStyle = "w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow";
    const labelStyle = "block text-sm font-medium text-gray-700 mb-1";

    return (
        <Modal title={isEdit ? `Cập nhật: ${user.Username}` : "Thêm người dùng mới"} onClose={onClose} size="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={labelStyle}>Email <span className="text-red-500">*</span></label>
                        <input 
                            type="email" 
                            required
                            value={formData.Email} 
                            onChange={e => setFormData({...formData, Email: e.target.value})} 
                            className={`${inputStyle} ${isEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                            disabled={isEdit}
                            placeholder="user@example.com"
                        />
                    </div>
                    <div>
                        <label className={labelStyle}>Tên hiển thị / Username <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            required
                            value={formData.Username} 
                            onChange={e => setFormData({...formData, Username: e.target.value})} 
                            className={inputStyle} 
                            placeholder="Nguyen Van A"
                        />
                    </div>
                    <div>
                        <label className={labelStyle}>Vai trò</label>
                        <select 
                            value={formData.Role} 
                            onChange={e => setFormData({...formData, Role: e.target.value as Role})} 
                            className={inputStyle}
                            disabled={isEdit && user.Role === 'Admin'} // Prevent downgrading existing admins easily
                        >
                            <option value="Admin">Admin (Quản trị viên)</option>
                            <option value="Accountant">Accountant (Kế toán)</option>
                            <option value="Operator">Operator (Vận hành)</option>
                            <option value="Viewer">Viewer (Xem báo cáo)</option>
                            <option value="Resident">Resident (Cư dân)</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelStyle}>Trạng thái</label>
                        <select 
                            value={formData.status} 
                            onChange={e => setFormData({...formData, status: e.target.value as any})} 
                            className={inputStyle}
                        >
                            <option value="Active">Hoạt động</option>
                            <option value="Disabled">Vô hiệu hóa</option>
                            <option value="Pending">Chờ duyệt</option>
                        </select>
                    </div>
                </div>

                {/* Module Permissions Section - Only for Staff */}
                {isStaff && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <ShieldCheckIcon className="w-5 h-5 text-primary"/> 
                            Phân quyền truy cập
                        </h4>
                        <p className="text-xs text-gray-500 mb-4">Chọn các module mà nhân viên này được phép truy cập.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {AVAILABLE_MODULES.map(mod => (
                                <label key={mod.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-gray-200">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedPermissions.has(mod.id)} 
                                        onChange={() => handlePermissionToggle(mod.id)}
                                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                    />
                                    <span className="text-sm text-gray-700">{mod.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* Admin Note */}
                {formData.Role === 'Admin' && (
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm flex items-start gap-2">
                        <CheckCircleIcon className="w-5 h-5 mt-0.5 flex-shrink-0"/>
                        <span>Tài khoản <strong>Admin</strong> có toàn quyền truy cập hệ thống. Không cần cấu hình phân quyền riêng lẻ.</span>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors">Hủy bỏ</button>
                    <button type="submit" className="px-5 py-2.5 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/30 hover:bg-primary-focus transition-all transform hover:-translate-y-0.5">
                        {isEdit ? 'Lưu thay đổi' : 'Tạo người dùng'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

// --- Main Component ---

const UsersPage: React.FC<UsersPageProps> = ({ users, setUsers, role }) => {
    const { showToast } = useNotification();
    const { user: currentUser } = useAuth();
    
    // Authorization
    const isAdmin = role === 'Admin';

    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<ExtendedUser | null>(null);
    const [passwordModalState, setPasswordModalState] = useState<{ isOpen: boolean; user: UserPermission | null }>({ isOpen: false, user: null });

    // Filtering
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            if (roleFilter !== 'all' && user.Role !== roleFilter) return false;
    
            const lowerSearch = searchTerm.toLowerCase();
            if (lowerSearch && !(
                user.Email.toLowerCase().includes(lowerSearch) ||
                (user.Username || '').toLowerCase().includes(lowerSearch)
            )) return false;
    
            return true;
        });
    }, [users, searchTerm, roleFilter]);

    // --- Handlers ---

    const handleAddUser = (newUser: ExtendedUser) => {
        setUsers(prev => [...prev, newUser], {
            module: 'System',
            action: 'CREATE_USER',
            summary: `Tạo người dùng mới: ${newUser.Email} (${newUser.Role})`,
            before_snapshot: users
        });
        showToast('Tạo người dùng thành công.', 'success');
        setIsUserModalOpen(false);
    };

    const handleUpdateUser = (updatedUser: ExtendedUser) => {
        setUsers(prev => prev.map(u => u.Email === updatedUser.Email ? updatedUser : u), {
            module: 'System',
            action: 'UPDATE_USER',
            summary: `Cập nhật người dùng: ${updatedUser.Email}`,
            ids: [updatedUser.Email],
            before_snapshot: users
        });
        showToast('Cập nhật thành công.', 'success');
        setIsUserModalOpen(false);
        setEditingUser(null);
    };

    const handleDeleteUser = (userToDelete: UserPermission) => {
        if (userToDelete.Role === 'Admin') {
            showToast('Không thể xóa tài khoản Admin.', 'error');
            return;
        }
        if (confirm(`Bạn có chắc chắn muốn xóa người dùng ${userToDelete.Email}? Hành động này không thể hoàn tác.`)) {
            setUsers(prev => prev.filter(u => u.Email !== userToDelete.Email), {
                module: 'System',
                action: 'DELETE_USER',
                summary: `Xóa người dùng: ${userToDelete.Email}`,
                ids: [userToDelete.Email],
                before_snapshot: users
            });
            showToast('Đã xóa người dùng.', 'success');
        }
    };

    const handlePasswordChange = (newPassword: string) => {
        if (passwordModalState.user) {
            const updatedUser = { ...passwordModalState.user, password: newPassword, mustChangePassword: false };
            setUsers(prev => prev.map(u => u.Email === updatedUser.Email ? updatedUser : u), {
                module: 'System',
                action: 'RESET_PASSWORD',
                summary: `Admin đổi mật khẩu cho: ${updatedUser.Email}`,
                ids: [updatedUser.Email]
            });
            showToast('Đổi mật khẩu thành công.', 'success');
            setPasswordModalState({ isOpen: false, user: null });
        }
    };

    const handleOpenEdit = (user: UserPermission) => {
        setEditingUser(user);
        setIsUserModalOpen(true);
    };

    // --- Render Helpers ---

    const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
        const styles: Record<string, string> = {
            Admin: 'bg-red-100 text-red-800 border-red-200',
            Accountant: 'bg-blue-100 text-blue-800 border-blue-200',
            Operator: 'bg-orange-100 text-orange-800 border-orange-200',
            Viewer: 'bg-gray-100 text-gray-800 border-gray-200',
            Resident: 'bg-green-100 text-green-800 border-green-200',
        };
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[role] || styles.Viewer}`}>
                {role}
            </span>
        );
    };

    const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                {status === 'Active' ? 'Hoạt động' : 'Vô hiệu'}
            </span>
        );
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Modals */}
            {isUserModalOpen && (
                <UserModal 
                    user={editingUser} 
                    onSave={editingUser ? handleUpdateUser : handleAddUser} 
                    onClose={() => { setIsUserModalOpen(false); setEditingUser(null); }} 
                    allUsers={users}
                />
            )}
            {passwordModalState.isOpen && passwordModalState.user && (
                <PasswordModal 
                    user={passwordModalState.user} 
                    onSave={handlePasswordChange} 
                    onClose={() => setPasswordModalState({ isOpen: false, user: null })} 
                />
            )}

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-grow min-w-[200px]">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm theo tên, email..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 p-2.5 border rounded-lg bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                    </div>
                    
                    <select 
                        value={roleFilter} 
                        onChange={e => setRoleFilter(e.target.value)} 
                        className="p-2.5 border rounded-lg bg-white border-gray-300 text-gray-900 focus:ring-primary outline-none"
                    >
                        <option value="all">Tất cả vai trò</option>
                        <option value="Admin">Admin</option>
                        <option value="Accountant">Accountant</option>
                        <option value="Operator">Operator</option>
                        <option value="Viewer">Viewer</option>
                        <option value="Resident">Resident</option>
                    </select>

                    {isAdmin && (
                        <button 
                            onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} 
                            className="ml-auto px-4 py-2.5 bg-primary text-white font-bold rounded-lg shadow-sm hover:bg-primary-focus flex items-center gap-2"
                        >
                            <PlusIcon className="w-5 h-5" /> Thêm người dùng
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden border border-gray-100">
                <div className="overflow-y-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Người dùng</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Vai trò</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Phân quyền</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map(user => (
                                <tr key={user.Email} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                                <UserIcon className="w-5 h-5"/>
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900">{user.Username || 'N/A'}</div>
                                                <div className="text-xs text-gray-500">{user.Email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <RoleBadge role={user.Role} />
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={user.status} />
                                    </td>
                                    <td className="px-6 py-4">
                                        {(user as ExtendedUser).permissions && (user as ExtendedUser).permissions!.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {(user as ExtendedUser).permissions!.slice(0, 2).map(p => {
                                                    const label = AVAILABLE_MODULES.find(m => m.id === p)?.label || p;
                                                    return <span key={p} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">{label}</span>
                                                })}
                                                {(user as ExtendedUser).permissions!.length > 2 && (
                                                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">+{((user as ExtendedUser).permissions?.length || 0) - 2}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">Mặc định</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <div className="flex justify-center items-center gap-2">
                                        {/* Security Check: Cannot edit/delete other Admins unless it's yourself (logic handled in functions, visual disable here) */}
                                        {isAdmin && (
                                            <>
                                                <button 
                                                    onClick={() => handleOpenEdit(user)} 
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed" 
                                                    data-tooltip="Chỉnh sửa"
                                                    disabled={user.Role === 'Admin' && user.Email !== currentUser?.Email}
                                                >
                                                    <PencilSquareIcon className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => setPasswordModalState({ isOpen: true, user })} 
                                                    className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed" 
                                                    data-tooltip="Đổi mật khẩu"
                                                    disabled={user.Role === 'Admin' && user.Email !== currentUser?.Email}
                                                >
                                                    <KeyIcon className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteUser(user)} 
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed" 
                                                    data-tooltip="Xóa"
                                                    disabled={user.Role === 'Admin' || user.Email === currentUser?.Email}
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </>
                                        )}
                                      </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="p-8 text-center text-gray-500">Không tìm thấy người dùng nào phù hợp.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UsersPage;
