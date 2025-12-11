
import React, { useState, useEffect, useMemo } from 'react';
import type { UserPermission, NewsItem, ChargeRaw, Owner } from '../../../types';
import { WarningIcon, CheckCircleIcon, SparklesIcon } from '../../ui/Icons';
import { formatCurrency, timeAgo } from '../../../utils/helpers';
import { PortalPage } from '../../layout/ResidentLayout';
import { doc, onSnapshot, collection, query, where, limit } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { isProduction } from '../../../utils/env';

interface PortalHomePageProps {
  user: UserPermission;
  owner: Owner | null;
  charges: ChargeRaw[];
  news: NewsItem[];
  setActivePage: (page: PortalPage) => void;
}

const PortalHomePage: React.FC<PortalHomePageProps> = ({ user, charges, news, setActivePage }) => {
    // 1. Calculate Current Period (YYYY-MM)
    const currentPeriod = useMemo(() => new Date().toISOString().slice(0, 7), []);
    const IS_PROD = isProduction();

    // 2. Real-time Charge State
    const [currentCharge, setCurrentCharge] = useState<ChargeRaw | null>(null);
    const [loadingCharge, setLoadingCharge] = useState(false);

    // 3. Listener for Current Month's Charge
    useEffect(() => {
        if (!user.residentId) return;

        // Initial/Fallback data from props (static load)
        const propCharge = charges.find(c => c.UnitID === user.residentId && c.Period === currentPeriod);
        if (propCharge) setCurrentCharge(propCharge);

        if (IS_PROD) {
            setLoadingCharge(true);
            
            // Prefer direct doc reference if ID schema is standard: `${period}_${unitID}`
            // But requirement said "Query: collection(db, 'charges')...", so we use query with limit(1)
            // to stay flexible if IDs change, though doc ref is cheaper.
            // Let's use the query as requested for safety.
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
                console.error("Real-time charge fetch error", err);
                setLoadingCharge(false);
            });

            return () => unsubscribe();
        }
    }, [user.residentId, currentPeriod, charges, IS_PROD]);

    // 4. Render Logic based on Real-time Data
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

        // Pending / Unpaid
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
        {/* Render the dynamic bill card */}
        {renderBillStatus()}

        <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-full">
                    <SparklesIcon className="w-5 h-5 text-purple-600"/>
                </div>
                <h3 className="font-bold text-gray-800 text-lg">Tin tức mới nhất</h3>
            </div>

            {news.slice(0, 3).map(item => (
                <div key={item.id} onClick={() => setActivePage('portalNews')} className="border-t pt-3 cursor-pointer group">
                    <p className="font-semibold group-hover:text-primary transition-colors">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(item.date)}</p>
                </div>
            ))}
        </div>
    </div>
  );
};

export default PortalHomePage;
