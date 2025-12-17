import React, { useState, useEffect } from 'react';
import { SmartphoneIcon, CloudArrowDownIcon, XMarkIcon, ShareIcon } from '../ui/Icons';
import Modal from '../ui/Modal';

// --- Local Icons ---
const DownloadIcon: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

const InstallPWA: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSModal, setShowIOSModal] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // 1. Check if already installed
        const checkStandalone = () => {
            const isWindowStandalone = window.matchMedia('(display-mode: standalone)').matches;
            // @ts-ignore
            const isNavStandalone = window.navigator.standalone === true;
            setIsStandalone(isWindowStandalone || isNavStandalone);
        };

        checkStandalone();

        // 2. Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIPhone = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIPhone);

        // 3. Android/Chrome/Desktop prompt listener
        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Show iOS button if not standalone
        if (isIPhone && !isStandalone) {
            setIsVisible(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, [isStandalone]);

    const handleInstallClick = async () => {
        if (isIOS) {
            setShowIOSModal(true);
            return;
        }

        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
            setIsVisible(false);
        }
        
        setDeferredPrompt(null);
    };

    // Don't render anything if app is installed
    if (isStandalone || !isVisible) return null;

    return (
        <>
            <div className="px-3 py-2">
                <button
                    onClick={handleInstallClick}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all active:scale-[0.98] group"
                >
                    <SmartphoneIcon className="w-5 h-5 group-hover:animate-bounce" />
                    <span className="text-sm font-bold">Cài đặt Ứng dụng</span>
                </button>
            </div>

            {/* iOS Instruction Modal */}
            {showIOSModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">Cài đặt vào màn hình</h3>
                            <button onClick={() => setShowIOSModal(false)} className="p-1 hover:bg-gray-200 rounded-full">
                                <XMarkIcon className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
                                    <DownloadIcon className="w-8 h-8 text-emerald-600" />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                        Để sử dụng ứng dụng mượt mà hơn, vui lòng thêm vào màn hình chính:
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-white rounded-full shadow-sm flex items-center justify-center text-xs font-bold text-emerald-600 border">1</div>
                                    <p className="text-sm text-gray-700">
                                        Bấm nút <strong>Chia sẻ (Share)</strong> <ShareIcon className="inline w-4 h-4 text-blue-500 mx-0.5" /> ở thanh công cụ trình duyệt.
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-white rounded-full shadow-sm flex items-center justify-center text-xs font-bold text-emerald-600 border">2</div>
                                    <p className="text-sm text-gray-700">
                                        Chọn <strong>"Thêm vào MH chính" (Add to Home Screen)</strong>.
                                    </p>
                                </div>
                            </div>

                            <button 
                                onClick={() => setShowIOSModal(false)}
                                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors"
                            >
                                Đã hiểu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default InstallPWA;
