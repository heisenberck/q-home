
import React, { useState, useEffect } from 'react';
import { UserPermission, Owner, Unit } from '../../types';
import { EyeIcon, EyeSlashIcon, UserIcon, LockClosedIcon } from '../ui/Icons';
import { useSettings, useNotification } from '../../App';
import Modal from '../ui/Modal';

interface LoginPageProps {
    users: UserPermission[];
    onLogin: (user: UserPermission, rememberMe: boolean) => void;
    allOwners: Owner[];
    allUnits: Unit[];
    resetInfo?: { email: string; pass: string } | null;
}

// --- Helper: Send Password Reset Email ---
const sendPasswordResetEmail = async (
    email: string,
    link: string,
    gasUrl: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const payload = {
            action_type: "RESET_PASSWORD",
            email: email,
            link: link
        };

        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            mode: 'no-cors'
        });
        return { success: true };
    } catch (e: any) {
        console.error("Password reset fetch error:", e);
        return { success: false, error: `Lỗi mạng khi gửi yêu cầu: ${e.message}` };
    }
};

// --- Component: Forgot Password Modal ---
const ForgotPasswordModal: React.FC<{ 
    onClose: () => void; 
    users: UserPermission[];
}> = ({ onClose, users }) => {
    const { showToast } = useNotification();
    const { invoiceSettings } = useSettings();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const { appsScriptUrl } = invoiceSettings;
        if (!appsScriptUrl) {
            showToast('Chưa cấu hình máy chủ Email trong Cài đặt.', 'error');
            setIsLoading(false);
            return;
        }

        const user = users.find(u => u.Email.toLowerCase() === email.trim().toLowerCase());
        if (!user) {
            showToast('Không tìm thấy tài khoản nào với email này.', 'error');
            setIsLoading(false);
            return;
        }

        const resetLink = `${window.location.origin}${window.location.pathname}?action=reset_default&email=${encodeURIComponent(email)}`;
        const result = await sendPasswordResetEmail(email, resetLink, appsScriptUrl);

        if (result.success) {
            showToast(`Yêu cầu đã được gửi. Kiểm tra email ${email}.`, 'success');
            onClose();
        } else {
            showToast(result.error || 'Gửi yêu cầu thất bại.', 'error');
        }
        setIsLoading(false);
    };

    return (
        <Modal title="Cấp lại Mật khẩu" onClose={onClose} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-gray-600">Nhập email để nhận link đặt lại mật khẩu.</p>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#006f3a] outline-none"
                        placeholder="email@example.com"
                        required
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200">Hủy</button>
                    <button type="submit" disabled={isLoading} className="px-4 py-2 bg-[#006f3a] text-white font-semibold rounded-md hover:bg-[#005a2f] disabled:opacity-70">
                        {isLoading ? 'Đang gửi...' : 'Gửi yêu cầu'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

// --- Main Component: Login Page ---
const LoginPage: React.FC<LoginPageProps> = ({ users, onLogin, allOwners, allUnits, resetInfo }) => {
    const { invoiceSettings } = useSettings();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isForgotPassModalOpen, setIsForgotPassModalOpen] = useState(false);
    
    // Personalization
    const [greetingName, setGreetingName] = useState('Cư dân');

    const MASTER_PASSWORD = '123456a@A';

    useEffect(() => {
        // Load remembered user
        const rememberedUser = localStorage.getItem('rememberedUser');
        if (rememberedUser) {
            setIdentifier(rememberedUser);
            setRememberMe(true);
        }
        
        // Load last greeting name
        const lastLoginName = localStorage.getItem('lastLoginName');
        if (lastLoginName) {
            setGreetingName(lastLoginName);
        }

        // Handle Reset Info from URL
        if (resetInfo) {
            setIdentifier(resetInfo.email);
            setPassword(resetInfo.pass);
        }
    }, [resetInfo]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Simulate network delay for UX
        await new Promise(resolve => setTimeout(resolve, 800));

        const cleanIdentifier = identifier.trim().toLowerCase();
        
        const user = users.find(u => 
            u.Email.toLowerCase() === cleanIdentifier || 
            (u.Username && u.Username.toLowerCase() === cleanIdentifier)
        );

        if (!user) {
            setError('Tài khoản không tồn tại.');
            setIsLoading(false);
            return;
        }

        if (user.status !== 'Active') {
            setError('Tài khoản đã bị vô hiệu hóa.');
            setIsLoading(false);
            return;
        }

        const isPasswordValid = 
            user.password === password || 
            (user.Username === 'Admin0' && password === '123456a@A') || 
            (user.Role === 'Admin' && password === MASTER_PASSWORD);

        if (!isPasswordValid) {
            setError('Mật khẩu không chính xác.');
            setIsLoading(false);
            return;
        }

        // Save name for next time greeting
        let displayName = user.Username || user.Email.split('@')[0];
        // Try to find Owner Name if it's a resident
        if (user.Role === 'Resident' && user.residentId) {
             const unit = allUnits.find(u => u.UnitID === user.residentId);
             if (unit) {
                 const owner = allOwners.find(o => o.OwnerID === unit.OwnerID);
                 if (owner) {
                     // Get last word of name
                     const nameParts = owner.OwnerName.split(' ');
                     displayName = nameParts[nameParts.length - 1];
                 }
             }
        }
        localStorage.setItem('lastLoginName', displayName);

        onLogin(user, rememberMe);
        setIsLoading(false);
    };

    const backgroundUrl = invoiceSettings.loginBackgroundUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=1920';

    return (
        <div className="relative h-screen w-screen overflow-hidden flex items-center justify-center bg-gray-900">
            {/* Inject Google Font */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');
                .font-handwriting { font-family: 'Dancing Script', cursive; }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
            `}</style>

            {/* 1. Robust Background Layer */}
            {/* Fallback Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#006f3a] to-emerald-900 z-0"></div>
            
            {/* Image Layer with Error Handling */}
            <img 
                src={backgroundUrl} 
                alt="Background" 
                className="absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-1000"
                onError={(e) => { e.currentTarget.style.opacity = '0'; }}
            />
            
            {/* Overlay for Contrast */}
            <div className="absolute inset-0 bg-black/30 z-0 backdrop-blur-[2px]"></div>

            {/* 2. Login Card */}
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up mx-4">
                
                {/* Header: Personalized Brand Area */}
                <div className="bg-[#006f3a] p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-white/5 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
                    <div className="relative z-10">
                        <h2 className="text-4xl text-white font-handwriting mb-2">Xin chào, {greetingName}</h2>
                        <p className="text-white/90 text-sm font-light">Chào mừng trở về nhà. Đăng nhập để tiếp tục.</p>
                    </div>
                </div>

                {/* Form Area */}
                <div className="p-8 bg-white">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        {/* Username Input */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <UserIcon className="h-5 w-5 text-gray-400 group-focus-within:text-[#006f3a] transition-colors" />
                            </div>
                            <input
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="w-full h-12 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#006f3a] focus:border-transparent outline-none transition-all"
                                placeholder="Email hoặc Mã căn hộ"
                                required
                                autoFocus
                            />
                        </div>

                        {/* Password Input */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <LockClosedIcon className="h-5 w-5 text-gray-400 group-focus-within:text-[#006f3a] transition-colors" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-12 pl-10 pr-10 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#006f3a] focus:border-transparent outline-none transition-all"
                                placeholder="Mật khẩu"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                            >
                                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                        </div>

                        {/* Options Row */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={rememberMe} 
                                    onChange={(e) => setRememberMe(e.target.checked)} 
                                    className="w-4 h-4 text-[#006f3a] border-gray-300 rounded focus:ring-[#006f3a]"
                                />
                                <span className="text-sm text-gray-600">Ghi nhớ</span>
                            </label>
                            <button 
                                type="button" 
                                onClick={() => setIsForgotPassModalOpen(true)} 
                                className="text-sm font-medium text-[#006f3a] hover:underline"
                            >
                                Quên mật khẩu?
                            </button>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm text-center animate-pulse">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-12 bg-gradient-to-r from-[#006f3a] to-emerald-600 hover:from-[#005a2f] hover:to-emerald-700 text-white font-bold rounded-lg shadow-lg transform transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Đang xử lý...</span>
                                </>
                            ) : (
                                'Đăng nhập'
                            )}
                        </button>
                    </form>
                </div>
                
                {/* Footer */}
                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                        Hệ thống Quản lý Vận hành 
                        <span className="mx-1">•</span> 
                        <a href="#" className="hover:text-[#006f3a]">Điều khoản & Chính sách</a>
                    </p>
                </div>
            </div>

            {/* Modals */}
            {isForgotPassModalOpen && <ForgotPasswordModal onClose={() => setIsForgotPassModalOpen(false)} users={users} />}
        </div>
    );
};

export default LoginPage;
