import React, { useState } from 'react';
import { MOCK_USER_PERMISSIONS } from '../constants';
import type { UserPermission, Role } from '../types';
import { useAuth } from '../App';

const UserManagement: React.FC = () => {
    const { role } = useAuth();
    const [users, setUsers] = useState<UserPermission[]>(MOCK_USER_PERMISSIONS);

    const canManage = role === 'Admin';

    const handleRoleChange = (email: string, newRole: Role) => {
        if (!canManage) return;
        setUsers(users.map(u => u.Email === email ? { ...u, Role: newRole } : u));
    };

    // FIX: Updated to use the 'status' property instead of 'Active' and toggle between 'Active' and 'Disabled'.
    const handleStatusToggle = (email: string) => {
        if (!canManage) return;
        setUsers(users.map(u => u.Email === email ? { ...u, status: u.status === 'Active' ? 'Disabled' : 'Active' } : u));
    };

    return (
        <div className="bg-background dark:bg-dark-secondary p-4 sm:p-6 rounded-lg shadow-md">
            <h2 className="text-3xl font-bold text-text-primary dark:text-dark-text-primary mb-6">Quản lý Người dùng</h2>
            {!canManage && <p className="text-red-600 mb-4">Chỉ Admin mới có quyền truy cập chức năng này.</p>}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border-color">
                    <thead className="bg-gray-50 dark:bg-dark-secondary">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Vai trò</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Trạng thái</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-dark-background divide-y divide-gray-200 dark:divide-dark-border-color">
                        {users.map(user => (
                            <tr key={user.Email}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary dark:text-dark-text-primary">{user.Email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <select 
                                        value={user.Role}
                                        onChange={(e) => handleRoleChange(user.Email, e.target.value as Role)}
                                        disabled={!canManage}
                                        className="p-1 border rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed bg-background dark:bg-dark-background dark:border-dark-border-color text-text-primary dark:text-dark-text-primary"
                                    >
                                        <option value="Admin">Admin</option>
                                        <option value="Accountant">Accountant</option>
                                        <option value="Operator">Operator</option>
                                        <option value="Viewer">Viewer</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {/* FIX: Replaced 'Active' property with 'status' and handled all three states ('Active', 'Disabled', 'Pending'). */}
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'Active' ? 'bg-green-100 text-green-800' : user.status === 'Disabled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {user.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                        onClick={() => handleStatusToggle(user.Email)}
                                        disabled={!canManage}
                                        className="text-primary hover:text-primary-dark disabled:text-gray-400 disabled:cursor-not-allowed"
                                    >
                                        {/* FIX: Replaced 'Active' property with 'status' for correct button text. */}
                                        {user.status === 'Active' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserManagement;