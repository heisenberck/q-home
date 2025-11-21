
import React from 'react';
import type { ChargeRaw, AllData, InvoiceSettings } from '../types';
import Modal from './ui/Modal';
import { PaperAirplaneIcon } from './ui/Icons';
import { generateFeeDetails, processFooterHtml } from '../utils/helpers';

interface NoticePreviewModalProps {
    charge: ChargeRaw;
    onClose: () => void;
    invoiceSettings: InvoiceSettings;
    allData: AllData;
    onSendEmail: (charge: ChargeRaw) => void;
}

const NoticePreviewModal: React.FC<NoticePreviewModalProps> = ({ charge, onClose, invoiceSettings, allData, onSendEmail }) => {
    const formatVND = (value: number | undefined | null) => new Intl.NumberFormat('vi-VN').format(Math.round(value || 0));

    const feeDetails = generateFeeDetails(charge, allData);

    const paymentContent = `HUD3 LD - Phong ${charge.UnitID} - nop phi dich vu thang ${charge.Period.split('-')[1]}/${charge.Period.split('-')[0]}`;
    const bankShortNameForQR = invoiceSettings.bankName.split(' - ')[0].trim();
    const qrCodeUrl = `https://qr.sepay.vn/img?acc=${invoiceSettings.accountNumber}&bank=${bankShortNameForQR}&amount=${charge.TotalDue}&des=${encodeURIComponent(paymentContent)}`;
    
    const getFooterHtmlForViewer = (settings: InvoiceSettings) => {
        if (!settings.footerShowInViewer || !settings.footerHtml) return '';
        const processedFooter = processFooterHtml(settings.footerHtml);
        const align = settings.footerAlign || 'center';
        const fontSize = { sm: '0.75rem', md: '0.875rem', lg: '1rem' }[settings.footerFontSize || 'sm'];
        return `<div class="text-gray-500 dark:text-gray-400" style="text-align: ${align}; font-size: ${fontSize}; margin-top: 1rem; padding-top: 0.5rem; border-top: 1px dashed #ccc;">${processedFooter}</div>`;
    };
    const footerHtml = getFooterHtmlForViewer(invoiceSettings);

    const htmlContent = `
    <div class="font-sans bg-white text-gray-900 p-6 rounded-lg max-w-4xl mx-auto dark:bg-dark-bg-secondary dark:text-dark-text-primary" style="font-family: Arial, sans-serif;">
        <header class="flex justify-between items-start mb-4">
            <div class="flex-1"><img src="${invoiceSettings.logoUrl}" alt="Logo" class="h-16 object-contain"/></div>
            <div class="flex-2 text-center">
                <h1 class="text-xl font-bold uppercase">Phiếu thông báo phí dịch vụ</h1>
                <p>Kỳ: ${charge.Period}</p>
            </div>
            <div class="flex-1 text-right font-semibold text-xs">BAN QUẢN LÝ VẬN HÀNH<br/>NHÀ CHUNG CƯ HUD3 LINH ĐÀM</div>
        </header>
        <section class="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <p><strong>Căn hộ:</strong> ${charge.UnitID}</p>
            <p><strong>Chủ hộ:</strong> ${charge.OwnerName}</p>
            <p><strong>Diện tích:</strong> ${charge.Area_m2} m²</p>
            <p><strong>SĐT:</strong> ${charge.Phone}</p>
        </section>
        <table class="w-full border-collapse text-sm themed-table">
            <thead class="bg-gray-100 dark:bg-dark-bg">
                <tr>
                    <th class="p-2 border text-left font-semibold dark:border-dark-border">Nội dung</th>
                    <th class="p-2 border text-center font-semibold dark:border-dark-border">Số lượng</th>
                    <th class="p-2 border text-right font-semibold dark:border-dark-border">Thành tiền (VND)</th>
                    <th class="p-2 border text-right font-semibold dark:border-dark-border">Thuế GTGT (VND)</th>
                    <th class="p-2 border text-right font-semibold dark:border-dark-border">Tổng cộng (VND)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="p-2 border dark:border-dark-border">Phí dịch vụ</td>
                    <td class="p-2 border text-center dark:border-dark-border">${charge.Area_m2} m²</td>
                    <td class="p-2 border text-right dark:border-dark-border">${formatVND(charge.ServiceFee_Base)}</td>
                    <td class="p-2 border text-right dark:border-dark-border">${formatVND(charge.ServiceFee_VAT)}</td>
                    <td class="p-2 border text-right dark:border-dark-border">${formatVND(charge.ServiceFee_Total)}</td>
                </tr>
                ${feeDetails.parking.map(item => `
                    <tr>
                        <td class="p-2 border dark:border-dark-border">${item.description}</td>
                        <td class="p-2 border text-center dark:border-dark-border">${item.quantity}</td>
                        <td class="p-2 border text-right dark:border-dark-border">${formatVND(item.base)}</td>
                        <td class="p-2 border text-right dark:border-dark-border">${formatVND(item.vat)}</td>
                        <td class="p-2 border text-right dark:border-dark-border">${formatVND(item.total)}</td>
                    </tr>
                `).join('')}
                ${feeDetails.water.map(item => `
                     <tr>
                        <td class="p-2 border dark:border-dark-border">${item.description}</td>
                        <td class="p-2 border text-center dark:border-dark-border">${item.quantity}</td>
                        <td class="p-2 border text-right dark:border-dark-border">${formatVND(item.base)}</td>
                        <td class="p-2 border text-right dark:border-dark-border">${formatVND(item.vat)}</td>
                        <td class="p-2 border text-right dark:border-dark-border">${formatVND(item.total)}</td>
                    </tr>
                `).join('')}
                 ${feeDetails.adjustments.map(adj => `
                    <tr>
                        <td class="p-2 border dark:border-dark-border">${adj.Description}</td>
                        <td class="p-2 border dark:border-dark-border"></td>
                        <td class="p-2 border dark:border-dark-border"></td>
                        <td class="p-2 border dark:border-dark-border"></td>
                        <td class="p-2 border text-right dark:border-dark-border">${formatVND(adj.Amount)}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr class="bg-gray-100 dark:bg-dark-bg font-bold text-base">
                    <td colspan="4" class="p-2 border text-right dark:border-dark-border">TỔNG CỘNG THANH TOÁN</td>
                    <td class="p-2 border text-right text-red-600 dark:border-dark-border">${formatVND(charge.TotalDue)}</td>
                </tr>
            </tfoot>
        </table>
        <div class="mt-6 flex items-start gap-4">
            <div class="flex-auto bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 p-4 rounded-md text-blue-800 dark:text-blue-200 text-sm">
                <p class="font-bold text-base mb-2">Thông tin thanh toán:</p>
                <p><strong>Chủ TK:</strong> ${invoiceSettings.accountName}</p>
                <p><strong>Số TK:</strong> ${invoiceSettings.accountNumber} tại ${invoiceSettings.bankName}</p>
                <p class="mt-2"><strong>Nội dung:</strong> <code class="bg-blue-200 dark:bg-blue-800/50 p-1 rounded font-mono break-all">${paymentContent}</code></p>
            </div>
            <div class="flex-shrink-0 text-center">
                <img src="${qrCodeUrl}" alt="QR Code" class="w-24 h-24" />
                <p class="text-xs font-medium mt-1">Quét mã để thanh toán</p>
            </div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: footerHtml }}></div>
    </div>`;

    return (
        <Modal title={`Phiếu báo phí: ${charge.UnitID} - Kỳ ${charge.Period}`} onClose={onClose} size="4xl">
            <>
                <div className="bg-gray-100 dark:bg-gray-800 -m-6 p-4">
                    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                </div>
                <div className="flex justify-end gap-3 pt-4 mt-auto border-t dark:border-dark-border">
                    <button
                        onClick={() => onSendEmail(charge)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus"
                    >
                        <PaperAirplaneIcon /> Gửi Email
                    </button>
                     <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">
                        Đóng
                    </button>
                </div>
            </>
        </Modal>
    );
};

export default NoticePreviewModal;
