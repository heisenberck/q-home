import type { ChargeRaw, Unit, Owner, Vehicle, WaterReading, Adjustment, AllData, PaymentStatus } from '../types';
import { UnitType, VehicleTier, ParkingTariffTier } from '../types';

// The local calculation engine is now the primary method, fully implementing business rules.
// Gemini API calls have been removed to prioritize speed and deterministic calculations.

interface CalculationInput {
    unit: Unit;
    owner: Owner;
    vehicles: Vehicle[];
    waterReading: WaterReading;
    adjustments: Adjustment[];
}

// --- START: NEW FEE ENGINE from Master Prompt ---

const priceBook = {
  service: {
    Apartment: 3500,
    ApartmentBusiness: 5000,
    KIOS: 11000,
    vat: 0.10
  },
  vehicle: {
    Car: 860000, CarA: 800000,
    Moto_first2: 60000, Moto_from3: 80000,
    EBike_asMoto: true,
    Bicycle: 30000,
    vat: 0.08
  },
  water: {
    domestic: { t1_10: 9775, t11_20: 11385, t21_30: 18400, t31p: 31050, vat: 0.05 },
    businessFlat: 31050, businessVat: 0.05
  }
};

const money = (n: number) => Math.max(0, Math.round(n));
const applyVAT = (net: number, vatRate: number) => {
    const v = net * vatRate;
    return { net: money(net), vat: money(v), gross: money(net + v) };
};

const isBusinessUnit = (unit: Unit) => unit.UnitType === UnitType.KIOS || unit.Status === 'Business';

const getWaterUsage = (unitId: string, monthT_1: string, allWaterReadings: WaterReading[]) => {
    const reading = allWaterReadings.find(r => r.UnitID === unitId && r.Period === monthT_1);
    return reading ? Math.max(0, Math.floor(reading.CurrIndex - reading.PrevIndex)) : 0;
};

// --- Service Fee Calculation (UPDATED) ---
const calcServiceFee = (unit: Unit, pb: typeof priceBook) => {
    const rate = unit.UnitType === UnitType.KIOS ? pb.service.KIOS
               : unit.Status === 'Business' ? pb.service.ApartmentBusiness
               : pb.service.Apartment;
    return applyVAT(unit.Area_m2 * rate, pb.service.vat);
};

// --- Parking Fee Calculation ---
const calcVehicleFee = (vehicles: Vehicle[], period: string, pb: typeof priceBook) => {
    const endOfMonth = new Date(new Date(period + '-02').getFullYear(), new Date(period + '-02').getMonth() + 1, 0);
    const activeVehicles = vehicles.filter(v => v.isActive && new Date(v.StartDate) <= endOfMonth);
    
    const car = activeVehicles.filter(v => v.Type === VehicleTier.CAR).length;
    const carA = activeVehicles.filter(v => v.Type === VehicleTier.CAR_A).length;
    const moto = activeVehicles.filter(v => v.Type === VehicleTier.MOTORBIKE).length;
    const eBike = activeVehicles.filter(v => v.Type === VehicleTier.EBIKE).length;
    const bicycle = activeVehicles.filter(v => v.Type === VehicleTier.BICYCLE).length;

    const motoTotal = moto + (pb.vehicle.EBike_asMoto ? eBike : 0);
    const motoFirst2 = Math.min(2, motoTotal);
    const motoAfter2 = Math.max(0, motoTotal - 2);

    let net = 0;
    net += car * pb.vehicle.Car;
    net += carA * pb.vehicle.CarA;
    net += motoFirst2 * pb.vehicle.Moto_first2;
    net += motoAfter2 * pb.vehicle.Moto_from3;
    net += bicycle * pb.vehicle.Bicycle;

    return {
        counts: { car, carA, motoTotal, bicycle },
        ...applyVAT(net, pb.vehicle.vat)
    };
};

// --- Water Fee Calculation (UPDATED) ---
const calcWaterFee = (unit: Unit, period: string, allWaterReadings: WaterReading[], pb: typeof priceBook) => {
    const prevPeriod = `${new Date(period + '-02').getFullYear()}-${String(new Date(period + '-02').getMonth()).padStart(2, '0')}`;
    const usage = getWaterUsage(unit.UnitID, prevPeriod, allWaterReadings);
    if (usage <= 0) return { usage, ...applyVAT(0, 0) };

    if (isBusinessUnit(unit)) {
        const taxed = applyVAT(usage * pb.water.businessFlat, pb.water.businessVat);
        return { usage, ...taxed };
    }

    const dom = pb.water.domestic;
    const q1 = Math.min(10, usage);
    const q2 = Math.min(10, Math.max(0, usage - 10));
    const q3 = Math.min(10, Math.max(0, usage - 20));
    const q4 = Math.max(0, usage - 30);
    const net = (q1 * dom.t1_10) + (q2 * dom.t11_20) + (q3 * dom.t21_30) + (q4 * dom.t31p);
    
    return { usage, ...applyVAT(net, dom.vat) };
};

/**
 * Main batch calculation function, rewritten to use the new local fee engine.
 */
export const calculateChargesBatch = async (
    period: string,
    calculationInputs: CalculationInput[],
    allData: AllData
): Promise<Omit<ChargeRaw, 'CreatedAt' | 'Locked'>[]> => {
    
    const results = calculationInputs.map(input => {
        const { unit, owner, vehicles, adjustments } = input;
        
        const serviceFee = calcServiceFee(unit, priceBook);
        const parkingFee = calcVehicleFee(vehicles, period, priceBook);
        const waterFee = calcWaterFee(unit, period, allData.waterReadings, priceBook);
        
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
            // FIX: Cast 'pending' to PaymentStatus to resolve type incompatibility.
            paymentStatus: 'pending' as PaymentStatus,
        };
    });
    
    return Promise.resolve(results);
};
