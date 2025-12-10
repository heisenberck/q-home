import React from 'react';
import type { UserPermission, NewsItem, ChargeRaw, Owner } from '../../../types';
import { WarningIcon, CheckCircleIcon, SparklesIcon } from '../../ui/Icons';
import { formatCurrency, timeAgo } from '../../../utils/helpers';
import { PortalPage } from '../../layout/ResidentLayout';

interface PortalHomePageProps {
  user: UserPermission;
  owner: Owner | null;
  charges: ChargeRaw[];
  news: NewsItem[];
  setActivePage: (page: PortalPage) => void;
}

const PortalHomePage: React.FC<PortalHomePageProps> = ({ user, charges, news, setActivePage }) => {
    const unpaidCharges = charges.filter(c => c.UnitID === user.residentId && c.paymentStatus !== 'paid' && c.paymentStatus !== 'paid_ck' && c.paymentStatus !== 'paid_tm');
    const totalUnpaid = unpaidCharges.reduce((sum, charge) => sum + (charge.TotalDue - charge.TotalPaid), 0);

  return (
    <div className="p-4 space-y-6">
        {totalUnpaid > 0 ? (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-4">
                <div className="p-2 bg-red-100 rounded-full"><WarningIcon className="w-6 h-6 text-red-600"/></div>
                <div>
                    <p className="font-bold text-red-800">Thông báo Nợ phí</p>
                    <p className="text-sm text-red-700">Bạn có hóa đơn chưa thanh toán với tổng số tiền là <span className="font-bold">{formatCurrency(totalUnpaid)}</span></p>
                </div>
            </div>
        ) : (
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-4">
                 <div className="p-2 bg-green-100 rounded-full"><CheckCircleIcon className="w-6 h-6 text-green-600"/></div>
                <div>
                    <p className="font-bold text-green-800">Thông báo phí</p>
                    <p className="text-sm text-green-700">Bạn chưa có khoản phí nào cần thanh toán trong kỳ này.</p>
                </div>
            </div>
        )}

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