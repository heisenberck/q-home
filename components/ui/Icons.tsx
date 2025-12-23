
import React from 'react';
import { 
  LayoutDashboard, 
  UserCircle, 
  LogOut, 
  Check, 
  User, 
  Users, 
  Send, 
  Upload, 
  Trash2, 
  Settings, 
  Key, 
  Archive, 
  ClipboardList, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  Calculator, 
  Droplets, 
  Receipt, 
  Car, 
  Megaphone, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  RefreshCcw, 
  Search, 
  Download, 
  Banknote, 
  Printer, 
  Mail, 
  Undo2, 
  Database, 
  Building2, 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  Bike, 
  Zap, 
  Smartphone, 
  Star, 
  Info,
  Paperclip,
  Plus,
  Share2,
  Tag,
  SquarePen,
  X,
  Camera as LucideCamera,
  CreditCard,
  Percent,
  PiggyBank
} from 'lucide-react';

interface IconProps {
    className?: string;
    size?: number;
}

// Global default size reduced to 16px for a cleaner UI
const DEFAULT_CLASS = "h-4 w-4";
const DEFAULT_SIZE = 16;

export const PieChartIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <LayoutDashboard className={className} size={size} />;
export const UserCircleIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <UserCircle className={className} size={size} />;
export const ArrowRightOnRectangleIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <LogOut className={className} size={size} />;
export const CheckIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Check className={className} size={size} />;
export const UserIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <User className={className} size={size} />;
export const UsersIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Users className={className} size={size} />;
export const PaperAirplaneIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Send className={className} size={size} />;
export const UploadIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Upload className={className} size={size} />;
export const TrashIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Trash2 className={className} size={size} />;
export const SettingsIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Settings className={className} size={size} />;
export const KeyIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Key className={className} size={size} />;
export const ArchiveBoxIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Archive className={className} size={size} />;
export const ClipboardDocumentListIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <ClipboardList className={className} size={size} />;
export const LockClosedIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Lock className={className} size={size} />;
export const EyeIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Eye className={className} size={size} />;
export const EyeSlashIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <EyeOff className={className} size={size} />;
export const CheckCircleIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <CheckCircle className={className} size={size} />;
export const CalculatorIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Calculator className={className} size={size} />;
export const CalculatorIcon2 = CalculatorIcon;
export const WaterIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Droplets className={className} size={size} />;
export const ReceiptIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Receipt className={className} size={size} />;
export const CarIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Car className={className} size={size} />;
export const MegaphoneIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Megaphone className={className} size={size} />;
export const ChatBubbleLeftEllipsisIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <MessageSquare className={className} size={size} />;
export const ChevronLeftIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <ChevronLeft className={className} size={size} />;
export const ChevronRightIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <ChevronRight className={className} size={size} />;
export const ChevronDownIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <ChevronDown className={className} size={size} />;
export const ChevronUpIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <ChevronUp className={className} size={size} />;
export const ArrowPathIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <RefreshCcw className={className} size={size} />;
export const SearchIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Search className={className} size={size} />;
export const ArrowDownTrayIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Download className={className} size={size} />;
export const BanknotesIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Banknote className={className} size={size} />;
export const ArrowUpTrayIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Upload className={className} size={size} />;
export const PrinterIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Printer className={className} size={size} />;
export const EnvelopeIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Mail className={className} size={size} />;
export const ArrowUturnLeftIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Undo2 className={className} size={size} />;
export const ActionViewIcon = EyeIcon;
export const SaveIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Database className={className} size={size} />;
export const MagnifyingGlassIcon = SearchIcon;
export const BuildingIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Building2 className={className} size={size} />;
export const DropletsIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Droplets className={className} size={size} />;
export const WarningIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <AlertTriangle className={className} size={size} />;
export const ClockIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Clock className={className} size={size} />;
export const ChatBubbleLeftRightIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <MessageSquare className={className} size={size} />;
export const TagIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Tag className={className} size={size} />;
export const StoreIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Building2 className={className} size={size} />;
export const DocumentTextIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <ClipboardList className={className} size={size} />;
export const MotorbikeIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Bike className={className} size={size} />;
export const BikeIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Bike className={className} size={size} />;
export const PhoneArrowUpRightIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Smartphone className={className} size={size} />;
export const ClipboardIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <ClipboardList className={className} size={size} />;
export const HomeIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Building2 className={className} size={size} />;
export const EBikeIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Zap className={className} size={size} />;
export const DocumentPlusIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Plus className={className} size={size} />;
export const PaperclipIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Paperclip className={className} size={size} />;
export const XMarkIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <X className={className} size={size} />;
export const DocumentArrowDownIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Download className={className} size={size} />;
export const ShieldCheckIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <CheckCircle className={className} size={size} />;
export const PlusIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Plus className={className} size={size} />;
export const UserGroupIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Users className={className} size={size} />;
export const TrendingUpIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Sparkles className={className} size={size} />;
export const SparklesIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Sparkles className={className} size={size} />;
export const CircularArrowRefreshIcon = ArrowPathIcon;
export const CurrencyDollarIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Banknote className={className} size={size} />;
export const BellIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Megaphone className={className} size={size} />;
export const PinIcon: React.FC<IconProps & { filled?: boolean }> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE, filled }) => <Clock className={className} size={size} />;
export const CalendarDaysIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Clock className={className} size={size} />;
export const ShareIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Share2 className={className} size={size} />;
export const CloudArrowUpIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Upload className={className} size={size} />;
export const ExclamationTriangleIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <AlertTriangle className={className} size={size} />;
export const SmartphoneIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Smartphone className={className} size={size} />;
export const CloudArrowDownIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Download className={className} size={size} />;
export const StarIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Star className={className} size={size} />;
export const PencilSquareIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <SquarePen className={className} size={size} />;
export const InformationCircleIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Info className={className} size={size} />;
export const Camera: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <LucideCamera className={className} size={size} />;
export const CreditCardIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <CreditCard className={className} size={size} />;
export const PercentIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <Percent className={className} size={size} />;
export const PiggyBankIcon: React.FC<IconProps> = ({ className = DEFAULT_CLASS, size = DEFAULT_SIZE }) => <PiggyBank className={className} size={size} />;
