import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { ChargeRaw, UserPermission } from '../../../types';
import { formatCurrency, formatNumber, generateTransferContent } from '../../../utils/helpers';
import { ReceiptIcon, CheckCircleIcon, WarningIcon, ClipboardIcon, HomeIcon, DropletsIcon, CarIcon } from '../../ui/Icons';
import { useNotification } from '../../../App';
import { useSettings } from '../../../App';
import { isProduction } from '../../../utils/env';

declare const Chart: any;

interface PortalBillingPageProps {
  charges: ChargeRaw[];
  user: UserPermission;
}

const FeeDetailCard: React.FC<{ label: string, amount: number, icon: React.ReactNode }> = ({ label, amount, icon }) => (
    <div className="bg-gray-50 p-3 rounded-lg flex items-center gap-3">
        <div className="bg-white p-2 rounded-full border">{icon}</div>
        <div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="font-bold text-gray-800">{formatCurrency(amount)}</p>
        </div>
    </div>
);

const PortalBillingPage: React.FC<PortalBillingPageProps> = ({ charges, user }) => {
  const { showToast } = useNotification();
  const { invoiceSettings } = useSettings();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const IS_PROD = isProduction();

  const residentCharges = useMemo(() => 
    charges
        .filter(c => c.UnitID === user.residentId)
        .sort((a, b) => a.Period.localeCompare(b.Period)), // Sort oldest to newest for chart
    [charges, user.residentId]
  );
  
  const currentBill = residentCharges.length > 0 ? residentCharges[residentCharges.length - 1] : null;
  const historyBills = residentCharges.slice(-7, -1); // Last 6 months from history, excluding current

  const handleCopy = (textToCopy: string, label: string) => {
      navigator.clipboard.writeText(textToCopy).then(() => {
          showToast(`Đã sao chép ${label}`, 'success');
      }).catch(() => {
          showToast(`Sao chép thất bại`, 'error');
      });
  };
  
  const paymentContent = currentBill ? generateTransferContent(currentBill, invoiceSettings) : '';

  useEffect(() => {
    if (chartRef.current && historyBills.length > 0 && !IS_PROD) {
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
            chartInstanceRef.current = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: historyBills.map(c => c.Period.substring(5)), // "MM"
                    datasets: [{
                        label: 'Tổng phí hàng tháng',
                        data: historyBills.map(c => c.TotalDue),
                        borderColor: '#006f3a',
                        backgroundColor: 'rgba(0, 111, 58, 0.1)',
                        fill: true,
                        tension: 0.3,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: false,
                            ticks: {
                                callback: function(value: any) {
                                    if (value >= 1000000) return (value / 1000000) + 'tr';
                                    if (value >= 1000) return (value / 1000) + 'k';
                                    return value;
                                }
                            }
                        }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    }
    return () => {
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }
    };
  }, [historyBills, IS_PROD]);

  if (IS_PROD) {
    return (
        <div className="p-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
                <p className="mt-4 text-gray-500">Chờ dữ liệu từ Ban Quản Lý...</p>
                <p className="text-xs text-gray-400 mt-2">Tính năng này sẽ tự động hiển thị hóa đơn khi BQL chốt phí hàng tháng.</p>
            </div>
        </div>
    );
  }

  // --- DEV MODE MOCKUP ---
  return (
    <div className="p-4 space-y-6">
      {currentBill ? (
        <div className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
            <div className="text-center">
                <p className="text-sm text-gray-500">Tổng phí kỳ {currentBill.Period}</p>
                <div className="flex items-center justify-center gap-2">
                    <p className="text-4xl font-bold text-primary">{formatCurrency(currentBill.TotalDue)}</p>
                    <button onClick={() => handleCopy(String(currentBill.TotalDue), 'tổng phí')} className="p-2 rounded-full hover:bg-gray-100">
                        <ClipboardIcon className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <FeeDetailCard label="Phí dịch vụ" amount={currentBill.ServiceFee_Total} icon={<HomeIcon className="w-5 h-5 text-green-600"/>} />
                <FeeDetailCard label="Tiền nước" amount={currentBill.WaterFee_Total} icon={<DropletsIcon className="w-5 h-5 text-blue-600"/>} />
                <FeeDetailCard label="Phí gửi xe" amount={currentBill.ParkingFee_Total} icon={<CarIcon className="w-5 h-5 text-orange-600"/>} />
                <FeeDetailCard label="Điều chỉnh" amount={currentBill.Adjustments} icon={<ReceiptIcon className="w-5 h-5 text-purple-600"/>} />
            </div>

            <div className="space-y-3 pt-4 border-t">
                 <h3 className="font-bold text-center">Thông tin chuyển khoản</h3>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Ngân hàng</span>
                    <span className="font-semibold">{invoiceSettings.bankName}</span>
                </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Chủ tài khoản</span>
                    <span className="font-semibold">{invoiceSettings.accountName}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Số tài khoản</span>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold font-mono">{invoiceSettings.accountNumber}</span>
                        <button onClick={() => handleCopy(invoiceSettings.accountNumber, 'STK')}><ClipboardIcon className="w-4 h-4 text-gray-400"/></button>
                    </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Nội dung</span>
                    <div className="flex items-center gap-2">
                         <span className="font-semibold font-mono bg-gray-100 px-1 rounded">{paymentContent}</span>
                        <button onClick={() => handleCopy(paymentContent, 'nội dung')}><ClipboardIcon className="w-4 h-4 text-gray-400"/></button>
                    </div>
                </div>
            </div>
            <button className="w-full p-3 bg-primary text-white font-bold rounded-lg shadow-md hover:bg-primary-focus">Thanh toán ngay</button>
        </div>
      ) : (
        <div className="text-center py-10 bg-white rounded-xl border">
            <p className="text-gray-500">Chưa có dữ liệu hóa đơn.</p>
        </div>
      )}

      {historyBills.length > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <h2 className="font-bold text-xl mb-4">Lịch sử Thanh toán</h2>
          <div className="h-48 mb-4">
            <canvas ref={chartRef}></canvas>
          </div>
          <ul className="space-y-2">
            {[...residentCharges].reverse().map(charge => (
                 <li key={charge.Period} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-gray-50">
                    <div>
                        <p className="font-semibold">Hóa đơn Kỳ {charge.Period}</p>
                        <p className="text-xs text-gray-400">Ngày tạo: {new Date(charge.CreatedAt).toLocaleDateString('vi-VN')}</p>
                    </div>
                    <div className="text-right">
                         <p className="font-bold">{formatCurrency(charge.TotalDue)}</p>
                         <span className="text-xs font-semibold text-green-600">Đã thanh toán</span>
                    </div>
                </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PortalBillingPage;