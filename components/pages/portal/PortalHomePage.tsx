
import React, { useState, useEffect, useMemo } from 'react';
import type { UserPermission, NewsItem, ChargeRaw, Owner } from '../../../types';
import { WarningIcon, CheckCircleIcon, SparklesIcon, ChevronRightIcon } from '../../ui/Icons';
import { formatCurrency, timeAgo } from '../../../utils/helpers';
import { PortalPage } from '../../layout/ResidentLayout';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useNews } from '../../../hooks/useNews';
import { isProduction } from '../../../utils/env';

interface PortalHomePageProps {
  user: UserPermission;
  owner: Owner | null;
  charges: ChargeRaw[];
  news: NewsItem[]; // Prop kept but listener prioritized
  setActivePage: (page: PortalPage) => void;
}

const PortalHomePage: React.FC<PortalHomePageProps> = ({ user, charges, setActivePage }) => {
    const currentPeriod = useMemo(() => new Date().toISOString().slice(0, 7), []);
    const IS_PROD = isProduction();

    const [currentCharge, setCurrentCharge] = useState<ChargeRaw | null>(null);
    const { news, loading: newsLoading } = useNews(3); // Real-time fix

    useEffect(() => {
        if (!user.residentId) return;

        if (IS_PROD) {
            const q = query(
                collection(db, 'charges'), 
                where('UnitID', '==', user.residentId), 
                where('Period', '==', currentPeriod),
                limit(1)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    setCurrentCharge(snapshot.docs[0].data() as ChargeRaw);
                } else {
                    setCurrentCharge(null);
                }
            });

            return () => unsubscribe();
        }
    }, [user.residentId, currentPeriod, IS_PROD]);

    const renderBillStatus = () => {
        if (!currentCharge) {
             return (
                <div className="bg-green-50 border border-green-200 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
                     <div className="p-3 bg-white rounded-xl shadow-sm"><CheckCircleIcon className="w-7 h-7 text-green-600"/></div>
                    <div>
                        <p className="font-bold text-green-800 text-base">Thông báo phí</p>
                        <p className="text-sm text-green-700 font-medium">Chưa có thông báo mới tháng này.</p>
                    </div>
                </div>
            );
        }

        const isPaid = ['paid', 'paid_tm', 'paid_ck'].includes(currentCharge.paymentStatus);
        
        if (isPaid) {
             return (
                <div className="bg-emerald-600 p-5 rounded-2xl flex items-center gap-4 shadow-lg text-white">
                     <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm"><CheckCircleIcon className="w-7 h-7 text-white"/></div>
                    <div>
                        <p className="font-bold text-lg">Đã thanh toán</p>
                        <p className="text-sm opacity-90 font-medium">Cảm ơn bạn đã nộp phí đúng hạn!</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-white p-5 rounded-2xl shadow-xl border-2 border-red-500/10 flex items-center gap-4 cursor-pointer hover:shadow-2xl transition-all active:scale-95" onClick={() => setActivePage('portalBilling')}>
                <div className="p-3 bg-red-50 rounded-xl text-red-600"><WarningIcon className="w-7 h-7 animate-pulse"/></div>
                <div className="flex-1">
                    <p className="font-black text-gray-800 uppercase text-xs tracking-widest mb-1">Cần thanh toán</p>
                    <p className="text-xl font-black text-red-600">
                        {formatCurrency(currentCharge.TotalDue)}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold mt-1">HẠN CHÓT: 20/{currentPeriod.split('-')[1]}/{currentPeriod.split('-')[0]}</p>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-gray-300" />
            </div>
        );
    };

  return (
    <div className="p-5 space-y-6">
        {renderBillStatus()}

        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-100 rounded-lg"><SparklesIcon className="w-4 h-4 text-purple-600"/></div>
                    <h3 className="font-black text-gray-800 text-sm uppercase tracking-wider">Tin tức mới</h3>
                </div>
                <button onClick={() => setActivePage('portalNews')} className="text-xs font-bold text-primary hover:underline">Tất cả</button>
            </div>

            <div className="space-y-3">
                {newsLoading ? (
                    [1,2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>)
                ) : news.length > 0 ? (
                    news.map(item => (
                        <div key={item.id} onClick={() => setActivePage('portalNews')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:bg-gray-50 transition-colors group">
                            <div className="flex gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-800 group-hover:text-primary transition-colors text-sm line-clamp-1">{item.title}</p>
                                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.content.replace(/<[^>]*>?/gm, '')}</p>
                                    <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-tight">{timeAgo(item.date)}</p>
                                </div>
                                {item.imageUrl && (
                                    <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                                        <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-8 text-center text-gray-400 bg-white rounded-2xl border border-dashed">
                        <p className="text-xs font-bold italic">Không có tin tức mới.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default PortalHomePage;
