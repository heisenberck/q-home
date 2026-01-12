
export type Role = 'Admin' | 'Accountant' | 'Operator' | 'Viewer' | 'Resident';

export enum UnitType {
    APARTMENT = 'Apartment',
    KIOS = 'KIOS'
}

export type ExpenseCategory = 'purchasing' | 'maintenance' | 'decoration' | 'other';

export interface OperationalExpense {
    id: string;
    category: ExpenseCategory;
    amount: number;
    description: string;
    date: string; // YYYY-MM-DD
    createdAt: string;
    performedBy: string;
}

export interface Unit {
    UnitID: string;
    OwnerID: string;
    UnitType: UnitType;
    Area_m2: number;
    Status: 'Owner' | 'Rent' | 'Business';
}

export interface VehicleDocument {
    fileId: string;
    name: string;
    url: string;
    type: string;
    uploadedAt: string;
}

export interface Owner {
    OwnerID: string;
    OwnerName: string;
    Phone: string;
    Email: string;
    title?: 'Anh' | 'Chị' | 'Ông' | 'Bà';
    updatedAt?: string;
    secondOwnerName?: string;
    secondOwnerPhone?: string;
    avatarUrl?: string;
    documents?: {
        nationalId?: VehicleDocument;
        title?: VehicleDocument;
        others?: VehicleDocument[];
    };
}

export enum VehicleTier {
    CAR = 'car',
    CAR_A = 'car_a',
    MOTORBIKE = 'motorbike',
    EBIKE = 'ebike',
    BICYCLE = 'bicycle'
}

export interface Vehicle {
    VehicleId: string;
    UnitID: string;
    Type: VehicleTier;
    VehicleName?: string;
    PlateNumber: string;
    StartDate: string;
    isActive: boolean;
    updatedAt?: string;
    log?: string | null;
    parkingStatus?: 'Lốt chính' | 'Lốt tạm' | 'Xếp lốt' | null;
    documents?: {
        registration?: VehicleDocument;
        vehiclePhoto?: VehicleDocument;
    };
}

export interface WaterReading {
    UnitID: string;
    Period: string; // YYYY-MM
    PrevIndex: number;
    CurrIndex: number;
    Rollover: boolean;
    consumption: number;
}

export interface TariffService {
    LoaiHinh: string;
    ServiceFee_per_m2: number;
    VAT_percent: number;
    ValidFrom: string;
    ValidTo: string | null;
}

export enum ParkingTariffTier {
    CAR = 'Car',
    CAR_A = 'Car_A',
    MOTO12 = 'Moto12',
    MOTO34 = 'Moto34',
    BICYCLE = 'Bicycle'
}

export interface TariffParking {
    Tier: ParkingTariffTier;
    Price_per_unit: number;
    VAT_percent: number;
    ValidFrom: string;
    ValidTo: string | null;
}

export interface TariffWater {
    From_m3: number;
    To_m3: number | null;
    UnitPrice: number;
    VAT_percent: number;
    ValidFrom: string;
    ValidTo: string | null;
}

export interface TariffCollection {
    service: TariffService[];
    parking: TariffParking[];
    water: TariffWater[];
}

export interface Adjustment {
    UnitID: string;
    Period: string;
    Amount: number;
    Description: string;
    SourcePeriod?: string;
}

export type PaymentStatus = 'pending' | 'reconciling' | 'paid' | 'paid_tm' | 'paid_ck' | 'unpaid';

export interface ChargeRaw {
    Period: string;
    UnitID: string;
    OwnerName: string;
    Phone: string;
    Email: string;
    Area_m2: number;
    ServiceFee_Base: number;
    ServiceFee_VAT: number;
    ServiceFee_Total: number;
    '#CAR': number;
    '#CAR_A': number;
    '#MOTORBIKE': number;
    '#BICYCLE': number;
    ParkingFee_Base: number;
    ParkingFee_VAT: number;
    ParkingFee_Total: number;
    Water_m3: number;
    WaterFee_Base: number;
    WaterFee_VAT: number;
    WaterFee_Total: number;
    Adjustments: number;
    TotalDue: number;
    TotalPaid: number;
    PaymentConfirmed: boolean;
    paymentStatus: PaymentStatus;
    CreatedAt: string;
    Locked: boolean;
    isPrinted: boolean;
    isSent: boolean;
    proofImage?: string;
    ocrResult?: any;
    submittedAt?: string;
}

export interface MonthlyStat {
    period: string;
    totalService: number;
    totalParking: number;
    totalWater: number;
    totalDue: number;
    updatedAt: string;
}

export interface ActivityLog {
    id: string;
    ts: string;
    actor_email: string;
    actor_role: Role;
    module: string;
    action: string;
    summary: string;
    count?: number;
    ids?: string[];
    undone: boolean;
    undo_token: string | null;
    undo_until: string | null;
    before_snapshot?: any;
}

export interface NewsItem {
    id: string;
    title: string;
    content: string;
    date: string;
    priority: 'normal' | 'high';
    category: 'notification' | 'plan' | 'event';
    imageUrl?: string;
    sender?: string;
    isBroadcasted: boolean;
    broadcastTime?: string;
    isArchived: boolean;
}

export interface FeedbackReply {
    author: string;
    content: string;
    date: string;
}

export interface FeedbackItem {
    id: string;
    residentId: string;
    subject: string;
    category: 'general' | 'maintenance' | 'billing' | 'vehicle_reg' | 'other' | 'security' | 'hygiene';
    content: string;
    date: string;
    status: 'Pending' | 'Processing' | 'Resolved';
    priority?: 'normal' | 'high';
    replies: FeedbackReply[];
    imageUrl?: string;
}

// NEW: Service Registration Types
export type RegistrationStatus = 'Pending' | 'Approved' | 'Rejected';
export type RegistrationType = 'Construction' | 'Vehicle';

export interface ServiceRegistration {
    id: string;
    residentId: string;
    type: RegistrationType;
    status: RegistrationStatus;
    date: string;
    details: {
        // Construction fields
        constructionItem?: string;
        constructionTime?: string;
        contractor?: string;
        description?: string;
        // Vehicle fields
        vehicleType?: 'moto' | 'car';
        plate?: string;
        model?: string;
        color?: string;
    };
    documents: {
        name: string;
        url: string;
    }[];
    rejectionReason?: string;
    processedBy?: string;
    processedAt?: string;
}

export interface UserPermission {
    Email: string;
    Username?: string;
    Role: Role;
    status: 'Active' | 'Disabled' | 'Pending';
    password?: string;
    mustChangePassword?: boolean;
    residentId?: string;
    DisplayName?: string;
    avatarUrl?: string;
    contact_email?: string;
    permissions?: string[]; // Added permissions field
}

export interface InvoiceSettings {
    logoUrl: string;
    accountName: string;
    accountNumber: string;
    bankName: string;
    senderEmail: string;
    buildingName: string;
    appsScriptUrl?: string;
    senderName?: string;
    emailSubject?: string;
    emailBody?: string;
    footerHtml?: string;
    footerShowInPdf?: boolean;
    footerShowInEmail?: boolean;
    footerShowInViewer?: boolean;
    footerAlign?: 'left' | 'center' | 'right';
    footerFontSize?: 'sm' | 'md' | 'lg';
    loginBackgroundUrl?: string;
    HOTLINE?: string;
    transferContentTemplate?: string;
}

export interface ResidentNotification {
    id: string;
    userId: string;
    title: string;
    body: string;
    type: 'bill' | 'news' | 'feedback' | 'profile' | 'system';
    link: string;
    isRead: boolean;
    createdAt: any;
}

export interface SystemMetadata {
    units_version: number;
    owners_version: number;
    vehicles_version: number;
    tariffs_version: number;
    users_version: number;
}

export interface ProfileRequest {
    id: string;
    residentId: string;
    ownerId: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    changes: {
        title?: string;
        OwnerName?: string;
        Phone?: string;
        Email?: string;
        secondOwnerName?: string;
        secondOwnerPhone?: string;
        UnitStatus?: string;
        avatarUrl?: string;
    };
    createdAt: string;
    updatedAt: string;
}

export type MiscRevenueType = 'PARKING' | 'KIOS' | 'VAT_SERVICE' | 'OTHER';

export interface MiscRevenue {
    id: string;
    type: MiscRevenueType;
    amount: number;
    description: string;
    date: string;
    createdAt: string;
    createdBy: string;
}

export interface AdminNotification {
    id: string;
    type: 'system' | 'request' | 'message' | 'alert';
    title: string;
    message: string;
    isRead: boolean;
    createdAt: any; // Firestore Timestamp
    linkTo?: string;
}

export interface AllData {
    units: Unit[];
    owners: Owner[];
    vehicles: Vehicle[];
    waterReadings: WaterReading[];
    tariffs: TariffCollection;
    adjustments: Adjustment[];
    activityLogs: ActivityLog[];
    monthlyStats: MonthlyStat[];
    lockedWaterPeriods: string[];
}
