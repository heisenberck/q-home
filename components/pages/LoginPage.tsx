
import React, { useState } from 'react';
import { UserPermission } from '../../types';
import { EyeIcon } from '../ui/Icons';

interface LoginPageProps {
    users: UserPermission[];
    onLogin: (user: UserPermission) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ users, onLogin }) => {
    const [identifier, setIdentifier] = useState(''); // Email or Username
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const MASTER_PASSWORD = '123456a@A';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Simulate network delay for better UX feel
        await new Promise(resolve => setTimeout(resolve, 600));

        const cleanIdentifier = identifier.trim().toLowerCase();
        
        const user = users.find(u => 
            u.Email.toLowerCase() === cleanIdentifier || 
            (u.Username && u.Username.toLowerCase() === cleanIdentifier)
        );

        if (!user) {
            setError('Tên đăng nhập hoặc Email không tồn tại.');
            setIsLoading(false);
            return;
        }

        if (user.status !== 'Active') {
            setError('Tài khoản này chưa được kích hoạt hoặc đã bị vô hiệu hóa.');
            setIsLoading(false);
            return;
        }

        const isPasswordValid = user.password === password || (user.Role === 'Admin' && password === MASTER_PASSWORD);

        if (!isPasswordValid) {
            setError('Mật khẩu không chính xác.');
            setIsLoading(false);
            return;
        }

        onLogin(user);
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4 relative overflow-hidden">
            {/* Background Image */}
            <div 
                className="absolute inset-0 z-0 bg-cover bg-center" 
                style={{ 
                    backgroundImage: 'url("https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=1920")',
                    filter: 'brightness(0.5)'
                }}
            ></div>

            <div className="max-w-md w-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden z-10 border border-white/20">
                <div className="bg-primary p-8 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
                     {/* Logo Icon */}
                     <div className="relative z-10 flex justify-center mb-3">
                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                            </svg>
                        </div>
                     </div>
                     <h1 className="text-3xl font-bold text-white mb-2 relative z-10">Q-Home Manager</h1>
                     <div className="inline-block bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full relative z-10 shadow-sm uppercase tracking-wide">
                        HUD3 Linh Đàm
                     </div>
                </div>
                
                <div className="p-8 pt-8">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white text-center mb-6">Đăng nhập</h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email hoặc Tên đăng nhập</label>
                            <input 
                                type="text" 
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
                                placeholder="Email hoặc Tên đăng nhập"
                                required
                                autoFocus
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mật khẩu</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
                                    placeholder="••••••••"
                                    required
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                    tabIndex={-1}
                                >
                                    <EyeIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm text-center font-medium">
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-primary hover:bg-primary-focus text-white font-bold rounded-lg shadow-lg transform transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                         <p className="text-sm text-gray-500 dark:text-gray-400">
                            Quên mật khẩu? Vui lòng liên hệ Admin.
                        </p>
                    </div>
                </div>
                 <div className="bg-gray-50/50 dark:bg-gray-700/30 p-4 text-center border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">© {new Date().getFullYear()} Q-Home Manager. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
