
import React, { useState, useMemo, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ChargeRaw, UserPermission } from '../../../types';
import { formatCurrency, generateTransferContent } from '../../../utils/helpers';
import { 
    ReceiptIcon, CheckCircleIcon, ClipboardIcon, 
    HomeIcon, DropletsIcon, CarIcon, XMarkIcon, 
    ArrowDownTrayIcon, BanknotesIcon, ClockIcon
} from '../../ui/Icons';
import { useNotification, useSettings } from '../../../App';
import Modal from '../../ui/Modal';

interface PortalBillingPageProps {
  charges: ChargeRaw[];
  user: UserPermission;
}

// --- Helper Components ---

const DetailRow: React.FC<{ label: string; value: number; icon: React.ReactNode; colorClass: string }> = ({ label, value, icon, colorClass }) => (
    <div className="flex justify-between items-center py-2">
        <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-full ${colorClass}`}>
                {icon}
            </div>
            <span className="text-gray-600 text-sm font-medium">{label}</span>
        </div>
        <span className="font-semibold text-gray-900">{formatCurrency(value)}</span>
    </div>
);

const CopyButton: React.FC<{ text: string; label: string }> = ({ text, label }) => {
    const { showToast } = useNotification();
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        showToast(`Đã sao chép ${label}`, 'success');
    };
    return (
        <button onClick={handleCopy} className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-md transition-colors" title="Sao chép">
            <ClipboardIcon className="w-4 h-4" />
        </button>
    );
};

const QRModal: React.FC<{ 
    qrUrl: string; 
    amount: number; 
    onClose: () => void;
    onDownloadSuccess: () => void;
}> = ({ qrUrl, amount, onClose, onDownloadSuccess }) => {
    const handleDownload = async () => {
        try {
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `QR_ThanhToan_${amount}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            onDownloadSuccess();
        } catch (e) {
            console.error("Download failed", e);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-down">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                <div className="p-4 bg-primary text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg">Quét mã thanh toán</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full"><XMarkIcon className="w-6 h-6"/></button>
                </div>
                <div className="p-8 flex flex-col items-center bg-white">
                    <div className="p-2 border-2 border-primary/20 rounded-xl shadow-inner bg-white">
                        <img src={qrUrl} alt="VietQR" className="w-64 h-64 object-contain rounded-lg" />
                    </div>
                    <p className="mt-4 text-2xl font-bold text-primary">{formatCurrency(amount)}</p>
                    <p className="text-sm text-gray-500 text-center mt-2">Sử dụng App Ngân hàng hoặc Camera để quét mã</p>
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center">
                    <button 
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-full shadow-sm hover:bg-gray-100 transition-colors"
                    >
                        <ArrowDownTrayIcon className="w-5 h-5"/> Lưu ảnh QR
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main Page ---

const PortalBillingPage: React.FC<PortalBillingPageProps> = ({ charges, user }) => {
  const { invoiceSettings } = useSettings();
  const { showToast } = useNotification();
  const [showQR, setShowQR] = useState(false);
  const [isPaymentInitiated, setIsPaymentInitiated] = useState(false);

  // 1. Logic: Filter & Sort Data
  const sortedCharges = useMemo(() => 
    charges
        .filter(c => c.UnitID === user.residentId)
        .sort((a, b) => a.Period.localeCompare(b.Period)), 
    [charges, user.residentId]
  );

  const currentCharge = sortedCharges.length > 0 ? sortedCharges[sortedCharges.length - 1] : null;
  const historyData = sortedCharges.slice(-6).map(c => ({
      name: `T${c.Period.split('-')[1]}`,
      amount: c.TotalDue,
      fullDate: c.Period
  }));

  // 2. Logic: Payment Info
  const paymentContent = currentCharge ? generateTransferContent(currentCharge, invoiceSettings) : '';
  const bankId = invoiceSettings.bankName?.split('-')[0]?.trim().replace(/\s/g, '') || 'MB'; 
  const accountName = encodeURIComponent(invoiceSettings.accountName || '');
  
  const qrUrl = currentCharge 
    ? `https://img.vietqr.io/image/${bankId}-${invoiceSettings.accountNumber}-compact2.png?amount=${currentCharge.TotalDue}&addInfo=${encodeURIComponent(paymentContent)}&accountName=${accountName}`
    : '';

  const handleQRDownloadSuccess = () => {
      setShowQR(false);
      setIsPaymentInitiated(true);
      showToast("Đã lưu mã QR. Vui lòng hoàn tất chuyển khoản trên App ngân hàng.", "success", 5000);
  };

  if (!currentCharge) {
      return (
          <div className="flex flex-col items-center justify-center h-64 p-4 text-center">
              <ReceiptIcon className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600">Chưa có thông báo phí</h3>
              <p className="text-sm text-gray-500 max-w-xs mt-2">Hiện tại căn hộ của bạn chưa có dữ liệu phí dịch vụ nào.</p>
          </div>
      );
  }

  const isPaid = ['paid', 'paid_tm', 'paid_ck'].includes(currentCharge.paymentStatus);
  // Safe access for optional properties
  const sentCount = (currentCharge as any).sentCount || 1;
  const [year, month] = currentCharge.Period.split('-');
  const deadline = `20/${month}/${year}`;

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto pb-24">
        {showQR && (
            <QRModal 
                qrUrl={qrUrl} 
                amount={currentCharge.TotalDue} 
                onClose={() => setShowQR(false)} 
                onDownloadSuccess={handleQRDownloadSuccess}
            />
        )}

        {/* SECTION A: BILL SUMMARY CARD */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
            {isPaid && (
                <div className="absolute top-4 right-4 z-10">
                    <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200 shadow-sm">
                        <CheckCircleIcon className="w-3 h-3"/> Đã thanh toán
                    </span>
                </div>
            )}
            
            {/* Header Pattern */}
            <div className="h-2 bg-gradient-to-r from-primary to-emerald-400"></div>
            
            <div className="p-5">
                <h2 className="text-xl font-bold text-gray-800 mb-1">Thông báo phí {currentCharge.Period}</h2>
                <p className="text-red-500 text-sm font-medium mb-6">
                    Lần {sentCount} - Hạn thanh toán: {deadline}
                </p>

                <div className="space-y-1">
                    <DetailRow label="Phí dịch vụ" value={currentCharge.ServiceFee_Total} icon={<HomeIcon className="w-4 h-4 text-blue-600"/>} colorClass="bg-blue-50" />
                    <DetailRow label="Phí gửi xe" value={currentCharge.ParkingFee_Total} icon={<CarIcon className="w-4 h-4 text-orange-600"/>} colorClass="bg-orange-50" />
                    <DetailRow label="Tiền nước" value={currentCharge.WaterFee_Total} icon={<DropletsIcon className="w-4 h-4 text-cyan-600"/>} colorClass="bg-cyan-50" />
                    {currentCharge.Adjustments !== 0 && (
                        <DetailRow label="Điều chỉnh" value={currentCharge.Adjustments} icon={<ReceiptIcon className="w-4 h-4 text-purple-600"/>} colorClass="bg-purple-50" />
                    )}
                </div>

                <div className="my-4 border-t border-dashed border-gray-300"></div>

                <div className="flex justify-between items-end">
                    <span className="text-sm font-semibold text-gray-600 mb-1">TỔNG CỘNG</span>
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold text-red-600">{formatCurrency(currentCharge.TotalDue)}</span>
                        <CopyButton text={currentCharge.TotalDue.toString()} label="số tiền" />
                    </div>
                </div>
            </div>
        </section>

        {/* SECTION B: SMART PAY */}
        {!isPaid && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <BanknotesIcon className="w-6 h-6"/>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800">Thông tin chuyển khoản</h3>
                        <p className="text-xs text-gray-500">{invoiceSettings.bankName}</p>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="overflow-hidden">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Số tài khoản</p>
                            <p className="text-lg font-mono font-bold text-gray-800 tracking-wide truncate">{invoiceSettings.accountNumber}</p>
                        </div>
                        <CopyButton text={invoiceSettings.accountNumber} label="số tài khoản" />
                    </div>
                    <div className="w-full h-px bg-gray-200"></div>
                    <div className="flex justify-between items-center">
                        <div className="overflow-hidden">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Nội dung</p>
                            <p className="text-sm font-mono font-bold text-primary truncate">{paymentContent}</p>
                        </div>
                        <CopyButton text={paymentContent} label="nội dung" />
                    </div>
                </div>

                {isPaymentInitiated ? (
                    <button 
                        disabled
                        className="w-full py-3.5 bg-green-600 text-white font-bold rounded-xl shadow-md cursor-default flex items-center justify-center gap-2 transition-all opacity-100"
                    >
                        <CheckCircleIcon className="w-5 h-5" /> Đã thực hiện thanh toán
                    </button>
                ) : (
                    <button 
                        onClick={() => setShowQR(true)}
                        className="w-full py-3.5 bg-gradient-to-r from-[#006f3a] to-[#005a2f] text-white font-bold rounded-xl shadow-lg shadow-green-900/20 hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <ArrowDownTrayIcon className="w-5 h-5" /> Thanh toán ngay (QR)
                    </button>
                )}
            </section>
        )}

        {/* SECTION C: HISTORY CHART */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wider">Lịch sử 6 tháng</h3>
            <div className="h-48 w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis 
                            dataKey="name" 
                            tick={{fontSize: 11, fill: '#9ca3af'}} 
                            axisLine={false} 
                            tickLine={false} 
                            dy={10}
                        />
                        <YAxis hide />
                        <Tooltip 
                            formatter={(value: number) => [formatCurrency(value), 'Tổng']}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="amount" 
                            stroke="#006f3a" 
                            strokeWidth={3} 
                            dot={{ r: 3, fill: '#006f3a', strokeWidth: 2, stroke: '#fff' }} 
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            
            <div className="mt-4 space-y-3">
                {[...sortedCharges].reverse().slice(0, 3).map(bill => {
                    const isBillPaid = ['paid', 'paid_tm', 'paid_ck'].includes(bill.paymentStatus);
                    const isProcessing = isPaymentInitiated && bill.Period === currentCharge.Period && !isBillPaid;
                    
                    let statusText = isBillPaid ? 'Đã thanh toán' : 'Chưa thanh toán';
                    let statusColor = isBillPaid ? 'text-green-600' : 'text-red-500';
                    
                    if (isProcessing) {
                        statusText = 'Đang xử lý';
                        statusColor = 'text-orange-500';
                    }

                    return (
                        <div key={bill.Period} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                            <div>
                                <p className="font-semibold text-gray-700">Tháng {bill.Period.split('-')[1]}</p>
                                <p className="text-xs text-gray-400">{new Date(bill.CreatedAt).toLocaleDateString('vi-VN')}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-gray-800">{formatCurrency(bill.TotalDue)}</p>
                                <span className={`text-[10px] font-bold ${statusColor} flex items-center justify-end gap-1`}>
                                    {isProcessing && <ClockIcon className="w-3 h-3"/>}
                                    {statusText}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    </div>
  );
};

export default PortalBillingPage;
