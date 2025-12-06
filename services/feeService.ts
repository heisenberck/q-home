

import type { ChargeRaw, Unit, Owner, Vehicle, WaterReading, Adjustment, AllData, PaymentStatus } from '../types';
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
 * REWRITTEN (2024-07-29): Calculates water usage for a specific reading period based on the strict "Base Index Algorithm".
 *
 * Business Logic:
 * To calculate consumption for a given `readingPeriod`, the system MUST check for a valid reading in the immediately preceding period (`readingPeriod - 1`).
 *
 * - IF a reading for the preceding period does NOT exist:
 *   This is considered the first month of data entry for this unit.
 *   Consumption is set to 0 to establish a baseline index.
 *
 * - IF a reading for the preceding period EXISTS:
 *   Consumption is calculated as `current_period_index - previous_period_index`.
 *
 * @param unitId The ID of the unit.
 * @param readingPeriod The period (YYYY-MM) for which to calculate consumption (e.g., '2025-10' for the Nov billing cycle).
 * @param allWaterReadings The complete list of water readings from the database.
 * @returns The calculated water consumption in m³.
 */
const getWaterUsage = (unitId: string, readingPeriod: string, allWaterReadings: WaterReading[]): number => {
    // Step 1: Find the reading for the current period. If it doesn't exist, no consumption can be calculated.
    const readingForThisPeriod = allWaterReadings.find(r => r.UnitID === unitId && r.Period === readingPeriod);
    if (!readingForThisPeriod) {
        return 0;
    }

    // Step 2: Determine the immediately preceding period.
    const previousPeriod = getPreviousPeriod(readingPeriod);

    // Step 3: Find the reading for the preceding period.
    const readingForPrevPeriod = allWaterReadings.find(r => r.UnitID === unitId && r.Period === previousPeriod);

    // Step 4: Apply the "Base Index Algorithm".
    // If there is no record for the previous month, this is the baseline month. Consumption must be 0.
    if (!readingForPrevPeriod) {
        return 0;
    }
    
    // If a previous reading exists, calculate consumption based on the indexes of the current reading.
    // The `PrevIndex` is expected to be hydrated correctly from the previous period's `CurrIndex`.
    const consumption = readingForThisPeriod.CurrIndex - readingForThisPeriod.PrevIndex;

    // Ensure consumption is not negative (e.g., due to meter rollover or data entry error).
    return Math.max(0, Math.floor(consumption));
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
    
    // FIX: Exclude vehicles with 'Xếp lốt' status from fee calculation.
    const activeVehicles = vehicles.filter(v => 
        v.isActive && 
        new Date(v.StartDate) <= endOfMonth &&
        v.parkingStatus !== 'Xếp lốt'
    );
    
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
    // UPDATED LOGIC: For billing period T, use water consumption from reading period T.
    const usage = getWaterUsage(unit.UnitID, period, allData.waterReadings);
    
    if (usage <= 0) return { usage, ...applyVAT(0, 0) };

    const sortedTiers = [...allData.tariffs.water].sort((a, b) => a.From_m3 - b.From_m3);
    
    if (isBusinessUnit(unit)) {
        const businessTariff = sortedTiers.find(t => t.To_m3 === null); // Highest tier is business rate
        if (!businessTariff) return { usage, ...applyVAT(0, 0) };
        const taxed = applyVAT(usage * businessTariff.UnitPrice, businessTariff.VAT_percent);
        return { usage, ...taxed };
    }

    // Progressive (lũy tiến) calculation for apartments
    let net = 0;
    let consumptionRemaining = usage;
    
    // Tier blocks: first 10, next 10, next 10, rest
    const tierSizes = [10, 10, 10, Infinity];

    for (let i = 0; i < sortedTiers.length; i++) {
        if (consumptionRemaining <= 0) break;
        
        const tier = sortedTiers[i];
        if (!tier) continue; // Should not happen if data is correct
        
        const tierSize = tierSizes[i]; // Assumes sortedTiers and tierSizes are aligned
        const usageInThisTier = Math.min(consumptionRemaining, tierSize);

        net += usageInThisTier * tier.UnitPrice;
        consumptionRemaining -= usageInThisTier;
    }
    
    const vatPercent = sortedTiers[0]?.VAT_percent ?? 5; // Assume all water has same VAT
    return { usage, ...applyVAT(net, vatPercent) };
};

export const calculateChargesBatch = async (
    period: string,
    calculationInputs: CalculationInput[],
    allData: AllData
// FIX: The function returns an array of charges, so the Promise should resolve to an array type.
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
            // UPDATED LOGIC: Pre-fill paid amount but set status to pending
            TotalPaid: money(totalDue),
            PaymentConfirmed: false,
            paymentStatus: 'pending' as PaymentStatus,
        };
    });
    
    return Promise.resolve(results);
};