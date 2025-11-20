
import React, { useRef, useMemo, useState } from 'react';
import type { ChargeRaw, AllData, InvoiceSettings } from '../types';
import { UnitType, ParkingTariffTier } from '../types';
import Modal from './ui/Modal';
import { DownloadIcon, PaperAirplaneIcon } from './ui/Icons';
import { useNotification } from '../App';
import { loadScript } from '../utils/scriptLoader';
import { generateFeeDetails, processFooterHtml } from '../utils/helpers';

interface NoticePreviewModalProps {
    charge: ChargeRaw;
    onClose: () => void;
    invoiceSettings: InvoiceSettings;
    allData: AllData;
    onSendEmail: (charge: ChargeRaw) => Promise<void>;
}

declare const jspdf: any;
declare const html2canvas: any;

const NoticePreviewModal: React.FC<NoticePreviewModalProps> = ({ charge, onClose, invoiceSettings, allData, onSendEmail }) => {
    const noticeContentRef = useRef<HTMLDivElement>(null);
    const [isSending, setIsSending] = useState(false);
    const [isSavingPdf, setIsSavingPdf] = useState(false);
    const { showToast } = useNotification();


    const formatCurrency = (value: number | null | undefined) => {
        if (typeof value !== 'number' || isNaN(value)) {
            return '0';
        }
        return new Intl.NumberFormat('vi-VN').format(Math.round(value));
    };

    const feeDetails = useMemo(() => generateFeeDetails(charge, allData), [charge, allData]);

    const handleSavePdf = async () => {
        const content = noticeContentRef.current;
        if (!content) return;
        
        setIsSavingPdf(true);
        showToast('Đang chuẩn bị file PDF...', 'info');

        try {
            await Promise.all([loadScript('jspdf'), loadScript('html2canvas')]);
            
            const { jsPDF } = jspdf;
            const canvas = await html2canvas(content, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`PhieuBaoPhi_${charge.UnitID}_${charge.Period}.pdf`);
            showToast('Tải file PDF thành công!', 'success');
        } catch (error) {
            console.error("PDF generation failed:", error);
            showToast('Không thể tạo file PDF. Vui lòng thử lại.', 'error');
        } finally {
            setIsSavingPdf(false);
        }
    };

    const handleSendEmail = async () => {
        setIsSending(true);
        await onSendEmail(charge);
        setIsSending(false);
    };

    const paymentContent = `HUD3 LD - Phong ${charge.UnitID} - nop phi dich vu thang ${charge.Period.split('-')[1]}/${charge.Period.split('-')[0]}`;
    const bankShortNameForQR = invoiceSettings.bankName.split(' - ')[0].trim();
    const qrCodeUrl = `https://qr.sepay.vn/img?acc=${invoiceSettings.accountNumber}&bank=${bankShortNameForQR}&amount=${charge.TotalDue}&des=${encodeURIComponent(paymentContent)}`;

    const renderFooter = () => {
        if (!invoiceSettings.footerShowInViewer || !invoiceSettings.footerHtml) {
            return null;
        }

        const alignClasses: Record<string, string> = {
            left: 'text-left',
            center: 'text-center',
            right: 'text-right',
        };
        const fontClasses: Record<string, string> = {
            sm: 'text-xs',
            md: 'text-sm',
            lg: 'text-base',
        };

        const className = `
            contact-line
            ${alignClasses[invoiceSettings.footerAlign || 'center']}
            ${fontClasses[invoiceSettings.footerFontSize || 'sm']}
            text-gray-600 dark:text-gray-400
        `;

        const processedHtml = processFooterHtml(invoiceSettings.footerHtml);

        return <div className={className.trim()} dangerouslySetInnerHTML={{ __html: processedHtml }} />;
    };


    return (
        <Modal title={`Phiếu báo phí: ${charge.UnitID} - Kỳ ${charge.Period}`} onClose={onClose} size="5xl">
            <style>{`
                /* --- BẮT BUỘC: CHỈ THAY ĐỔI CSS --- */
                /* 1. Khung in A5 ngang */
                @page { size: A5 landscape; margin: 8mm; }
                html, body { -webkit-print-color-adjust: exact; -webkit-font-smoothing:antialiased; font-family: Arial, sans-serif; }

                /* 2. Selector tổng cho phiếu/modal */
                #phiieu, .phiieu-print, .print-page {
                  box-sizing: border-box !important;
                  width: 100% !important;
                  height: auto !important;
                  overflow: visible !important;
                  position: relative !important;
                  z-index: 99999 !important; /* đảm bảo nằm trên overlay */
                }

                /* 3. Ép hiển thị header + body của bảng */
                #phiieu table.print-table {
                  width: 100% !important;
                  border-collapse: collapse !important;
                  table-layout: fixed !important;
                  page-break-inside: auto !important;
                }
                #phiieu table.print-table thead { display: table-header-group !important; }
                #phiieu table.print-table tbody { display: table-row-group !important; max-height: none !important; overflow: visible !important; }
                #phiieu table.print-table tr { display: table-row !important; page-break-inside: avoid !important; page-break-after: auto !important; }
                #phiieu table.print-table th,
                #phiieu table.print-table td {
                  display: table-cell !important;
                  color: #222 !important;               /* đảm bảo chữ nhìn thấy */
                  background: transparent !important;   /* remove overlay background */
                  border: 1px solid #e0e0e0 !important;
                  padding: 6px 8px !important;
                  vertical-align: middle !important;
                  word-wrap: break-word !important;
                  overflow-wrap: break-word !important;
                  white-space: normal !important;       /* cho phép ngắt dòng */
                  opacity: 1 !important;
                  filter: none !important;
                  mix-blend-mode: normal !important;
                }
                #phiieu table.print-table tfoot .total-row td {
                  font-weight: 700 !important;
                  text-align: right !important;
                  background: #f1f5f9 !important;
                  color: #111 !important;
                }

                /* 4. Nếu tbody từng bị set height 0, reset */
                #phiieu .table-body, #phiieu .tbody, #phiieu tbody {
                  min-height: 60px !important;
                  max-height: none !important;
                  overflow: visible !important;
                }

                /* 5. Dòng tổng cố định hiển thị */
                #phiieu .total-row, #phiieu .total {
                  font-weight: 700 !important;
                  text-align: right !important;
                  page-break-inside: avoid !important;
                  background: transparent !important;
                  color: #111 !important;
                }

                /* 6. QR & thanh toán phải luôn hiển thị */
                #phiieu .qr-section { display:flex !important; justify-content: flex-end !important; gap:12px !important; align-items:center !important; page-break-inside: avoid !important; }
                #phiieu .qr-section img { width: 78px !important; height: 78px !important; object-fit: contain !important; }

                /* 7. Ngăn chặn pseudo element phủ lên nội dung */
                #phiieu::before, #phiieu::after, #phiieu *::before, #phiieu *::after { display: none !important; pointer-events: none !important; }

                /* 8. Thu nhỏ font tự động để vừa A5 khi in (không thay JS) */
                #phiieu { font-size: clamp(10px, 1.6vw, 13px) !important; }

                /* 9. Bảo đảm modal content có z-index cao hơn overlay */
                .modal-backdrop, .overlay, .modal-overlay { z-index: 90000 !important; }
                .modal, .modal-dialog, #phiieu { z-index: 99999 !important; }

                /* --- CSS GỘP THÔNG TIN TÀI KHOẢN --- */
                #phiieu .bank-info, #phiieu .bank-account, #phiieu .account-info, #phiieu .payment-account, #phiieu .bank-details { display: none !important; }
                #phiieu .payment-area { display:flex !important; justify-content:space-between !important; gap:12px !important; align-items:flex-start !important; }
                #phiieu .bank-info-box--keep {
                  display:block !important;
                  flex: 1 1 auto !important; /* Allow to grow/shrink */
                  min-width: 0 !important; /* Fix for text overflow in flex */
                  background:#eaf3ff !important;
                  border:1px solid #cfe6ff !important;
                  padding:10px 12px !important;
                  border-radius:6px !important;
                  color:#0b3b6f !important;
                  font-size: clamp(10px,1.6vw,12px) !important;
                  line-height:1.3 !important;
                }
                #phiieu .bank-qr { 
                  flex:0 0 90px !important; /* Fixed width to prevent squishing */
                  width: 90px !important;
                  display:flex !important; 
                  flex-direction: column; 
                  justify-content:center !important; 
                  align-items:center !important; 
                }
                #phiieu .bank-qr img { width:100% !important; max-width:90px !important; height:auto !important; object-fit:contain !important; }

                /* Ẩn footer cũ */
                #phiieu .footer, 
                #phiieu footer,
                #phiieu .bottom-note {
                  display: none !important;
                }

                /* Thêm dòng liên hệ gọn gàng bên trên */
                #phiieu .contact-line {
                  margin-top: 8px !important;
                  text-align: center !important;
                  font-size: clamp(10px, 1.5vw, 12px) !important;
                  color: #333 !important;
                  line-height: 1.4 !important;
                  padding-top: 6px !important;
                  border-top: 1px dashed #ccc !important;
                }
                #phiieu .contact-line strong { color: #000 !important; }


                @media print {
                    body > #root > div > aside,
                    body > #root > div > div > header,
                    body > #root > div > div > footer,
                    .modal-header,
                    .modal-footer {
                        display: none !important;
                    }
                    .printable-modal-container {
                        position: static !important;
                        all: unset !important;
                        display: block !important;
                    }
                }
            `}</style>
            <div className="printable-modal-container">
                <div id="phiieu" ref={noticeContentRef} className="p-4 bg-white font-sans phiieu-print">
                    <header className="flex justify-between items-start mb-4" style={{ pageBreakInside: 'avoid' }}>
                        <div className="flex-1 min-w-[120px]">
                            <img src={invoiceSettings.logoUrl} alt="Logo" className="h-16 object-contain"/>
                        </div>
                        <div className="flex-[2_1_0%] text-center">
                            <h1 className="text-xl font-bold">PHIẾU THÔNG BÁO PHÍ DỊCH VỤ</h1>
                            <p>Kỳ: {charge.Period}</p>
                        </div>
                        <div className="flex-1 text-right font-semibold leading-tight min-w-[180px]" style={{ fontSize: 'clamp(10px, 1.2vw, 12px)' }}>
                            BAN QUẢN LÝ VẬN HÀNH<br/>
                            NHÀ CHUNG CƯ HUD3 LINH ĐÀM
                        </div>
                    </header>

                    <section className="mb-4 grid grid-cols-4 gap-x-6 gap-y-1 text-sm" style={{ pageBreakInside: 'avoid' }}>
                        <div className="font-bold">Căn hộ:</div><div>{charge.UnitID}</div>
                        <div className="font-bold">Chủ hộ:</div><div>{charge.OwnerName}</div>
                        <div className="font-bold">Diện tích:</div><div>{charge.Area_m2} m²</div>
                        <div className="font-bold">SĐT:</div><div>{charge.Phone}</div>
                    </section>
                    
                    <table className="min-w-full text-sm print-table">
                        <colgroup>
                            <col style={{ width: '40%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '15%' }} />
                        </colgroup>
                        <thead className="bg-slate-100">
                            <tr className="text-left">
                                <th className="p-2 font-semibold">Nội dung</th>
                                <th className="p-2 font-semibold text-center">Số lượng</th>
                                <th className="p-2 font-semibold text-right">Thành tiền (VND)</th>
                                <th className="p-2 font-semibold text-right">Thuế GTGT (VND)</th>
                                <th className="p-2 font-semibold text-right">Tổng cộng (VND)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td className="p-2">Phí dịch vụ</td><td className="p-2 text-center">{charge.Area_m2} m²</td><td className="p-2 text-right">{formatCurrency(charge.ServiceFee_Base)}</td><td className="p-2 text-right">{formatCurrency(charge.ServiceFee_VAT)}</td><td className="p-2 text-right">{formatCurrency(charge.ServiceFee_Total)}</td></tr>
                            {feeDetails.parking.map((item, index) => <tr key={`p-${index}`}><td className="p-2">{item.description}</td><td className="p-2 text-center">{item.quantity}</td><td className="p-2 text-right">{formatCurrency(item.base)}</td><td className="p-2 text-right">{formatCurrency(item.vat)}</td><td className="p-2 text-right">{formatCurrency(item.total)}</td></tr>)}
                            {feeDetails.water.map((item, index) => <tr key={`w-${index}`}><td className="p-2">{item.description}</td><td className="p-2 text-center">{item.quantity}</td><td className="p-2 text-right">{formatCurrency(item.base)}</td><td className="p-2 text-right">{formatCurrency(item.vat)}</td><td className="p-2 text-right">{formatCurrency(item.total)}</td></tr>)}
                             {feeDetails.adjustments.map((adj, index) => (
                                <tr key={`adj-${index}`}>
                                    <td className="p-2">{adj.Description}</td>
                                    <td className="p-2 text-center"></td>
                                    <td className="p-2 text-right"></td>
                                    <td className="p-2 text-right"></td>
                                    <td className="p-2 text-right">{formatCurrency(adj.Amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="total-row"><td colSpan={4} className="p-3 text-right font-bold text-base">TỔNG CỘNG THANH TOÁN</td><td className="p-3 text-right font-bold text-base text-red-600">{formatCurrency(charge.TotalDue)}</td></tr>
                        </tfoot>
                    </table>
                    
                    <div className="mt-6 text-xs">
                        <div className="payment-area">
                            <div className="bank-info-box bank-info-box--keep">
                                <p className="font-bold text-sm mb-2">Thông tin thanh toán chuyển khoản:</p>
                                <div style={{ marginTop: '6px' }}><strong>Chủ TK:</strong> {invoiceSettings.accountName}</div>
                                <div style={{ marginTop: '6px' }}><strong>Số TK:</strong> {invoiceSettings.accountNumber} tại {invoiceSettings.bankName}</div>
                                <p className="mt-2"><span className="font-semibold">Nội dung: </span> <span className="font-mono bg-slate-200 p-1 rounded" style={{ wordBreak: 'break-all' }}>{paymentContent}</span></p>
                            </div>
                            <div className="bank-qr">
                                <img src={qrCodeUrl} alt="QR Code" />
                                <p className="mt-1 text-center font-medium whitespace-nowrap text-[10px]">Quét mã để thanh toán</p>
                            </div>
                        </div>

                        {renderFooter()}
                    </div>
                </div>
            </div>
            <div className="modal-footer p-4 bg-light-bg dark:bg-dark-bg-secondary flex justify-end gap-3 mt-auto">
                <button 
                    onClick={handleSendEmail} 
                    disabled={isSending || !charge.Email}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400"
                    title={!charge.Email ? "Chủ hộ chưa có email" : ""}
                >
                    <PaperAirplaneIcon /> {isSending ? 'Đang gửi...' : 'Gửi Email (kèm PDF)'}
                </button>
                <button onClick={handleSavePdf} disabled={isSavingPdf} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400">
                    <DownloadIcon /> {isSavingPdf ? 'Đang lưu...' : 'Lưu PDF'}
                </button>
            </div>
        </Modal>
    );
};

export default NoticePreviewModal;
