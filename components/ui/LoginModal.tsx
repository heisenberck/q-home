import React, { useState, useEffect } from 'react';
import type { UserPermission } from '../../types';
import Modal from './Modal';
import { KeyIcon } from './Icons';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin: (password: string) => void;
    userToSwitchTo: UserPermission | null;
    error: string | null;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin, userToSwitchTo, error }) => {
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPassword(''); // Reset password field when modal opens
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(password);
    };

    if (!isOpen || !userToSwitchTo) return null;

    return (
        <Modal title={`Đăng nhập với tư cách ${userToSwitchTo.Email.split('@')[0]}`} onClose={onClose} size="sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-center text-light-text-secondary dark:text-dark-text-secondary">
                    Vui lòng nhập mật khẩu để chuyển đổi người dùng.
                </p>
                <div>
                    <label htmlFor="password-input" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                        Mật khẩu
                    </label>
                    <div className="relative mt-1">
                         <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <KeyIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="password"
                            id="password-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoFocus
                            className="w-full pl-10 p-2 border rounded-md bg-light-bg-secondary dark:bg-dark-bg border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary"
                        />
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded-md text-center">{error}</p>
                )}

                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">
                        Hủy
                    </button>
                    <button type="submit" className="px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus">
                        Đăng nhập
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default LoginModal;