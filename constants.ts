
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
    { Email: 'admin0@q-home.vn', Username: 'Admin0', Role: 'Admin', status: 'Active', password: '123456a@A' },
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
// Map chuẩn diện tích KIOS (m²) from user prompt
const KIOS_AREAS: { [key: string]: number } = {
  'Kios 1': 67.5, 'Kios 2': 61.32, 'Kios 3': 166.1, 'Kios 4': 0, 'Kios 5': 65.15,
  'Kios 6': 65.15, 'Kios 7': 64.5, 'Kios 8': 78.4, 'Kios 9': 99.4, 'Kios 10': 64.5,
  'Kios 11': 65.8, 'Kios 12': 87.7, 'Kios 13': 78.4, 'Kios 14': 61.32, 'Kios 15': 67.5,
};

export function patchKiosAreas(units: Unit[]): void {
  let patched = 0;
  for (const u of units) {
    if (u.UnitType === UnitType.KIOS) {
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

patchKiosAreas(generatedUnits);

export const MOCK_UNITS: Unit[] = generatedUnits;
export const MOCK_OWNERS: Owner[] = generatedOwners;

// Generate resident users and append them to the main user list
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

const baseWaterReadings = generateStableMockWaterReadings(MOCK_UNITS);

const secondFloorUnits = MOCK_UNITS.filter(u => u.UnitID.startsWith('2') && u.UnitID.length === 3);
const newReadingsForNovember: WaterReading[] = secondFloorUnits.map(unit => {
    const lastReading = baseWaterReadings.filter(r => r.UnitID === unit.UnitID).sort((a, b) => b.Period.localeCompare(a.Period))[0];
    const newPrevIndex = lastReading.CurrIndex;
    const consumption = 12 + Math.floor(Math.random() * 20);
    const newCurrIndex = newPrevIndex + consumption;
    return { UnitID: unit.UnitID, Period: '2025-11', PrevIndex: newPrevIndex, CurrIndex: newCurrIndex, Rollover: false, consumption };
});

export const MOCK_WATER_READINGS: WaterReading[] = [...baseWaterReadings, ...newReadingsForNovember];

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

const now = new Date();
const currentMonthISO = now.toISOString().slice(0, 7);
const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
const lastMonthISO = lastMonthDate.toISOString().slice(0, 7);

export const MOCK_NEWS_ITEMS: NewsItem[] = [
    { id: 'news1', title: 'Thông báo Lịch cắt điện T6, 22/11/2024', content: 'Do công tác bảo trì của điện lực Hoàng Mai, tòa nhà sẽ tạm thời mất điện từ 8:00 đến 11:00 sáng ngày 22/11/2024. Mong quý cư dân thông cảm.', date: `${currentMonthISO}-20T10:00:00Z`, priority: 'high', category: 'plan', imageUrl: 'https://images.unsplash.com/photo-1621243878988-8243b5934328?w=800', sender: 'BQLVH', isBroadcasted: true, broadcastTime: `${currentMonthISO}-20T10:05:00Z`, isArchived: false },
    { id: 'news2', title: 'V/v Đăng ký Vé xe Tết Nguyên Đán 2025', content: 'BQL bắt đầu tiếp nhận đăng ký vé xe ô tô bổ sung cho dịp Tết Nguyên Đán từ ngày 01/12/2024. Vui lòng liên hệ quầy lễ tân để biết thêm chi tiết.', date: `${currentMonthISO}-18T14:30:00Z`, priority: 'normal', category: 'notification', sender: 'BQT', isBroadcasted: false, isArchived: false },
    { id: 'news3', title: 'Lịch phun thuốc diệt côn trùng định kỳ', content: 'BQL sẽ tiến hành phun thuốc diệt muỗi và côn trùng tại các khu vực công cộng vào ngày 25/11/2024. Thuốc có chứng nhận an toàn, ít mùi. Đề nghị cư dân đóng cửa sổ trong thời gian phun thuốc.', date: `${currentMonthISO}-15T09:00:00Z`, priority: 'normal', category: 'plan', sender: 'BQLVH', isBroadcasted: true, broadcastTime: `${currentMonthISO}-15T09:10:00Z`, isArchived: true },
    { id: 'news4', title: 'Mời tham gia Đêm hội Trăng rằm', content: 'Nhân dịp Tết Trung thu, Ban Quản lý tổ chức đêm hội trăng rằm cho các cháu thiếu nhi tại sảnh chung. Thời gian: 19:00, ngày 15/08 Âm lịch.', date: `2024-09-10T11:00:00Z`, priority: 'normal', category: 'event', imageUrl: 'https://images.unsplash.com/photo-1599723381692-72b6b553c395?w=800', sender: 'BQT', isBroadcasted: true, broadcastTime: `2024-09-10T11:05:00Z`, isArchived: false },
    { id: 'news5', title: 'Báo cáo thu chi Quỹ Bảo trì 2%', content: 'BQT công khai báo cáo thu chi Quỹ Bảo trì 2% cho năm tài chính vừa qua. Chi tiết xem tại bảng tin tầng 1.', date: `${lastMonthISO}-25T16:00:00Z`, priority: 'normal', category: 'notification', sender: 'BQT', isBroadcasted: true, broadcastTime: `${lastMonthISO}-25T16:05:00Z`, isArchived: false },
    { id: 'news6', title: 'Sự kiện "Ngày hội Gia đình" Chủ nhật tuần này', content: 'Mời các gia đình tham gia các trò chơi vận động và ẩm thực tại khu vực sân chung. Thời gian: 8:00 - 11:00, Chủ nhật.', date: `${currentMonthISO}-02T11:00:00Z`, priority: 'normal', category: 'event', sender: 'BQLVH', isBroadcasted: false, isArchived: false },
    { id: 'news7', title: 'Kế hoạch bảo trì thang máy định kỳ', content: 'Lịch bảo trì thang máy: Thang A1, A2: Thứ 2; Thang B1, B2: Thứ 3. Thời gian: 13:30 - 16:30.', date: `${lastMonthISO}-28T09:00:00Z`, priority: 'normal', category: 'plan', sender: 'BQLVH', isBroadcasted: true, broadcastTime: `${lastMonthISO}-28T09:05:00Z`, isArchived: false },
    { id: 'news8', title: 'Thông báo về việc thay đổi đơn vị an ninh', content: 'Từ tháng tới, tòa nhà sẽ chuyển sang hợp tác với công ty an ninh mới - An Ninh Thăng Long.', date: `${lastMonthISO}-15T10:00:00Z`, priority: 'high', category: 'notification', sender: 'BQT', isBroadcasted: true, broadcastTime: `${lastMonthISO}-15T10:05:00Z`, isArchived: false },
    { id: 'news9', title: 'Lưu ý về việc để xe đúng nơi quy định', content: 'Một số cư dân đang để xe lấn chiếm lối đi chung. Đề nghị các hộ tuân thủ quy định để xe trong vạch kẻ.', date: `2024-10-05T14:00:00Z`, priority: 'normal', category: 'notification', sender: 'BQLVH', isBroadcasted: true, broadcastTime: `2024-10-05T14:05:00Z`, isArchived: false },
    { id: 'news10', title: 'Sự kiện chiếu phim ngoài trời tối thứ 7', content: 'Mời quý cư dân thưởng thức bộ phim "Mắt Biếc" tại khu vực sân khấu ngoài trời vào 19:30 thứ 7 tuần này.', date: `2024-09-25T17:00:00Z`, priority: 'normal', category: 'event', imageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800', sender: 'BQLVH', isBroadcasted: true, broadcastTime: `2024-09-25T17:05:00Z`, isArchived: false },
    { id: 'news11', title: 'V/v thay thế hệ thống thẻ từ thang máy', content: 'Hệ thống thẻ từ sẽ được nâng cấp. BQL sẽ tiến hành đổi thẻ mới cho cư dân tại quầy lễ tân từ ngày 1/12.', date: `2024-11-10T08:30:00Z`, priority: 'high', category: 'plan', sender: 'BQT', isBroadcasted: true, broadcastTime: `2024-11-10T08:35:00Z`, isArchived: false },
    { id: 'news12', title: 'Mở lớp học Yoga miễn phí cho cư dân', content: 'Lớp Yoga cộng đồng sẽ được tổ chức vào 6:00 sáng T3-T5-T7 hàng tuần tại phòng sinh hoạt chung.', date: `2024-08-20T15:00:00Z`, priority: 'normal', category: 'event', sender: 'BQLVH', isBroadcasted: true, broadcastTime: `2024-08-20T15:05:00Z`, isArchived: false },
    { id: 'news13', title: 'Khảo sát ý kiến cư dân về Dịch vụ Vệ sinh', content: 'BQL gửi link khảo sát online để ghi nhận ý kiến của cư dân về chất lượng dịch vụ vệ sinh. Rất mong nhận được sự tham gia.', date: `2024-10-10T10:10:00Z`, priority: 'normal', category: 'notification', sender: 'BQLVH', isBroadcasted: true, broadcastTime: `2024-10-10T10:15:00Z`, isArchived: true },
    { id: 'news14', title: 'Quy định về việc nuôi thú cưng trong tòa nhà', content: 'Nhắc nhở các hộ nuôi thú cưng cần tuân thủ quy định về việc rọ mõm, dọn dẹp chất thải và không gây ồn ào.', date: `2024-11-01T11:00:00Z`, priority: 'normal', category: 'notification', sender: 'BQT', isBroadcasted: true, broadcastTime: `2024-11-01T11:05:00Z`, isArchived: false },
    { id: 'news15', title: 'Kế hoạch cải tạo khu vực sân chơi trẻ em', content: 'BQT dự kiến cải tạo, bổ sung thêm đồ chơi tại khu vực sân chơi chung vào Quý 1 năm sau.', date: `2024-11-05T09:00:00Z`, priority: 'normal', category: 'plan', sender: 'BQT', isBroadcasted: false, isArchived: false },
];

export const MOCK_FEEDBACK_ITEMS: FeedbackItem[] = [
    { id: 'fb1', residentId: '202', subject: 'Hỏng đèn hành lang tầng 2', category: 'maintenance', content: 'Đèn ở khu vực thang máy B tầng 2 đã bị cháy, không sáng. Vui lòng kiểm tra và thay thế.', date: '2024-11-19T08:15:00Z', status: 'Processing', replies: [{ author: 'BQL', content: 'Đã tiếp nhận. Đội kỹ thuật sẽ kiểm tra trong ngày.', date: '2024-11-19T09:00:00Z' }] },
    { id: 'fb2', residentId: '1504', subject: 'Góp ý về vệ sinh sảnh A', category: 'general', content: 'Sảnh A buổi sáng khá bẩn, mong BQL tăng cường tần suất lau dọn.', date: '2024-11-18T17:00:00Z', status: 'Resolved', replies: [{ author: 'BQL', content: 'Cảm ơn góp ý của quý cư dân. BQL đã yêu cầu đội vệ sinh tăng cường làm sạch vào 7:00 sáng hàng ngày.', date: '2024-11-19T11:20:00Z' }] },
    { id: 'fb3', residentId: '808', subject: 'Thắc mắc phí nước tháng 10', category: 'billing', content: 'Hóa đơn nước tháng 10 của tôi cao bất thường, trong khi gia đình đi du lịch nửa tháng. Vui lòng kiểm tra lại đồng hồ.', date: '2024-11-17T14:00:00Z', status: 'Pending', replies: [] },
];
