
import { UnitType, ParkingTariffTier, VehicleTier, InvoiceSettings } from '../types';
import type { ChargeRaw, AllData, Adjustment, Unit } from '../types';

export const formatCurrency = (value: number | null | undefined): string => {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0 ₫';
    }
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Math.round(value));
};

export const formatNumber = (value: number | null | undefined): string => {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0';
    }
    return new Intl.NumberFormat('vi-VN').format(Math.round(value));
};

export const getPreviousPeriod = (p: string): string => {
    const [year, month] = p.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const parseUnitCode = (code: string) => {
    const s = String(code).trim();
    
    // Xử lý Kios (bắt đầu bằng K hoặc Kios)
    // Trả về floor 99 để Kios luôn nằm sau các căn hộ tầng thường
    // Regex \d+ sẽ lấy số đầu tiên tìm thấy (VD: "Kios 1" -> 1, "K10" -> 10)
    if (s.toLowerCase().startsWith('k')) {
        const matches = s.match(/\d+/);
        const apt = matches ? parseInt(matches[0], 10) : 0;
        return { floor: 99, apt: apt };
    }

    // Xử lý Căn hộ (VD: 202, 1204)
    if (!/^\d{3,4}$/.test(s)) return null;
    let floor, apt;
    if (s.length === 3) {
        floor = parseInt(s.slice(0, 1), 10);
        apt = parseInt(s.slice(1), 10);
    } else { // 4 digits
        floor = parseInt(s.slice(0, 2), 10);
        apt = parseInt(s.slice(2), 10);
    }
    return { floor, apt };
};

export const sortUnitsComparator = (a: { UnitID: string }, b: { UnitID: string }) => {
    const pa = parseUnitCode(a.UnitID) || { floor: 999, apt: 999 };
    const pb = parseUnitCode(b.UnitID) || { floor: 999, apt: 999 };
    if (pa.floor !== pb.floor) return pa.floor - pb.floor;
    return pa.apt - pb.apt;
};

export const processFooterHtml = (
    html: string | undefined,
    variables: Record<string, string> = {}
): string => {
    if (!html) return '';
    let processedHtml = html;
    
    // Default variables that can be used in the footer template
    const allVariables = {
        '{{YEAR}}': new Date().getFullYear().toString(),
        '{{BUILDING_NAME}}': 'BQL Chung cư HUD3 Linh Đàm',
        '{{HOTLINE}}': '0834.88.66.86',
        '{{ADDRESS}}': 'Linh Đàm, Hoàng Mai, Hà Nội',
        '{{EMAIL_SUPPORT}}': 'bqthud3linhdam@gmail.com',
        '{{WEBSITE}}': '', // No website provided, leave blank
        ...variables, // User-provided variables (if any) can override defaults
    };

    for (const key in allVariables) {
        // Use a regex with the 'g' flag to replace all occurrences
        processedHtml = processedHtml.replace(new RegExp(key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), allVariables[key as keyof typeof allVariables]);
    }
    return processedHtml;
};

export const timeAgo = (dateString?: string): string => {
    if (!dateString) return 'không rõ';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 2) return 'vừa xong';
    if (seconds < 60) return `${seconds} giây trước`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const generateTransferContent = (charge: ChargeRaw, settings: InvoiceSettings): string => {
    // Default value if the setting is null/undefined
    let template = settings.transferContentTemplate || 'HUD3 {{unitId}} T{{period}}';

    // Fallback if user messes up the template by removing required variables
    if (!template.includes('{{unitId}}') || !template.includes('{{period}}')) {
        template = 'HUD3 {{unitId}} T{{period}}';
    }
    
    // Extract just the month number, e.g., "12" from "2025-12"
    const month = charge.Period.split('-')[1];

    return template
        .replace(/{{\s*unitId\s*}}/g, charge.UnitID)
        .replace(/{{\s*period\s*}}/g, month);
};


export const generateFeeDetails = (charge: ChargeRaw, allData: AllData) => {
    const unit = allData.units.find(u => u.UnitID === charge.UnitID);
    if (!unit) return { parking: [], water: [], adjustments: [] };

    const adjustmentsForUnit = allData.adjustments.filter(a => a.UnitID === charge.UnitID && a.Period === charge.Period);

    // Parking Fee Breakdown
    const parkingBreakdown: { description: string; quantity: number | string; base: number; vat: number; total: number }[] = [];
    const parkingVatPercent = allData.tariffs.parking[0]?.VAT_percent ?? 8;
    
    if (charge['#CAR'] > 0) {
        const tariff = allData.tariffs.parking.find(t => t.Tier === ParkingTariffTier.CAR)!;
        const base = charge['#CAR'] * tariff.Price_per_unit;
        parkingBreakdown.push({ description: `Phí gửi xe - Ô tô`, quantity: charge['#CAR'], base, vat: base * (parkingVatPercent / 100), total: base * (1 + parkingVatPercent / 100) });
    }
    if (charge['#CAR_A'] > 0) {
        const tariff = allData.tariffs.parking.find(t => t.Tier === ParkingTariffTier.CAR_A)!;
        const base = charge['#CAR_A'] * tariff.Price_per_unit;
        parkingBreakdown.push({ description: `Phí gửi xe - Ô tô loại A`, quantity: charge['#CAR_A'], base, vat: base * (parkingVatPercent / 100), total: base * (1 + parkingVatPercent / 100) });
    }
    if (charge['#BICYCLE'] > 0) {
        const tariff = allData.tariffs.parking.find(t => t.Tier === ParkingTariffTier.BICYCLE)!;
        const base = charge['#BICYCLE'] * tariff.Price_per_unit;
        parkingBreakdown.push({ description: `Phí gửi xe - Xe đạp`, quantity: charge['#BICYCLE'], base, vat: base * (parkingVatPercent / 100), total: base * (1 + parkingVatPercent / 100) });
    }
    if (charge['#MOTORBIKE'] > 0) {
        const moto12 = allData.tariffs.parking.find(t => t.Tier === ParkingTariffTier.MOTO12)!;
        const moto34 = allData.tariffs.parking.find(t => t.Tier === ParkingTariffTier.MOTO34)!;
        const base = Math.min(2, charge['#MOTORBIKE']) * moto12.Price_per_unit + Math.max(0, charge['#MOTORBIKE'] - 2) * moto34.Price_per_unit;
        parkingBreakdown.push({ description: `Phí gửi xe - Xe máy`, quantity: charge['#MOTORBIKE'], base, vat: base * (parkingVatPercent / 100), total: base * (1 + parkingVatPercent / 100) });
    }

    // Water Fee Breakdown
    const waterBreakdown: { description: string; quantity: string; base: number; vat: number; total: number }[] = [];
    const waterVatPercent = allData.tariffs.water[0]?.VAT_percent ?? 5;
    const waterConsumption = charge.Water_m3;

    if (unit.UnitType === UnitType.KIOS) {
        const highestTier = allData.tariffs.water.find(t => t.To_m3 === null)!;
        const base = waterConsumption * highestTier.UnitPrice;
        waterBreakdown.push({ description: `Tiền nước KIOS`, quantity: `${waterConsumption} m³`, base, vat: base * (waterVatPercent / 100), total: base * (1 + waterVatPercent / 100) });
    } else {
        let consumptionLeft = waterConsumption;
        const sortedTiers = [...allData.tariffs.water].sort((a, b) => a.From_m3 - b.From_m3);
        let lastTierEnd = 0;
        for (const tier of sortedTiers) {
            if (consumptionLeft <= 0) break;
            const tierEnd = tier.To_m3 ?? Infinity;
            const usageInTier = Math.min(consumptionLeft, tierEnd - lastTierEnd);
            if (usageInTier > 0) {
                const base = usageInTier * tier.UnitPrice;
                const desc = `Tiền nước (${tier.From_m3} - ${tier.To_m3 ?? 'trở lên'} m³)`
                waterBreakdown.push({ description: desc, quantity: `${usageInTier} m³`, base, vat: base * (waterVatPercent / 100), total: base * (1 + waterVatPercent / 100) });
            }
            consumptionLeft -= usageInTier;
            lastTierEnd = tierEnd === Infinity ? lastTierEnd + usageInTier : tierEnd;
        }
    }

    return { parking: parkingBreakdown, water: waterBreakdown, adjustments: adjustmentsForUnit };
};

// --- PDF & EMAIL HELPERS ---

const getFooterHtmlForChannel = (settings: InvoiceSettings, forChannel: 'pdf' | 'email') => {
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


export const renderInvoiceHTMLForPdf = (charge: ChargeRaw, allData: AllData, invoiceSettings: InvoiceSettings): string => {
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

    const paymentContent = generateTransferContent(charge, invoiceSettings);
    const bankShortNameForQR = invoiceSettings.bankName.split(' - ')[0].trim();
    const qrCodeUrl = `https://qr.sepay.vn/img?acc=${invoiceSettings.accountNumber}&bank=${bankShortNameForQR}&amount=${charge.TotalDue}&des=${encodeURIComponent(paymentContent)}`;
    
    const footerHtml = getFooterHtmlForChannel(invoiceSettings, 'pdf');
    const buildingName = (invoiceSettings.buildingName || 'HUD3 LINH ĐÀM').toUpperCase();

    return `
    <div id="phiieu" style="font-family: Arial, sans-serif; background: #fff; width: 210mm; height: 148mm; padding: 8mm; box-sizing: border-box; font-size: 12px; ${textStyle}">
        <header style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; ${textStyle}">
            <div style="flex: 1;"><img src="${invoiceSettings.logoUrl}" alt="Logo" style="height: 64px;"/></div>
            <div style="flex: 2; text-align: center;">
                <h1 style="font-size: 1.25rem; font-weight: bold; margin: 0; ${textStyle}">PHIẾU THÔNG BÁO PHÍ DỊCH VỤ</h1>
                <p style="margin: 0; ${textStyle}">Kỳ: ${charge.Period}</p>
            </div>
            <div style="flex: 1; text-align: right; font-weight: 600; font-size: 11px; ${textStyle}">BAN QUẢN LÝ VẬN HÀNH<br>NHÀ CHUNG CƯ ${buildingName}</div>
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
            <div style="flex: 1 1 auto; min-width: 0;">
                <p style="font-weight: bold; font-size: 13px; margin-bottom: 0.5rem; ${textStyle}">Thông tin thanh toán:</p>
                <table style="width: 100%; font-size: 11px; border-spacing: 0; text-align: left;">
                    <tbody>
                        <tr>
                            <td style="font-weight: 500; color: #4b5563; padding: 2px 1rem 2px 0; vertical-align: top;">Chủ TK:</td>
                            <td style="font-weight: 600; padding: 2px 0; ${textStyle}">${invoiceSettings.accountName}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 500; color: #4b5563; padding: 2px 1rem 2px 0; vertical-align: top;">Số TK:</td>
                            <td style="font-weight: 600; padding: 2px 0; ${textStyle}">${invoiceSettings.accountNumber}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 500; color: #4b5563; padding: 2px 1rem 2px 0; vertical-align: top;">Ngân hàng:</td>
                            <td style="font-weight: 600; padding: 2px 0; ${textStyle}">${invoiceSettings.bankName}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 500; color: #4b5563; padding: 2px 1rem 2px 0; vertical-align: top;">Nội dung:</td>
                            <td style="font-weight: bold; color: #000; font-family: monospace; word-break: break-all; padding: 2px 0;">${paymentContent}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="flex: 0 0 90px; text-align: center; ${textStyle}">
                <img src="${qrCodeUrl}" alt="QR Code" style="width: 90px; height: 90px; object-fit: contain;" />
                <p style="font-weight: 500; font-size: 10px; margin-top: 4px; white-space: nowrap; ${textStyle}">Quét mã để thanh toán</p>
            </div>
        </div>
        ${footerHtml}
    </div>`;
};

export const generateEmailHtmlForCharge = (charge: ChargeRaw, allData: AllData, invoiceSettings: InvoiceSettings, personalizedBody: string): string => {
    const formatVND = (value: number | undefined | null) => new Intl.NumberFormat('vi-VN').format(Math.round(value || 0));
    const formattedPersonalizedBody = personalizedBody.replace(/\n/g, '<br />');

    const feeDetails = generateFeeDetails(charge, allData);

    const paymentContent = generateTransferContent(charge, invoiceSettings);
    const bankShortNameForQR = invoiceSettings.bankName.split(' - ')[0].trim();
    const qrCodeUrl = `https://qr.sepay.vn/img?acc=${invoiceSettings.accountNumber}&bank=${bankShortNameForQR}&amount=${charge.TotalDue}&des=${encodeURIComponent(paymentContent)}`;

    const footerHtml = getFooterHtmlForChannel(invoiceSettings, 'email');
    const buildingName = (invoiceSettings.buildingName || 'HUD3 LINH ĐÀM').toUpperCase();

    // This is the full HTML document for the email body.
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
            @media (prefers-color-scheme: dark) {
                body { background-color: #111827 !important; }
                .container { background-color: #1f2937 !important; border-color: #374151 !important; }
                h1, p, th, td, .footer, div { color: #f9fafb !important; }
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
                <div style="flex: 1; text-align: right; font-weight: 600; font-size: 12px;">BAN QUẢN LÝ VẬN HÀNH<br/>NHÀ CHUNG CƯ ${buildingName}</div>
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


// --- NEW HELPERS ---

export const normalizePhoneNumber = (phoneStr: string | number | undefined | null): string => {
    if (!phoneStr) return '';
    let digits = String(phoneStr).replace(/\D/g, '');
    if (digits.startsWith('84')) {
        digits = '0' + digits.substring(2);
    }
    if (digits.length > 0 && !digits.startsWith('0')) {
        digits = '0' + digits;
    }
    return digits;
};

export const formatLicensePlate = (rawPlate: string | undefined | null): string => {
    if (!rawPlate) return '';
    const cleaned = rawPlate.replace(/[\s.-]/g, '').toUpperCase();
    
    // Matches ...12345 (5 digits) or ...1234 (4 digits) at the end of the string
    const match = cleaned.match(/^([A-Z0-9]+?)(\d{4,5})$/);
    if (match && match[1] && match[2]) {
        return `${match[1]}-${match[2]}`;
    }
    return cleaned; // Fallback for unusual formats
};

export const vehicleTypeLabels: { [key in VehicleTier]: string } = {
    [VehicleTier.CAR]: "Ô tô",
    [VehicleTier.CAR_A]: "Ô tô - A",
    [VehicleTier.MOTORBIKE]: "Xe máy",
    [VehicleTier.EBIKE]: "Xe điện",
    [VehicleTier.BICYCLE]: "Xe đạp",
};

export const translateVehicleType = (type: VehicleTier): string => {
    return vehicleTypeLabels[type] || type;
};

export const compressImageToWebP = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH_OR_HEIGHT = 1024;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH_OR_HEIGHT) {
                        height *= MAX_WIDTH_OR_HEIGHT / width;
                        width = MAX_WIDTH_OR_HEIGHT;
                    }
                } else {
                    if (height > MAX_WIDTH_OR_HEIGHT) {
                        width *= MAX_WIDTH_OR_HEIGHT / height;
                        height = MAX_WIDTH_OR_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/webp', 0.7);

                const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
                const padding = (dataUrl.charAt(dataUrl.length - 2) === '=') ? 2 : ((dataUrl.charAt(dataUrl.length - 1) === '=') ? 1 : 0);
                const fileSizeInBytes = base64Length * 0.75 - padding;

                if (fileSizeInBytes > 200 * 1024) {
                    console.warn(`Compressed image is still larger than 200KB: ${(fileSizeInBytes / 1024).toFixed(1)}KB`);
                }

                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

const pastelColors = [
    { bg: 'bg-blue-50 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700/50' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/50', text: 'text-emerald-800 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-700/50' },
    { bg: 'bg-purple-50 dark:bg-purple-900/50', text: 'text-purple-800 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-700/50' },
    { bg: 'bg-orange-50 dark:bg-orange-900/50', text: 'text-orange-800 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-700/50' },
    { bg: 'bg-rose-50 dark:bg-rose-900/50', text: 'text-rose-800 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-700/50' },
    { bg: 'bg-sky-50 dark:bg-sky-900/50', text: 'text-sky-800 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-700/50' },
    { bg: 'bg-amber-50 dark:bg-amber-900/50', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700/50' },
];

export const getPastelColorForName = (name: string | undefined) => {
    if (!name) return pastelColors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % pastelColors.length);
    return pastelColors[index];
};
