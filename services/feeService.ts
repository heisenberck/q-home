
import type { ChargeRaw, Unit, Owner, Vehicle, WaterReading, Adjustment, AllData, PaymentStatus, TariffParking } from '../types';
import { UnitType, VehicleTier, ParkingTariffTier } from '../types';
import { getPreviousPeriod } from '../utils/helpers';

interface CalculationInput {
    unit: Unit;
    owner: Owner;
    vehicles: Vehicle[];
    adjustments: Adjustment[];
}

const money = (n: number) => Math.max(0, Math.round(n));
const applyVAT = (net: number, vatRate: number) => {
    const v = net * (vatRate / 100);
    return { net: money(net), vat: money(v), gross: money(net + v) };
};

const isBusinessUnit = (unit: Unit) => unit.UnitType === UnitType.KIOS || unit.Status === 'Business';

/**
 * Lấy chỉ số tiêu thụ nước đã được lưu trữ cho một kỳ nhất định.
 */
const getWaterUsage = (unitId: string, readingPeriod: string, allWaterReadings: WaterReading[]): number => {
    const readingForThisPeriod = allWaterReadings.find(r => r.UnitID === unitId && r.Period === readingPeriod);
    return readingForThisPeriod?.consumption ?? 0;
};

const calcServiceFee = (unit: Unit, tariffs: AllData['tariffs']) => {
    const tariffKey = unit.UnitType === UnitType.KIOS ? 'KIOS' 
                    : unit.Status === 'Business' ? 'Business Apartment' 
                    : 'Apartment';
    
    const tariff = tariffs.service.find(t => t.LoaiHinh === tariffKey);
    if (!tariff) return { net: 0, vat: 0, gross: 0 };
    
    const net = unit.Area_m2 * tariff.ServiceFee_per_m2;
    return applyVAT(net, tariff.VAT_percent);
};

const findParkingTariff = (parkingTariffs: TariffParking[], tier: ParkingTariffTier) => {
    // So khớp không phân biệt hoa thường để tăng tính chịu lỗi của hệ thống
    return parkingTariffs.find(t => t.Tier.toLowerCase() === tier.toLowerCase());
};

const calcVehicleFee = (vehicles: Vehicle[], period: string, tariffs: AllData['tariffs']) => {
    const endOfMonth = new Date(new Date(period + '-02').getFullYear(), new Date(period + '-02').getMonth() + 1, 0);
    
    // Loại trừ các xe đang ở trạng thái 'Xếp lốt' khỏi tính phí
    const activeVehicles = vehicles.filter(v => 
        v.isActive && 
        new Date(v.StartDate) <= endOfMonth &&
        v.parkingStatus !== 'Xếp lốt'
    );
    
    const carCount = activeVehicles.filter(v => v.Type === VehicleTier.CAR).length;
    const carACount = activeVehicles.filter(v => v.Type === VehicleTier.CAR_A).length;
    const motoCount = activeVehicles.filter(v => v.Type === VehicleTier.MOTORBIKE || v.Type === VehicleTier.EBIKE).length;
    const bicycleCount = activeVehicles.filter(v => v.Type === VehicleTier.BICYCLE).length;
    
    const carTariff = findParkingTariff(tariffs.parking, ParkingTariffTier.CAR);
    const carATariff = findParkingTariff(tariffs.parking, ParkingTariffTier.CAR_A);
    const moto12Tariff = findParkingTariff(tariffs.parking, ParkingTariffTier.MOTO12);
    const moto34Tariff = findParkingTariff(tariffs.parking, ParkingTariffTier.MOTO34);
    const bicycleTariff = findParkingTariff(tariffs.parking, ParkingTariffTier.BICYCLE);

    // Kiểm tra cấu hình có đầy đủ không, nhưng không ngắt chương trình nếu chỉ thiếu mục không dùng tới
    if (!carTariff || !carATariff || !moto12Tariff || !moto34Tariff || !bicycleTariff) {
         console.warn("Cảnh báo: Cấu hình đơn giá gửi xe chưa đầy đủ!");
    }

    let net = 0;
    if (carCount > 0 && carTariff) net += carCount * carTariff.Price_per_unit;
    if (carACount > 0 && carATariff) net += carACount * carATariff.Price_per_unit;
    
    // Tính phí lũy tiến cho xe máy
    if (motoCount > 0) {
        if (moto12Tariff) net += Math.min(2, motoCount) * moto12Tariff.Price_per_unit;
        if (moto34Tariff) net += Math.max(0, motoCount - 2) * moto34Tariff.Price_per_unit;
    }
    
    if (bicycleCount > 0 && bicycleTariff) net += bicycleCount * bicycleTariff.Price_per_unit;
    
    // Sử dụng VAT của lốt ô tô làm mặc định, nếu không có lấy 8%
    const vatPercent = carTariff?.VAT_percent ?? 8;
    return {
        counts: { car: carCount, carA: carACount, motoTotal: motoCount, bicycle: bicycleCount },
        ...applyVAT(net, vatPercent)
    };
};

const calcWaterFee = (unit: Unit, period: string, allData: AllData) => {
    const usage = getWaterUsage(unit.UnitID, period, allData.waterReadings);
    
    if (usage <= 0) return { usage, ...applyVAT(0, 0) };

    const sortedTiers = [...allData.tariffs.water].sort((a, b) => a.From_m3 - b.From_m3);
    
    if (isBusinessUnit(unit)) {
        const businessTariff = sortedTiers.find(t => t.To_m3 === null);
        if (!businessTariff) return { usage, ...applyVAT(0, 0) };
        const taxed = applyVAT(usage * businessTariff.UnitPrice, businessTariff.VAT_percent);
        return { usage, ...taxed };
    }

    let net = 0;
    let consumptionRemaining = usage;
    const tierSizes = [10, 10, 10, Infinity];

    for (let i = 0; i < sortedTiers.length; i++) {
        if (consumptionRemaining <= 0) break;
        const tier = sortedTiers[i];
        if (!tier) continue;
        const tierSize = tierSizes[i];
        const usageInThisTier = Math.min(consumptionRemaining, tierSize);
        net += usageInThisTier * tier.UnitPrice;
        consumptionRemaining -= usageInThisTier;
    }
    
    const vatPercent = sortedTiers[0]?.VAT_percent ?? 5;
    return { usage, ...applyVAT(net, vatPercent) };
};

export const calculateChargesBatch = async (
    period: string,
    calculationInputs: CalculationInput[],
    allData: AllData
): Promise<Omit<ChargeRaw, 'CreatedAt' | 'Locked' | 'isPrinted' | 'isSent'>[]> => {
    
    const results = calculationInputs.map(input => {
        const { unit, owner, vehicles, adjustments } = input;
        
        const serviceFee = calcServiceFee(unit, allData.tariffs);
        const parkingFee = calcVehicleFee(vehicles, period, allData.tariffs);
        const waterFee = calcWaterFee(unit, period, allData);
        
        const adjustmentsTotal = adjustments.reduce((acc, adj) => acc + adj.Amount, 0);
        const totalDue = serviceFee.gross + parkingFee.gross + waterFee.gross + adjustmentsTotal;

        return {
            Period: period,
            UnitID: unit.UnitID,
            OwnerName: owner.OwnerName,
            Phone: owner.Phone,
            Email: owner.Email,
            Area_m2: unit.Area_m2,
            ServiceFee_Base: serviceFee.net,
            ServiceFee_VAT: serviceFee.vat,
            ServiceFee_Total: serviceFee.gross,
            '#CAR': parkingFee.counts.car,
            '#CAR_A': parkingFee.counts.carA,
            '#MOTORBIKE': parkingFee.counts.motoTotal,
            '#BICYCLE': parkingFee.counts.bicycle,
            ParkingFee_Base: parkingFee.net,
            ParkingFee_VAT: parkingFee.vat,
            ParkingFee_Total: parkingFee.gross,
            Water_m3: waterFee.usage,
            WaterFee_Base: waterFee.net,
            WaterFee_VAT: waterFee.vat,
            WaterFee_Total: waterFee.gross,
            Adjustments: adjustmentsTotal,
            TotalDue: money(totalDue),
            TotalPaid: money(totalDue),
            PaymentConfirmed: false,
            paymentStatus: 'pending' as PaymentStatus,
        };
    });
    
    return Promise.resolve(results);
};
