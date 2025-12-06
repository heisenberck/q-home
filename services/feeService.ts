

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
 * REWRITTEN (2024-08-01): Retrieves the persisted water consumption for a specific billing period.
 *
 * Business Logic:
 * The system now calculates and saves the `consumption` value at the time of data entry (manual or import).
 * This function's sole responsibility is to read that pre-calculated, authoritative value from the database record.
 * This ensures consistency between the Water Management page and the Billing module.
 *
 * @param unitId The ID of the unit.
 * @param readingPeriod The period (YYYY-MM) for which to retrieve consumption.
 * @param allWaterReadings The complete list of water readings from the database.
 * @returns The persisted water consumption in m³. If no record or consumption value exists, returns 0.
 */
const getWaterUsage = (unitId: string, readingPeriod: string, allWaterReadings: WaterReading[]): number => {
    // Find the reading for the specified period.
    const readingForThisPeriod = allWaterReadings.find(r => r.UnitID === unitId && r.Period === readingPeriod);

    // Return the persisted consumption value.
    // If the record doesn't exist or the consumption field is missing (for legacy data), default to 0.
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
    // UPDATED LOGIC: Use the authoritative getWaterUsage function which now reads persisted consumption.
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