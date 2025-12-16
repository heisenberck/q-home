
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
import { formatCurrency, generateTransferContent, compressImageToWebP } from '../../../utils/helpers';
import { loadScript } from '../../../utils/scriptLoader';
import { 
    ReceiptIcon, CheckCircleIcon, ClipboardIcon, 
    HomeIcon, DropletsIcon, CarIcon, XMarkIcon, 
    ArrowDownTrayIcon, BanknotesIcon, ClockIcon, ShareIcon,
    CloudArrowUpIcon, MagnifyingGlassIcon
} from '../../ui/Icons';
import { useNotification, useSettings } from '../../../App';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { isProduction } from '../../../utils/env';

declare const Tesseract: any;

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
    period: string;
    unitId: string;
    onClose: () => void;
    onUploadSuccess: () => void;
}> = ({ qrUrl, amount, period, unitId, onClose, onUploadSuccess }) => {
    const { showToast } = useNotification();
    const [view, setView] = useState<'qr' | 'upload'>('qr');
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const IS_PROD = isProduction();

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
        } catch (e) {
            console.error("Download failed", e);
        }
    };

    const handleShare = async () => {
        try {
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const file = new File([blob], `vietqr-payment-${amount}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Thanh toán phí Q-Home',
                    text: `Mã QR thanh toán phí dịch vụ: ${formatCurrency(amount)}`,
                    files: [file]
                });
            } else {
                showToast('Trình duyệt không hỗ trợ chia sẻ ảnh.', 'warn');
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') showToast('Không thể chia sẻ.', 'error');
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        try {
            // 1. Load OCR Lib
            await loadScript('tesseract');
            
            // 2. Compress Image
            const base64 = await compressImageToWebP(file);

            // 3. Perform OCR with Production-Safe Configuration
            // FORCE load worker & core from CDN to bypass build path issues
            const worker = await Tesseract.createWorker('vie', 1, {
                logger: (m: any) => console.log(m),
                workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
                corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
                langPath: 'https://tessdata.projectnaptha.com/4.0.0', // Reliable language data source
                errorHandler: (err: any) => console.error(err)
            });

            const ret = await worker.recognize(base64);
            const text = ret.data.text.toLowerCase();
            await worker.terminate();

            // 4. Analyze Text
            const successKeywords = ['thành công', 'successful', 'hoàn tất', 'đã chuyển', 'success'];
            const isSuccess = successKeywords.some(kw => text.includes(kw));
            
            // Simple Number Extraction (remove non-digits, look for sequence resembling amount)
            // This is naive but works for clear screenshots
            const numbers = text.match(/\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?/g) || [];
            const cleanNumbers = numbers.map((n: string) => parseFloat(n.replace(/[.,]/g, '')));
            
            // Allow matching if exact amount found OR within 5% error (OCR glitch)
            const matchedAmount = cleanNumbers.find((n: number) => Math.abs(n - amount) < (amount * 0.05));
            
            const ocrResult = {
                scannedAmount: matchedAmount || 0,
                isMatch: !!matchedAmount,
                rawText: text.substring(0, 200) // Store snippet
            };

            // 5. Submit to Firestore
            if (IS_PROD) {
                const chargeId = `${period}_${unitId}`;
                await updateDoc(doc(db, 'charges', chargeId), {
                    paymentStatus: 'reconciling', // Wait for Admin to verify
                    proofImage: base64,
                    ocrResult: ocrResult,
                    submittedAt: new Date().toISOString()
                });
            }

            if (ocrResult.isMatch && isSuccess) {
                showToast('Hệ thống đã nhận diện bill hợp lệ!', 'success');
            } else {
                showToast('Đã tải bill. BQL sẽ kiểm tra thủ công.', 'info');
            }
            
            onUploadSuccess();

        } catch (error: any) {
            console.error("OCR Full Error:", error);
            
            // Smart error parsing
            let errorMessage = "Không xác định";
            if (typeof error === 'string') {
                errorMessage = error;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            } else if (error && typeof error === 'object') {
                try {
                    errorMessage = JSON.stringify(error);
                } catch (e) {
                    errorMessage = "Lỗi không thể đọc chi tiết";
                }
            }

            showToast(`Lỗi xử lý ảnh: ${errorMessage}`, 'error');
        } finally {
            setIsScanning(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-down">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                <div className="p-4 bg-primary text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg">
                        {view === 'qr' ? 'Quét mã thanh toán' : 'Xác thực thanh toán'}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full"><XMarkIcon className="w-6 h-6"/></button>
                </div>
                
                <div className="p-6 bg-white flex flex-col items-center">
                    {view === 'qr' ? (
                        <>
                            <div className="p-2 border-2 border-primary/20 rounded-xl shadow-inner bg-white relative">
                                <img src={qrUrl} alt="VietQR" className="w-56 h-56 object-contain rounded-lg" />
                                <div className="absolute -bottom-3 -right-3 bg-white p-1 rounded-full shadow border">
                                    <CheckCircleIcon className="w-6 h-6 text-green-500 animate-pulse"/>
                                </div>
                            </div>
                            <p className="mt-4 text-2xl font-bold text-primary">{formatCurrency(amount)}</p>
                            <div className="flex gap-2 mt-4 w-full">
                                <button onClick={handleDownload} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-200 flex justify-center gap-1"><ArrowDownTrayIcon className="w-4 h-4"/> Lưu</button>
                                <button onClick={handleShare} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-200 flex justify-center gap-1"><ShareIcon className="w-4 h-4"/> Share</button>
                            </div>
                            <div className="w-full mt-4 pt-4 border-t border-gray-100">
                                <button 
                                    onClick={() => setView('upload')}
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <CloudArrowUpIcon className="w-5 h-5" /> Đã chuyển khoản? Tải Bill
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="w-full text-center">
                            {isScanning ? (
                                <div className="py-12 flex flex-col items-center">
                                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                                    <p className="font-semibold text-gray-800">Đang quét thông tin bill...</p>
                                    <p className="text-xs text-gray-500 mt-1">Công nghệ OCR đang kiểm tra số tiền</p>
                                </div>
                            ) : (
                                <>
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl p-8 cursor-pointer hover:bg-blue-100 transition-colors"
                                    >
                                        <CloudArrowUpIcon className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                                        <p className="font-bold text-blue-800">Chọn ảnh biên lai (Bill)</p>
                                        <p className="text-xs text-blue-600 mt-1">Hỗ trợ JPG, PNG, WEBP</p>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={handleFileChange} 
                                            accept="image/*" 
                                            className="hidden" 
                                        />
                                    </div>
                                    <div className="mt-6 text-left bg-gray-50 p-3 rounded-lg text-xs text-gray-600 space-y-1">
                                        <p className="flex items-center gap-2"><MagnifyingGlassIcon className="w-3 h-3"/> Hệ thống sẽ tự động quét số tiền.</p>
                                        <p className="flex items-center gap-2"><ClockIcon className="w-3 h-3"/> Trạng thái sẽ chuyển sang "Chờ xác nhận".</p>
                                    </div>
                                    <button onClick={() => setView('qr')} className="mt-4 text-sm text-gray-500 hover:text-gray-800">Quay lại mã QR</button>
                                </>
                            )}
                        </div>
                    )}
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
  const [isPaymentSubmitted, setIsPaymentSubmitted] = useState(false); // Changed to submitted state

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

  const handleUploadSuccess = () => {
      setShowQR(false);
      setIsPaymentSubmitted(true);
      showToast("Đã gửi biên lai. BQL sẽ xác nhận sớm.", "success", 5000);
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
  const isReconciling = currentCharge.paymentStatus === 'reconciling' || isPaymentSubmitted;
  
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
                period={currentCharge.Period}
                unitId={currentCharge.UnitID} 
                onClose={() => setShowQR(false)} 
                onUploadSuccess={handleUploadSuccess}
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
            {isReconciling && !isPaid && (
                <div className="absolute top-4 right-4 z-10">
                    <span className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-200 shadow-sm">
                        <ClockIcon className="w-3 h-3"/> Chờ xác nhận
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

                {isReconciling ? (
                    <button 
                        disabled
                        className="w-full py-3.5 bg-orange-100 text-orange-700 font-bold rounded-xl shadow-none cursor-default flex items-center justify-center gap-2 transition-all border border-orange-200"
                    >
                        <ClockIcon className="w-5 h-5" /> Đã gửi bill, chờ xác nhận...
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
                    
                    return (
                        <div key={bill.Period} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                            <div>
                                <p className="font-semibold text-gray-700">Tháng {bill.Period.split('-')[1]}</p>
                                <p className="text-xs text-gray-400">{new Date(bill.CreatedAt).toLocaleDateString('vi-VN')}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-gray-800">{formatCurrency(bill.TotalDue)}</p>
                                <span className={`text-[10px] font-bold ${isBillPaid ? 'text-green-600' : 'text-red-500'}`}>
                                    {isBillPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
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
