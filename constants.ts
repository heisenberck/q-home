import {
    UserPermission,
    Unit,
    UnitType,
    Owner,
    Vehicle,
    WaterReading,
    TariffService,
    TariffParking,
    VehicleTier,
    TariffWater,
    Adjustment,
    ParkingTariffTier
} from './types';

export const MOCK_USER_PERMISSIONS: UserPermission[] = [
    { Email: 'admin@bql.com.vn', Username: 'admin', Role: 'Admin', status: 'Active', password: '123456a@' },
    { Email: 'ketoan@bql.com.vn', Username: 'ketoan', Role: 'Accountant', status: 'Active', password: '123456a@' },
    { Email: 'vanhanh@bql.com.vn', Username: 'vanhanh', Role: 'Operator', status: 'Disabled', password: '123456a@' },
    { Email: 'viewer@bql.com.vn', Username: 'guest', Role: 'Viewer', status: 'Active', password: '123456a@' },
    { Email: 'pending@bql.com.vn', Username: 'pending', Role: 'Viewer', status: 'Pending', password: '123456a@' },
];

const areaMap: { [key: string]: number } = {
    '02': 88, '04': 57.6, '06': 57.6, '08': 82.6, '10': 59.1,
    '12': 57.6, '14': 57.6, '16': 63.2, '18': 63.2, '20': 57.6,
    '22': 57.6, '24': 59.1, '26': 82.6, '28': 57.6, '30': 57.6, '32': 88,
};

const generateMockUnitsAndOwners = () => {
    const units: Unit[] = [];
    const owners: Owner[] = [];
    const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ'];
    const lastNames = ['Văn An', 'Thị Bình', 'Hoàng Cường', 'Thuỳ Dung', 'Minh Hải', 'Ngọc Lan'];
    const statuses: Array<'Owner' | 'Rent' | 'Business'> = ['Owner', 'Rent', 'Business'];

    let ownerCounter = 1;
    for (let floor = 2; floor <= 21; floor++) {
        for (let aptNum = 2; aptNum <= 32; aptNum += 2) {
            const aptNumStr = aptNum.toString().padStart(2, '0');
            const unitId = `${floor}${aptNumStr}`;
            const ownerId = `OWN${ownerCounter.toString().padStart(3, '0')}`;
            
            const owner: Owner = {
                OwnerID: ownerId,
                OwnerName: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
                Phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
                Email: `user${ownerCounter}@email.com`,
                updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Randomly in the last 30 days
            };
            owners.push(owner);

            const unit: Unit = {
                UnitID: unitId,
                OwnerID: ownerId,
                UnitType: UnitType.APARTMENT,
                Area_m2: areaMap[aptNumStr],
                Status: statuses[Math.floor(Math.random() * statuses.length)],
            };
            units.push(unit);
            
            ownerCounter++;
        }
    }

    // Add Kiosks
    for (let i = 1; i <= 15; i++) {
        const unitId = `K${i.toString().padStart(2, '0')}`;
        const ownerId = `OWN${ownerCounter.toString().padStart(3, '0')}`;

        const owner: Owner = {
            OwnerID: ownerId,
            OwnerName: `Chủ KIOS ${i.toString().padStart(2, '0')}`,
            Phone: `098${Math.floor(1000000 + Math.random() * 9000000)}`,
            Email: `kios${i.toString().padStart(2, '0')}@email.com`,
            updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
        owners.push(owner);

        const unit: Unit = {
            UnitID: unitId,
            OwnerID: ownerId,
            UnitType: UnitType.KIOS,
            Area_m2: Math.floor(20 + Math.random() * 30), // Random area between 20-50 m2
            Status: 'Business',
        };
        units.push(unit);

        ownerCounter++;
    }

    return { units, owners };
};

// --- START: KIOS Area Patch ---
// Map chuẩn diện tích KIOS (m²) from user prompt
const KIOS_AREAS: { [key: string]: number } = {
  'Kios 1': 67.5,
  'Kios 2': 61.32,
  'Kios 3': 166.1,
  'Kios 4': 0,
  'Kios 5': 65.15,
  'Kios 6': 65.15,
  'Kios 7': 64.5,
  'Kios 8': 78.4,
  'Kios 9': 99.4,
  'Kios 10': 64.5,
  'Kios 11': 65.8,
  'Kios 12': 87.7,
  'Kios 13': 78.4,
  'Kios 14': 61.32,
  'Kios 15': 67.5,
};

// Chạy khi load mock/DB: đồng bộ diện tích KIOS theo bảng trên
// Adapted to match TypeScript types and data structure
// FIX: Export 'patchKiosAreas' to make it available for import in other modules.
export function patchKiosAreas(units: Unit[]): void {
  let patched = 0;
  for (const u of units) {
    if (u.UnitType === UnitType.KIOS) {
      // The generated UnitID is e.g. "K01", "K12". We need to convert it to "Kios 1", "Kios 12" to match the map keys.
      const kiosNum = parseInt(u.UnitID.substring(1), 10);
      const key = `Kios ${kiosNum}`;
      if (KIOS_AREAS[key] != null) {
        u.Area_m2 = KIOS_AREAS[key];
        patched++;
      }
    }
  }
}
// --- END: KIOS Area Patch ---


const { units: generatedUnits, owners: generatedOwners } = generateMockUnitsAndOwners();

// Call the patch function after generating mock data to apply the correct areas
patchKiosAreas(generatedUnits);

export const MOCK_UNITS: Unit[] = generatedUnits;
export const MOCK_OWNERS: Owner[] = generatedOwners;


// UPDATED: MOCK_VEHICLES now conforms to the new permanent storage schema and has valid license plates.
export const MOCK_VEHICLES: Vehicle[] = [
    { VehicleId: 'VEH001', UnitID: '202', Type: VehicleTier.MOTORBIKE, VehicleName: 'Honda Wave', PlateNumber: '29A1-12345', StartDate: '2024-01-01', isActive: true, documents: {} },
    { VehicleId: 'VEH002', UnitID: '202', Type: VehicleTier.MOTORBIKE, VehicleName: 'Yamaha Sirius', PlateNumber: '29A1-54321', StartDate: '2024-02-15', isActive: true, documents: {} },
    { VehicleId: 'VEH003', UnitID: '202', Type: VehicleTier.CAR, VehicleName: 'Toyota Vios', PlateNumber: '30K-98765', StartDate: '2024-01-01', isActive: false, updatedAt: '2025-10-15', log: 'Đổi xe sang Mazda CX5 2025-10-15', parkingStatus: null, documents: {} },
    { VehicleId: 'VEH009', UnitID: '202', Type: VehicleTier.CAR, VehicleName: 'Mazda CX5', PlateNumber: '30M-45678', StartDate: '2025-10-15', isActive: true, parkingStatus: 'Lốt chính', documents: {} },
    { VehicleId: 'VEH004', UnitID: '204', Type: VehicleTier.CAR_A, VehicleName: 'Vinfast Fadil', PlateNumber: '30L-11223', StartDate: '2023-12-01', isActive: true, parkingStatus: 'Lốt chính', documents: {} },
    { VehicleId: 'VEH005', UnitID: '204', Type: VehicleTier.MOTORBIKE, VehicleName: 'Honda Lead', PlateNumber: '29B2-44556', StartDate: '2023-12-01', isActive: true, documents: {} },
    { VehicleId: 'VEH006', UnitID: '206', Type: VehicleTier.BICYCLE, VehicleName: 'Xe đạp Thống Nhất', PlateNumber: 'N/A', StartDate: '2024-05-01', isActive: true, documents: {} },
    { VehicleId: 'VEH007', UnitID: '308', Type: VehicleTier.MOTORBIKE, VehicleName: 'Honda Vision', PlateNumber: '29C3-77889', StartDate: '2024-03-01', isActive: true, documents: {} },
    { VehicleId: 'VEH008', UnitID: '202', Type: VehicleTier.MOTORBIKE, VehicleName: 'SYM Attila', PlateNumber: '29D4-13579', StartDate: '2025-11-01', isActive: true, documents: {} }, // Not active in 2025-10 based on date
    { VehicleId: 'VEH010', UnitID: '512', Type: VehicleTier.CAR, VehicleName: 'Hyundai Accent', PlateNumber: '30N-12345', StartDate: '2025-08-01', isActive: true, parkingStatus: 'Lốt tạm', documents: {} },
    { VehicleId: 'VEH011', UnitID: '714', Type: VehicleTier.CAR, VehicleName: 'Kia Seltos', PlateNumber: '30P-67890', StartDate: '2025-09-20', isActive: true, parkingStatus: 'Xếp lốt', documents: {} },
    { VehicleId: 'VEH012', UnitID: '920', Type: VehicleTier.CAR, VehicleName: 'Ford Ranger', PlateNumber: '30R-11122', StartDate: '2025-10-05', isActive: true, parkingStatus: 'Xếp lốt', documents: {} },
];


// NEW: Function to generate FIXED, multi-month water readings for consistency
const generateStableMockWaterReadings = (allUnits: Unit[]): WaterReading[] => {
    const readings: WaterReading[] = [];
    const periods = ['2025-08', '2025-09', '2025-10'];

    allUnits.forEach((unit, index) => {
        let lastIndex = 100 + (index * 50); // Start with a varied base index for each unit
        
        periods.forEach((period, periodIndex) => {
            const actualConsumption = unit.UnitType === UnitType.KIOS
                ? 20 + ((index + parseInt(period.split('-')[1])) % 10) * 4 // KIOS: 20-56 m3
                : 10 + ((index + parseInt(period.split('-')[1])) % 10) * 3; // Apartment: 10-37 m3
            
            const prevIndex = lastIndex;
            const currIndex = prevIndex + actualConsumption;

            // Per new logic: consumption is 0 for the first period in a series to establish a baseline.
            const consumption = periodIndex === 0 ? 0 : actualConsumption;
            
            readings.push({
                UnitID: unit.UnitID,
                Period: period,
                PrevIndex: prevIndex,
                CurrIndex: currIndex,
                Rollover: false,
                consumption, // Persisted consumption
            });

            lastIndex = currIndex; // The current index becomes the next period's previous index
        });
    });

    return readings;
};

// Generate base readings for all units
const baseWaterReadings = generateStableMockWaterReadings(MOCK_UNITS);

// As requested: Add mock data for the "current month" (Nov 2025) for 2nd-floor residents
const secondFloorUnits = MOCK_UNITS.filter(u => u.UnitID.startsWith('2') && u.UnitID.length === 3);
const newReadingsForNovember: WaterReading[] = secondFloorUnits.map(unit => {
    // Find the latest reading (Oct 2025) for this unit to ensure continuity
    const lastReading = baseWaterReadings
        .filter(r => r.UnitID === unit.UnitID)
        .sort((a, b) => b.Period.localeCompare(a.Period))[0];

    const newPrevIndex = lastReading.CurrIndex;
    // Generate a realistic random consumption for an apartment
    const consumption = 12 + Math.floor(Math.random() * 20); // between 12 and 31 m3
    const newCurrIndex = newPrevIndex + consumption;

    return {
        UnitID: unit.UnitID,
        Period: '2025-11', // The month after the last generated mock data
        PrevIndex: newPrevIndex,
        CurrIndex: newCurrIndex,
        Rollover: false,
        consumption, // Persisted consumption
    };
});

// Combine the base readings with the new November data for floor 2
export const MOCK_WATER_READINGS: WaterReading[] = [...baseWaterReadings, ...newReadingsForNovember];


// UPDATED: New service fee tariffs
export const MOCK_TARIFFS_SERVICE: TariffService[] = [
    { LoaiHinh: 'Apartment', ServiceFee_per_m2: 3500, VAT_percent: 10, ValidFrom: '2025-01-01', ValidTo: null },
    { LoaiHinh: 'Business Apartment', ServiceFee_per_m2: 5000, VAT_percent: 10, ValidFrom: '2025-01-01', ValidTo: null },
    { LoaiHinh: 'KIOS', ServiceFee_per_m2: 11000, VAT_percent: 10, ValidFrom: '2025-01-01', ValidTo: null },
];

export const MOCK_TARIFFS_PARKING: TariffParking[] = [
    { Tier: ParkingTariffTier.CAR, Price_per_unit: 860000, VAT_percent: 8, ValidFrom: '2025-01-01', ValidTo: null },
    { Tier: ParkingTariffTier.CAR_A, Price_per_unit: 800000, VAT_percent: 8, ValidFrom: '2025-01-01', ValidTo: null },
    { Tier: ParkingTariffTier.MOTO12, Price_per_unit: 60000, VAT_percent: 8, ValidFrom: '2025-01-01', ValidTo: null },
    { Tier: ParkingTariffTier.MOTO34, Price_per_unit: 80000, VAT_percent: 8, ValidFrom: '2025-01-01', ValidTo: null },
    { Tier: ParkingTariffTier.BICYCLE, Price_per_unit: 30000, VAT_percent: 8, ValidFrom: '2025-01-01', ValidTo: null },
];

// UPDATED: New water fee tariffs
export const MOCK_TARIFFS_WATER: TariffWater[] = [
    { From_m3: 0, To_m3: 10, UnitPrice: 9310, VAT_percent: 5, ValidFrom: '2025-01-01', ValidTo: null },
    { From_m3: 11, To_m3: 20, UnitPrice: 10843, VAT_percent: 5, ValidFrom: '2025-01-01', ValidTo: null },
    { From_m3: 21, To_m3: 30, UnitPrice: 17524, VAT_percent: 5, ValidFrom: '2025-01-01', ValidTo: null },
    { From_m3: 31, To_m3: null, UnitPrice: 29571, VAT_percent: 5, ValidFrom: '2025-01-01', ValidTo: null },
];

export const MOCK_ADJUSTMENTS: Adjustment[] = [
    { UnitID: '204', Period: '2025-10', Amount: -50000, Description: 'Hoàn tiền sửa chữa' },
];