
// types.ts

export type Role = 'Admin' | 'Accountant' | 'Operator' | 'Viewer' | 'Resident';

// UPDATED: Added specific payment method statuses
export type PaymentStatus = 'pending' | 'unpaid' | 'paid' | 'reconciling' | 'paid_tm' | 'paid_ck';

export interface UserPermission {
    Email: string; // Used as the unique ID in Firestore
    Username?: string; // Login ID / System Username (Fixed for system users)
    DisplayName?: string; // NEW: Editable display name (e.g., "Nguyễn Văn A")
    avatarUrl?: string; // Added Avatar URL (Base64)
    Role: Role;
    status: 'Active' | 'Disabled' | 'Pending';
    password: string;
    mustChangePassword?: boolean;
    residentId?: string; // Link to UnitID for residents
}

// ... (Keep existing Enums UnitType, VehicleTier, ParkingTariffTier)
export enum UnitType {
    APARTMENT = 'Apartment',
    KIOS = 'KIOS',
}

export enum VehicleTier {
    CAR = 'car',
    CAR_A = 'car_a',
    MOTORBIKE = 'motorbike',
    EBIKE = 'ebike', // Note: For billing, this is grouped with MOTORBIKE
    BICYCLE = 'bicycle',
}

export enum ParkingTariffTier {
    CAR = 'Car',
    CAR_A = 'Car-A',
    MOTO12 = 'Moto12',
    MOTO34 = 'Moto34',
    BICYCLE = 'Bicycle',
}

export interface Unit {
    UnitID: string; // e.g., 'A101'
    OwnerID: string;
    UnitType: UnitType;
    Area_m2: number;
    Status: 'Owner' | 'Rent' | 'Business'; // Trạng thái căn hộ
    // NEW: Added for CSV import and display logic
    displayStatus?: 'Normal' | 'Missing data' | 'Locked';
}

export interface Owner {
    OwnerID: string;
    OwnerName: string;
    Phone: string;
    Email: string;
    title?: 'Anh' | 'Chị' | 'Ông' | 'Bà'; // NEW: Title for greetings
    // NEW: Fields for resident detail panel
    avatarUrl?: string;
    secondOwnerName?: string;
    secondOwnerPhone?: string;
    updatedAt?: string; // ISO string for tracking updates
    documents?: {
        nationalId?: VehicleDocument; // CCCD
        title?: VehicleDocument;      // Sổ đỏ / Hợp đồng
        others?: VehicleDocument[];   // Other documents
    };
}

// NEW: Vehicle Document Interface
export interface VehicleDocument {
    fileId: string;
    name: string;
    url: string; // Base64 or URL
    type: string; // MIME type
    uploadedAt: string;
}

// UPDATED: Vehicle interface to match permanent storage schema
export interface Vehicle {
    VehicleId: string;
    UnitID: string;
    Type: VehicleTier;
    VehicleName: string;
    PlateNumber: string;
    StartDate: string;
    isActive: boolean;
    updatedAt?: string;
    parkingStatus?: 'Lốt chính' | 'Lốt tạm' | 'Xếp lốt' | null;
    log?: string;
    // NEW: Documents attachment
    documents?: {
        registration?: VehicleDocument; // Đăng ký xe
        vehiclePhoto?: VehicleDocument; // Ảnh chụp xe
    };
}


export interface WaterReading {
    UnitID: string;
    Period: string; // 'YYYY-MM'
    PrevIndex: number;
    CurrIndex: number;
    Rollover: boolean; // Indicates if the meter has reset
    consumption: number; // ADDED: Persisted consumption value (CurrIndex - PrevIndex)
}

export interface TariffService {
    LoaiHinh: string;
    ServiceFee_per_m2: number;
    VAT_percent: number;
    ValidFrom: string; // 'YYYY-MM-DD'
    ValidTo: string | null; // 'YYYY-MM-DD'
}

export interface TariffParking {
    Tier: ParkingTariffTier; // Uses the specific pricing tier
    Price_per_unit: number;
    VAT_percent: number;
    ValidFrom: string; // 'YYYY-MM-DD'
    ValidTo: string | null; // 'YYYY-MM-DD'
}

export interface TariffWater {
    From_m3: number;
    To_m3: number | null; // null for the last tier
    UnitPrice: number;
    VAT_percent: number;
    ValidFrom: string; // 'YYYY-MM-DD'
    ValidTo: string | null; // 'YYYY-MM-DD'
}

export interface TariffCollection {
    service: TariffService[];
    parking: TariffParking[];
    water: TariffWater[];
}

export interface Adjustment {
    UnitID: string;
    Period: string; // 'YYYY-MM'
    Amount: number;
    Description: string;
    SourcePeriod?: string;
}

export interface ChargeRaw {
    Period: string; // 'YYYY-MM'
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
    CreatedAt: string; // ISO 8601
    Locked: boolean;
    paymentStatus: PaymentStatus;
    // NEW: Added for delivery status tracking
    isPrinted?: boolean;
    isSent?: boolean;
}

// NEW: Aggregated Statistics for Charts (Optimization)
export interface MonthlyStat {
    period: string; // YYYY-MM
    totalService: number;
    totalParking: number;
    totalWater: number;
    totalDue: number;
    updatedAt: string;
}

// NEW: System Metadata for Version Checking
export interface SystemMetadata {
    units_version: number;
    owners_version: number;
    vehicles_version: number;
    tariffs_version: number;
    users_version: number;
    // Cold data like charges/logs don't need strict versioning as they are time-based or appended
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
    lockedWaterPeriods: string[]; // NEW: Cached list of locked months
}

export interface InvoiceSettings {
    logoUrl: string;
    accountName: string;
    accountNumber: string;
    bankName: string;
    senderEmail: string;
    senderName?: string;
    emailSubject?: string;
    emailBody?: string;
    appsScriptUrl?: string;
    transferContentTemplate?: string; // NEW: Added for customizable transfer content
    // Footer Settings
    footerHtml?: string;
    footerShowInPdf?: boolean;
    footerShowInEmail?: boolean;
    footerShowInViewer?: boolean;
    footerAlign?: 'left' | 'center' | 'right';
    footerFontSize?: 'sm' | 'md' | 'lg';
    // Branding Settings
    buildingName?: string;
    loginBackgroundUrl?: string;
}

// REFACTORED: New Activity Log schema
export interface ActivityLog {
    id: string;
    ts: string; // ISO string
    actor_email: string;
    actor_role: Role;
    module: 'Billing' | 'Residents' | 'Water' | 'Pricing' | 'Settings' | 'System' | 'Vehicles' | 'News' | 'Feedback';
    action: string; // e.g., 'CALCULATE_CHARGES', 'IMPORT_RESIDENTS'
    summary: string;
    count?: number;
    ids?: string[];
    before_snapshot: any; // The state *before* the action for undo
    undone: boolean;
    undo_token: string | null; // ID of the log itself if undoable
    undo_until: string | null; // ISO string, 24h from creation
}

// NEW: News and Feedback types
export interface NewsItem {
    id: string;
    title: string;
    content: string;
    date: string; // ISO string
    priority: 'high' | 'normal';
    category: 'notification' | 'plan' | 'event';
    imageUrl?: string;
    sender?: 'BQT' | 'BQLVH';
    isBroadcasted?: boolean;
    broadcastTime?: string;
    isArchived?: boolean;
}

export interface FeedbackReply {
    author: string; // e.g., "BQL" or user's name
    content: string;
    date: string; // ISO string
}

export interface FeedbackItem {
    id: string;
    residentId: string; // UnitID
    subject: string;
    category: 'general' | 'maintenance' | 'billing' | 'other';
    content: string;
    imageUrl?: string; // Base64
    status: 'Pending' | 'Processing' | 'Resolved';
    date: string; // ISO string
    replies: FeedbackReply[];
}
