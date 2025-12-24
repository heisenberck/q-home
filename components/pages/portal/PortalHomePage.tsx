
import React, { useState, useEffect, useMemo } from 'react';
import type { UserPermission, NewsItem, ChargeRaw, Owner } from '../../../types';
import { WarningIcon, CheckCircleIcon, SparklesIcon } from '../../ui/Icons';
import { formatCurrency, timeAgo } from '../../../utils/helpers';
import { PortalPage } from '../../layout/ResidentLayout';
import { doc, onSnapshot, collection, query, where, limit } from 'firebase/firestore';
import { db, auth } from '../../../firebaseConfig';
import { isProduction } from '../../../utils/env';

interface PortalHomePageProps {
  user: UserPermission;
  owner: Owner | null;
  charges: ChargeRaw[];
  news: NewsItem[];
  setActivePage: (page: PortalPage) => void;
}

const PortalHomePage: React.FC<PortalHomePageProps> = ({ user, charges, news, setActivePage }) => {
    const currentPeriod = useMemo(() => new Date().toISOString().slice(0, 7), []);
    const IS_PROD = isProduction();

    const [currentCharge, setCurrentCharge] = useState<ChargeRaw | null>(null);
    const [loadingCharge, setLoadingCharge] = useState(false);

    useEffect(() => {
        // Chỉ bắt đầu lắng nghe khi user có residentId và đã được Firebase xác thực hoàn tất
        if (!user.residentId || !auth.currentUser) return;

        const propCharge = charges.find(c => c.UnitID === user.residentId && c.Period === currentPeriod);
        if (propCharge) setCurrentCharge(propCharge);

        if (IS_PROD) {
            setLoadingCharge(true);
            const q = query(
                collection(db, 'charges'), 
                where('UnitID', '==', user.residentId), 
                where('Period', '==', currentPeriod),
                limit(1)
            );
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const data = snapshot.docs[0].data() as ChargeRaw;
                    setCurrentCharge(data);
                } else {
                    setCurrentCharge(null);
                }
                setLoadingCharge(false);
            }, (err) => {
                // Xử lý lỗi phân quyền một cách êm ái
                if (err.code === 'permission-denied') {
                    console.warn("PortalHome: Chờ xác thực quyền truy cập...");
                } else {
                    console.error("PortalHome Snapshot Error:", err);
                }
                setLoadingCharge(false);
            });
            
            return () => unsubscribe();
        }
    }, [user.residentId, currentPeriod, IS_PROD, charges]);

    const latestNews = useMemo(() => {
        return [...news]
            .filter(n => !n.isArchived)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 3);
    }, [news]);

    const renderBillStatus = () => {
        if (!currentCharge) {
             return (
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-4">
                     <div className="p-2 bg-green-100 rounded-full"><CheckCircleIcon className="w-6 h-6 text-green-600"/></div>
                    <div>
                        <p className="font-bold text-green-800">Thông báo phí</p>
                        <p className="text-sm text-green-700">Chưa có thông báo phí cho kỳ {currentPeriod}.</p>
                    </div>
                </div>
            );
        }

        const isPaid = ['paid', 'paid_tm', 'paid_ck'].includes(currentCharge.paymentStatus);
        if (isPaid) {
             return (
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-4">
                     <div className="p-2 bg-green-100 rounded-full"><CheckCircleIcon className="w-6 h-6 text-green-600"/></div>
                    <div>
                        <p className="font-bold text-green-800">Đã thanh toán</p>
                        <p className="text-sm text-green-700">Bạn đã thanh toán phí dịch vụ tháng này. Cảm ơn cư dân!</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-red-100 transition-colors" onClick={() => setActivePage('portalBilling')}>
                <div className="p-2 bg-red-100 rounded-full"><WarningIcon className="w-6 h-6 text-red-600"/></div>
                <div>
                    <p className="font-bold text-red-800">Thông báo phí T{currentPeriod.split('-')[1]}</p>
                    <p className="text-sm text-red-700">
                        Bạn có hóa đơn chưa thanh toán: <span className="font-bold">{formatCurrency(currentCharge.TotalDue)}</span>
                    </p>
                </div>
            </div>
        );
    };

  return (
    <div className="p-4 space-y-6">
        {renderBillStatus()}

        <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-full">
                    <SparklesIcon className="w-5 h-5 text-purple-600"/>
                </div>
                <h3 className="font-bold text-gray-800 text-lg">Tin tức mới nhất</h3>
            </div>

            {latestNews.length > 0 ? latestNews.map(item => (
                <div key={item.id} onClick={() => setActivePage('portalNews')} className="border-t pt-3 cursor-pointer group">
                    <p className="font-semibold group-hover:text-primary transition-colors">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(item.date)}</p>
                </div>
            )) : (
                <p className="text-sm text-gray-400 italic text-center py-4">Hiện không có tin tức mới nào.</p>
            )}
            
            {latestNews.length > 0 && (
                <button 
                    onClick={() => setActivePage('portalNews')}
                    className="w-full pt-2 text-primary font-bold text-sm hover:underline flex justify-center items-center gap-1"
                >
                    Xem tất cả tin tức
                </button>
            )}
        </div>
    </div>
  );
};

export default PortalHomePage;
