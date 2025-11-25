
import type { ChargeRaw, Unit, Owner, Vehicle, WaterReading, Adjustment, AllData, PaymentStatus } from '../types';
import { UnitType, VehicleTier, ParkingTariffTier } from '../types';
import { getPreviousPeriod } from '../utils/helpers';

interface CalculationInput {
    unit: Unit;
    owner: Owner;
    vehicles: Vehicle[];
    waterReading: WaterReading;
    adjustments: Adjustment[];
}

const money = (n: number) => Math.max(0, Math.round(n));
const applyVAT = (net: number, vatRate: number) => {
    const v = net * (vatRate / 100);
    return { net: money(net), vat: money(v), gross: money(net + v) };
};

const isBusinessUnit = (unit: Unit) => unit.UnitType === UnitType.KIOS || unit.Status === 'Business';

const getWaterUsage = (unitId: string, monthT_1: string, allWaterReadings: WaterReading[]) => {
    const reading = allWaterReadings.find(r => r.UnitID === unitId && r.Period === monthT_1);
    return reading ? Math.max(0, Math.floor(reading.CurrIndex - reading.PrevIndex)) : 0;
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

const calcVehicleFee = (vehicles: Vehicle[], period: string, tariffs: AllData['tariffs']) => {
    const endOfMonth = new Date(new Date(period + '-02').getFullYear(), new Date(period + '-02').getMonth() + 1, 0);
    const activeVehicles = vehicles.filter(v => v.isActive && new Date(v.StartDate) <= endOfMonth);
    
    const carCount = activeVehicles.filter(v => v.Type === VehicleTier.CAR).length;
    const carACount = activeVehicles.filter(v => v.Type === VehicleTier.CAR_A).length;
    // Count motorbikes and electric bikes together for fee calculation as they share the same tariff tiers.
    const motoCount = activeVehicles.filter(v => v.Type === VehicleTier.MOTORBIKE || v.Type === VehicleTier.EBIKE).length;
    const bicycleCount = activeVehicles.filter(v => v.Type === VehicleTier.BICYCLE).length;
    
    const carTariff = tariffs.parking.find(t => t.Tier === ParkingTariffTier.CAR);
    const carATariff = tariffs.parking.find(t => t.Tier === ParkingTariffTier.CAR_A);
    const moto12Tariff = tariffs.parking.find(t => t.Tier === ParkingTariffTier.MOTO12);
    const moto34Tariff = tariffs.parking.find(t => t.Tier === ParkingTariffTier.MOTO34);
    const bicycleTariff = tariffs.parking.find(t => t.Tier === ParkingTariffTier.BICYCLE);

    if (!carTariff || !carATariff || !moto12Tariff || !moto34Tariff || !bicycleTariff) {
         console.error("Parking tariffs are not fully configured!");
         return { counts: { car: 0, carA: 0, motoTotal: 0, bicycle: 0 }, net: 0, vat: 0, gross: 0 };
    }

    let net = 0;
    net += carCount * carTariff.Price_per_unit;
    net += carACount * carATariff.Price_per_unit;
    
    // Tiered pricing for motorbikes
    net += Math.min(2, motoCount) * moto12Tariff.Price_per_unit;
    net += Math.max(0, motoCount - 2) * moto34Tariff.Price_per_unit;
    
    net += bicycleCount * bicycleTariff.Price_per_unit;
    
    const vatPercent = carTariff.VAT_percent; // Assume all parking has same VAT
    return {
        counts: { car: carCount, carA: carACount, motoTotal: motoCount, bicycle: bicycleCount },
        ...applyVAT(net, vatPercent)
    };
};

const calcWaterFee = (unit: Unit, period: string, allData: AllData) => {
    const prevPeriod = getPreviousPeriod(period);
    const usage = getWaterUsage(unit.UnitID, prevPeriod, allData.waterReadings);
    if (usage <= 0) return { usage, ...applyVAT(0, 0) };

    const sortedTiers = [...allData.tariffs.water].sort((a, b) => a.From_m3 - b.From_m3);
    const businessTariff = sortedTiers.find(t => t.To_m3 === null); // Highest tier is business rate

    if (isBusinessUnit(unit)) {
        if (!businessTariff) return { usage, ...applyVAT(0, 0) };
        const taxed = applyVAT(usage * businessTariff.UnitPrice, businessTariff.VAT_percent);
        return { usage, ...taxed };
    }

    let net = 0;
    let consumptionLeft = usage;
    for (const tier of sortedTiers) {
        if (consumptionLeft <= 0) break;
        
        const tierRange = (tier.To_m3 ?? Infinity) - tier.From_m3 + 1;
        const usageInTier = Math.min(consumptionLeft, tierRange);

        net += usageInTier * tier.UnitPrice;
        consumptionLeft -= usageInTier;
    }
    
    const vatPercent = sortedTiers[0]?.VAT_percent ?? 5; // Assume all water has same VAT
    return { usage, ...applyVAT(net, vatPercent) };
};

export const calculateChargesBatch = async (
    period: string,
    calculationInputs: CalculationInput[],
    allData: AllData
): Promise<Omit<ChargeRaw, 'CreatedAt' | 'Locked'>[]> => {
    
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
            TotalPaid: money(totalDue), // Default to full amount
            PaymentConfirmed: false,
            paymentStatus: 'pending' as PaymentStatus,
        };
    });
    
    return Promise.resolve(results);
};
