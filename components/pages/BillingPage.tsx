


import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Unit, ChargeRaw, Vehicle, WaterReading, Adjustment, Owner, AllData, Role, PaymentStatus, InvoiceSettings, ActivityLog } from '../../types';
import { UnitType, ParkingTariffTier } from '../../types';
import NoticePreviewModal from '../NoticePreviewModal';
import { calculateChargesBatch } from '../../services/feeService';
import { useNotification } from '../../App';
import { 
    RefreshIcon, SearchIcon, TagIcon, BuildingIcon, ChevronLeftIcon, 
    ChevronRightIcon, CalendarDaysIcon, MoneyBagIcon, 
    CheckCircleIcon, WarningIcon, PercentageIcon, PrinterIcon, PaperAirplaneIcon,
    CircularArrowRefreshIcon, ActionUnpaidIcon, ActionPaidIcon, ActionViewIcon,
    CalculatorIcon2, ExportIcon, LockClosedIcon, LockOpenIcon, ChevronDownIcon,
    DocumentArrowDownIcon, TableCellsIcon, ArrowUpTrayIcon
} from '../ui/Icons';
import { loadScript } from '../../utils/scriptLoader';
import { formatCurrency, getPreviousPeriod, parseUnitCode, generateFeeDetails, processFooterHtml } from '../../utils/helpers';


// Declare external libraries for TypeScript
declare const jspdf: any;
declare const html2canvas: any;
declare const JSZip: any;
declare const XLSX: any;

const formatNumber = (value: number | null | undefined) => {
    if (typeof value !== 'number' || isNaN(value)) return '0';
    return new Intl.NumberFormat('vi-VN').format(Math.round(value));
};

// --- Real Email Sending Function using Google Apps Script ---
interface Attachment {
    name: string;
    data: string; // base64 encoded string
}

const sendEmailAPI = async (
    recipient: string, 
    subject: string, 
    body: string,
    settings: InvoiceSettings,
    attachment?: Attachment
): Promise<{ success: boolean; error?: string }> => {
    if (!settings.appsScriptUrl) {
        return { success: false, error: 'Chưa cấu hình URL Google Apps Script trong Cài đặt.' };
    }

    try {
        // NOTE: mode: 'no-cors' is a common workaround for simple Apps Script POST requests from a browser.
        // The script executes, but the browser cannot read the response due to CORS policies on Google's side.
        // We optimistically assume success. For a more robust solution, the Apps Script would need to be
        // modified to return JSONP or handle preflight requests, which is more complex.
        await fetch(settings.appsScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
                to: recipient,
                subject: subject,
                body: body, // Body is already HTML
                attachment: attachment,
                name: settings.senderName
            }),
        });
        
        // We can't check the response, so we assume it was successful.
        return { success: true };

    } catch (e: any) {
        console.error("Apps Script fetch error:", e);
        return { success: false, error: `Lỗi mạng khi gửi yêu cầu: ${e.message}` };
    }
};

const getFooterHtml = (settings: InvoiceSettings, forChannel: 'pdf' | 'email') => {
    const show = forChannel === 'pdf' ? settings.footerShowInPdf : settings.footerShowInEmail;
    if (!show || !settings.footerHtml) return '';

    const getFontSize = (size: 'sm' | 'md' | 'lg' = 'sm') => {
        if (forChannel === 'email') return '12px'; // Fixed size for email
        if (size === 'lg') return '14px';
        if (size === 'md') return '12px';
        return '10px';
    };

    const processedFooter = processFooterHtml(settings.footerHtml);
    const align = settings.footerAlign || 'center';
    const fontSize = getFontSize(settings.footerFontSize);

    return `<div style="text-align: ${align}; font-size: ${fontSize}; color: #555; margin-top: 1rem; padding-top: 0.5rem; border-top: 1px dashed #ccc;">${processedFooter}</div>`;
};


const generateEmailHtmlForCharge = (charge: ChargeRaw, allData: AllData, invoiceSettings: InvoiceSettings, personalizedBody: string): string => {
    const formatVND = (value: number | undefined | null) => new Intl.NumberFormat('vi-VN').format(Math.round(value || 0));
    const formattedPersonalizedBody = personalizedBody.replace(/\n/g, '<br />');

    const feeDetails = generateFeeDetails(charge, allData);

    const paymentContent = `HUD3 LD - Phong ${charge.UnitID} - nop phi dich vu thang ${charge.Period.split('-')[1]}/${charge.Period.split('-')[0]}`;
    const bankShortNameForQR = invoiceSettings.bankName.split(' - ')[0].trim();
    const qrCodeUrl = `https://qr.sepay.vn/img?acc=${invoiceSettings.accountNumber}&bank=${bankShortNameForQR}&amount=${charge.TotalDue}&des=${encodeURIComponent(paymentContent)}`;

    const footerHtml = getFooterHtml(invoiceSettings, 'email');

    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Phiếu thông báo phí dịch vụ</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f8; }
            .container { max-width: 800px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
            .header, .footer { padding: 20px; }
            .content { padding: 20px; }
            h1 { font-size: 20px; font-weight: bold; color: #111827; margin: 0; }
            p { margin: 0; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            th, td { padding: 10px; border: 1px solid #e5e7eb; text-align: left; color: #111827; }
            th { background-color: #f9fafb; font-weight: 600; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .total-row td { font-size: 16px; font-weight: bold; background-color: #f9fafb; }
            .total-due { color: #dc2626; }
            .qr-section { display: flex; align-items: flex-start; gap: 20px; margin-top: 24px; }
            .payment-info { flex: 1 1 auto; min-width: 0; background-color: #eff6ff; border: 1px solid #dbeafe; padding: 16px; border-radius: 6px; color: #1e3a8a; }
            .qr-code { flex: 0 0 100px; text-align: center; }
            .qr-code img { width: 100px; height: 100px; }
            
            /* Dark Mode Styles */
            :root { color-scheme: light dark; supported-color-schemes: light dark; }
            @media (prefers-color-scheme: dark) {
                body { background-color: #111827 !important; }
                .container { background-color: #1f2937 !important; border-color: #374151 !important; }
                h1, p, th, td, .footer { color: #f9fafb !important; }
                th { background-color: #374151 !important; }
                td, th { border-color: #374151 !important; }
                .total-row td { background-color: #374151 !important; }
                .payment-info { background-color: #1e3a8a !important; border-color: #3b82f6 !important; color: #e0e7ff !important; }
                .payment-info code { background-color: #374151 !important; color: #e0e7ff !important; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="content" style="padding-bottom: 0; border-bottom: 1px dashed #d1d5db; margin-bottom: 20px;">
                <p style="margin-bottom: 20px; line-height: 1.6;">${formattedPersonalizedBody}</p>
            </div>
            <div class="header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;"><img src="${invoiceSettings.logoUrl}" alt="Logo" style="height: 64px; object-fit: contain;"/></div>
                <div style="flex: 2; text-align: center;"><h1>PHIẾU THÔNG BÁO PHÍ DỊCH VỤ</h1><p>Kỳ: ${charge.Period}</p></div>
                <div style="flex: 1; text-align: right; font-weight: 600; font-size: 12px;">BAN QUẢN LÝ VẬN HÀNH<br/>NHÀ CHUNG CƯ HUD3 LINH ĐÀM</div>
            </div>
            <div class="content">
                <div style="margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 14px;">
                    <p><strong>Căn hộ:</strong> ${charge.UnitID}</p>
                    <p><strong>Chủ hộ:</strong> ${charge.OwnerName}</p>
                    <p><strong>Diện tích:</strong> ${charge.Area_m2} m²</p>
                    <p><strong>SĐT:</strong> ${charge.Phone}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Nội dung</th>
                            <th class="text-center">Số lượng</th>
                            <th class="text-right">Thành tiền (VND)</th>
                            <th class="text-right">Thuế GTGT (VND)</th>
                            <th class="text-right">Tổng cộng (VND)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Phí dịch vụ</td>
                            <td class="text-center">${charge.Area_m2} m²</td>
                            <td class="text-right">${formatVND(charge.ServiceFee_Base)}</td>
                            <td class="text-right">${formatVND(charge.ServiceFee_VAT)}</td>
                            <td class="text-right">${formatVND(charge.ServiceFee_Total)}</td>
                        </tr>
                        ${feeDetails.parking.map(item => `
                            <tr>
                                <td>${item.description}</td>
                                <td class="text-center">${item.quantity}</td>
                                <td class="text-right">${formatVND(item.base)}</td>
                                <td class="text-right">${formatVND(item.vat)}</td>
                                <td class="text-right">${formatVND(item.total)}</td>
                            </tr>
                        `).join('')}
                        ${feeDetails.water.map(item => `
                             <tr>
                                <td>${item.description}</td>
                                <td class="text-center">${item.quantity}</td>
                                <td class="text-right">${formatVND(item.base)}</td>
                                <td class="text-right">${formatVND(item.vat)}</td>
                                <td class="text-right">${formatVND(item.total)}</td>
                            </tr>
                        `).join('')}
                         ${feeDetails.adjustments.map(adj => `
                            <tr>
                                <td>${adj.Description}</td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td class="text-right">${formatVND(adj.Amount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="4" class="text-right font-bold">TỔNG CỘNG THANH TOÁN</td>
                            <td class="text-right font-bold total-due">${formatVND(charge.TotalDue)}</td>
                        </tr>
                    </tfoot>
                </table>
                <div class="qr-section">
                    <div class="payment-info">
                        <p style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">Thông tin thanh toán:</p>
                        <p><strong>Chủ TK:</strong> ${invoiceSettings.accountName}</p>
                        <p><strong>Số TK:</strong> ${invoiceSettings.accountNumber} tại ${invoiceSettings.bankName}</p>
                        <p style="margin-top: 8px;"><strong>Nội dung:</strong> <code style="background-color: #dbeafe; padding: 4px; border-radius: 4px; font-family: monospace; word-break: break-all;">${paymentContent}</code></p>
                    </div>
                    <div class="qr-code">
                        <img src="${qrCodeUrl}" alt="QR Code" />
                        <p style="font-size: 10px; font-weight: 500; margin-top: 4px; white-space: nowrap;">Quét mã để thanh toán</p>
                    </div>
                </div>
            </div>
            <div class="footer">
                ${footerHtml}
            </div>
        </div>
    </body>
    </html>
    `;
};


// Redesigned, compact KPI Card Component with Tooltip and onClick
const KpiCard: React.FC<{ title: string; tooltip: string; value: React.ReactNode; valueTitle: string; icon: React.ReactNode; className?: string; onClick?: () => void; isActive: boolean; }> = ({ title, tooltip, value, valueTitle, icon, className, onClick, isActive }) => (
    <div className={`stat-card cursor-pointer ${className || ''} ${isActive ? 'ring-2 ring-primary' : ''}`} data-label={tooltip} title={tooltip} onClick={onClick}>
        <div className="stat-icon">
            {icon}
        </div>
        <span className="stat-label">{title}</span>
        <div className="stat-value" title={valueTitle}>
            {value}
        </div>
    </div>
);


type LogPayload = Omit<ActivityLog, 'id' | 'ts' | 'actor_email' | 'actor_role' | 'undone' | 'undo_token' | 'undo_until' | 'before_snapshot'>;

interface BillingPageProps {
    charges: ChargeRaw[];
    setCharges: (updater: React.SetStateAction<ChargeRaw[]>, logPayload?: LogPayload) => void;
    allData: AllData;
    onUpdateAdjustments: (updater: React.SetStateAction<Adjustment[]>, details: string) => void;
    role: Role;
    invoiceSettings: InvoiceSettings;
}

const BATCH_SIZE = 50; 
type PrimaryActionState = 'calculate' | 'recalculate' | 'locked';

// --- START: PDF Generation Helper ---
const renderInvoiceHTML = (charge: ChargeRaw, allData: AllData, invoiceSettings: InvoiceSettings): string => {
    const formatVND = (value: number | null | undefined) => {
        if (typeof value !== 'number' || isNaN(value)) return '0';
        return new Intl.NumberFormat('vi-VN').format(Math.round(value));
    };
    
    const feeDetails = generateFeeDetails(charge, allData);
    
    // --- Define explicit styles for PDF rendering to override app theme ---
    const textStyle = 'color: #000;';
    const cellStyle = `padding: 6px 8px; border: 1px solid #e0e0e0; vertical-align: middle; ${textStyle}`;
    const headerCellStyle = `padding: 6px 8px; border: 1px solid #e0e0e0; font-weight: bold; background-color: #f1f5f9; ${textStyle}`;
    const textRight = 'text-align: right;';
    const textCenter = 'text-align: center;';

    const serviceRow = `
        <tr>
            <td style="${cellStyle}">Phí dịch vụ</td>
            <td style="${cellStyle} ${textCenter}">${charge.Area_m2} m²</td>
            <td style="${cellStyle} ${textRight}">${formatVND(charge.ServiceFee_Base)}</td>
            <td style="${cellStyle} ${textRight}">${formatVND(charge.ServiceFee_VAT)}</td>
            <td style="${cellStyle} ${textRight}">${formatVND(charge.ServiceFee_Total)}</td>
        </tr>
    `;

    const parkingRows = feeDetails.parking.map(item => `
        <tr>
            <td style="${cellStyle}">${item.description}</td>
            <td style="${cellStyle} ${textCenter}">${item.quantity}</td>
            <td style="${cellStyle} ${textRight}">${formatVND(item.base)}</td>
            <td style="${cellStyle} ${textRight}">${formatVND(item.vat)}</td>
            <td style="${cellStyle} ${textRight}">${formatVND(item.total)}</td>
        </tr>
    `).join('');

    const waterRows = feeDetails.water.map(item => `
        <tr>
            <td style="${cellStyle}">${item.description}</td>
            <td style="${cellStyle} ${textCenter}">${item.quantity}</td>
            <td style="${cellStyle} ${textRight}">${formatVND(item.base)}</td>
            <td style="${cellStyle} ${textRight}">${formatVND(item.vat)}</td>
            <td style="${cellStyle} ${textRight}">${formatVND(item.total)}</td>
        </tr>
    `).join('');
    
    const adjustmentRows = feeDetails.adjustments.map(adj => `
        <tr>
            <td style="${cellStyle}">${adj.Description}</td>
            <td style="${cellStyle}"></td><td style="${cellStyle}"></td><td style="${cellStyle}"></td>
            <td style="${cellStyle} ${textRight}">${formatVND(adj.Amount)}</td>
        </tr>
    `).join('');

    const paymentContent = `HUD3 LD - Phong ${charge.UnitID} - nop phi dich vu thang ${charge.Period.split('-')[1]}/${charge.Period.split('-')[0]}`;
    const bankShortNameForQR = invoiceSettings.bankName.split(' - ')[0].trim();
    const qrCodeUrl = `https://qr.sepay.vn/img?acc=${invoiceSettings.accountNumber}&bank=${bankShortNameForQR}&amount=${charge.TotalDue}&des=${encodeURIComponent(paymentContent)}`;
    
    const footerHtml = getFooterHtml(invoiceSettings, 'pdf');

    return `
    <div id="phiieu" style="font-family: Arial, sans-serif; background: #fff; width: 210mm; height: 148mm; padding: 8mm; box-sizing: border-box; font-size: 12px; ${textStyle}">
        <header style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; ${textStyle}">
            <div style="flex: 1;"><img src="${invoiceSettings.logoUrl}" alt="Logo" style="height: 64px;"/></div>
            <div style="flex: 2; text-align: center;">
                <h1 style="font-size: 1.25rem; font-weight: bold; margin: 0; ${textStyle}">PHIẾU THÔNG BÁO PHÍ DỊCH VỤ</h1>
                <p style="margin: 0; ${textStyle}">Kỳ: ${charge.Period}</p>
            </div>
            <div style="flex: 1; text-align: right; font-weight: 600; font-size: 11px; ${textStyle}">BAN QUẢN LÝ VẬN HÀNH<br>NHÀ CHUNG CƯ HUD3 LINH ĐÀM</div>
        </header>
        <section style="margin-bottom: 1rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.25rem 1.5rem; font-size: 0.875rem; ${textStyle}">
            <div style="${textStyle}"><strong style="${textStyle}">Căn hộ:</strong> ${charge.UnitID}</div>
            <div style="${textStyle}"><strong style="${textStyle}">Chủ hộ:</strong> ${charge.OwnerName}</div>
            <div style="${textStyle}"><strong style="${textStyle}">Diện tích:</strong> ${charge.Area_m2} m²</div>
            <div style="${textStyle}"><strong style="${textStyle}">SĐT:</strong> ${charge.Phone}</div>
        </section>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <colgroup><col style="width: 40%;" /><col style="width: 15%;" /><col style="width: 15%;" /><col style="width: 15%;" /><col style="width: 15%;" /></colgroup>
            <thead>
                <tr>
                    <th style="${headerCellStyle} text-align: left;">Nội dung</th>
                    <th style="${headerCellStyle} ${textCenter}">Số lượng</th>
                    <th style="${headerCellStyle} ${textRight}">Thành tiền (VND)</th>
                    <th style="${headerCellStyle} ${textRight}">Thuế GTGT (VND)</th>
                    <th style="${headerCellStyle} ${textRight}">Tổng cộng (VND)</th>
                </tr>
            </thead>
            <tbody>
                ${serviceRow}
                ${parkingRows}
                ${waterRows}
                ${adjustmentRows}
            </tbody>
            <tfoot>
                <tr style="background-color: #f1f5f9; font-weight: bold; font-size: 13px;">
                    <td colspan="4" style="${cellStyle} ${textRight}">TỔNG CỘNG THANH TOÁN</td>
                    <td style="${cellStyle} ${textRight} color: #dc2626 !important;">${formatVND(charge.TotalDue)}</td>
                </tr>
            </tfoot>
        </table>
        <div style="margin-top: 1rem; font-size: 11px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; ${textStyle}">
            <div style="flex: 1 1 auto; min-width: 0; background: #eaf3ff; border: 1px solid #cfe6ff; padding: 8px; border-radius: 6px; color: #0b3b6f;">
                <p style="font-weight: bold; font-size: 13px; margin-bottom: 0.5rem; color: #0b3b6f;">Thông tin thanh toán:</p>
                <div style="color: #0b3b6f;"><strong style="color: #0b3b6f;">Chủ TK:</strong> ${invoiceSettings.accountName}</div>
                <div style="color: #0b3b6f;"><strong style="color: #0b3b6f;">Số TK:</strong> ${invoiceSettings.accountNumber} tại ${invoiceSettings.bankName}</div>
                <p style="color: #0b3b6f;"><strong style="color: #0b3b6f;">Nội dung:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 4px; border-radius: 4px; color: #0b3b6f; word-break: break-all;">${paymentContent}</span></p>
            </div>
            <div style="flex: 0 0 90px; text-align: center; ${textStyle}">
                <img src="${qrCodeUrl}" alt="QR Code" style="width: 90px; height: 90px; object-fit: contain;" />
                <p style="font-weight: 500; font-size: 10px; margin-top: 4px; white-space: nowrap; ${textStyle}">Quét mã để thanh toán</p>
            </div>
        </div>
        ${footerHtml}
    </div>`;
};
// --- END: PDF Generation Helper ---

const MonthPicker: React.FC<{
    currentPeriod: string;
    onSelectPeriod: (period: string) => void;
    onClose: () => void;
}> = ({ currentPeriod, onSelectPeriod, onClose }) => {
    const pickerRef = useRef<HTMLDivElement>(null);
    const [displayYear, setDisplayYear] = useState(new Date(currentPeriod + '-02').getFullYear());

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const now = new Date();
    const currentSystemYear = now.getFullYear();
    const currentSystemMonth = now.getMonth();

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return (
        <div ref={pickerRef} className="absolute top-full mt-2 left-0 z-20 bg-light-bg-secondary dark:bg-dark-bg-secondary p-4 rounded-xl shadow-lg border dark:border-dark-border w-72">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setDisplayYear(y => y - 1)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700"><ChevronLeftIcon /></button>
                <span className="font-bold text-lg">{displayYear}</span>
                <button onClick={() => setDisplayYear(y => y + 1)} disabled={displayYear >= currentSystemYear} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50"><ChevronRightIcon /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {months.map((month, index) => {
                    const isFuture = displayYear > currentSystemYear || (displayYear === currentSystemYear && index > currentSystemMonth);
                    const isSelected = displayYear === new Date(currentPeriod + '-02').getFullYear() && index === new Date(currentPeriod + '-02').getMonth();
                    return (
                        <button
                            key={month}
                            disabled={isFuture}
                            onClick={() => onSelectPeriod(`${displayYear}-${String(index + 1).padStart(2, '0')}`)}
                            className={`p-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-primary text-white font-bold' : 'hover:bg-gray-200 dark:hover:bg-slate-700'} ${isFuture ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {month}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const ExportProgressModal: React.FC<{
    isOpen: boolean;
    done: number;
    total: number;
    onCancel: () => void;
}> = ({ isOpen, done, total, onCancel }) => {
    if (!isOpen) return null;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-6 rounded-lg shadow-xl w-full max-w-md">
                <h4 className="text-lg font-bold mb-4">Exporting Invoices...</h4>
                <div className="export-modal-progress-bar">
                    <div style={{ width: `${percent}%` }}></div>
                </div>
                <div className="text-center my-2 font-semibold">{`${done} / ${total} (${percent}%)`}</div>
                <div className="flex justify-end mt-4">
                    <button onClick={onCancel} data-tooltip="Huỷ xuất file" className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                </div>
            </div>
        </div>
    );
};

const FilterPill: React.FC<{
  icon: React.ReactNode;
  options: { value: string; label: string }[];
  currentValue: string;
  onValueChange: (value: string) => void;
  tooltip: string;
}> = ({ icon, options, currentValue, onValueChange, tooltip }) => {
    const [isOpen, setIsOpen] = useState(false);
    const pillRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pillRef.current && !pillRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const currentLabel = options.find(o => o.value === currentValue)?.label || 'Select';

    return (
        <div className="relative" ref={pillRef} data-tooltip={tooltip}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="pill h-9 px-3 border rounded-lg bg-light-bg dark:bg-dark-bg flex items-center gap-2 hover:border-primary transition-colors w-full justify-between"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <div className='flex items-center gap-2'>
                    {icon}
                    <span className="text-sm font-medium">{currentLabel}</span>
                </div>
                <ChevronDownIcon />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-1.5 z-20 bg-light-bg-secondary dark:bg-dark-bg-secondary p-2 rounded-lg shadow-lg border dark:border-dark-border w-full">
                    {options.map(option => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onValueChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left p-2 rounded-md text-sm ${currentValue === option.value ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


const BillingPage: React.FC<BillingPageProps> = ({ charges, setCharges, allData, onUpdateAdjustments, role, invoiceSettings }) => {
    const { showToast } = useNotification();
    const canCalculate = ['Admin', 'Accountant'].includes(role);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [previewCharge, setPreviewCharge] = useState<ChargeRaw | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | UnitType>('all');
    const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [primaryActionState, setPrimaryActionState] = useState<PrimaryActionState>('calculate');
    
    const [lockedPeriods, setLockedPeriods] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('lockedBillingPeriods');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const primaryActionTimeout = useRef<number | null>(null);
    const lastClickTime = useRef(0);

    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);
    
    const [exportProgress, setExportProgress] = useState({ isOpen: false, done: 0, total: 0 });
    const cancelExportToken = useRef({ cancelled: false });
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [editedPayments, setEditedPayments] = useState<Record<string, number>>({});

    const [isDataStale, setIsDataStale] = useState(false);
    const [dataSnapshot, setDataSnapshot] = useState('');

    const currentISODate = new Date().toISOString().slice(0, 7);
    const [period, setPeriod] = useState('2025-11');

    const createSnapshot = useCallback((data: AllData) => {
        return JSON.stringify({
            vehicles: data.vehicles,
            waterReadings: data.waterReadings,
        });
    }, []);

    useEffect(() => {
        if (!dataSnapshot) {
            setDataSnapshot(createSnapshot(allData));
            return;
        }
        const currentSnapshot = createSnapshot(allData);
        if (currentSnapshot !== dataSnapshot) {
            setIsDataStale(true);
        }
    }, [allData, dataSnapshot, createSnapshot]);
    
    useEffect(() => {
        localStorage.setItem('lockedBillingPeriods', JSON.stringify(Array.from(lockedPeriods)));
    }, [lockedPeriods]);

    useEffect(() => {
        if (lockedPeriods.has(period)) {
            setPrimaryActionState('locked');
        } else if (charges.some(c => c.Period === period)) {
            setPrimaryActionState('recalculate');
        } else {
            setPrimaryActionState('calculate');
        }
    }, [period, charges, lockedPeriods]);
    
    const floors = useMemo(() => {
        const floorNumbers = Array.from(new Set(allData.units.filter(u=>u.UnitType === UnitType.APARTMENT).map(u => u.UnitID.slice(0,-2)))).sort((a,b) => parseInt(String(a), 10) - parseInt(String(b), 10));
        return [{value: 'all', label: 'All Floors'}, ...floorNumbers.map(f => ({value: f, label: `Floor ${f}`})), {value: 'KIOS', label: 'KIOS'}];
    }, [allData.units]);

    const [floorFilter, setFloorFilter] = useState('all');

    useEffect(() => {
        setSelectedUnits(new Set()); 
        setActiveKpiFilter(null);
    }, [period]);
    
    const filteredCharges = useMemo(() => {
        return charges.filter(c => {
            if (c.Period !== period) return false;
            const unitInfo = parseUnitCode(c.UnitID);
            const unitType = allData.units.find(u => u.UnitID === c.UnitID)?.UnitType;
            if (statusFilter !== 'all' && c.paymentStatus !== statusFilter) return false;
            if (typeFilter !== 'all' && unitType !== typeFilter) return false;
            
            if (floorFilter !== 'all') {
                const floor = unitInfo?.floor === 99 ? 'KIOS' : String(unitInfo?.floor);
                if (floor !== floorFilter) return false;
            }

            const s = searchTerm.toLowerCase();
            // FIX: Handle undefined OwnerName safely
            if (s && !(c.UnitID.toLowerCase().includes(s) || (c.OwnerName || '').toLowerCase().includes(s))) return false;
            return true;
        });
    }, [charges, period, searchTerm, statusFilter, typeFilter, floorFilter, allData.units]);
    
    const sortedAndFilteredCharges = useMemo(() => {
        return [...filteredCharges].sort((a, b) => {
            const pa = parseUnitCode(a.UnitID) || { floor: 100, apt: 0 };
            const pb = parseUnitCode(b.UnitID) || { floor: 100, apt: 0 };
            if (pa.floor !== pb.floor) return pa.floor - pb.floor;
            return pa.apt - pb.apt;
        });
    }, [filteredCharges]);

    useEffect(() => { setSelectedUnits(new Set()); }, [searchTerm, statusFilter, typeFilter, floorFilter, period]);

    const formatPeriodForDisplay = (isoPeriod: string): string => {
        const date = new Date(isoPeriod + '-02');
        return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
    };

    const navigatePeriod = (direction: 'prev' | 'next' | 'current') => {
        if (direction === 'current') { setPeriod(currentISODate); return; }
        const d = new Date(period + '-02');
        d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
        const newPeriodDate = new Date(d.getFullYear(), d.getMonth(), 1);
        const currentPeriodDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        if (direction === 'next' && newPeriodDate > currentPeriodDate) {
            showToast("Cannot view or calculate for future periods.", "info");
            return;
        }
        setPeriod(d.toISOString().slice(0, 7));
    };
    
    const handleRefreshData = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            setDataSnapshot(createSnapshot(allData));
            setIsDataStale(false);
            showToast('Dữ liệu đã được làm mới.', 'success');
        } catch (error) { 
            showToast('Lỗi khi làm mới dữ liệu.', 'error');
            console.error("Refresh data failed:", error);
        } 
        finally { setIsRefreshing(false); }
    }, [isRefreshing, allData, showToast, createSnapshot]);

    const executeCalculation = useCallback(async () => {
        setIsLoading(true);
        setProgress({ current: 0, total: allData.units.length });
        
        try {
            const calculationInputs = allData.units.map(unit => {
                const owner = allData.owners.find(o => o.OwnerID === unit.OwnerID)!;
                const waterReading = allData.waterReadings.find(r => r.UnitID === unit.UnitID && r.Period === getPreviousPeriod(period)) || { UnitID: unit.UnitID, Period: getPreviousPeriod(period), PrevIndex: 0, CurrIndex: 0, Rollover: false };
                return { unit, owner, vehicles: allData.vehicles.filter(v => v.UnitID === unit.UnitID), waterReading, adjustments: allData.adjustments.filter(a => a.UnitID === unit.UnitID && a.Period === period) };
            });

            const newCharges = await calculateChargesBatch(period, calculationInputs, allData);
            const updater = (prev: ChargeRaw[]) => [...prev.filter(c => c.Period !== period), ...newCharges.map(c => ({...c, CreatedAt: new Date().toISOString(), Locked: false, paymentStatus: 'pending' as PaymentStatus}))];
            setCharges(updater, {
                module: 'Billing',
                action: 'CALCULATE_CHARGES',
                summary: `Tính phí cho kỳ ${period} - ${newCharges.length} căn hộ`,
                count: newCharges.length
            });

            showToast(`Tính phí hoàn tất cho ${newCharges.length} căn hộ.`, 'success');
        } catch (error) {
            console.error("Calculation failed", error);
            showToast('Quá trình tính phí xảy ra lỗi.', 'error');
        } finally {
            setIsLoading(false);
            setProgress({ current: 0, total: 0 });
        }
    }, [period, allData, setCharges, showToast]);

    const runRecalculation = useCallback(async () => {
        if (lockedPeriods.has(period)) {
            showToast('Đang khoá tính phí. Nhấn đúp nút Locked để mở khoá.', 'warn');
            return;
        }
        await executeCalculation();
    }, [period, showToast, lockedPeriods, executeCalculation]);

    const runInitialCalculation = useCallback(async () => {
        if (lockedPeriods.has(period)) {
            showToast('Đang khoá tính phí. Nhấn đúp nút Locked để mở khoá.', 'warn');
            return;
        }
        await executeCalculation();
    }, [period, showToast, lockedPeriods, executeCalculation]);
    
    const handlePrimaryAction = useCallback(() => {
        const now = Date.now();
        const isDoubleClick = (now - lastClickTime.current) < 350;
        lastClickTime.current = now;

        const canLock = ['Admin', 'Accountant'].includes(role);
    
        if (isDoubleClick) {
            if (primaryActionTimeout.current) clearTimeout(primaryActionTimeout.current);
            if (!canLock) { showToast('Bạn không có quyền thực hiện hành động này.', 'error'); return; }
            
            setLockedPeriods(prev => {
                const next = new Set(prev);
                if (next.has(period)) {
                    next.delete(period);
                    showToast('Đã mở khóa chức năng tính phí.', 'success');
                } else {
                    next.add(period);
                    showToast('Đã khóa chức năng tính phí. Các thao tác khác vẫn dùng bình thường.', 'success');
                }
                return next;
            });
        } else {
            primaryActionTimeout.current = window.setTimeout(() => {
                if (isDataStale) {
                    showToast('Dữ liệu nguồn đã thay đổi. Vui lòng bấm "Refresh" trước khi tính toán.', 'warn');
                    return;
                }
                if (primaryActionState === 'locked') {
                    showToast('Kỳ đang bị khóa. Nhấn đúp để mở khóa.', 'info');
                } else if (primaryActionState === 'calculate') {
                    runInitialCalculation();
                } else if (primaryActionState === 'recalculate') {
                    runRecalculation();
                }
            }, 250);
        }
    }, [primaryActionState, period, role, showToast, runInitialCalculation, runRecalculation, isDataStale]);

    const handleBulkSetStatus = useCallback((targetStatus: 'paid' | 'unpaid') => {
        if (selectedUnits.size === 0) return;
        if (role === 'Operator') { showToast('Bạn không có quyền.', 'error'); return; }
    
        const updater = (prev: ChargeRaw[]) => prev.map(c => {
            if (c.Period === period && selectedUnits.has(c.UnitID)) {
                if (targetStatus === 'unpaid') {
                    // FIX: Explicitly cast string literals to PaymentStatus to satisfy TypeScript.
                    // When marking as unpaid, reset payment details to allow re-entry
                    return { ...c, paymentStatus: 'unpaid' as PaymentStatus, PaymentConfirmed: false, TotalPaid: c.TotalDue };
                }
                // FIX: Explicitly cast string literals to PaymentStatus to satisfy TypeScript.
                // When marking as paid, confirm the full amount
                return { ...c, paymentStatus: 'paid' as PaymentStatus, PaymentConfirmed: true, TotalPaid: c.TotalDue };
            }
            return c;
        });
    
        setCharges(updater, {
            module: 'Billing',
            action: 'BULK_UPDATE_CHARGE_STATUS',
            summary: `Đánh dấu '${targetStatus}' cho ${selectedUnits.size} căn hộ kỳ ${period}`,
            count: selectedUnits.size,
            ids: Array.from(selectedUnits)
        });
    
        showToast(`Đã đánh dấu ${targetStatus} cho ${selectedUnits.size} căn`, 'success');
        setSelectedUnits(new Set());
    }, [period, role, selectedUnits, setCharges, showToast]);

    const handleExportReport = useCallback(() => {
        if (primaryActionState === 'calculate') { showToast('Vui lòng tính phí trước khi xuất báo cáo.', 'error'); return; }
        
        const targets = selectedUnits.size > 0 ? charges.filter(c => c.Period === period && selectedUnits.has(c.UnitID)) : sortedAndFilteredCharges;
        if (targets.length === 0) { showToast('Không có dữ liệu để xuất báo cáo.', 'info'); return; }

        // BOM for Excel to read UTF-8 correctly
        const BOM = "\uFEFF";
        const headers = [
            'Kỳ', 'Căn hộ', 'Chủ hộ', 'Diện tích (m2)', 
            'Phí Dịch vụ', 'SL Ô tô', 'SL Xe máy', 'Phí Gửi xe', 
            'Tiêu thụ nước (m3)', 'Tiền nước', 'Điều chỉnh', 
            'Tổng phải thu', 'Đã nộp', 'Còn nợ', 'Trạng thái'
        ];
        const rows = [headers.join(',')];

        targets.forEach(c => {
            const diff = c.TotalDue - c.TotalPaid;
            const statusText = c.paymentStatus === 'paid' ? 'Đã nộp' : c.paymentStatus === 'unpaid' ? 'Chưa nộp' : 'Chờ xử lý';
            
            const line = [
                `"${c.Period}"`,
                `"${c.UnitID}"`,
                `"${c.OwnerName}"`,
                c.Area_m2,
                c.ServiceFee_Total,
                c['#CAR'] + c['#CAR_A'],
                c['#MOTORBIKE'],
                c.ParkingFee_Total,
                c.Water_m3,
                c.WaterFee_Total,
                c.Adjustments,
                c.TotalDue,
                c.TotalPaid,
                diff,
                `"${statusText}"`
            ];
            rows.push(line.join(','));
        });

        const csvContent = BOM + rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `BaoCao_Phi_Ky_${period}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Đã xuất báo cáo chi tiết (${targets.length} căn).`, 'success');
    }, [primaryActionState, charges, period, selectedUnits, sortedAndFilteredCharges, showToast]);


    const handleDownloadPDFs = useCallback(async () => {
        if (primaryActionState === 'calculate') { showToast('Vui lòng tính phí trước khi xuất PDF.', 'error'); return; }
        const targets = selectedUnits.size > 0 ? charges.filter(c => c.Period === period && selectedUnits.has(c.UnitID)) : sortedAndFilteredCharges;
        if (targets.length === 0) { showToast('Không có dữ liệu để xuất file.', 'info'); return; }
    
        try {
            await Promise.all([
                loadScript('jspdf'),
                loadScript('html2canvas'),
                loadScript('jszip')
            ]);
        } catch (error) {
            showToast('Không thể tải thư viện xuất file. Vui lòng thử lại.', 'error');
            return;
        }

        cancelExportToken.current.cancelled = false;
        setExportProgress({ isOpen: true, done: 0, total: targets.length });
    
        const files: { name: string, blob: Blob }[] = [];
        for (let i = 0; i < targets.length; i++) {
            if (cancelExportToken.current.cancelled) break;
            const charge = targets[i];
            try {
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed; left:-9999px; top:0; width:210mm; height:148mm; background:#fff; z-index:-1;';
                document.body.appendChild(host);
                host.innerHTML = renderInvoiceHTML(charge, allData, invoiceSettings);
                await new Promise(r => setTimeout(r, 50));
                const canvas = await html2canvas(host, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                const { jsPDF } = jspdf;
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 148);
                host.remove();
                files.push({ name: `PhieuBaoPhi_${charge.UnitID}_${charge.Period}.pdf`, blob: pdf.output('blob') });
            } catch (e) { console.error(`Failed to generate PDF for ${charge.UnitID}`, e); }
            setExportProgress(p => ({ ...p, done: i + 1 }));
        }
    
        setExportProgress({ isOpen: false, done: 0, total: 0 });
        if (cancelExportToken.current.cancelled) { showToast('Export cancelled.', 'info'); return; }
    
        const downloadBlob = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
        if (files.length === 1) { downloadBlob(files[0].blob, files[0].name); }
        else if (files.length > 1) {
            const zip = new JSZip(); files.forEach(f => zip.file(f.name, f.blob));
            downloadBlob(await zip.generateAsync({ type: 'blob' }), `Invoices_${period}.zip`);
        }
        if (files.length > 0) { showToast(`Successfully downloaded ${files.length} invoices.`, 'success'); }
    }, [primaryActionState, period, selectedUnits, charges, sortedAndFilteredCharges, allData, invoiceSettings, showToast]);
    
    const handleBulkSendEmail = useCallback(async () => {
        const recipients = charges.filter(c => c.Period === period && selectedUnits.has(c.UnitID) && c.Email);
        if (recipients.length === 0) {
            showToast('Không có căn hộ nào được chọn có địa chỉ email hợp lệ.', 'warn');
            return;
        }
        
        showToast(`Bắt đầu gửi email tới ${recipients.length} người nhận...`, 'info');
        let successCount = 0;
        let failCount = 0;

        try {
            await Promise.all([
                loadScript('jspdf'),
                loadScript('html2canvas'),
            ]);
        } catch(error) {
            showToast('Không thể tải thư viện PDF để đính kèm. Vui lòng thử lại.', 'error');
            return;
        }

        for (const [index, charge] of recipients.entries()) {
            showToast(`[${index + 1}/${recipients.length}] Đang tạo PDF cho ${charge.UnitID}...`, 'info', 3000);

            // 1. Generate PDF in memory
            let attachment: Attachment | undefined;
            try {
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed; left:-9999px; top:0; width:210mm; height:148mm; background:#fff; z-index:-1;';
                document.body.appendChild(host);
                host.innerHTML = renderInvoiceHTML(charge, allData, invoiceSettings);
                await new Promise(r => setTimeout(r, 50));
                const canvas = await html2canvas(host, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                const { jsPDF } = jspdf;
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 148);
                host.remove();
                
                const base64Data = pdf.output('datauristring').split(',')[1];
                attachment = {
                    name: `PhieuBaoPhi_${charge.UnitID}_${charge.Period}.pdf`,
                    data: base64Data
                };
            } catch (e) {
                console.error(`Failed to generate PDF for ${charge.UnitID}`, e);
                showToast(`Lỗi tạo PDF cho ${charge.UnitID}, bỏ qua...`, 'error');
                failCount++;
                continue;
            }

            showToast(`[${index + 1}/${recipients.length}] Đang gửi mail cho ${charge.UnitID}...`, 'info', 3000);
            
            // 2. Personalize Subject and generate HTML Body
            const subjectTemplate = invoiceSettings.emailSubject || '[BQL HUD3] Thông báo phí dịch vụ kỳ {{period}} cho căn hộ {{unit_id}}';
            const personalizedSubject = subjectTemplate.replace(/{{unit_id}}/g, charge.UnitID).replace(/{{owner_name}}/g, charge.OwnerName).replace(/{{period}}/g, charge.Period).replace(/{{total_due}}/g, formatCurrency(charge.TotalDue));

            const bodyTemplate = invoiceSettings.emailBody || '';
            const personalizedBody = bodyTemplate.replace(/{{unit_id}}/g, charge.UnitID).replace(/{{owner_name}}/g, charge.OwnerName).replace(/{{period}}/g, charge.Period).replace(/{{total_due}}/g, formatCurrency(charge.TotalDue));
            const emailBodyHtml = generateEmailHtmlForCharge(charge, allData, invoiceSettings, personalizedBody);

            const result = await sendEmailAPI(charge.Email, personalizedSubject, emailBodyHtml, invoiceSettings, attachment);

            if (result.success) {
                successCount++;
            } else {
                failCount++;
                showToast(`Gửi mail thất bại cho ${charge.UnitID}: ${result.error}`, 'error', 8000);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between emails
        }

        showToast(`Hoàn tất gửi mail: ${successCount} thành công, ${failCount} thất bại.`, failCount > 0 ? 'warn' : 'success', 10000);
        setSelectedUnits(new Set());
    }, [charges, period, selectedUnits, allData, invoiceSettings, showToast]);

    const handleSendSingleEmail = useCallback(async (charge: ChargeRaw) => {
        if (!charge.Email) {
            showToast('Căn hộ này không có địa chỉ email.', 'error');
            return;
        }
        showToast(`Đang chuẩn bị email cho căn hộ ${charge.UnitID}...`, 'info');
        
        try {
            await Promise.all([
                loadScript('jspdf'),
                loadScript('html2canvas'),
            ]);
        } catch(error) {
            showToast('Không thể tải thư viện PDF để đính kèm. Vui lòng thử lại.', 'error');
            return;
        }

        // 1. Generate PDF in memory
        let attachment: Attachment | undefined;
        try {
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed; left:-9999px; top:0; width:210mm; height:148mm; background:#fff; z-index:-1;';
            document.body.appendChild(host);
            host.innerHTML = renderInvoiceHTML(charge, allData, invoiceSettings);
            await new Promise(r => setTimeout(r, 50));
            const canvas = await html2canvas(host, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 148);
            host.remove();
            
            const base64Data = pdf.output('datauristring').split(',')[1];
            attachment = {
                name: `PhieuBaoPhi_${charge.UnitID}_${charge.Period}.pdf`,
                data: base64Data
            };
        } catch (e) {
            console.error(`Failed to generate PDF for ${charge.UnitID}`, e);
            showToast(`Lỗi tạo PDF cho ${charge.UnitID}, email sẽ được gửi không có đính kèm.`, 'error');
        }

        // 2. Personalize Subject and generate HTML Body
        const subjectTemplate = invoiceSettings.emailSubject || '[BQL HUD3] Thông báo phí dịch vụ kỳ {{period}} cho căn hộ {{unit_id}}';
        const personalizedSubject = subjectTemplate.replace(/{{unit_id}}/g, charge.UnitID).replace(/{{owner_name}}/g, charge.OwnerName).replace(/{{period}}/g, charge.Period).replace(/{{total_due}}/g, formatCurrency(charge.TotalDue));
        
        const bodyTemplate = invoiceSettings.emailBody || '';
        const personalizedBody = bodyTemplate.replace(/{{unit_id}}/g, charge.UnitID).replace(/{{owner_name}}/g, charge.OwnerName).replace(/{{period}}/g, charge.Period).replace(/{{total_due}}/g, formatCurrency(charge.TotalDue));
        const emailBodyHtml = generateEmailHtmlForCharge(charge, allData, invoiceSettings, personalizedBody);

        const result = await sendEmailAPI(charge.Email, personalizedSubject, emailBodyHtml, invoiceSettings, attachment);

        if (result.success) {
            showToast(`Yêu cầu gửi email đã được thực hiện cho ${charge.UnitID}.`, 'success');
        } else {
            showToast(`Gửi mail thất bại cho ${charge.UnitID}: ${result.error}`, 'error', 10000);
        }
    }, [allData, invoiceSettings, showToast]);
    
    const handlePaymentChange = (unitId: string, value: string) => {
        const digits = value.replace(/\D/g, '');
        const amount = parseInt(digits, 10);
        
        if (digits.length > 9) {
            return;
        }

        setEditedPayments(prev => ({ ...prev, [unitId]: isNaN(amount) ? 0 : amount }));
    };
    
    const handleConfirmPayment = (charge: ChargeRaw) => {
        const finalPaidAmount = editedPayments[charge.UnitID] ?? charge.TotalPaid;
        const difference = finalPaidAmount - charge.TotalDue;

        const chargeUpdater = (prev: ChargeRaw[]) => prev.map(c =>
            (c.UnitID === charge.UnitID && c.Period === period)
                // FIX: Explicitly cast 'paid' to PaymentStatus to satisfy TypeScript.
                ? { ...c, TotalPaid: finalPaidAmount, PaymentConfirmed: true, paymentStatus: 'paid' as PaymentStatus }
                : c
        );
        setCharges(chargeUpdater, {
            module: 'Billing',
            action: 'CONFIRM_PAYMENT',
            summary: `Xác nhận thanh toán ${formatNumber(finalPaidAmount)} cho ${charge.UnitID}`,
            count: 1,
            ids: [charge.UnitID]
        });

        if (difference !== 0) {
            const nextPeriodDate = new Date(period + '-02');
            nextPeriodDate.setMonth(nextPeriodDate.getMonth() + 1);
            const nextPeriod = nextPeriodDate.toISOString().slice(0, 7);

            const newAdjustment: Adjustment = {
                UnitID: charge.UnitID,
                Period: nextPeriod,
                Amount: -difference,
                Description: `Công nợ kỳ trước`,
                SourcePeriod: period,
            };

            const adjustmentUpdater = (prev: Adjustment[]) => [...prev.filter(a => !(a.UnitID === newAdjustment.UnitID && a.SourcePeriod === newAdjustment.SourcePeriod)), newAdjustment];
            onUpdateAdjustments(adjustmentUpdater, `Created adjustment for ${charge.UnitID} from period ${period}`);
            showToast(`Đã tạo khoản điều chỉnh ${formatNumber(-difference)} cho kỳ sau.`, 'info');
        } else {
             showToast(`Đã xác nhận thanh toán đủ cho căn hộ ${charge.UnitID}.`, 'success');
        }
        
        setEditedPayments(prev => {
            const next = { ...prev };
            delete next[charge.UnitID];
            return next;
        });
    };
    
    // --- START: Bank Statement Import Handler ---
    const handleStatementFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        // Only allow Admins and Accountants
        if (role === 'Operator' || role === 'Viewer') {
            showToast('Bạn không có quyền thực hiện hành động này.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                // Find header row
                let headerIndex = -1;
                let colCredit = -1;
                let colDesc = -1;

                for (let i = 0; i < Math.min(20, json.length); i++) {
                    const row = json[i].map(cell => String(cell).toLowerCase());
                    const cIdx = row.findIndex(cell => cell.includes('so tien ghi co') || cell.includes('credit amount'));
                    const dIdx = row.findIndex(cell => cell.includes('noi dung') || cell.includes('transaction detail') || cell.includes('description'));
                    
                    if (cIdx !== -1 && dIdx !== -1) {
                        headerIndex = i;
                        colCredit = cIdx;
                        colDesc = dIdx;
                        break;
                    }
                }

                if (headerIndex === -1) {
                    showToast('Không tìm thấy cột "Số tiền ghi có" hoặc "Nội dung" trong 20 dòng đầu.', 'error');
                    return;
                }

                // 1. Aggregate amounts by UnitID to handle multiple transactions per unit
                const amountMap = new Map<string, number>();
                const validUnitSet = new Set(allData.units.map(u => u.UnitID));
                // Regex to find potential IDs: 3 or 4 digits, optionally prefixed by P/C/Can/Phong, surrounded by non-digits
                const unitRegex = /(?:^|[^a-zA-Z0-9])(?:P|Ph|Phong|Can|C|Apt|Căn)?\s*([0-9]{3,4})(?=[^0-9]|$)/gi;

                for (let i = headerIndex + 1; i < json.length; i++) {
                    const row = json[i];
                    if (!row[colCredit]) continue;

                    const rawAmount = row[colCredit];
                    const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/,/g, ''));
                    const description = String(row[colDesc] || '');
                    
                    if (isNaN(amount) || amount <= 0) continue;

                    let matchedUnitID = '';
                    let match;
                    unitRegex.lastIndex = 0;

                    while ((match = unitRegex.exec(description)) !== null) {
                        const potentialID = match[1];
                        if (validUnitSet.has(potentialID)) {
                            matchedUnitID = potentialID;
                            break; 
                        }
                    }
                    
                    // Fallback for Kiosks if no numeric match found
                    if (!matchedUnitID) {
                         const kioskRegex = /(?:^|[^0-9])(K\d{2})(?=[^0-9]|$)/gi;
                         while ((match = kioskRegex.exec(description)) !== null) {
                            if (validUnitSet.has(match[1])) {
                                matchedUnitID = match[1];
                                break;
                            }
                         }
                    }

                    if (matchedUnitID) {
                         const current = amountMap.get(matchedUnitID) || 0;
                         amountMap.set(matchedUnitID, current + amount);
                    }
                }

                // 2. Apply aggregated amounts to charges
                let reconciledCount = 0;
                let totalReconciledAmount = 0;
                const matchedUnits: string[] = [];
                let changesMade = false;

                const updatedCharges = charges.map(charge => {
                    if (charge.Period !== period) return charge;

                    const importedAmount = amountMap.get(charge.UnitID);
                    
                    // Only apply if we found an amount AND the charge hasn't been confirmed yet.
                    // If it's already confirmed, we skip it to avoid overwriting manual work or duplicates
                    if (importedAmount !== undefined && !charge.PaymentConfirmed) {
                         reconciledCount++;
                         totalReconciledAmount += importedAmount;
                         matchedUnits.push(charge.UnitID);
                         changesMade = true;

                         // Logic: Overwrite placeholder TotalPaid with actual imported amount
                         return {
                             ...charge,
                             TotalPaid: importedAmount,
                             PaymentConfirmed: true,
                             // FIX: Explicitly cast 'paid' to PaymentStatus to satisfy TypeScript.
                             // Mark as 'paid' regardless of amount
                             paymentStatus: 'paid' as PaymentStatus
                         };
                    }
                    return charge;
                });

                if (changesMade) {
                    setCharges(updatedCharges, {
                        module: 'Billing',
                        action: 'IMPORT_BANK_STATEMENT',
                        summary: `Đối soát ${reconciledCount} giao dịch, tổng: ${formatCurrency(totalReconciledAmount)}`,
                        count: reconciledCount,
                        ids: matchedUnits
                    });
                    showToast(`Đã đối soát thành công ${reconciledCount} giao dịch. Tổng tiền: ${formatCurrency(totalReconciledAmount)}`, 'success');
                } else {
                    if (amountMap.size > 0) {
                         showToast('Tìm thấy giao dịch nhưng các căn hộ đã được đối soát trước đó.', 'info');
                    } else {
                         showToast('Không tìm thấy giao dịch nào khớp với mã căn hộ trong file.', 'warn');
                    }
                }

            } catch (error) {
                console.error("Import error:", error);
                showToast('Lỗi khi đọc file sao kê. Vui lòng kiểm tra định dạng.', 'error');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImportStatementClick = () => {
        fileInputRef.current?.click();
    };
    // --- END: Bank Statement Import Handler ---


    const kpiStats = useMemo(() => {
        const rows = charges.filter(c => c.Period === period);
        const totalDue = rows.reduce((s, r) => s + r.TotalDue, 0);
        const totalPaid = rows.filter(r => r.PaymentConfirmed === true).reduce((s, r) => s + r.TotalPaid, 0);
        const difference = totalDue - totalPaid;
        const unpaidCount = rows.filter(r => r.paymentStatus !== 'paid').length;
        
        return {
            totalDue,
            totalPaid,
            difference,
            unpaidCount,
        };
    }, [charges, period]);

    const clearAllFilters = () => { setStatusFilter('all'); setTypeFilter('all'); setFloorFilter('all'); setSearchTerm(''); setActiveKpiFilter(null); };
    const applyKpiFilter = (status: PaymentStatus, name: string) => { clearAllFilters(); setStatusFilter(status); setActiveKpiFilter(name); };
    const handleSelectUnit = (id: string, isSel: boolean) => setSelectedUnits(p => { const n = new Set(p); isSel ? n.add(id) : n.delete(id); return n; });
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => setSelectedUnits(e.target.checked ? new Set(sortedAndFilteredCharges.map(c => c.UnitID)) : new Set());
    const getStatusText = (s: PaymentStatus) => s === 'paid' ? { text: 'Đã nộp', class: 'bg-green-100 text-green-800' } : s === 'unpaid' ? { text: 'Chưa nộp', class: 'bg-red-100 text-red-800' } : { text: 'Chờ xử lý', class: 'bg-yellow-100 text-yellow-800' };

    const handleStatusChange = (unitId: string, newStatus: PaymentStatus) => { 
        const updater = (prev: ChargeRaw[]) => prev.map(c => (c.UnitID === unitId && c.Period === period) ? { ...c, paymentStatus: newStatus } : c);
        setCharges(updater, {
            module: 'Billing',
            action: 'UPDATE_CHARGE_STATUS',
            summary: `Cập nhật trạng thái cho căn hộ ${unitId} thành '${newStatus}'`,
            count: 1,
            ids: [unitId]
        });
        showToast(`Đã cập nhật trạng thái cho căn hộ ${unitId}.`, 'success'); 
    };
    const isAllVisibleSelected = sortedAndFilteredCharges.length > 0 && selectedUnits.size > 0 && sortedAndFilteredCharges.every(c => selectedUnits.has(c.UnitID));

    const renderMainActionButton = () => {
        const canLock = ['Admin', 'Accountant'].includes(role);
        const isDisabled = isLoading || !canCalculate || isRefreshing;

        if (primaryActionState === 'locked') {
            return ( <button onClick={handlePrimaryAction} className="h-9 px-4 bg-gray-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5 hover:bg-gray-800" title="Đang khóa tính phí. Nhấn đúp để mở khóa."> <LockClosedIcon className="w-5 h-5" /> Locked </button> );
        }
        
        const tooltip = !canCalculate ? 'Bạn không có quyền.' : (isRefreshing ? 'Đang làm mới dữ liệu...' : (primaryActionState === 'recalculate' ? "Tính lại toàn bộ phí cho kỳ này" : "Tính phí cho kỳ hiện tại"));
        const buttonClass = primaryActionState === 'recalculate' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700';
        const buttonText = isLoading ? 'Đang tính...' : (primaryActionState === 'recalculate' ? 'Recalculate' : 'Calculate');
        const Icon = primaryActionState === 'recalculate' ? CircularArrowRefreshIcon : CalculatorIcon2;

        return (
            <div className="relative" title={!isDisabled ? (canLock ? 'Nhấn đúp để khóa' : '') : tooltip}>
                <button onClick={handlePrimaryAction} disabled={isDisabled} data-tooltip={tooltip} className={`h-9 px-4 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 ${buttonClass} disabled:bg-gray-400 disabled:cursor-not-allowed`}> <Icon className="w-5 w-5" /> {buttonText} </button>
            </div>
        );
    };

    const isPeriodLocked = lockedPeriods.has(period);

    return (
        <div className="space-y-4 h-full flex flex-col">
            <style>{`.pill{display:inline-flex;align-items:center;gap:8px;}.pill i{font-size:14px;line-height:1;display:inline-block;}`}</style>
             {/* Hidden File Input for Statement Import */}
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleStatementFileChange} 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
            />

            <div className="sticky top-0 z-30 bg-light-bg dark:bg-dark-bg -mx-4 -mt-3 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:-mx-8 pt-3 pb-2 space-y-2">
                {/* Controls and Filters */}
                <div className="flex flex-wrap items-center gap-4 p-2 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-xl border dark:border-dark-border shadow-sm">
                    <div className="relative flex items-center gap-2 p-1 bg-light-bg dark:bg-dark-bg rounded-lg">
                        <button onClick={() => navigatePeriod('prev')} data-tooltip="Kỳ trước"><ChevronLeftIcon /></button>
                        <button onClick={() => setIsMonthPickerOpen(p => !p)} className="p-1.5 w-36 font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 rounded-md">{formatPeriodForDisplay(period)}</button>
                        <button onClick={() => navigatePeriod('next')} data-tooltip="Kỳ sau"><ChevronRightIcon /></button>
                        <button onClick={() => setPeriod(currentISODate)} className={`p-2 rounded-md text-sm font-semibold flex items-center gap-1 ${period === currentISODate ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-slate-700'}`}><CalendarDaysIcon /> Current</button>
                        {isMonthPickerOpen && <MonthPicker currentPeriod={period} onSelectPeriod={(p) => { setPeriod(p); setIsMonthPickerOpen(false); }} onClose={() => setIsMonthPickerOpen(false)}/>}
                    </div>
                    <div className="h-6 border-l dark:border-dark-border hidden md:block"></div>
                    <div className="flex items-center gap-2 flex-grow flex-wrap">
                        <div className="relative flex-grow min-w-[200px]"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><input type="text" placeholder="Tìm theo mã hoặc tên..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border rounded-lg bg-light-bg dark:bg-dark-bg"/></div>
                        <FilterPill icon={<TagIcon className="h-5 w-5 text-gray-400" />} currentValue={typeFilter} onValueChange={v => setTypeFilter(v as any)} tooltip="Lọc theo loại hình" options={[{value: 'all', label: 'All Types'}, {value: UnitType.APARTMENT, label: 'Apartment'}, {value: UnitType.KIOS, label: 'KIOS'}]} />
                        <FilterPill icon={<CheckCircleIcon className="h-5 w-5 text-gray-400" />} currentValue={statusFilter} onValueChange={v => setStatusFilter(v as any)} tooltip="Lọc theo trạng thái" options={[{value: 'all', label: 'All Status'}, {value: 'unpaid', label: 'Unpaid'}, {value: 'paid', label: 'Paid'}, {value: 'pending', label: 'Pending'}]} />
                        <FilterPill icon={<BuildingIcon className="h-5 w-5 text-gray-400" />} currentValue={floorFilter} onValueChange={setFloorFilter} tooltip="Lọc theo tầng" options={floors} />
                    </div>
                </div>
                {/* KPIs and Actions */}
                <div className="stats-row flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 flex-wrap md:flex-nowrap mt-1">
                    <KpiCard title="Tổng phí" tooltip="Tổng phí của tất cả căn hộ trong kỳ" value={formatCurrency(kpiStats.totalDue)} valueTitle={formatCurrency(kpiStats.totalDue)} icon={<MoneyBagIcon className="w-5 h-5 text-blue-500" />} className="big billing-kpi" onClick={clearAllFilters} isActive={!activeKpiFilter}/>
                    <KpiCard title="Tổng đã nộp" tooltip="Tổng số tiền đã nộp thực tế (đã xác nhận)" value={formatCurrency(kpiStats.totalPaid)} valueTitle={formatCurrency(kpiStats.totalPaid)} icon={<CheckCircleIcon className="w-5 h-5 text-green-500" />} className="big billing-kpi" onClick={() => applyKpiFilter('paid', 'Paid')} isActive={activeKpiFilter === 'Paid'}/>
                    <KpiCard 
                        title="Chênh lệch" 
                        tooltip="Chênh lệch = Tổng phí - Tổng đã nộp" 
                        value={(
                            <>
                                <span>{formatNumber(kpiStats.difference)}</span>
                                <span className="kpi-unit">₫</span>
                            </>
                        )} 
                        valueTitle={formatCurrency(kpiStats.difference)} 
                        icon={<CalculatorIcon2 className="w-5 h-5 text-orange-500" />} 
                        className="small billing-kpi kpi-delta" 
                        isActive={false}
                    />
                    <KpiCard title="Căn hộ chưa nộp" tooltip="Số căn hộ chưa hoàn thành thanh toán" value={kpiStats.unpaidCount} valueTitle={`${kpiStats.unpaidCount} căn hộ`} icon={<WarningIcon className="w-5 h-5 text-red-500" />} className="small billing-kpi" onClick={() => applyKpiFilter('unpaid', 'Unpaid')} isActive={activeKpiFilter === 'Unpaid'}/>
                    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={handleRefreshData}
                            data-tooltip={isDataStale ? "Dữ liệu nguồn (xe, nước) đã thay đổi. Bấm để cập nhật." : "Làm mới dữ liệu nguồn"}
                            disabled={isRefreshing || isLoading}
                            className={`h-9 px-3 font-semibold rounded-lg hover:bg-opacity-80 disabled:opacity-50 flex items-center gap-2 border ${
                                isDataStale
                                    ? 'bg-green-100 dark:bg-green-900/30 border-green-600 text-green-700 dark:text-green-300 animate-pulse'
                                    : 'border-blue-600 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                            }`}
                        >
                            <CircularArrowRefreshIcon /> Refresh
                        </button>
                        {renderMainActionButton()}
                        
                        {/* Import / Export Group */}
                        <div className="flex items-center border-l pl-2 ml-2 gap-2 border-gray-300 dark:border-gray-600">
                             <button
                                onClick={handleImportStatementClick}
                                data-tooltip="Nhập sao kê để tự động đối soát"
                                disabled={isPeriodLocked || !canCalculate}
                                className="h-9 px-3 font-semibold rounded-lg hover:bg-opacity-80 disabled:opacity-50 flex items-center gap-2 border border-purple-600 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 bg-white dark:bg-transparent"
                            >
                                <ArrowUpTrayIcon className="w-5 h-5" /> Import
                            </button>
                            <button 
                                onClick={handleExportReport} 
                                data-tooltip="Xuất báo cáo tổng hợp" 
                                disabled={primaryActionState === 'calculate'} 
                                className="btn-export h-9 px-3 text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2"
                            > 
                                <TableCellsIcon className="w-5 h-5" /> Export 
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-4 rounded-lg shadow-md flex-1 flex flex-col overflow-hidden mt-2">
                {selectedUnits.size > 0 && (
                    <div className="bulk-action-bar">
                        <span className="font-semibold text-sm">{selectedUnits.size} selected</span>
                        <button onClick={() => setSelectedUnits(new Set())} className="btn-clear ml-4">Bỏ chọn</button>
                        <div className="h-6 border-l dark:border-dark-border ml-2"></div>
                        <div className="ml-auto flex items-center gap-4">
                             {(role === 'Admin' || role === 'Accountant') && <>
                                <button onClick={() => handleBulkSetStatus('paid')} className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-primary"><CheckCircleIcon /> Mark Paid</button>
                                <button onClick={() => handleBulkSetStatus('unpaid')} className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-primary"><WarningIcon /> Mark Unpaid</button>
                            </>}
                            <button onClick={handleDownloadPDFs} disabled={exportProgress.isOpen} className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-primary"><DocumentArrowDownIcon className="w-5 h-5" /> Tải PDF (Zip)</button>
                            <button onClick={handleExportReport} className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-primary"><TableCellsIcon /> Export CSV</button>
                            <button onClick={handleBulkSendEmail} className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-primary"><PaperAirplaneIcon /> Send Mail</button>
                        </div>
                    </div>
                )}
                <div className="overflow-y-auto">
                    <table className="min-w-full themed-table billing-table">
                        <thead className="sticky top-0 z-10"><tr>
                            <th className="col-check text-center"><input type="checkbox" onChange={handleSelectAll} checked={isAllVisibleSelected} disabled={sortedAndFilteredCharges.length === 0}/></th>
                            <th className="col-unit text-left">Căn hộ</th>
                            <th className="col-owner text-left">Chủ SH</th>
                            <th className="col-total-due text-right">Tổng phí</th>
                            <th className="col-total-paid text-right">Tổng TT</th>
                            <th className="col-diff text-right">C.Lệch</th>
                            <th className="col-status text-center">Trạng thái</th>
                            <th className="col-actions text-center">H.động</th>
                        </tr></thead>
                        <tbody className="text-sm">
                            {isLoading && primaryActionState !== 'recalculate' ? ( Array.from({ length: 10 }).map((_, i) => ( <tr key={i}><td colSpan={8} className="p-1"><div className="skeleton-row"></div></td></tr> )) )
                            : sortedAndFilteredCharges.length === 0 ? ( <tr><td colSpan={8} className="text-center p-8">No data available. {charges.filter(c=>c.Period===period).length > 0 ? 'Try different filters.' : 'Please "Refresh" then "Calculate" to view data.'}</td></tr> ) 
                            : ( sortedAndFilteredCharges.map(charge => {
                                    const finalPaidAmount = editedPayments[charge.UnitID] ?? charge.TotalPaid;
                                    const difference = finalPaidAmount - charge.TotalDue;
                                    
                                    let statusInfo = getStatusText(charge.paymentStatus);
                                    // Custom logic: If status is 'paid' but amount is less than due (with tolerance), show red
                                    if (charge.paymentStatus === 'paid' && difference < -1000) {
                                        statusInfo = { 
                                            text: 'Đã nộp', 
                                            class: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' 
                                        };
                                    }

                                    return (
                                    <tr key={charge.UnitID}>
                                        <td className="col-check py-3 px-2"><input type="checkbox" checked={selectedUnits.has(charge.UnitID)} onChange={(e) => handleSelectUnit(charge.UnitID, e.target.checked)} /></td>
                                        <td className="font-medium col-unit py-3 px-4">{charge.UnitID}</td>
                                        <td className="col-owner py-3 px-4">{charge.OwnerName}</td>
                                        <td className="font-bold col-total-due py-3 px-4 text-right"><span className="amount-wrapper">{formatNumber(charge.TotalDue)}</span></td>
                                        <td className="col-total-paid py-2 px-2">
                                            <input 
                                                type="text"
                                                value={new Intl.NumberFormat('vi-VN').format(finalPaidAmount)}
                                                onChange={(e) => handlePaymentChange(charge.UnitID, e.target.value)}
                                                disabled={isPeriodLocked || charge.PaymentConfirmed || role === 'Operator'}
                                                className="payment-input"
                                            />
                                        </td>
                                         <td className={`font-semibold col-diff py-3 px-4 text-right whitespace-nowrap ${difference > 0 ? 'text-green-600' : (difference < 0 ? 'text-red-600' : '')}`}>
                                            {difference !== 0 ? formatNumber(difference) : ''}
                                        </td>
                                        <td className="col-status py-3 px-4"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo.class}`}>{statusInfo.text}</span></td>
                                        <td className="col-actions py-3 px-4"><div className="action-icons">
                                            <button 
                                                onClick={() => handleConfirmPayment(charge)}
                                                disabled={isPeriodLocked || charge.PaymentConfirmed || role === 'Operator'}
                                                className="icon-btn"
                                                title="Xác nhận thanh toán"
                                            >
                                                <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                            </button>
                                            <button onClick={() => setPreviewCharge(charge)} className="icon-btn" title="View & Send"><ActionViewIcon className="text-blue-500" /></button>
                                        </div></td>
                                    </tr>
                                )
                            }))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <ExportProgressModal isOpen={exportProgress.isOpen} done={exportProgress.done} total={exportProgress.total} onCancel={() => { cancelExportToken.current.cancelled = true; showToast('Cancellation requested...', 'info'); }}/>
            {previewCharge && <NoticePreviewModal charge={previewCharge} onClose={() => setPreviewCharge(null)} invoiceSettings={invoiceSettings} allData={allData} onSendEmail={handleSendSingleEmail} />}
        </div>
    );
};

export default BillingPage;
