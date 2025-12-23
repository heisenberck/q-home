
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
    ParkingTariffTier,
    NewsItem,
    FeedbackItem,
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
    const titles: Array<'Anh' | 'Chị'> = ['Anh', 'Chị'];

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
                title: titles[Math.floor(Math.random() * titles.length)],
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
const KIOS_AREAS: { [key: string]: number } = {
  'Kios 1': 67.5, 'Kios 2': 61.32, 'Kios 3': 166.1, 'Kios 4': 0, 'Kios 5': 65.15,
  'Kios 6': 65.15, 'Kios 7': 64.5, 'Kios 8': 78.4, 'Kios 9': 99.4, 'Kios 10': 64.5,
  'Kios 11': 65.8, 'Kios 12': 87.7, 'Kios 13': 78.4, 'Kios 14': 61.32, 'Kios 15': 67.5,
};

export function patchKiosAreas(units: Unit[]): void {
  for (const u of units) {
    if (u.UnitType === UnitType.KIOS) {
      const kiosNum = parseInt(u.UnitID.substring(1), 10);
      const key = `Kios ${kiosNum}`;
      if (KIOS_AREAS[key] != null) {
        u.Area_m2 = KIOS_AREAS[key];
      }
    }
  }
}

const { units: generatedUnits, owners: generatedOwners } = generateMockUnitsAndOwners();
patchKiosAreas(generatedUnits);

export const MOCK_UNITS: Unit[] = generatedUnits;
export const MOCK_OWNERS: Owner[] = generatedOwners;

const generateResidentUsers = (units: Unit[]): UserPermission[] => {
    return units.map(unit => ({
        Email: `${unit.UnitID.toLowerCase()}@resident.q-home.vn`,
        Username: unit.UnitID,
        Role: 'Resident',
        status: 'Active',
        password: '123456',
        mustChangePassword: true,
        residentId: unit.UnitID,
    }));
};

const residentUsers = generateResidentUsers(generatedUnits);
MOCK_USER_PERMISSIONS.push(...residentUsers);

export const MOCK_VEHICLES: Vehicle[] = [
    { VehicleId: 'VEH001', UnitID: '202', Type: VehicleTier.MOTORBIKE, VehicleName: 'Honda Wave', PlateNumber: '29A1-12345', StartDate: '2024-01-01', isActive: true, documents: {} },
    { VehicleId: 'VEH002', UnitID: '202', Type: VehicleTier.MOTORBIKE, VehicleName: 'Yamaha Sirius', PlateNumber: '29A1-54321', StartDate: '2024-02-15', isActive: true, documents: {} },
    { VehicleId: 'VEH009', UnitID: '202', Type: VehicleTier.CAR, VehicleName: 'Mazda CX5', PlateNumber: '30M-45678', StartDate: '2025-10-15', isActive: true, parkingStatus: 'Lốt chính', documents: {} },
    { VehicleId: 'VEH004', UnitID: '204', Type: VehicleTier.CAR_A, VehicleName: 'Vinfast Fadil', PlateNumber: '30L-11223', StartDate: '2023-12-01', isActive: true, parkingStatus: 'Lốt chính', documents: {} },
];

const generateStableMockWaterReadings = (allUnits: Unit[]): WaterReading[] => {
    const readings: WaterReading[] = [];
    const periods = ['2025-08', '2025-09', '2025-10'];
    allUnits.forEach((unit, index) => {
        let lastIndex = 100 + (index * 50); 
        periods.forEach((period, periodIndex) => {
            const actualConsumption = unit.UnitType === UnitType.KIOS ? 20 + ((index + parseInt(period.split('-')[1])) % 10) * 4 : 10 + ((index + parseInt(period.split('-')[1])) % 10) * 3;
            const prevIndex = lastIndex;
            const currIndex = prevIndex + actualConsumption;
            const consumption = periodIndex === 0 ? 0 : actualConsumption;
            readings.push({ UnitID: unit.UnitID, Period: period, PrevIndex: prevIndex, CurrIndex: currIndex, Rollover: false, consumption });
            lastIndex = currIndex;
        });
    });
    return readings;
};

export const MOCK_WATER_READINGS: WaterReading[] = generateStableMockWaterReadings(MOCK_UNITS);

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

export const MOCK_TARIFFS_WATER: TariffWater[] = [
    { From_m3: 0, To_m3: 10, UnitPrice: 9310, VAT_percent: 5, ValidFrom: '2025-01-01', ValidTo: null },
    { From_m3: 11, To_m3: 20, UnitPrice: 10843, VAT_percent: 5, ValidFrom: '2025-01-01', ValidTo: null },
    { From_m3: 21, To_m3: 30, UnitPrice: 17524, VAT_percent: 5, ValidFrom: '2025-01-01', ValidTo: null },
    { From_m3: 31, To_m3: null, UnitPrice: 29571, VAT_percent: 5, ValidFrom: '2025-01-01', ValidTo: null },
];

export const MOCK_ADJUSTMENTS: Adjustment[] = [
    { UnitID: '204', Period: '2025-10', Amount: -50000, Description: 'Hoàn tiền sửa chữa' },
];

export const MOCK_NEWS_ITEMS: NewsItem[] = [
    { id: 'news1', title: 'Thông báo Lịch cắt điện T6, 22/11/2024', content: 'Do công tác bảo trì của điện lực Hoàng Mai...', date: new Date().toISOString(), priority: 'high', category: 'plan', isBroadcasted: true, isArchived: false },
];

export const MOCK_FEEDBACK_ITEMS: FeedbackItem[] = [
    { id: 'fb1', residentId: '202', subject: 'Hỏng đèn hành lang tầng 2', category: 'maintenance', content: 'Đèn ở khu vực thang máy B tầng 2 đã bị cháy, không sáng. Vui lòng kiểm tra và thay thế.', date: '2024-11-19T08:15:00Z', status: 'Processing', priority: 'high', replies: [{ author: 'BQL', content: 'Đã tiếp nhận. Đội kỹ thuật sẽ kiểm tra trong ngày.', date: '2024-11-19T09:00:00Z' }] },
    { id: 'fb2', residentId: '1504', subject: 'Góp ý về vệ sinh sảnh A', category: 'hygiene', content: 'Sảnh A buổi sáng khá bẩn, mong BQL tăng cường tần suất lau dọn.', date: '2024-11-18T17:00:00Z', status: 'Resolved', priority: 'normal', replies: [{ author: 'BQL', content: 'Cảm ơn góp ý của quý cư dân.', date: '2024-11-19T11:20:00Z' }] },
    { id: 'fb3', residentId: '808', subject: 'Thắc mắc phí nước tháng 10', category: 'billing', content: 'Hóa đơn nước tháng 10 của tôi cao bất thường...', date: '2024-11-17T14:00:00Z', status: 'Pending', priority: 'normal', replies: [] },
    { id: 'fb4', residentId: '1012', subject: 'Người lạ lảng vảng tầng hầm', category: 'security', content: 'Tôi thấy có người lạ không mặc đồng phục lảng vảng khu vực xe máy lúc 23h đêm qua.', date: '2024-11-20T22:30:00Z', status: 'Pending', priority: 'high', replies: [] },
];
