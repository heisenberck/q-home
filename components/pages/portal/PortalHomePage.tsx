
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { UserPermission, NewsItem, ChargeRaw, Owner } from '../../../types';
import { WarningIcon, CheckCircleIcon, SparklesIcon, ArrowPathIcon } from '../../ui/Icons';
import { formatCurrency, timeAgo } from '../../../utils/helpers';
import { PortalPage } from '../../layout/ResidentLayout';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { isProduction } from '../../../utils/env';

interface PortalHomePageProps {
  user: UserPermission;
  owner: Owner | null;
  charges: ChargeRaw[];
  news: NewsItem[];
  setActivePage: (page: PortalPage) => void;
}

// In-memory cache for resident bills to prevent spamming Firestore
const BILL_CACHE: Record<string, { data: ChargeRaw | null, ts: number }> = {};
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const PortalHomePage: React.FC<PortalHomePageProps> = ({ user, news, setActivePage }) => {
    const currentPeriod = useMemo(() => new Date().toISOString().slice(0, 7), []);
    const IS_PROD = isProduction();

    const [currentCharge, setCurrentCharge] = useState<ChargeRaw | null>(null);
    const [loadingCharge, setLoadingCharge] = useState(false);
    const isInitialMount = useRef(true);

    const fetchBill = async (force = false) => {
        if (!user.residentId || !IS_PROD) return;

        const cacheKey = `${user.residentId}_${currentPeriod}`;
        const now = Date.now();

        if (!force && BILL_CACHE[cacheKey] && (now - BILL_CACHE[cacheKey].ts < CACHE_TTL)) {
            setCurrentCharge(BILL_CACHE[cacheKey].data);
            return;
        }

        setLoadingCharge(true);
        try {
            const q = query(
                collection(db, 'charges'), 
                where('UnitID', '==', user.residentId), 
                where('Period', '==', currentPeriod),
                limit(1)
            );
            const snapshot = await getDocs(q);
            const data = !snapshot.empty ? snapshot.docs[0].data() as ChargeRaw : null;
            
            BILL_CACHE[cacheKey] = { data, ts: now };
            setCurrentCharge(data);
        } catch (err) {
            console.error("Error fetching bill:", err);
        } finally {
            setLoadingCharge(false);
        }
    };

    useEffect(() => {
        if (isInitialMount.current) {
            fetchBill();
            isInitialMount.current = false;
        }
    }, [user.residentId, currentPeriod]);

    const latestNews = useMemo(() => {
        return [...news]
            .filter(n => !n.isArchived)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 3);
    }, [news]);

    const renderBillStatus = () => {
        if (loadingCharge) return <div className="animate-pulse bg-gray-100 h-24 rounded-xl"></div>;

        if (!currentCharge) {
             return (
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-100 rounded-full"><CheckCircleIcon className="w-6 h-6 text-green-600"/></div>
                        <div>
                            <p className="font-bold text-green-800">Hóa đơn sạch</p>
                            <p className="text-sm text-green-700">Chưa có thông báo phí cho kỳ này.</p>
                        </div>
                    </div>
                    <button onClick={() => fetchBill(true)} className="text-green-600 p-2 active:scale-90"><ArrowPathIcon className="w-4 h-4" /></button>
                </div>
            );
        }

        const isPaid = ['paid', 'paid_tm', 'paid_ck'].includes(currentCharge.paymentStatus);
        if (isPaid) {
             return (
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-100 rounded-full"><CheckCircleIcon className="w-6 h-6 text-green-600"/></div>
                        <div>
                            <p className="font-bold text-green-800">Đã thanh toán</p>
                            <p className="text-sm text-green-700">Cảm ơn cư dân đã hoàn thành nghĩa vụ phí!</p>
                        </div>
                    </div>
                    <button onClick={() => fetchBill(true)} className="text-green-600 p-2 active:scale-90"><ArrowPathIcon className="w-4 h-4" /></button>
                </div>
            );
        }

        return (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => setActivePage('portalBilling')}>
                    <div className="p-2 bg-red-100 rounded-full"><WarningIcon className="w-6 h-6 text-red-600"/></div>
                    <div>
                        <p className="font-bold text-red-800">Chưa nộp: T{currentPeriod.split('-')[1]}</p>
                        <p className="text-sm text-red-700 font-bold">{formatCurrency(currentCharge.TotalDue)}</p>
                    </div>
                </div>
                <button onClick={() => fetchBill(true)} className="text-red-600 p-2 active:scale-90"><ArrowPathIcon className="w-4 h-4" /></button>
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
