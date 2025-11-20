import { UnitType, ParkingTariffTier } from '../types';
import type { ChargeRaw, AllData, Adjustment } from '../types';

export const formatCurrency = (value: number | null | undefined): string => {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0 ₫';
    }
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Math.round(value));
};

export const getPreviousPeriod = (p: string): string => {
    const [year, month] = p.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const parseUnitCode = (code: string) => {
    const s = String(code).trim();
    if (s.startsWith('K')) return { floor: 99, apt: parseInt(s.substring(1), 10) || 0 };
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
        // This also escapes special regex characters in the key
        processedHtml = processedHtml.replace(new RegExp(key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), allVariables[key as keyof typeof allVariables]);
    }
    return processedHtml;
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