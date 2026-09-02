

'use client';

import { useState, useRef, ReactNode, useEffect, useCallback } from 'react';
import Image from 'next/image';
import * as XLSX from 'xlsx';
import ReactCrop, { type Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import ImageModule from 'docxtemplater-image-module-free';
import { saveAs } from 'file-saver';

import { FileUp, Table, Download, FileCheck, Loader2, Settings, Upload, TestTube2, FileText, Trash2, X, MessageSquareQuote, History, RotateCw, ChevronRight, CheckCircle2, Search, File as FileIcon, Files, Package as PackageIcon, AlertCircle, HelpCircle, AlertTriangle, Percent, LogIn, Coins, Gift, Share2, LayoutDashboard, ShoppingBag, Store } from 'lucide-react';
import { MarketplaceSection } from '@/components/marketplace/marketplace-section';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
import {
  Table as ShadTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AppHeader } from '@/app/app-header';
import { useDisclaimer } from '@/app/(main)/disclaimer-context';
import { useUser as useFirebaseUser } from '@/firebase/provider';
import { useUser as useAuthUser } from '@/firebase/auth/use-user';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PricedDocumentType } from '@/lib/pricing';
import {
  REFERRAL_REWARD_TOKENS,
  TOKEN_RELOAD_MIN_PESOS,
  TOKENS_PER_STUDENT_FORM,
  calculateAllowableStudentForms,
  calculateTokenCost,
  calculateTokenReload,
} from '@/lib/tokens';
import {
  buildKindergartenTemplateFields,
  getDefaultSchoolYearStartDate,
} from '@/lib/kindergarten-template';

type StudentRecord = {
  LRN: string;
  Name: string; // This will now store the original name from the file
  Sex: 'Male' | 'Female' | '';
  Birthdate: string;
  Age: number | '';
  Barangay: string;
  Municipality: string;
  Province: string;
  FatherName: string;
  MotherName: string;
};

type FileInfo = {
    gradeLevel: string;
    section: string;
    adviser: string;
    school: string;
    district: string;
    division?: string;
    region?: string;
    address: string;
    municipality?: string;
    schoolYear?: string;
};

type SharedInfo = {
    school: string;
    schoolHead: string;
    schoolHeadDesignation: string;
    district: string;
    municipality: string;
    division: string;
    region: string;
    address: string;
    schoolYear: string;
    schoolYearStartDate: string;
};

type FileData = {
    id: string;
    fileName: string;
    studentData: StudentRecord[];
    fileInfo: FileInfo;
    selectedRows: Set<string>;
    searchTerm: string;
};

type TemplateFile = {
  name: string;
  download_url: string;
};

type RepoConfig = {
    user: string;
    repo: string;
    path?: string;
};

const initialSharedInfo: SharedInfo = {
    school: '',
    schoolHead: '',
    schoolHeadDesignation: '',
    district: '',
    municipality: '',
    division: '',
    region: 'Region V',
    address: '',
    schoolYear: '',
    schoolYearStartDate: '',
};

type PreviousInfo = {
    schoolHead: string[];
    schoolHeadDesignation: string[];
    region: string[];
    division: string[];
    district: string[];
    municipality: string[];
    address: string[];
    school: string[];
    schoolYear: string[];
};

const initialPreviousInfo: PreviousInfo = {
    schoolHead: [],
    schoolHeadDesignation: [],
    region: [],
    division: [],
    district: [],
    municipality: [],
    address: [],
    school: [],
    schoolYear: [],
};

type AppState = {
  filesData: FileData[];
  sharedInfo: SharedInfo;
  croppedLogo: string | null;
  selectedTemplateUrls: { [gradeLevel: string]: string };
  useMiddleInitial: boolean;
  documentType: PricedDocumentType;
};

type PaidGenerationTokenLedger = {
  checkoutSessionId: string;
  userId: string | null;
  documentType: PricedDocumentType;
  totalTokens: number;
  remainingTokens: number;
  status: 'paid' | 'generated_pending_confirmation';
  updatedAt: string;
};

type TokenWallet = {
  tokens: number;
  shareableTokens?: number;
  reservedTokens: number;
  referralCode: string;
};

type ReferralSummary = {
  rewardTokens: number;
  minimumReloadPesos: number;
  summary: {
    signedUp: number;
    firstReloadCompleted: number;
    rewardGranted: number;
    pendingRewards: number;
    totalRewardTokens: number;
  };
  referrals: Array<{
    id: string;
    referredEmail: string | null;
    status: string;
    referrerRewardGranted: boolean;
    referrerRewardTokens: number;
    signedUpAt: string | null;
    firstReloadAt: string | null;
    rewardGrantedAt: string | null;
  }>;
};

type TokenHistoryItem = {
  id: string;
  type: string;
  tokens: number;
  amountPesos: number | null;
  studentCount: number | null;
  completedGenerations: number | null;
  recipientEmail: string | null;
  referrerUid: string | null;
  referredUid: string | null;
  checkoutSessionId: string | null;
  reservationId: string | null;
  createdAt: string | null;
};

const regions = [
    "Region I", "Region II", "Region III", "Region IV-A", "Region IV-B", "Region V", 
    "Region VI", "Region VII", "Region VIII", "Region IX", "Region X", "Region XI", 
    "Region XII", "Region XIII", "NCR", "CAR", "BARMM"
];

let schoolYears = Array.from({ length: 5 }, (_, i) => `${2025 + i}-${2026 + i}`);

const formatNameWithMiddleInitialForDocx = (name: string): string => {
    const SUFFIX_LIST = ["JR.", "SR.", "III", "II", "IV", "V", "JR", "SR"];
    let cleanedName = name.trim().toUpperCase()
        .replace(/\sBearer ,\sBearer /g, ", ")
        .replace(/ , -/g, '')
        .replace(/\s+/g, ' ');

    const parts = cleanedName.split(', ').filter(p => p.trim() !== '');
    if (parts.length < 3) return cleanedName;

    const lastName = parts[0];
    let firstName = parts[1];
    let middleAndSuffix = parts.slice(2).join(' ');
    let foundSuffix = "";
    let middleName = middleAndSuffix;

    for (const suffix of SUFFIX_LIST) {
        if (middleAndSuffix.startsWith(suffix + ' ') || middleAndSuffix === suffix) {
            foundSuffix = suffix;
            middleName = middleAndSuffix.substring(suffix.length).trim();
            break;
        }
        if (firstName.endsWith(' ' + suffix)) {
            foundSuffix = suffix;
            firstName = firstName.substring(0, firstName.length - suffix.length - 1).trim();
            break;
        }
    }

    if (middleName) {
        const hyphenIndex = middleName.indexOf(' - ');
        if (hyphenIndex !== -1) {
            middleName = middleName.substring(0, hyphenIndex).trim();
        }

        return `${lastName}, ${firstName}${foundSuffix ? ' ' + foundSuffix : ''} ${middleName.charAt(0)}.`;
    }

    return `${lastName}, ${firstName}${foundSuffix ? ' ' + foundSuffix : ''}`;
};

const sanitizeFileNamePart = (value: string, fallback: string): string => {
    const sanitized = value
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
        .replace(/-+/g, '-')
        .replace(/[. ]+$/g, '');
    return sanitized || fallback;
};

const getGenerationErrorMessage = (error: any): string => {
    const nestedErrors = error?.properties?.errors;
    if (Array.isArray(nestedErrors) && nestedErrors.length > 0) {
        return nestedErrors
            .map((nestedError: any) =>
                nestedError?.properties?.explanation || nestedError?.message
            )
            .filter(Boolean)
            .join(' ');
    }

    return error?.message || 'An unexpected error occurred.';
};

async function buildSf9DocxBlob({
    templateUrl,
    fileData,
    sharedInfo,
    croppedLogo,
    useMiddleInitial,
    previewOnly = false,
}: {
    templateUrl: string;
    fileData: FileData;
    sharedInfo: SharedInfo;
    croppedLogo: string | null;
    useMiddleInitial: boolean;
    previewOnly?: boolean;
}) {
    const response = await fetch(`/api/download-template?url=${encodeURIComponent(templateUrl)}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch template for ${fileData.fileName}: ${response.statusText}`);
    }

    const templateBlob = await response.arrayBuffer();
    const zip = new PizZip(templateBlob);
    const isKinderCoverTemplate = decodeURIComponent(templateUrl)
        .toLowerCase()
        .includes(KINDER_COVER_TEMPLATE_NAME.toLowerCase());

    // The KPRC template's opening loop is inside a table while its closing
    // tag is at document-body level. Move the opening marker to body level.
    if (isKinderCoverTemplate) {
        const documentXmlFile = zip.file('word/document.xml');
        const documentXml = documentXmlFile?.asText();
        if (documentXml) {
            const repairedXml = documentXml
                .replace('{#students}', '')
                .replace(/\{#(?:<[^>]+>)*students\}/, '')
                .replace(
                    /(<w:body[^>]*>)/,
                    '$1<w:p><w:r><w:t>{#students}</w:t></w:r></w:p>'
                );
            zip.file('word/document.xml', repairedXml);
        }
    }

    const imageModule = new ImageModule({
        centered: false,
        getImage: (tag: string) => {
            if (tag === 'logo' && croppedLogo) {
                return Buffer.from(croppedLogo.split(',')[1], 'base64');
            }
            return null;
        },
        getSize: () => isKinderCoverTemplate ? [86, 86] : [54, 54],
    });

    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, modules: [imageModule] });
    const formattedSection = fileData.fileInfo.section
        .trim()
        .split(/\s+/)
        .map((word) => {
            if (/^[IVXLCDM]+$/i.test(word)) {
                return word.toUpperCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');

    const selectedStudents = fileData.studentData.filter(d => fileData.selectedRows.has(d.LRN));
    const studentsForRender = previewOnly ? selectedStudents.slice(0, 1) : selectedStudents;
    const ageReferenceDate =
        sharedInfo.schoolYearStartDate || getDefaultSchoolYearStartDate(sharedInfo.schoolYear);
    let exportData = studentsForRender.map((student, index) => ({
        ...student,
        ...buildKindergartenTemplateFields(
            student.LRN,
            student.Birthdate,
            ageReferenceDate
        ),
        'No.': index + 1,
        Name: useMiddleInitial ? formatNameWithMiddleInitialForDocx(student.Name) : student.Name,
        FatherName: useMiddleInitial
            ? formatNameWithMiddleInitialForDocx(student.FatherName || '')
            : student.FatherName || '',
        MotherName: useMiddleInitial
            ? formatNameWithMiddleInitialForDocx(student.MotherName || '')
            : student.MotherName || '',
    }));

    if (!previewOnly) {
        const blankStudent = {
            LRN: '',
            Name: '',
            Sex: '' as const,
            Birthdate: '',
            Age: '' as const,
            Barangay: '',
            Municipality: '',
            Province: '',
            FatherName: '',
            MotherName: '',
            ...buildKindergartenTemplateFields('', '', ageReferenceDate),
            gradeLevel: fileData.fileInfo.gradeLevel,
            section: formattedSection,
        };
        const lastStudentNumber = exportData.length;
        exportData.unshift(
            { ...blankStudent, 'No.': lastStudentNumber + 1 },
            { ...blankStudent, 'No.': lastStudentNumber + 2 }
        );
    }

    const finalData: any = {
        ...fileData.fileInfo,
        ...sharedInfo,
        section: formattedSection,
        students: exportData,
        logo: croppedLogo ? 'logo' : undefined,
    };

    doc.setData(finalData);
    doc.render();

    return {
        blob: doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
        selectedCount: selectedStudents.length,
    };
}


const LoadingOverlay = ({ message }: { message: string }) => (
    <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
        <Loader2 className="size-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">{message}</p>
    </div>
);

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

const KINDER_COVER_TEMPLATE_NAME = 'Latest KPRC and PECD Cover Page.docx';
const KINDER_CONTENT_PDF_NAME = 'Latest KPRC and PECD Content Pages 3-10.pdf';
const KINDER_CONTENT_PDF_URL =
  'https://raw.githubusercontent.com/jerniqz-del/schoolform9/main/Latest%20KPRC%20and%20PECD%20Content%20Pages%203-10.pdf';

const masterTemplateOrder = [
  KINDER_COVER_TEMPLATE_NAME,
  'Kinder Report Card.docx',
  'Kinder PECD.docx',
  'Grade One.docx',
  'Grade Two.docx',
  'Grade Three.docx',
  'Grade Four.docx',
  'Grade Five.docx',
  'Grade Six.docx',
  'Grade Seven (Year 1).docx',
  'Grade Eight (Year 2).docx',
  'Grade Nine (Year 3).docx',
  'Grade Ten (Year 4).docx',
  'Grade Eleven.docx',
  'Grade Twelve.docx',
];

const gradeToTemplateMap: { [key: string]: string } = {
  'Kinder': KINDER_COVER_TEMPLATE_NAME,
  'One': 'Grade One.docx',
  'Two': 'Grade Two.docx',
  'Three': 'Grade Three.docx',
  'Four': 'Grade Four.docx',
  'Five': 'Grade Five.docx',
  'Six': 'Grade Six.docx',
  'Seven': 'Grade Seven (Year 1).docx',
  'Eight': 'Grade Eight (Year 2).docx',
  'Nine': 'Grade Nine (Year 3).docx',
  'Ten': 'Grade Ten (Year 4).docx',
  'Eleven': 'Grade Eleven.docx',
  'Twelve': 'Grade Twelve.docx',
};

const paperSizeRepos: { [key: string]: RepoConfig | null } = {
    'A4': null,
    'A5': null,
    'Custom': { user: 'jerniqz-del', repo: 'schoolform9' },
};

const MAX_PREVIOUS_LOGOS = 5;
const MAX_PREVIOUS_INFO = 5;
const DEV_PROMO_CODE = 'DEVPASS';
const IS_DEVELOPER_PROMO_ENABLED = process.env.NODE_ENV !== 'production';
const IS_PDF_OUTPUT_ENABLED = false;
const IS_LIVE_PDF_PREVIEW_ENABLED = false;
const PAID_GENERATION_TOKENS_STORAGE_KEY = 'paidGenerationTokens';


const HistoryBadges = ({
  items,
  onSelect,
}: {
  items: string[];
  onSelect: (item: string) => void;
}) => {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      <span className="text-xs text-muted-foreground mr-1">Recently Used:</span>
      {items.map((item) => (
        <Badge
          key={item}
          variant="secondary"
          className="cursor-pointer hover:bg-primary/20"
          onClick={() => onSelect(item)}
        >
          {item}
        </Badge>
      ))}
    </div>
  );
};


type TemplateStatusCardProps = {
  gradeLevel: string;
  templateName: string | null;
  selectedCount: number;
  sampleStudent: StudentRecord | null;
  [key: string]: unknown;
};

const TemplateStatusCard = ({ gradeLevel, templateName, selectedCount, sampleStudent }: TemplateStatusCardProps) => {
  return (
    <div className="flex h-[240px] w-[180px] flex-col justify-between rounded-lg border bg-background p-3 shadow-sm">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-[10px]">Grade {gradeLevel}</Badge>
          <FileText className="size-4 text-muted-foreground" />
        </div>
        <div>
          <p className="line-clamp-2 text-sm font-semibold">{templateName || 'No template selected'}</p>
          <p className="mt-1 text-xs text-muted-foreground">Use free tokens to test generated output.</p>
        </div>
      </div>

      <div className="rounded border border-dashed bg-muted/30 p-2 text-xs">
        <p className="font-medium text-foreground">{sampleStudent?.Name || 'Select a learner'}</p>
        <p className="mt-1 text-muted-foreground">{selectedCount} selected</p>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        New accounts include free tokens, enough to try a small batch before using the whole app.
      </p>
    </div>
  );
};


function limitFilesDataToSelectedCount(filesData: FileData[], maxSelected: number) {
  let remaining = maxSelected;

  return filesData.map(fileData => {
    if (remaining <= 0) {
      return { ...fileData, selectedRows: new Set<string>() };
    }

    const limitedRows = new Set<string>();
    for (const student of fileData.studentData) {
      if (remaining <= 0) break;
      if (fileData.selectedRows.has(student.LRN)) {
        limitedRows.add(student.LRN);
        remaining -= 1;
      }
    }

    return { ...fileData, selectedRows: limitedRows };
  });
}

function getTokenHistoryTitle(type: string) {
  const labels: Record<string, string> = {
    signup_bonus: 'Welcome bonus',
    referral_signup_bonus: 'Referral signup bonus',
    share_received: 'Tokens received',
    share_sent: 'Tokens shared',
    reload: 'Token reload',
    referral_reward: 'Referral reward',
    generation: 'Forms generated',
    generation_reward: 'Generation reward',
  };
  return labels[type] || 'Token activity';
}

function getTokenHistoryDetail(item: TokenHistoryItem) {
  if (item.type === 'reload' && item.amountPesos) return `Reloaded PHP ${item.amountPesos}.`;
  if (item.type === 'generation' && item.studentCount) return `${item.studentCount} student form(s) generated.`;
  if (item.type === 'generation_reward' && item.completedGenerations) return `Reward for reaching ${item.completedGenerations} generated student form(s).`;
  if (item.type === 'share_sent' && item.recipientEmail) return `Shared with ${item.recipientEmail}.`;
  if (item.type === 'share_received') return 'Received from another registered user.';
  if (item.type === 'referral_signup_bonus') return 'Bonus for signing up with a referral link.';
  if (item.type === 'referral_reward') return 'Reward after a referred teacher completed their first reload.';
  if (item.type === 'signup_bonus') return 'Initial free tokens for a new account.';
  return 'Wallet balance activity.';
}

function formatTokenHistoryDate(value: string | null) {
  if (!value) return 'Date unavailable';
  return new Date(value).toLocaleString();
}


export default function Home() {
  const [step, setStep] = useState(1);
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState<'dashboard' | 'generator' | 'marketplace'>('dashboard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing file, please wait...');
  
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [filesData, setFilesData] = useState<FileData[]>([]);
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);
  const [sharedInfo, setSharedInfo] = useState<SharedInfo>(initialSharedInfo);
  
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [croppedLogo, setCroppedLogo] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const [previousLogos, setPreviousLogos] = useState<string[]>([]);
  const [previousInfo, setPreviousInfo] = useState<PreviousInfo>(initialPreviousInfo);
  
  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [selectedTemplateUrls, setSelectedTemplateUrls] = useState<{ [gradeLevel: string]: string }>({});

  const [paperSize, setPaperSize] = useState('Custom');
  const [documentType, setDocumentType] = useState<PricedDocumentType>('docx');

  const [isPostGenerateDialogOpen, setIsPostGenerateDialogOpen] = useState(false);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [isPurchaseConfirmationOpen, setIsPurchaseConfirmationOpen] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [isPaymentRecoveryOpen, setIsPaymentRecoveryOpen] = useState(false);
  const [paymentRecoveryError, setPaymentRecoveryError] = useState<string | null>(null);
  const [paidGenerationNeedsConfirmation, setPaidGenerationNeedsConfirmation] = useState(false);
  const [tokenWallet, setTokenWallet] = useState<TokenWallet | null>(null);
  const [isTokenReloadOpen, setIsTokenReloadOpen] = useState(false);
  const [isTokenShareOpen, setIsTokenShareOpen] = useState(false);
  const [isTokenHistoryOpen, setIsTokenHistoryOpen] = useState(false);
  const [isTokenHistoryLoading, setIsTokenHistoryLoading] = useState(false);
  const [isReferralRewardsOpen, setIsReferralRewardsOpen] = useState(false);
  const [tokenHistory, setTokenHistory] = useState<TokenHistoryItem[]>([]);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [reloadAmountPesos, setReloadAmountPesos] = useState(TOKEN_RELOAD_MIN_PESOS);
  const [shareEmail, setShareEmail] = useState('');
  const [shareTokenAmount, setShareTokenAmount] = useState(5);
  const [activeReservationId, setActiveReservationId] = useState<string | null>(null);
  const tokenReloadVerificationAttemptedRef = useRef(false);

  const [promoCode, setPromoCode] = useState('');
  const [isPromoApplied, setIsPromoApplied] = useState(false);
  
  const { isDisclaimerOpen, setIsDisclaimerOpen, disclaimerAgreed, setDisclaimerAgreed } = useDisclaimer();
  
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);



  const [useMiddleInitial, setUseMiddleInitial] = useState(true);

  const { toast } = useToast();
  const { user: authUser, isUserLoading } = useFirebaseUser();
  const { signInWithGoogle } = useAuthUser();

  const getAuthHeaders = useCallback(async (forceRefresh = false) => {
    if (!authUser) {
      throw new Error('Sign in is required.');
    }
    const token = await authUser.getIdToken(forceRefresh);
    return { Authorization: `Bearer ${token}` };
  }, [authUser]);


  const readApiError = async (response: Response, fallback: string) => {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json().catch(() => null);
      return data?.error || `${fallback} (${response.status})`;
    }

    const body = await response.text().catch(() => '');
    const detail = body.replace(/\s+/g, ' ').trim().slice(0, 160);
    return detail ? `${fallback} (${response.status}): ${detail}` : `${fallback} (${response.status})`;
  };

  const refreshTokenWallet = useCallback(async (referralCode?: string) => {
    if (!authUser) {
      setTokenWallet(null);
      return null;
    }

    const headers = await getAuthHeaders();
    const response = await fetch('/api/tokens/wallet', {
      method: referralCode ? 'POST' : 'GET',
      headers: referralCode
        ? { ...headers, 'Content-Type': 'application/json' }
        : headers,
      body: referralCode ? JSON.stringify({ referralCode }) : undefined,
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, 'Unable to load token wallet.'));
    }
    const data = await response.json().catch(() => null);
    setTokenWallet(data.wallet);
    return data.wallet as TokenWallet;
  }, [authUser, getAuthHeaders]);

  const verifyTokenReload = useCallback(async (checkoutSessionId: string) => {
    setLoadingMessage('Verifying token reload...');
    setIsProcessing(true);

    try {
      const headers = await getAuthHeaders();
      const verifyResponse = await fetch('/api/tokens/verify-reload', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutSessionId }),
      });

      if (!verifyResponse.ok) {
        const errorMessage = await readApiError(verifyResponse, 'Could not verify token reload payment.');
        const isUnrecoverableSessionError =
          verifyResponse.status === 400 ||
          verifyResponse.status === 404 ||
          errorMessage.toLowerCase().includes('requested route does not exist') ||
          errorMessage.toLowerCase().includes('session not found');

        if (isUnrecoverableSessionError) {
          localStorage.removeItem('tokenReloadCheckoutSessionId');
          localStorage.removeItem('tokenReloadNeedsVerification');
        }

        throw new Error(errorMessage);
      }

      const verifyData = await verifyResponse.json().catch(() => null);
      localStorage.removeItem('tokenReloadCheckoutSessionId');
      localStorage.removeItem('tokenReloadNeedsVerification');
      await refreshTokenWallet();
      toast({
        variant: 'success',
        title: verifyData?.alreadyCredited ? 'Tokens Already Reloaded' : 'Tokens Reloaded',
        description: `${verifyData?.tokens || 0} token(s) ${verifyData?.alreadyCredited ? 'were already added' : 'added'} to your account.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Token Reload Failed',
        description: error.message || 'Could not reload tokens.',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [getAuthHeaders, refreshTokenWallet, toast]);

  useEffect(() => {
    if (!authUser) {
      setTokenWallet(null);
      return;
    }

    const referralCode = new URLSearchParams(window.location.search).get('ref');
    refreshTokenWallet(referralCode || undefined).catch(error => {
      toast({
        variant: 'destructive',
        title: 'Token Wallet Error',
        description: error.message || 'Could not load your token wallet.',
      });
    });
  }, [authUser, refreshTokenWallet, toast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isUserLoading || !authUser || tokenReloadVerificationAttemptedRef.current) return;

    const needsVerification = localStorage.getItem('tokenReloadNeedsVerification') === 'true';
    const checkoutSessionId = localStorage.getItem('tokenReloadCheckoutSessionId');

    if (!needsVerification) return;
    if (!checkoutSessionId) {
      localStorage.removeItem('tokenReloadNeedsVerification');
      return;
    }

    tokenReloadVerificationAttemptedRef.current = true;
    verifyTokenReload(checkoutSessionId);
  }, [authUser, isUserLoading, verifyTokenReload]);
  
  useEffect(() => {
    try {
      const savedLogos = sessionStorage.getItem('previousSchoolLogos');
      if (savedLogos) {
        setPreviousLogos(JSON.parse(savedLogos));
      }
      const savedInfo = sessionStorage.getItem('previousSchoolInfo');
      if (savedInfo) {
        const parsed = JSON.parse(savedInfo);
        setPreviousInfo(parsed);
        // Pre-fill shared info from the most recent history
        setSharedInfo({
            school: parsed.school?.[0] || '',
            schoolHead: parsed.schoolHead?.[0] || '',
            schoolHeadDesignation: parsed.schoolHeadDesignation?.[0] || '',
            region: parsed.region?.[0] || 'Region V',
            division: parsed.division?.[0] || '',
            district: parsed.district?.[0] || '',
                    municipality: parsed.municipality?.[0] || '',
                    address: parsed.address?.[0] || '',
                    schoolYear: parsed.schoolYear?.[0] || '',
                    schoolYearStartDate: getDefaultSchoolYearStartDate(parsed.schoolYear?.[0] || ''),
                });
      }
    } catch (error) {
      console.error("Could not load data from sessionStorage:", error);
    }
  }, []);

  const handleAgreeToDisclaimer = () => {
    try {
      sessionStorage.setItem('disclaimerAgreed', 'true');
    } catch (error) {
      console.error("Could not save disclaimer agreement to sessionStorage:", error);
    }
    setDisclaimerAgreed(true);
    setIsDisclaimerOpen(false);
  };

  const handleUploadAreaClick = () => {
    fileUploadRef.current?.click();
  };

  const updatePreviousInfo = useCallback(() => {
    const newPreviousInfo = { ...previousInfo };
    let hasChanged = false;

    // Update with shared info
    (Object.keys(sharedInfo) as Array<keyof SharedInfo>).forEach(key => {
        if (key in newPreviousInfo) {
                const value = sharedInfo[key as keyof SharedInfo] as string;
            const history = newPreviousInfo[key as keyof PreviousInfo] as string[];
            if (value && !history.includes(value)) {
                (newPreviousInfo[key as keyof PreviousInfo] as string[]) = [value, ...history].slice(0, MAX_PREVIOUS_INFO);
                hasChanged = true;
            }
        }
    });

    // Update with file-specific info
    filesData.forEach(fileData => {
            ['school', 'district', 'municipality', 'address'].forEach(key => {
            const value = fileData.fileInfo[key as keyof FileInfo];
            const history = newPreviousInfo[key as keyof PreviousInfo] as string[];
            if (value && !history.includes(value)) {
                (newPreviousInfo[key as keyof PreviousInfo] as string[]) = [value, ...history].slice(0, MAX_PREVIOUS_INFO);
                hasChanged = true;
            }
        });
    });


    if (hasChanged) {
        setPreviousInfo(newPreviousInfo);
        try {
            sessionStorage.setItem('previousSchoolInfo', JSON.stringify(newPreviousInfo));
        } catch (error) {
            console.error("Could not save previous info to sessionStorage:", error);
        }
    }
}, [filesData, sharedInfo, previousInfo]);


  const saveStateToLocalStorage = useCallback(() => {
    const stateToSave: AppState = {
      filesData: filesData.map(f => ({ ...f, selectedRows: Array.from(f.selectedRows) } as any)),
      sharedInfo,
      croppedLogo,
      selectedTemplateUrls,
      useMiddleInitial,
      documentType,
    };
    try {
      localStorage.setItem('appState', JSON.stringify(stateToSave));
    } catch(e) {
      console.error("Could not save state to localStorage", e);
    }
  }, [filesData, sharedInfo, croppedLogo, selectedTemplateUrls, useMiddleInitial, documentType]);

  const loadStateFromLocalStorage = useCallback((): AppState | null => {
    try {
      const savedState = localStorage.getItem('appState');
      if (savedState) {
        const parsedState = JSON.parse(savedState) as any; // any for intermediate step
        
        return {
          ...parsedState,
          documentType: IS_PDF_OUTPUT_ENABLED && parsedState.documentType === 'pdf' ? 'pdf' : 'docx',
          filesData: parsedState.filesData.map((f: any) => ({...f, selectedRows: new Set(f.selectedRows) })),
        };
      }
    } catch (error) {
      console.error("Could not load state from localStorage:", error);
    }
    return null;
  }, []);

  const clearStateFromLocalStorage = () => {
    try {
      localStorage.removeItem('appState');
      localStorage.removeItem('checkoutSessionId');
      localStorage.removeItem(PAID_GENERATION_TOKENS_STORAGE_KEY);
      localStorage.removeItem('tokenReloadCheckoutSessionId');
      localStorage.removeItem('tokenReloadNeedsVerification');
    } catch (error) {
        console.error("Could not clear state from localStorage:", error);
    }
  };

  const savePaidGenerationTokens = useCallback((ledger: PaidGenerationTokenLedger) => {
    try {
      localStorage.setItem(PAID_GENERATION_TOKENS_STORAGE_KEY, JSON.stringify(ledger));
    } catch (error) {
      console.error("Could not save paid generation tokens:", error);
    }
  }, []);

  const loadPaidGenerationTokens = useCallback((): PaidGenerationTokenLedger | null => {
    try {
      const savedLedger = localStorage.getItem(PAID_GENERATION_TOKENS_STORAGE_KEY);
      if (!savedLedger) return null;

      const parsed = JSON.parse(savedLedger) as PaidGenerationTokenLedger;
      if (
        typeof parsed.checkoutSessionId === 'string' &&
        typeof parsed.totalTokens === 'number' &&
        typeof parsed.remainingTokens === 'number' &&
        (parsed.documentType === 'docx' || parsed.documentType === 'pdf')
      ) {
        return {
          ...parsed,
          documentType: IS_PDF_OUTPUT_ENABLED && parsed.documentType === 'pdf' ? 'pdf' : 'docx',
        };
      }
    } catch (error) {
      console.error("Could not load paid generation tokens:", error);
    }
    return null;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedState = loadStateFromLocalStorage();
    const paidTokens = loadPaidGenerationTokens();
    const checkoutSessionId = localStorage.getItem('checkoutSessionId');

    if (
      savedState &&
      checkoutSessionId &&
      paidTokens?.status === 'paid' &&
      paidTokens.checkoutSessionId === checkoutSessionId &&
      paidTokens.remainingTokens > 0
    ) {
      setPaymentRecoveryError('Your confirmed payment is saved. Retry generation without paying again.');
      setIsPaymentRecoveryOpen(true);
    }
  }, [loadPaidGenerationTokens, loadStateFromLocalStorage]);
  
const formatNameWithMiddleInitial = (name: string): string => {
    const SUFFIX_LIST = ["JR.", "SR.", "III", "II", "IV", "V", "JR", "SR"];
    
    let cleanedName = name.trim().toUpperCase()
        .replace(/\sBearer ,\sBearer /g, ", ") // Normalize commas
        .replace(/ , -/g, '')
        .replace(/\s+/g, ' ');

    const parts = cleanedName.split(', ').filter(p => p.trim() !== '');

    if (parts.length < 3) {
      return cleanedName;
    }

    const lastName = parts[0];
    let firstName = parts[1];
    let middleAndSuffix = parts.slice(2).join(' ');

    let foundSuffix = "";
    let middleName = middleAndSuffix;

    for (const suffix of SUFFIX_LIST) {
        if (middleAndSuffix.startsWith(suffix + ' ') || middleAndSuffix === suffix) {
            foundSuffix = suffix;
            middleName = middleAndSuffix.substring(suffix.length).trim();
            break;
        }
        if (firstName.endsWith(' ' + suffix)) {
            foundSuffix = suffix;
            firstName = firstName.substring(0, firstName.length - suffix.length - 1).trim();
            break;
        }
    }

    if (middleName) {
        const hyphenIndex = middleName.indexOf(' - ');
        if (hyphenIndex !== -1) {
            middleName = middleName.substring(0, hyphenIndex).trim();
        }

        const middleInitial = middleName.charAt(0) + '.';
        return `${lastName}, ${firstName}${foundSuffix ? ' ' + foundSuffix : ''} ${middleInitial}`;
    }
    
    return `${lastName}, ${firstName}${foundSuffix ? ' ' + foundSuffix : ''}`;
};

const handleGenerateSF9 = useCallback(async (
    generationState: AppState,
    options?: { showPaymentRecovery?: boolean }
): Promise<boolean> => {
    const {
        filesData: currentFilesData,
        sharedInfo: currentSharedInfo,
        croppedLogo: currentCroppedLogo,
        selectedTemplateUrls: currentTemplateUrls,
        useMiddleInitial: useMI,
        documentType: currentDocumentType,
    } = generationState;

    const totalSelected = currentFilesData.reduce((acc, file) => acc + file.selectedRows.size, 0);

    if (totalSelected === 0) {
        toast({
            variant: 'destructive',
            title: 'No Students Selected',
            description: 'Please select at least one student from any file.',
        });
        return false;
    }
    
    setLoadingMessage('Generating documents, please wait...');
    setIsProcessing(true);

    try {
        const filesToGenerate = currentFilesData.filter(fileData => fileData.selectedRows.size > 0);
        const generatedFiles: { name: string; blob: Blob }[] = [];
        let kinderContentPdfPromise: Promise<Blob> | null = null;
        const getKinderContentPdf = () => {
            if (!kinderContentPdfPromise) {
                kinderContentPdfPromise = (async () => {
                    const response = await fetch(
                        `/api/download-template?url=${encodeURIComponent(KINDER_CONTENT_PDF_URL)}`
                    );
                    if (!response.ok) {
                        throw new Error(`Failed to download ${KINDER_CONTENT_PDF_NAME}: ${response.statusText}`);
                    }
                    return response.blob();
                })();
            }
            return kinderContentPdfPromise;
        };

        for (const [index, fileData] of filesToGenerate.entries()) {
            const templateUrl = currentTemplateUrls[fileData.fileInfo.gradeLevel];
            if (!templateUrl) {
                throw new Error(`No template selected for ${fileData.fileInfo.gradeLevel}.`);
            }

            setLoadingMessage(
                currentDocumentType === 'pdf'
                    ? `Preparing DOCX ${index + 1} of ${filesToGenerate.length} before PDF conversion...`
                    : `Generating DOCX ${index + 1} of ${filesToGenerate.length}...`
            );

            const { blob: output, selectedCount } = await buildSf9DocxBlob({
                templateUrl,
                fileData,
                sharedInfo: currentSharedInfo,
                croppedLogo: currentCroppedLogo,
                useMiddleInitial: useMI,
            });
            const docxName = `SF9_${fileData.fileInfo.gradeLevel}_${fileData.fileInfo.section}_(${selectedCount}_students).docx`;

            if (currentDocumentType === 'pdf') {
                setLoadingMessage(`Converting PDF ${index + 1} of ${filesToGenerate.length}. This may take a moment...`);

                const formData = new FormData();
                formData.append('file', output, docxName);

                const conversionResponse = await fetch('/api/convert-docx-to-pdf', {
                    method: 'POST',
                    body: formData,
                });

                if (!conversionResponse.ok) {
                    const errorData = await conversionResponse.json().catch(() => null);
                    throw new Error(errorData?.error || `Failed to convert ${fileData.fileName} to PDF.`);
                }
                const pdfBlob = await conversionResponse.blob();
                generatedFiles.push({
                    name: docxName.replace(/\.docx$/i, '.pdf'),
                    blob: pdfBlob,
                });
            } else {
                generatedFiles.push({
                    name: docxName,
                    blob: output
                });
            }

            if (fileData.fileInfo.gradeLevel === 'Kinder') {
                setLoadingMessage(`Adding Kindergarten content pages ${index + 1} of ${filesToGenerate.length}...`);
                const contentPdf = await getKinderContentPdf();
                generatedFiles.push({
                    name: `${docxName.replace(/\.docx$/i, '')}_${KINDER_CONTENT_PDF_NAME}`,
                    blob: contentPdf,
                });
            }
        }

        let exportBlob = generatedFiles[0].blob;
        let exportName = generatedFiles[0].name;

        if (generatedFiles.length > 1) {
            const masterZip = new PizZip();
            for (const file of generatedFiles) {
                const arrayBuffer = await file.blob.arrayBuffer();
                masterZip.file(file.name, arrayBuffer);
            }
            exportBlob = masterZip.generate({ type: "blob" });
            const schoolName = sanitizeFileNamePart(currentSharedInfo.school, 'School');
            const schoolYear = sanitizeFileNamePart(currentSharedInfo.schoolYear, 'School Year');
            exportName = `SF9_${schoolName}_${schoolYear}.zip`;
        }

        saveAs(exportBlob, exportName);

        if (options?.showPaymentRecovery) {
            const checkoutSessionId = localStorage.getItem('checkoutSessionId');
            if (checkoutSessionId) {
              savePaidGenerationTokens({
                    checkoutSessionId,
                    userId: authUser?.uid || null,
                    documentType: currentDocumentType,
                    totalTokens: totalSelected,
                    remainingTokens: totalSelected,
                    status: 'generated_pending_confirmation',
                    updatedAt: new Date().toISOString(),
                });
            }
            setPaidGenerationNeedsConfirmation(true);
        } else {
            clearStateFromLocalStorage();
            setPaidGenerationNeedsConfirmation(false);
        }
        setPaymentRecoveryError(null);
        setIsPaymentRecoveryOpen(false);
        setIsPostGenerateDialogOpen(true);

        toast({
            variant: 'success',
            title: 'Generation Complete',
            description: generatedFiles.length + ' ' + currentDocumentType.toUpperCase() + ' document(s) have been generated.',
        });
        return true;

    } catch (error: any) {
        console.error("Error generating SF9:", error);
        const message = getGenerationErrorMessage(error);
        if (options?.showPaymentRecovery) {
            setPaymentRecoveryError(message);
            setIsPaymentRecoveryOpen(true);
        }
        toast({
            variant: "destructive",
            title: "Generation Failed",
            description: options?.showPaymentRecovery
                ? "Your payment is confirmed. You can retry generation without paying again."
                : message,
        });
        return false;
    } finally {
        setIsProcessing(false);
    }
}, [authUser?.uid, savePaidGenerationTokens, toast]);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isUserLoading) return;

    const processPayment = async () => {
      const currentSearchParams = new URLSearchParams(window.location.search);
      const paymentStatus = currentSearchParams.get('payment_status');
      const tokenPaymentStatus = currentSearchParams.get('token_payment_status');

      if (!paymentStatus && !tokenPaymentStatus) return;

      if (tokenPaymentStatus === 'success') {
          localStorage.setItem('tokenReloadNeedsVerification', 'true');

          if (!authUser) {
              toast({
                  variant: 'destructive',
                  title: 'Token Reload Pending',
                  description: 'Sign in again to finish verifying your token reload.',
              });
              return;
          }

          const checkoutSessionId = localStorage.getItem('tokenReloadCheckoutSessionId');
          if (!checkoutSessionId) {
              window.history.replaceState({}, document.title, window.location.pathname);
              toast({
                  variant: 'destructive',
                  title: 'Token Reload Verification Failed',
                  description: 'Could not find the token reload checkout session.',
              });
              return;
          }

          window.history.replaceState({}, document.title, window.location.pathname);
          await verifyTokenReload(checkoutSessionId);
          return;
      } else if (tokenPaymentStatus === 'cancelled') {
          localStorage.removeItem('tokenReloadCheckoutSessionId');
          localStorage.removeItem('tokenReloadNeedsVerification');
          window.history.replaceState({}, document.title, window.location.pathname);
          toast({
              variant: 'destructive',
              title: 'Token Reload Cancelled',
              description: 'Your token reload payment was cancelled.',
          });
          return;
      }

      window.history.replaceState({}, document.title, window.location.pathname);

      if (paymentStatus === 'success') {
          const restoredState = loadStateFromLocalStorage();
          if (restoredState) {
              const checkoutSessionId = localStorage.getItem('checkoutSessionId');
              const totalSelected = restoredState.filesData.reduce((sum, file) => sum + file.selectedRows.size, 0);
              const restoredDocumentType = IS_PDF_OUTPUT_ENABLED && restoredState.documentType === 'pdf' ? 'pdf' : 'docx';
              restoredState.documentType = restoredDocumentType;

              if (!checkoutSessionId) {
                  toast({
                      variant: 'destructive',
                      title: "Payment Verification Failed",
                      description: "Could not find the checkout session. Please try generating again.",
                  });
                  clearStateFromLocalStorage();
                  return;
              }

              toast({
                  variant: 'success',
                  title: "Verifying Payment",
                  description: "Confirming your PayMongo payment before generating files...",
              });

              const verifyResponse = await fetch('/api/verify-payment', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ checkoutSessionId, studentCount: totalSelected, documentType: restoredDocumentType }),
              });

              const verifyData = await verifyResponse.json().catch(() => null);
              if (!verifyResponse.ok || !verifyData?.verified) {
                  toast({
                      variant: 'destructive',
                      title: "Payment Not Confirmed",
                      description: verifyData?.error || "PayMongo has not confirmed this payment yet.",
                  });
                  return;
              }

              toast({
                  variant: 'success',
                  title: "Payment Confirmed!",
                  description: "Your file(s) are being generated...",
              });
              savePaidGenerationTokens({
                  checkoutSessionId,
                  userId: authUser?.uid || null,
                  documentType: restoredDocumentType,
                  totalTokens: totalSelected,
                  remainingTokens: totalSelected,
                  status: 'paid',
                  updatedAt: new Date().toISOString(),
              });
              await handleGenerateSF9(restoredState, { showPaymentRecovery: true });
          } else {
              toast({
                  variant: 'destructive',
                  title: "Generation Failed",
                  description: "Could not retrieve session data after payment. Please try generating again.",
              });
          }
      } else if (paymentStatus === 'cancelled') {
           toast({
              variant: "destructive",
              title: "Payment Cancelled",
              description: "The payment process was cancelled. You can try again.",
           });
           clearStateFromLocalStorage();
      }
    };

    processPayment();
  }, [authUser, authUser?.uid, handleGenerateSF9, isUserLoading, loadStateFromLocalStorage, refreshTokenWallet, savePaidGenerationTokens, toast, verifyTokenReload]);

  const handleRetryPaidGeneration = useCallback(async () => {
      const restoredState = loadStateFromLocalStorage();
      const checkoutSessionId = localStorage.getItem('checkoutSessionId');
      const paidTokens = loadPaidGenerationTokens();

      if (!restoredState || !checkoutSessionId) {
          setPaymentRecoveryError('The saved payment session could not be found. Please contact support with your PayMongo receipt.');
          toast({
              variant: 'destructive',
              title: 'Retry Unavailable',
              description: 'The saved payment session could not be found.',
          });
          return;
      }

      const totalSelected = restoredState.filesData.reduce((sum, file) => sum + file.selectedRows.size, 0);
      const restoredDocumentType = IS_PDF_OUTPUT_ENABLED && restoredState.documentType === 'pdf' ? 'pdf' : 'docx';
      restoredState.documentType = restoredDocumentType;

      if (
          !paidTokens ||
          paidTokens.checkoutSessionId !== checkoutSessionId ||
          paidTokens.remainingTokens < totalSelected ||
          (paidTokens.userId && paidTokens.userId !== authUser?.uid)
      ) {
          setPaymentRecoveryError('The saved token balance could not cover this generation. Please contact support with your PayMongo receipt.');
          setIsPaymentRecoveryOpen(true);
          return;
      }

      setIsPaymentRecoveryOpen(false);
      setLoadingMessage('Rechecking payment before retrying generation...');
      setIsProcessing(true);

      try {
          const verifyResponse = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ checkoutSessionId, studentCount: totalSelected, documentType: restoredDocumentType }),
          });

          const verifyData = await verifyResponse.json().catch(() => null);
          if (!verifyResponse.ok || !verifyData?.verified) {
              throw new Error(verifyData?.error || 'PayMongo has not confirmed this payment yet.');
          }

          await handleGenerateSF9(restoredState, { showPaymentRecovery: true });
      } catch (error: any) {
          const message = error.message || 'Could not retry generation.';
          setPaymentRecoveryError(message);
          setIsPaymentRecoveryOpen(true);
          toast({
              variant: 'destructive',
              title: 'Retry Failed',
              description: message,
          });
      } finally {
          setIsProcessing(false);
      }
  }, [authUser?.uid, handleGenerateSF9, loadPaidGenerationTokens, loadStateFromLocalStorage, toast]);


  const fetchTemplates = useCallback(async () => {
      const repoConfig = paperSizeRepos[paperSize];
      
      setSelectedTemplateUrls({});
      setTemplates([]);

      if (!repoConfig) {
        toast({
          variant: "destructive",
          title: "Under Development",
          description: `Template repository for ${paperSize} paper size is not yet available.`,
        });
        return;
      }
      
      setIsTemplatesLoading(true);
      try {
        const response = await fetch(`/api/fetch-templates?repo=${repoConfig.repo}`);

        if (!response.ok) {
          throw new Error('Failed to fetch templates from server.');
        }
        
        const files: TemplateFile[] = await response.json();
        const docxFiles = files.filter(file => file.name.endsWith('.docx'));

        const availableMasterFiles = masterTemplateOrder.map(masterName => {
          return docxFiles.find(file => file.name === masterName);
        }).filter((file): file is TemplateFile => !!file);
        
        setTemplates(availableMasterFiles);
      } catch (error: any) {
        console.error("Error fetching templates:", error);
        toast({
            variant: "destructive",
            title: "Could Not Load Templates",
            description: error.message || "Please check your connection and try again.",
            action: <Button variant="outline" size="sm" onClick={fetchTemplates}>Retry</Button>,
        });
      } finally {
        setIsTemplatesLoading(false);
      }
    }, [paperSize, toast]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

  const autoSelectTemplates = useCallback((processedFiles: FileData[]) => {
      if (templates.length === 0) return;

      const newSelectedUrls: { [gradeLevel: string]: string } = {};
      let updated = false;

      processedFiles.forEach(fileData => {
          const gradeLevel = fileData.fileInfo.gradeLevel;
          if (!newSelectedUrls[gradeLevel]) {
              const templateNameToFind = gradeToTemplateMap[gradeLevel];
              if (templateNameToFind) {
                  const matchedTemplate = templates.find(t => t.name === templateNameToFind);
                  if (matchedTemplate) {
                      newSelectedUrls[gradeLevel] = matchedTemplate.download_url;
                      updated = true;
                  }
              }
          }
      });

      if (updated) {
          setSelectedTemplateUrls(prev => ({ ...prev, ...newSelectedUrls }));
      }
  }, [templates]);


  const toProperCase = (str: string) => {
    if (!str) return '';
    return str.replace(/\w\SBearer /g, (txt) => {
      if (/^[IVXLCDM]+$/i.test(txt)) {
        return txt.toUpperCase();
      }
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  };

  const expandSchoolName = (rawName: string): string => {
    if (!rawName) return '';
    let cleaned = rawName.toUpperCase().replace(/\s{2,}/g, ' ').trim();

    cleaned = cleaned.replace(/\bE\.?S\.?\b/gi, 'ELEMENTARY SCHOOL');
    cleaned = cleaned.replace(/\bN\.?H\.?S\.?\b/gi, 'NATIONAL HIGH SCHOOL');
    cleaned = cleaned.replace(/\bI\.?S\.?\b/gi, 'INTEGRATED SCHOOL');
    cleaned = cleaned.replace(/\bC\.?S\.?\b/gi, 'CENTRAL SCHOOL');

    return cleaned.replace(/\s{2,}/g, ' ').trim();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    setPendingFiles(prev => {
        const existingFileNames = new Set(prev.map(f => f.name));
        const uniqueNewFiles = newFiles.filter(f => !existingFileNames.has(f.name));
        return [...prev, ...uniqueNewFiles];
    });
    e.target.value = '';
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.classList.remove('border-primary', 'bg-primary/10');
      const newFiles = Array.from(e.dataTransfer.files || []);
      if (newFiles.length === 0) return;

      setPendingFiles(prev => {
          const existingFileNames = new Set(prev.map(f => f.name));
          const uniqueNewFiles = newFiles.filter(f => !existingFileNames.has(f.name));
          return [...prev, ...uniqueNewFiles];
      });
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.classList.add('border-primary', 'bg-primary/10');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.classList.remove('border-primary', 'bg-primary/10');
  };

  const removePendingFile = (fileName: string) => {
      setPendingFiles(prev => prev.filter(f => f.name !== fileName));
  };
  
const formatPolishedName = (name: string): string => {
    const SUFFIX_LIST = ["JR.", "SR.", "III", "II", "IV", "V", "JR", "SR"];

    let cleanedName = name.trim().toUpperCase()
        .replace(/,/g, ", ")
        .replace(/\s+/g, ' ')
        .replace(/ , /g, ", ")
        .replace(/, -/g, '')
        .replace(/Ñ/g, 'Ñ');

    const parts = cleanedName.split(", ").filter(p => p && p.trim() !== '');

    if (parts.length === 3) {
        const lastName = parts[0];
        const firstName = parts[1];
        let thirdPart = parts[2];
        let foundSuffix = "";
        let middleName = "";

        for (const suffix of SUFFIX_LIST) {
            if (thirdPart.startsWith(suffix + " ") || thirdPart === suffix) {
                foundSuffix = suffix;
                middleName = thirdPart.substring(suffix.length).trim();
                break;
            }
        }
        
        if (foundSuffix) {
            let finalName = `${lastName}, ${firstName} ${foundSuffix}`;
            if (middleName) {
                finalName += `, ${middleName}`;
            }
            return finalName;
        }
    } else if (parts.length === 4) {
        const lastName = parts[0];
        const firstName = parts[1];
        const possibleSuffix = parts[2];
        const middleName = parts[3];

        if (SUFFIX_LIST.includes(possibleSuffix)) {
            return `${lastName}, ${firstName} ${possibleSuffix}, ${middleName}`;
        }
    }
    
    return parts.join(", ");
};


  const processFiles = async () => {
    if (pendingFiles.length === 0) return;
    
    setLoadingMessage(`Processing ${pendingFiles.length} file(s)...`);
    setIsProcessing(true);
    
    const processedFiles: FileData[] = [];
    let fileSpecificInfoSet = false;

    for (const file of pendingFiles) {
        try {
            const fileData = await processSingleFile(file);
            processedFiles.push(fileData);

            if (!fileSpecificInfoSet && processedFiles.length > 0) {
              const firstFile = processedFiles[0];
              // Set shared info based on the first successfully processed file
              setSharedInfo(prev => ({
                ...prev,
                district: firstFile.fileInfo.district || prev.district,
                division: firstFile.fileInfo.division || prev.division,
                region: firstFile.fileInfo.region || prev.region,
                school: firstFile.fileInfo.school || prev.school,
                address: firstFile.fileInfo.address || prev.address,
                schoolYear: firstFile.fileInfo.schoolYear || prev.schoolYear,
                schoolYearStartDate:
                  prev.schoolYearStartDate ||
                  getDefaultSchoolYearStartDate(firstFile.fileInfo.schoolYear || prev.schoolYear),
              }));
              fileSpecificInfoSet = true;
            }

        } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            toast({
                variant: "destructive",
                title: `Error Processing ${file.name}`,
                description: "Please ensure it's a valid School Form 1 Excel file.",
            });
        }
    }

    setFilesData(processedFiles);
    setOpenAccordions(processedFiles.map(f => f.id));
    
    if(processedFiles.length > 0) {
      setPendingFiles([]);
      setStep(2);
      toast({
          variant: 'success',
          title: "Files Processed Successfully",
          description: `${processedFiles.length} file(s) extracted.`,
      });
      autoSelectTemplates(processedFiles);
    }
    
    setIsProcessing(false);
  };

  const processSingleFile = (file: File): Promise<FileData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

                const getCellValue = (row: number, col: number) => json[row]?.[col] || '';

                const rawSchoolYear = String(getCellValue(3, 19)).trim();
                const schoolYearMatch = rawSchoolYear.match(/\b(20\d{2})\s*[-\u2013\u2014/]\s*(20\d{2}|\d{2})\b/);
                const parsedSchoolYear = schoolYearMatch
                  ? `${schoolYearMatch[1]}-${
                      schoolYearMatch[2].length === 2
                        ? schoolYearMatch[1].slice(0, 2) + schoolYearMatch[2]
                        : schoolYearMatch[2]
                    }`
                  : '';
                
                let gradeLevel = '';
                const gradeValue = String(getCellValue(3, 30)).replace(/Grade /i, '').trim();

                if (!gradeValue) {
                  gradeLevel = 'Kinder';
                } else {
                    gradeLevel = gradeValue;
                }
                
                const gradeMap: { [key: string]: string } = {
                  '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six',
                  '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten', '11': 'Eleven', '12': 'Twelve'
                };

                if (gradeMap[gradeLevel]) {
                  gradeLevel = gradeMap[gradeLevel];
                }

                let adviser = '';
                for (let i = 0; i < json.length; i++) {
                    if (String(json[i][30]).includes('Prepared by;')) {
                        adviser = formatName(String(json[i+1]?.[30] || ''));
                        break;
                    }
                }

                let startIndex = -1;
                for(let i=0; i<json.length; i++) {
                    if(json[i][0] && typeof(json[i][0]) === 'string' && json[i][0].toLowerCase().includes('lrn')){
                        startIndex = i + 1;
                        break;
                    }
                }
                if (startIndex === -1) { startIndex = 6; }

                let endIndex = json.length;
                for (let i = startIndex; i < json.length; i++) {
                  if (json[i].some(cell => typeof cell === 'string' && cell.toLowerCase().includes('<=== total female'))) {
                    endIndex = i;
                    break;
                  }
                }
                
                const extractedData: StudentRecord[] = [];
                for (let i = startIndex; i < endIndex; i++) {
                  const row = json[i];
                  if (!row[0] || !row[2]) continue;
                  
                  if (
                    (typeof row[1] === 'string' && row[1].toLowerCase().includes('<=== total male')) ||
                    (typeof row[2] === 'string' && row[2].toLowerCase().includes('<=== total male'))
                  ) {
                    continue;
                  }

                  const rawName = String(row[2] || '');
                  const ageValue = Math.floor(Number(row[9] || 0));
                  const barangay = String(row[17] || '').replace(/\sBearer \(\sBearer Pob\.\sBearer \)/i, '').toUpperCase();

                  extractedData.push({
                    LRN: String(row[0]).split('.')[0],
                    Name: formatPolishedName(rawName),
                    Sex: String(row[6] || '').toUpperCase() === 'M' ? 'Male' : 'Female',
                    Birthdate: row[7] || '',
                    Age: isNaN(ageValue) ? 0 : ageValue,
                    Barangay: barangay,
                    Municipality: String(row[20] || '').toUpperCase(),
                    Province: String(row[22] || '').toUpperCase(),
                    FatherName: formatPolishedName(String(row[27] || '')),
                    MotherName: formatPolishedName(String(row[31] || '')),
                  });
                }
                
                const municipalities = extractedData.map(d => d.Municipality).filter(Boolean);
                const municipalityCounts = municipalities.reduce((acc, mun) => {
                  acc[mun] = (acc[mun] || 0) + 1;
                  return acc;
                }, {} as { [key: string]: number });
                
                let mostCommonMunicipality = '';
                if (Object.keys(municipalityCounts).length > 0) {
                    mostCommonMunicipality = Object.keys(municipalityCounts).reduce((a, b) => 
                        municipalityCounts[a] > municipalityCounts[b] ? a : b
                    );
                }

                let parsedDistrict = String(getCellValue(2, 38) || getCellValue(3, 38) || '').trim();
                if (!parsedDistrict) {
                    for (let r = 1; r <= 4; r++) {
                        for (let c = 35; c < 42; c++) {
                            const val = String(getCellValue(r, c) || '').trim();
                            if (val && !val.toLowerCase().includes('prepared') && !val.toLowerCase().includes('section')) {
                                parsedDistrict = val;
                                break;
                            }
                        }
                        if (parsedDistrict) break;
                    }
                }

                if (parsedDistrict.toLowerCase().startsWith('district')) {
                    parsedDistrict = parsedDistrict.replace(/^district\sBearer [:\s-]Bearer \sBearer /i, '').trim();
                }
                parsedDistrict = toProperCase(parsedDistrict);

                                // Municipality from nearby cells (prefer cell U3 / column 21, fallback to common municipality in student rows)
                                let parsedMunicipality = String(getCellValue(2, 21) || getCellValue(3, 21) || '').trim();
                                if (!parsedMunicipality) {
                                    // try scanning a small region where municipality might appear
                                    for (let r = 1; r <= 4; r++) {
                                        for (let c = 18; c <= 24; c++) {
                                            const val = String(getCellValue(r, c) || '').trim();
                                            if (val && !val.toLowerCase().includes('school') && !val.toLowerCase().includes('division') && !val.toLowerCase().includes('region')) {
                                                parsedMunicipality = val;
                                                break;
                                            }
                                        }
                                        if (parsedMunicipality) break;
                                    }
                                }

                                if (!parsedMunicipality && mostCommonMunicipality) {
                                    parsedMunicipality = mostCommonMunicipality;
                                }

                                parsedMunicipality = toProperCase(parsedMunicipality);

                // Division from cell T3 (column 19)
                let parsedDivision = String(getCellValue(2, 19) || '').trim();
                if (!parsedDivision) {
                    for (let r = 1; r <= 4; r++) {
                        for (let c = 17; c <= 23; c++) {
                            if (r === 3 && c === 19) continue;
                            const val = String(getCellValue(r, c) || '').trim();
                            if (val && !val.toLowerCase().includes('division') && !val.toLowerCase().includes('school') && !val.toLowerCase().includes('region')) {
                                parsedDivision = val;
                                break;
                            }
                        }
                        if (parsedDivision) break;
                    }
                }
                if (parsedDivision.toLowerCase().startsWith('division')) {
                    parsedDivision = parsedDivision.replace(/^(division\s+of\s+|division\sBearer [:\s-]Bearer \sBearer )/i, '').trim();
                }
                parsedDivision = parsedDivision.toUpperCase();

                // Region from cell K3 (column 10)
                let parsedRegion = String(getCellValue(2, 10) || getCellValue(3, 10) || '').trim();
                if (!parsedRegion) {
                    for (let r = 1; r <= 4; r++) {
                        for (let c = 8; c <= 12; c++) {
                            const val = String(getCellValue(r, c) || '').trim();
                            if (val && (val.toLowerCase().includes('region') || val.toLowerCase().includes('ncr') || val.toLowerCase().includes('car') || val.toLowerCase().includes('barmm'))) {
                                parsedRegion = val;
                                break;
                            }
                        }
                        if (parsedRegion) break;
                    }
                }
                if (parsedRegion) {
                    const matchedRegion = regions.find(r => r.toLowerCase() === parsedRegion.toLowerCase() || parsedRegion.toLowerCase().includes(r.toLowerCase()));
                    if (matchedRegion) {
                        parsedRegion = matchedRegion;
                    }
                }

                // School Name from cell (3, 5) or (2, 5) and expand abbreviations
                const rawSchoolName = String(getCellValue(3, 5) || getCellValue(2, 5) || '').trim();
                const parsedSchool = expandSchoolName(rawSchoolName);

                resolve({
                    id: file.name,
                    fileName: file.name,
                    studentData: extractedData,
                    fileInfo: {
                        gradeLevel: gradeLevel,
                        section: toProperCase(String(getCellValue(3, 38))),
                        adviser: adviser,
                        school: parsedSchool,
                        district: parsedDistrict,
                        municipality: parsedMunicipality,
                        division: parsedDivision,
                        region: parsedRegion,
                        address: toProperCase(mostCommonMunicipality),
                        schoolYear: parsedSchoolYear,
                    },

                    selectedRows: new Set(extractedData.map(s => s.LRN)),
                    searchTerm: '',
                });

            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
  };
  

  const handlePaymentAndGenerate = async () => {
    const totalSelected = filesData.reduce((sum, file) => sum + file.selectedRows.size, 0);
    const availableTokens = tokenWallet?.tokens || 0;

    if (totalSelected === 0) {
      toast({
        variant: 'destructive',
        title: 'No Students Selected',
        description: 'Please select at least one student to generate a document.',
      });
      setIsPurchaseConfirmationOpen(false);
      return;
    }
    
    if (isSF9ActionDisabled) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please select a template for each grade level, and fill all required shared info fields.',
      });
      setIsPurchaseConfirmationOpen(false);
      return;
    }

    const allowableForms = calculateAllowableStudentForms(availableTokens);
    if (!isPromoApplied && allowableForms <= 0) {
      toast({
        variant: 'destructive',
        title: 'No Tokens Available',
        description: 'Reload tokens before generating. New users can use their free starting tokens to test the app first.',
      });
      setIsPurchaseConfirmationOpen(false);
      setIsTokenReloadOpen(true);
      return;
    }

    const generationStudentCount = isPromoApplied ? totalSelected : Math.min(totalSelected, allowableForms);
    const generationFilesData = generationStudentCount < totalSelected
      ? limitFilesDataToSelectedCount(filesData, generationStudentCount)
      : filesData;

    if (!isPromoApplied && generationStudentCount < totalSelected) {
      toast({
        title: 'Generating Token-Covered Forms',
        description: `You selected ${totalSelected} learner(s), but your ${availableTokens} token(s) can cover ${generationStudentCount}. Only the first ${generationStudentCount} selected learner form(s) will be generated.`,
      });
    }

    updatePreviousInfo();

    const generationState: AppState = {
      filesData: generationFilesData,
      sharedInfo,
      croppedLogo,
      selectedTemplateUrls,
      useMiddleInitial,
      documentType,
    };
    
    setLoadingMessage('Processing your request...');
    setIsProcessing(true);
    
    try {
        if (isPromoApplied) {
            toast({
                title: "Developer Pass Applied",
                description: "Bypassing payment and generating file(s)...",
                variant: "success",
            });
            setIsPurchaseConfirmationOpen(false);
            await handleGenerateSF9(generationState);
            return;
        }

        const headers = await getAuthHeaders();
        const reservationResponse = await fetch('/api/tokens/generation', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reserve', studentCount: generationStudentCount }),
        });

        const reservationData = await reservationResponse.json().catch(() => null);
        if (!reservationResponse.ok) {
            throw new Error(reservationData?.error || 'Failed to reserve generation tokens.');
        }

        setActiveReservationId(reservationData.reservationId);
        setIsPurchaseConfirmationOpen(false);

        const generated = await handleGenerateSF9(generationState, { showPaymentRecovery: true });
        if (!generated) {
            await fetch('/api/tokens/generation', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'release', reservationId: reservationData.reservationId }),
            }).catch(() => null);
            setActiveReservationId(null);
            await refreshTokenWallet().catch(() => null);
            return;
        }

        await refreshTokenWallet().catch(() => null);
        return;
        
    } catch (error: any) {
      console.error('Generation or Payment failed:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Could not complete the process.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTokenReload = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/tokens/reload-checkout', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountPesos: reloadAmountPesos }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not create token reload checkout.'));
      }
      const data = await response.json().catch(() => null);
      localStorage.setItem('tokenReloadCheckoutSessionId', data.checkoutSessionId);
      localStorage.setItem('tokenReloadNeedsVerification', 'true');
      setIsTokenReloadOpen(false);
      window.location.assign(data.url);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Token Reload Failed',
        description: error.message || 'Could not reload tokens.',
      });
    }
  };

  const handleShareTokens = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/tokens/share', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: shareEmail, tokens: shareTokenAmount }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not share tokens.'));
      }
      setShareEmail('');
      setShareTokenAmount(5);
      setIsTokenShareOpen(false);
      await refreshTokenWallet();
      toast({
        variant: 'success',
        title: 'Tokens Shared',
        description: `${shareTokenAmount} token(s) reserved for ${shareEmail}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Token Sharing Failed',
        description: error.message || 'Could not share tokens.',
      });
    }
  };

  const handleOpenTokenHistory = async () => {
    setIsTokenHistoryOpen(true);
    setIsTokenHistoryLoading(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/tokens/history', { headers });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not load token history.'));
      }

      const data = await response.json().catch(() => null);
      setTokenHistory(data?.history || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Token History Failed',
        description: error.message || 'Could not load token history.',
      });
    } finally {
      setIsTokenHistoryLoading(false);
    }
  };

  const handleOpenReferralRewards = async () => {
    setIsReferralRewardsOpen(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/tokens/referrals', {
        headers,
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not load referral rewards.'));
      }

      const data = await response.json().catch(() => null);
      setReferralSummary(data);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Referral Rewards Failed',
        description: error.message || 'Could not load referral rewards.',
      });
    }
  };

  const handleApplyPromoCode = () => {
    if (!IS_DEVELOPER_PROMO_ENABLED) {
      setIsPromoApplied(false);
      toast({
        variant: "destructive",
        title: "Promo Code Disabled",
        description: "Developer promo codes are not available in production.",
      });
      return;
    }

    if (promoCode.trim().toUpperCase() === DEV_PROMO_CODE) {
      setIsPromoApplied(true);
      toast({
        variant: "success",
        title: "Developer Pass Applied!",
        description: "You can now generate the file for free.",
      });
    } else {
      setIsPromoApplied(false);
      toast({
        variant: "destructive",
        title: "Invalid Promo Code",
        description: "The code you entered is not valid.",
      });
    }
  };

  const formatName = (name: string): string => {
    if (!name) return '';
    let cleanedName = name.trim().replace(/\s+/g, ' ');

    if (cleanedName.includes(',')) {
      const parts = cleanedName.split(',');
      const lastName = parts[0].trim();
      const firstAndMiddle = parts.slice(1).join(' ').trim();
      cleanedName = `${firstAndMiddle} ${lastName}`;
    }

    const nameParts = cleanedName.split(' ').map(p => p.trim()).filter(Boolean);
    
    let deIndex = -1;
    for (let i = 0; i < nameParts.length; i++) {
        if (nameParts[i].toLowerCase() === 'de') {
            const posFromEnd = nameParts.length - 1 - i;
            if (posFromEnd === 2 || posFromEnd === 3) {
                deIndex = i;
                break;
            }
        }
    }

    if (deIndex !== -1) {
        nameParts.splice(deIndex, 2, `${nameParts[deIndex]} ${nameParts[deIndex + 1]}`);
    }


    const complexLastNameMarkers = ["del", "dela", "de la", "delos", "de los", "de"];
    
    let processedParts: string[] = [];
    let i = 0;
    while (i < nameParts.length) {
        let currentPart = nameParts[i];
        let nextPart = nameParts[i+1];

        if (complexLastNameMarkers.includes(currentPart.toLowerCase()) && nextPart) {
            processedParts.push(`${currentPart} ${nextPart}`);
            i += 2;
        } 
        else if (currentPart.includes('-') && i > 0) {
            let lastProcessed = processedParts.pop();
            if (lastProcessed) {
              processedParts.push(`${lastProcessed}-${currentPart}`);
            } else {
              processedParts.push(currentPart);
            }
            i++;
        }
        else {
            processedParts.push(currentPart);
            i++;
        }
    }

    let firstName = '';
    let middleInitial = '';
    let lastName = '';
    
    const numParts = processedParts.length;

    if (numParts === 2) {
        firstName = processedParts[0];
        lastName = processedParts[1];
    } else if (numParts === 3) {
        firstName = processedParts[0];
        middleInitial = processedParts[1].charAt(0).toUpperCase() + '.';
        lastName = processedParts[2];
    } else if (numParts === 4) {
        const deInMiddle = processedParts[1].toLowerCase().startsWith('de ');
        if (deInMiddle) {
            firstName = processedParts[0];
            middleInitial = `${processedParts[1].charAt(0).toUpperCase()}.`;
            lastName = processedParts[2] + ' ' + processedParts[3];

        } else {
            firstName = `${processedParts[0]} ${processedParts[1]}`;
            middleInitial = processedParts[2].charAt(0).toUpperCase() + '.';
            lastName = processedParts[3];
        }
    } else if (numParts === 5) {
        firstName = `${processedParts[0]} ${processedParts[1]} ${processedParts[2]}`;
        middleInitial = processedParts[3].charAt(0).toUpperCase() + '.';
        lastName = processedParts[4];
    } else if (numParts === 6) {
        firstName = `${processedParts[0]} ${processedParts[1]} ${processedParts[2]} ${processedParts[3]}`;
        middleInitial = processedParts[4].charAt(0).toUpperCase() + '.';
        lastName = processedParts[5];
    } else {
        return toProperCase(cleanedName).toUpperCase();
    }

    const finalName = [firstName, middleInitial, lastName].filter(Boolean).join(' ');
    return toProperCase(finalName).toUpperCase();
  };

  const resetState = () => {
    setStep(1);
    setIsProcessing(false);
    setPendingFiles([]);
    setFilesData([]);
    setOpenAccordions([]);
    setSharedInfo(initialSharedInfo);
    setCroppedLogo(null);
    setLogoSrc(null);
    setSelectedTemplateUrls({});
    setPaperSize('Custom');
    setPromoCode('');
    setIsPromoApplied(false);
    setActiveReservationId(null);
  };

  const handleAccountReset = () => {
    resetState();
    clearStateFromLocalStorage();
    try {
      sessionStorage.removeItem('previousSchoolLogos');
      sessionStorage.removeItem('previousSchoolInfo');
    } catch (error) {
      console.error("Could not clear account reset storage:", error);
    }
    setPreviousLogos([]);
    setPreviousInfo(initialPreviousInfo);
    refreshTokenWallet().catch(error => {
      toast({
        variant: 'destructive',
        title: 'Token Wallet Refresh Failed',
        description: error.message || 'Please refresh the page to reload your wallet.',
      });
    });
  };

  const handleRowSelection = (fileId: string, lrn: string) => {
    setFilesData(prev => prev.map(fileData => {
        if (fileData.id === fileId) {
            const newSelection = new Set(fileData.selectedRows);
            if (newSelection.has(lrn)) {
                newSelection.delete(lrn);
            } else {
                newSelection.add(lrn);
            }
            return { ...fileData, selectedRows: newSelection };
        }
        return fileData;
    }));
  };

  const handleSelectAll = (fileId: string, filteredData: StudentRecord[]) => {
      setFilesData(prev => prev.map(fileData => {
          if (fileData.id === fileId) {
              const currentSelectionSize = fileData.selectedRows.size;
              const filteredIds = new Set(filteredData.map(d => d.LRN));
              
              if (currentSelectionSize === filteredIds.size) {
                  return { ...fileData, selectedRows: new Set() };
              } else {
                  return { ...fileData, selectedRows: filteredIds };
              }
          }
          return fileData;
      }));
  };

  const handleSearchTermChange = (fileId: string, term: string) => {
      setFilesData(prev => prev.map(fileData => 
          fileData.id === fileId ? { ...fileData, searchTerm: term } : fileData
      ));
  };


  const handleSharedInfoChange = (field: keyof SharedInfo, value: string) => {
    setSharedInfo(prevInfo => {
      if (field === 'schoolYear') {
        return {
          ...prevInfo,
          schoolYear: value,
          schoolYearStartDate: getDefaultSchoolYearStartDate(value),
        };
      }
      return { ...prevInfo, [field]: value };
    });
  };

  const handleStudentInfoChange = (
    fileId: string,
    lrn: string,
    field: 'Municipality' | 'FatherName' | 'MotherName',
    value: string
  ) => {
    setFilesData(prev => prev.map(fileData =>
      fileData.id === fileId
        ? {
            ...fileData,
            studentData: fileData.studentData.map(student =>
              student.LRN === lrn ? { ...student, [field]: value } : student
            ),
          }
        : fileData
    ));
  };

  const handleFileInfoChange = (fileId: string, field: keyof FileInfo, value: string) => {
      setFilesData(prev => prev.map(fileData => 
          fileData.id === fileId ? { ...fileData, fileInfo: { ...fileData.fileInfo, [field]: value } } : fileData
      ));
  };


  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined) // Makes crop preview update between images.
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setLogoSrc(reader.result?.toString() || ''),
      );
      reader.readAsDataURL(e.target.files[0]);
      setIsEditorOpen(true);
      e.target.value = '';
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }
  
  const handleSaveCrop = () => {
    const image = imgRef.current;
    if (!image || !completedCrop) {
      return;
    }

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    const pixelRatio = window.devicePixelRatio;
    canvas.width = Math.round(completedCrop.width * pixelRatio);
    canvas.height = Math.round(completedCrop.height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      Math.round(completedCrop.width * pixelRatio),
      Math.round(completedCrop.height * pixelRatio)
    );
    
    const newLogo = canvas.toDataURL('image/png');
    setCroppedLogo(newLogo);
    setIsEditorOpen(false);

    setPreviousLogos(prev => {
        const updatedLogos = [newLogo, ...prev.filter(p => p !== newLogo)].slice(0, MAX_PREVIOUS_LOGOS);
        try {
            sessionStorage.setItem('previousSchoolLogos', JSON.stringify(updatedLogos));
        } catch (error) {
            console.error("Could not save logos to sessionStorage:", error);
        }
        return updatedLogos;
    });
  };

  const handleRemovePreviousLogo = (logoToRemove: string) => {
    setPreviousLogos(prev => {
        const updatedLogos = prev.filter(p => p !== logoToRemove);
        try {
            sessionStorage.setItem('previousSchoolLogos', JSON.stringify(updatedLogos));
        } catch (error) {
            console.error("Could not update logos in sessionStorage:", error);
        }
        return updatedLogos;
    });
  };

  const handleRemoveCurrentLogo = () => {
    const logoToRemove = croppedLogo;
    setCroppedLogo(null);
    if(logoToRemove){
        handleRemovePreviousLogo(logoToRemove);
    }
  }

  const uniqueGradeLevels = [...new Set(filesData.map(f => f.fileInfo.gradeLevel))];
  const hasKindergartenFiles = filesData.some(file => file.fileInfo.gradeLevel === 'Kinder');
  const totalSelectedStudents = filesData.reduce((sum, file) => sum + file.selectedRows.size, 0);
  const availableTokens = tokenWallet?.tokens || 0;
  const allowableStudentForms = calculateAllowableStudentForms(availableTokens);
  const generationStudentLimit = isPromoApplied ? totalSelectedStudents : Math.min(totalSelectedStudents, allowableStudentForms);
  const requiredTokens = calculateTokenCost(generationStudentLimit);
  const isSelectionTokenLimited = !isPromoApplied && totalSelectedStudents > generationStudentLimit;
  const reloadPreview = calculateTokenReload(reloadAmountPesos);
  
  const isActionDisabled = isProcessing || totalSelectedStudents === 0 || 
    !sharedInfo.school ||
    !sharedInfo.schoolHead || 
    !sharedInfo.schoolHeadDesignation ||
    !sharedInfo.region ||
    !sharedInfo.division ||
    !sharedInfo.district ||
    !sharedInfo.schoolYear ||
    (hasKindergartenFiles && !sharedInfo.schoolYearStartDate);

  const templatesAreSelected = uniqueGradeLevels.every(gl => !!selectedTemplateUrls[gl]);
  const isSF9ActionDisabled = isActionDisabled || !templatesAreSelected;
  const currentStepLabel = step === 1 ? 'Upload SF1 files' : step === 2 ? 'Select learners' : 'Finalize and generate';
  const hasGeneratorDraft = pendingFiles.length > 0 || filesData.length > 0 || totalSelectedStudents > 0;
  const latestTokenHistory = tokenHistory.slice(0, 3);

  const handleGenerateAnother = () => {
    resetState();
    clearStateFromLocalStorage();
    setPaidGenerationNeedsConfirmation(false);
    setIsPostGenerateDialogOpen(false);
  };

  const handleConfirmPaidDownload = async () => {
    try {
      let rewardTokens = 0;
      if (activeReservationId) {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/tokens/generation', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'consume', reservationId: activeReservationId }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || 'Could not consume reserved tokens.');
        }
        rewardTokens = Number(data?.rewardTokens || 0);
      }

      resetState();
      clearStateFromLocalStorage();
      setActiveReservationId(null);
      setPaidGenerationNeedsConfirmation(false);
      setIsPostGenerateDialogOpen(false);
      await refreshTokenWallet().catch(() => null);
      toast({
        variant: 'success',
        title: rewardTokens > 0 ? 'Generation Reward Added' : 'Tokens Consumed',
        description: rewardTokens > 0
          ? `Your generation has been completed. ${rewardTokens} bonus token(s) were added.`
          : 'Your generation has been completed.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Token Confirmation Failed',
        description: error.message || 'Could not confirm token usage.',
      });
    }
  };

  const SummaryItem = ({ label, value }: { label: string; value?: string | number | ReactNode }) => (
    <div className="flex justify-between py-2 border-b border-dashed">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-right">{value || 'Not set'}</dd>
    </div>
  );


  return (
    <TooltipProvider>
      {hasMounted && (
        <AppHeader
          availableTokens={tokenWallet?.tokens ?? null}
          onReloadTokens={() => setIsTokenReloadOpen(true)}
          onShareTokens={() => setIsTokenShareOpen(true)}
          onOpenTokenHistory={handleOpenTokenHistory}
          onResetAccount={handleAccountReset}
        />
      )}
      <div className="container mx-auto px-4 pt-6 pb-24 space-y-6">
        {isProcessing && <LoadingOverlay message={loadingMessage} />}

        <Dialog open={hasMounted && !isUserLoading && !authUser}>
            <DialogContent
              className="sm:max-w-md"
              hideCloseButton
              onInteractOutside={(event) => event.preventDefault()}
              onEscapeKeyDown={(event) => event.preventDefault()}
            >
              <DialogHeader>
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <LogIn className="size-5" />
                </div>
                <DialogTitle className="text-center">Sign In Required</DialogTitle>
                <DialogDescription className="text-center">
                  Sign in with Google before using TeachTiangge. Your account keeps tokens connected to you.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={signInWithGoogle}
                >
                  <LogIn className="size-4" />
                  Continue with Google
                </Button>
              </DialogFooter>
            </DialogContent>
        </Dialog>

        <AlertDialog open={isDisclaimerOpen} onOpenChange={setIsDisclaimerOpen}>
            <AlertDialogContent className="max-w-3xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>Important Disclaimer & Terms of Use</AlertDialogTitle>
                </AlertDialogHeader>
                <ScrollArea className="max-h-[60vh] pr-6">
                    <div className="space-y-4 text-sm text-muted-foreground">
                        <p>Please read these terms carefully before using TeachTiangge (the &quot;Service&quot;).</p>
                        <p>By clicking &quot;Agree&quot; or by using this Service, you acknowledge that you have read, understood, and agree to be bound by all the terms and conditions outlined below.</p>
                        
                        <h3 className="font-semibold text-foreground">1. No Official Affiliation</h3>
                        <p>This is an unofficial, third-party tool. It is NOT affiliated with, endorsed by, or created by the Department of Education (DepEd). This Service is provided as-is for convenience and supplemental use only.</p>

                        <h3 className="font-semibold text-foreground">2. Data Privacy & Security</h3>
                        <p>We have designed this app with your privacy as the highest priority.</p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><span className="font-semibold">Client-Side Document Processing:</span> Your School Form 1 (SF1) file and the sensitive student data it contains are processed in your browser for document generation.</li>
                            <li><span className="font-semibold">No Data Upload or Storage:</span> The file is read directly by your web browser, and the School Form 9 (SF9) is generated locally on your device. No student data is ever uploaded, sent to, or stored on our servers.</li>
                            <li><span className="font-semibold">Accounts and Tokens:</span> Google sign-in is used to connect token balances, reloads, referrals, sharing activity, and generation reservations to your account.</li>
                            <li><span className="font-semibold">Secure Payment:</span> PayMongo is used only for token reload payments. Student names, LRNs, and generated documents are not sent to PayMongo.</li>
                        </ul>

                        <h3 className="font-semibold text-foreground">3. Accuracy and Liability</h3>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><span className="font-semibold">For Convenience Only:</span> The calculations and generated documents are for review and convenience purposes only.</li>
                            <li><span className="font-semibold">Verification is Your Responsibility:</span> You, the user, are solely responsible for manually verifying the accuracy of all generated data (names, grades, calculations, etc.) against official school records and the Learner Information System (LIS) before any official use.</li>
                            <li><span className="font-semibold">No Warranty:</span> This Service is provided &quot;as is&quot; and &quot;as available&quot; without any warranties, express or implied. The developer does not guarantee that the Service will be error-free or that the generated documents will be 100% accurate or compliant with the latest DepEd orders. DepEd policies and form requirements can change at any time.</li>
                            <li><span className="font-semibold">Limitation of Liability:</span> The developer shall not be held liable for any damages (direct, indirect, or consequential) arising from the use or inability to use this Service. This includes, but is not to be limited to, damages from inaccurate calculations, file generation errors, or any reliance on this tool for official submissions.</li>
                        </ul>

                        <h3 className="font-semibold text-foreground">4. Tokens, Payments, Referrals, and Sharing</h3>
                        <p>Each selected student form generation consumes tokens. New registered users receive a free starting balance. Additional tokens may be reloaded through PayMongo, may include promotional bonus tokens, may be rewarded through referrals or generation milestones, and may be shared with other users when eligible.</p>
                        <p>Tokens are reserved before generation and consumed only after you confirm that the file was downloaded. Failed generation attempts release reserved tokens. Token reload payments are final once credited to your account.</p>

                        <p className="font-bold">By using this app, you agree to these terms and accept full responsibility for the use and verification of all generated data.</p>
                    </div>
                </ScrollArea>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={handleAgreeToDisclaimer}>
                        I Have Read and Agree to the Terms
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Crop School Logo</DialogTitle>
            </DialogHeader>
            {logoSrc && (
              <div className='flex justify-center'>
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                minWidth={100}
                minHeight={100}
              >
                <Image
                  ref={imgRef}
                  alt="Crop me"
                  src={logoSrc}
                  width={400}
                  height={400}
                  onLoad={onImageLoad}
                  className="max-h-[60vh] object-contain"
                />
              </ReactCrop>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditorOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveCrop}>Save Logo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Dialog open={isPostGenerateDialogOpen} onOpenChange={setIsPostGenerateDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center">Generation Successful!</DialogTitle>
                <DialogDescription className="text-center">
                  {paidGenerationNeedsConfirmation
                    ? 'Your document was prepared. Tokens will only be consumed after you confirm the download.'
                    : 'Your document(s) have been downloaded.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col sm:flex-col sm:space-x-0 items-center gap-2">
                {paidGenerationNeedsConfirmation ? (
                  <>
                    <Button
                      type="button"
                      onClick={handleConfirmPaidDownload}
                      className="w-full"
                    >
                      I Downloaded the File
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleGenerateSF9({
                        filesData,
                        sharedInfo,
                        croppedLogo,
                        selectedTemplateUrls,
                        useMiddleInitial,
                        documentType,
                      }, { showPaymentRecovery: true })}
                      className="w-full"
                    >
                      Download Again Without Paying
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={handleGenerateAnother}
                    className="w-full"
                  >
                    Generate Another
                  </Button>
                )}
                <a
                  href="https://forms.gle/2pDLGjWxooM6X6dv5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
                  onClick={() => setIsPostGenerateDialogOpen(false)}
                >
                  <MessageSquareQuote className="mr-2 h-4 w-4" />
                  Leave a Suggestion
                </a>
              </DialogFooter>
            </DialogContent>
        </Dialog>

         <AlertDialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Please Review Your Entries</AlertDialogTitle>
              <AlertDialogDescription>
                Double-check the information below before proceeding.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ScrollArea className="max-h-[60vh] pr-6">
              <dl className="space-y-1">
                <SummaryItem label="Total Files" value={filesData.length} />
                <SummaryItem label="Total Selected Students" value={totalSelectedStudents} />
                <SummaryItem label="Paper Size" value={paperSize} />
                <SummaryItem label="Document Type" value="DOCX" />
                <SummaryItem label={isSelectionTokenLimited ? "Forms to Generate Now" : "Forms to Generate"} value={`${generationStudentLimit} of ${totalSelectedStudents} selected`} />
                <SummaryItem label={isSelectionTokenLimited ? "Tokens Used Now" : "Required Tokens"} value={`${requiredTokens} tokens (${TOKENS_PER_STUDENT_FORM} per student form)`} />
                <SummaryItem label="Available Tokens" value={`${availableTokens} tokens`} />
                <SummaryItem label="School Name" value={sharedInfo.school} />
                <SummaryItem label="School Head" value={sharedInfo.schoolHead} />
                <SummaryItem label="School Head Designation" value={sharedInfo.schoolHeadDesignation} />
                <SummaryItem label="Region" value={sharedInfo.region} />
                <SummaryItem label="Division" value={sharedInfo.division} />
                <SummaryItem label="District" value={sharedInfo.district} />
                <SummaryItem label="Municipality" value={sharedInfo.municipality} />
                <SummaryItem label="School Year" value={sharedInfo.schoolYear} />
                <SummaryItem label="School Logo" value={croppedLogo ? "Included" : "Not Included"} />
                <div className="pt-4">
                  <h4 className="font-semibold text-foreground mb-2">Templates by Grade Level</h4>
                  {uniqueGradeLevels.map(grade => {
                    const templateName = templates.find(t => t.download_url === selectedTemplateUrls[grade])?.name;
                    const value = templateName ? (
                      <span className="text-green-600">{templateName}</span>
                    ) : (
                      <span className="text-destructive font-medium">Not Selected</span>
                    );
                    return <SummaryItem key={grade} label={`Grade ${grade}`} value={value} />
                  })}
                </div>
              </dl>
            </ScrollArea>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setIsSummaryDialogOpen(false); setIsPurchaseConfirmationOpen(true); }}>
                Confirm & Proceed
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isPurchaseConfirmationOpen} onOpenChange={setIsPurchaseConfirmationOpen}>
            <AlertDialogContent className="sm:max-w-lg">
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Generation</AlertDialogTitle>
                    {isPromoApplied ? (
                      <AlertDialogDescription>
                        Developer pass applied. You can generate the file(s) for free.
                      </AlertDialogDescription>
                    ) : (
                      <div className="space-y-3 pt-1">
                        <AlertDialogDescription>
                          Review token usage before generating your file.
                        </AlertDialogDescription>

                        <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-2">
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>Document Type:</span>
                            <span className="font-semibold text-foreground">DOCX</span>
                          </div>
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>Selected Students:</span>
                            <span className="font-semibold text-foreground">{totalSelectedStudents} selected x {TOKENS_PER_STUDENT_FORM} tokens</span>
                          </div>
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>Available Tokens:</span>
                            <span className="font-medium text-foreground">{availableTokens}</span>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t font-semibold text-sm text-foreground">
                            <span>{isSelectionTokenLimited ? 'Tokens Used Now:' : 'Required Tokens:'}</span>
                            <span className="text-primary text-base">{requiredTokens}</span>
                          </div>
                        </div>
                      </div>
                    )}
                </AlertDialogHeader>

                {!isPromoApplied && (
                    <div className="space-y-3">
                        {isSelectionTokenLimited && generationStudentLimit > 0 && (
                            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200 space-y-1 text-xs">
                                <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                                    <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <span>Limited Test Generation</span>
                                </div>
                                <p className="text-[11px] leading-relaxed opacity-90">
                                    Your available tokens can generate <strong>{generationStudentLimit}</strong> of <strong>{totalSelectedStudents}</strong> selected learner form(s). Only the first token-covered selected learners will be included. Use this to test first, or reload tokens to generate the full selection.
                                </p>
                            </div>
                        )}

                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
                            <Percent className="size-3.5 shrink-0 text-primary" />
                            <span>
                                <strong>Token Reload Bonus:</strong> Reload more than PHP 100.00 and receive <strong>5%</strong> additional tokens.
                            </span>
                        </div>
                    </div>
                )}

                {IS_DEVELOPER_PROMO_ENABLED && (
                    <div className="space-y-3 pt-1">
                        <Label htmlFor="promo-code" className="text-xs font-semibold">Use Custom Promo Code</Label>
                        <div className="flex gap-2">
                            <Input
                              id="promo-code"
                              placeholder="Enter promo code"
                              value={promoCode}
                              onChange={(e) => setPromoCode(e.target.value)}
                              disabled={isPromoApplied}
                              className="h-9 text-xs"
                            />
                            <Button
                              onClick={handleApplyPromoCode}
                              disabled={isPromoApplied || !promoCode}
                              variant="outline"
                              size="sm"
                            >
                                Apply Code
                            </Button>
                        </div>
                    </div>
                )}
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    {!isPromoApplied && generationStudentLimit === 0 ? (
                      <Button onClick={() => { setIsPurchaseConfirmationOpen(false); setIsTokenReloadOpen(true); }}>
                        Reload Tokens
                      </Button>
                    ) : (
                      <AlertDialogAction onClick={handlePaymentAndGenerate}>
                        {isPromoApplied ? 'Generate for Free' : isSelectionTokenLimited ? 'Generate First ' + generationStudentLimit : 'Generate with Tokens'}
                      </AlertDialogAction>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
            <DialogContent className="sm:max-w-md text-center space-y-4">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl">Complete Your Payment</DialogTitle>
                    <DialogDescription className="text-center text-sm pt-2">
                        Paymongo Checkout will open in a new tab. If your browser blocked the popup, click the button below to open the checkout page.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 flex flex-col items-center gap-3">
                    {checkoutUrl && (
                        <a
                            href={checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full gap-2 text-base font-semibold shadow-md')}
                        >
                            Open Paymongo Checkout Page
                        </a>
                    )}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        After completing payment on Paymongo, you will be redirected back here to automatically generate your School Form 9 document(s).
                    </p>
                </div>
                <DialogFooter className="sm:justify-center">
                    <Button variant="outline" onClick={() => setIsCheckoutDialogOpen(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isTokenReloadOpen} onOpenChange={setIsTokenReloadOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Coins className="size-5 text-primary" />
                        Reload Tokens
                    </DialogTitle>
                    <DialogDescription>
                        Minimum reload is PHP {TOKEN_RELOAD_MIN_PESOS}. PHP 20 gives 50 tokens. Reload more than PHP 100 to receive 5% bonus tokens.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="reload-amount">Amount in pesos</Label>
                        <Input
                            id="reload-amount"
                            type="number"
                            min={TOKEN_RELOAD_MIN_PESOS}
                            value={reloadAmountPesos}
                            onChange={(event) => setReloadAmountPesos(Number(event.target.value))}
                        />
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                        <div className="flex justify-between">
                            <span>Base tokens</span>
                            <span className="font-semibold">{reloadPreview.baseTokens}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600">
                            <span>Bonus tokens</span>
                            <span className="font-semibold">+{reloadPreview.bonusTokens}</span>
                        </div>
                        <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                            <span>Total tokens</span>
                            <span>{reloadPreview.totalTokens}</span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsTokenReloadOpen(false)}>Cancel</Button>
                    <Button onClick={handleTokenReload}>Proceed to PayMongo</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isReferralRewardsOpen} onOpenChange={setIsReferralRewardsOpen}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Gift className="size-5 text-primary" />
                        Referral Rewards
                    </DialogTitle>
                    <DialogDescription>
                        Invite another teacher. They receive {referralSummary?.rewardTokens || REFERRAL_REWARD_TOKENS} bonus tokens when they sign up, and you receive {referralSummary?.rewardTokens || REFERRAL_REWARD_TOKENS} bonus tokens after their first token reload.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                        <p className="mb-2 text-muted-foreground">Your referral link</p>
                        <div className="flex gap-2">
                            <Input readOnly value={tokenWallet?.referralCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${tokenWallet.referralCode}` : ''} />
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (!tokenWallet?.referralCode) return;
                                    const url = `${window.location.origin}/?ref=${tokenWallet.referralCode}`;
                                    navigator.clipboard?.writeText(url);
                                    toast({ variant: 'success', title: 'Referral Link Copied', description: 'Share it with another teacher.' });
                                }}
                            >
                                Copy
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">Signed Up</p>
                            <p className="text-lg font-semibold">{referralSummary?.summary.signedUp ?? 0}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">First Reload</p>
                            <p className="text-lg font-semibold">{referralSummary?.summary.firstReloadCompleted ?? 0}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">Pending</p>
                            <p className="text-lg font-semibold">{referralSummary?.summary.pendingRewards ?? 0}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">Earned</p>
                            <p className="text-lg font-semibold">{referralSummary?.summary.totalRewardTokens ?? 0}</p>
                        </div>
                    </div>
                    <div className="rounded-lg border">
                        <div className="border-b px-3 py-2 text-sm font-medium">Recent Referrals</div>
                        <div className="max-h-56 divide-y overflow-y-auto">
                            {referralSummary?.referrals.length ? referralSummary.referrals.map(referral => (
                                <div key={referral.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium">{referral.referredEmail || 'Teacher account'}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {referral.referrerRewardGranted ? 'Reward granted' : referral.firstReloadAt ? 'First reload completed' : 'Signed up'}
                                        </p>
                                    </div>
                                    <Badge variant={referral.referrerRewardGranted ? 'default' : 'secondary'}>
                                        {referral.referrerRewardGranted ? `+${referral.referrerRewardTokens}` : 'Pending'}
                                    </Badge>
                                </div>
                            )) : (
                                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                    No referred teachers yet.
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Referrer rewards are granted once per referred account after a successful reload of at least PHP {referralSummary?.minimumReloadPesos || TOKEN_RELOAD_MIN_PESOS}. Referral rewards are usable for generation but are not shareable.
                    </p>
                </div>
            </DialogContent>
        </Dialog>

        <Dialog open={isTokenHistoryOpen} onOpenChange={setIsTokenHistoryOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="size-5 text-primary" />
                        Token History
                    </DialogTitle>
                    <DialogDescription>
                        Review token reloads, usage, sharing, and rewards for your account.
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border">
                    <div className="max-h-96 divide-y overflow-y-auto">
                        {isTokenHistoryLoading ? (
                            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" />
                                Loading token history...
                            </div>
                        ) : tokenHistory.length ? tokenHistory.map(item => (
                            <div key={item.id} className="flex items-start justify-between gap-4 px-3 py-3 text-sm">
                                <div className="min-w-0">
                                    <p className="font-medium">{getTokenHistoryTitle(item.type)}</p>
                                    <p className="text-xs text-muted-foreground">{getTokenHistoryDetail(item)}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{formatTokenHistoryDate(item.createdAt)}</p>
                                </div>
                                <Badge variant={item.tokens >= 0 ? 'default' : 'secondary'} className="shrink-0">
                                    {item.tokens >= 0 ? '+' : ''}{item.tokens}
                                </Badge>
                            </div>
                        )) : (
                            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                                No token history yet.
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleOpenTokenHistory} disabled={isTokenHistoryLoading}>
                        {isTokenHistoryLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RotateCw className="mr-2 size-4" />}
                        Refresh
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isTokenShareOpen} onOpenChange={setIsTokenShareOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="size-5 text-primary" />
                        Share Tokens
                    </DialogTitle>
                    <DialogDescription>
                        Only tokens bought through reload can be shared.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Shareable reload tokens</span>
                            <span className="font-semibold">{tokenWallet?.shareableTokens || 0}</span>
                        </div>
                    </div>
                    <Input
                        placeholder="Recipient email"
                        value={shareEmail}
                        onChange={(event) => setShareEmail(event.target.value)}
                    />
                    <Input
                        type="number"
                        min={1}
                        max={tokenWallet?.shareableTokens || 0}
                        value={shareTokenAmount}
                        onChange={(event) => setShareTokenAmount(Number(event.target.value))}
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleShareTokens} disabled={(tokenWallet?.shareableTokens || 0) < 1}>Share Tokens</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isPaymentRecoveryOpen} onOpenChange={setIsPaymentRecoveryOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                        <AlertTriangle className="size-5" />
                    </div>
                    <DialogTitle className="text-center">Payment Confirmed</DialogTitle>
                    <DialogDescription className="text-center">
                        Your payment was verified, but the document download did not complete.
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    {paymentRecoveryError || 'You can retry generation without paying again.'}
                </div>
                <DialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2">
                    <Button onClick={handleRetryPaidGeneration} className="w-full">
                        Retry File Generation
                    </Button>
                    <Button variant="outline" onClick={() => setIsPaymentRecoveryOpen(false)} className="w-full">
                        Keep This for Later
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

                <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
            <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-2xl border bg-card/95 p-4 shadow-lg shadow-primary/5">
              <div className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-md shadow-primary/25">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
                    <Store className="size-5" />
                  </span>
                  <div>
                    <p className="text-lg font-bold leading-tight">TeachTiangge</p>
                    <p className="text-xs leading-snug text-primary-foreground/80">Your go to digital store for teaching related materials.</p>
                  </div>
                </div>
              </div>

              <nav className="space-y-1" aria-label="TeachTiangge workspace">
                {[
                  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
                  { id: 'generator' as const, label: 'School Forms Generator', icon: FileText },
                  { id: 'marketplace' as const, label: 'Marketplace', icon: ShoppingBag },
                ].map(item => {
                  const Icon = item.icon;
                  const active = activeWorkspaceSection === item.id;
                  return (
                    <Button
                      key={item.id}
                      variant={active ? 'default' : 'ghost'}
                      className={cn('h-11 w-full justify-start rounded-xl px-3', active && 'shadow-md shadow-primary/20')}
                      onClick={() => setActiveWorkspaceSection(item.id)}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Button>
                  );
                })}
              </nav>

              {authUser && (
                <div className="mt-auto rounded-2xl border bg-background/80 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Available Tokens</p>
                      <p className="text-3xl font-bold text-foreground">{availableTokens}</p>
                    </div>
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Coins className="size-6" />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={() => setIsTokenReloadOpen(true)}>Reload</Button>
                    <Button size="sm" variant="outline" onClick={handleOpenTokenHistory}>History</Button>
                    <Button size="sm" variant="outline" onClick={() => setIsTokenShareOpen(true)}>Share</Button>
                  </div>
                  {tokenWallet?.referralCode && (
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      <Button size="sm" variant="ghost" className="justify-start px-2 text-xs" onClick={handleOpenReferralRewards}>
                        <Gift className="size-3.5" />
                        Referral rewards
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="justify-start px-2 text-xs"
                        onClick={() => {
                          const url = `${window.location.origin}/?ref=${tokenWallet.referralCode}`;
                          navigator.clipboard?.writeText(url);
                          toast({ variant: 'success', title: 'Referral Link Copied', description: 'Share it with another teacher to earn reward tokens after their first reload.' });
                        }}
                      >
                        <Share2 className="size-3.5" />
                        Copy referral link
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>

          <main className="min-w-0 space-y-8">            {activeWorkspaceSection === 'dashboard' && (
              <section className="space-y-6">
                <div className="rounded-3xl border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <Badge className="mb-4 bg-accent text-accent-foreground hover:bg-accent">TeachTiangge Dashboard</Badge>
                      <h1 className="text-3xl font-bold tracking-normal text-foreground sm:text-4xl">Teacher workspace</h1>
                      <p className="mt-2 max-w-2xl text-muted-foreground">
                        Your go to digital store for teaching related materials.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button className="gap-2" onClick={() => setActiveWorkspaceSection('generator')}>
                        <FileText className="size-4" />
                        Continue generator
                      </Button>
                      <Button variant="outline" className="gap-2" onClick={() => setActiveWorkspaceSection('marketplace')}>
                        <ShoppingBag className="size-4" />
                        Marketplace
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <Card className="border-primary/15 shadow-lg shadow-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="size-5 text-primary" />
                        Continue Last Work
                      </CardTitle>
                      <CardDescription>{hasGeneratorDraft ? currentStepLabel : 'Start by uploading one or more SF1 files.'}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border bg-muted/30 p-4">
                          <p className="text-xs text-muted-foreground">Files</p>
                          <p className="mt-1 text-2xl font-bold">{filesData.length || pendingFiles.length}</p>
                        </div>
                        <div className="rounded-2xl border bg-muted/30 p-4">
                          <p className="text-xs text-muted-foreground">Selected learners</p>
                          <p className="mt-1 text-2xl font-bold">{totalSelectedStudents}</p>
                        </div>
                        <div className="rounded-2xl border bg-muted/30 p-4">
                          <p className="text-xs text-muted-foreground">Can generate now</p>
                          <p className="mt-1 text-2xl font-bold">{generationStudentLimit}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button className="flex-1" onClick={() => setActiveWorkspaceSection('generator')}>
                          {hasGeneratorDraft ? 'Resume Generator' : 'Start Generator'}
                        </Button>
                        {hasGeneratorDraft && (
                          <Button variant="outline" onClick={() => { resetState(); clearStateFromLocalStorage(); }}>Clear Draft</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-lg shadow-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Coins className="size-5 text-primary" />
                        Token Wallet
                      </CardTitle>
                      <CardDescription>Tokens remain available across TeachTiangge.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-end justify-between rounded-2xl border bg-primary/5 p-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Available tokens</p>
                          <p className="text-4xl font-bold text-foreground">{availableTokens}</p>
                        </div>
                        <Badge variant="outline">{allowableStudentForms} form(s)</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button onClick={() => setIsTokenReloadOpen(true)}>Reload</Button>
                        <Button variant="outline" onClick={handleOpenTokenHistory}>Activity</Button>
                        <Button variant="outline" onClick={() => setIsTokenShareOpen(true)}>Share</Button>
                        <Button variant="outline" onClick={handleOpenReferralRewards}>Rewards</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <Card className="xl:col-span-1">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Download className="size-5 text-primary" />
                        Local Downloads
                      </CardTitle>
                      <CardDescription>Generated files stay on your device.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                        Generated documents download directly to your device.
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setActiveWorkspaceSection('generator')}
                      >
                        Open Generator
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="xl:col-span-1">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <History className="size-5 text-primary" />
                        Token Activity
                      </CardTitle>
                      <CardDescription>Latest wallet events.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {latestTokenHistory.length ? latestTokenHistory.map(item => (
                        <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-semibold">{getTokenHistoryTitle(item.type)}</p>
                            <p className="line-clamp-1 text-xs text-muted-foreground">{getTokenHistoryDetail(item)}</p>
                          </div>
                          <Badge variant={item.tokens >= 0 ? 'default' : 'secondary'}>{item.tokens >= 0 ? '+' : ''}{item.tokens}</Badge>
                        </div>
                      )) : (
                        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                          Load token activity to see reloads, rewards, shares, and generations.
                        </div>
                      )}
                      <Button variant="outline" className="w-full" onClick={handleOpenTokenHistory} disabled={isTokenHistoryLoading}>
                        {isTokenHistoryLoading ? <Loader2 className="size-4 animate-spin" /> : <History className="size-4" />}
                        Load Activity
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="xl:col-span-1">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <ShoppingBag className="size-5 text-primary" />
                        Marketplace Picks
                      </CardTitle>
                      <CardDescription>Suggested sections for teaching materials.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {['SF9 templates', 'Class record tools', 'Certificates and printables'].map(item => (
                        <div key={item} className="rounded-xl border bg-background p-3 text-sm font-semibold">
                          {item}
                        </div>
                      ))}
                      <Button variant="outline" className="w-full" onClick={() => setActiveWorkspaceSection('marketplace')}>
                        Open Marketplace
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </section>
            )}

            {activeWorkspaceSection === 'marketplace' && (
              <MarketplaceSection
                isSignedIn={!!authUser}
                availableTokens={availableTokens}
                getAuthHeaders={getAuthHeaders}
                onSignIn={signInWithGoogle}
                onReloadTokens={() => setIsTokenReloadOpen(true)}
                onPurchaseComplete={() => { refreshTokenWallet().catch(() => null); }}
              />
            )}

            <div className={cn('max-w-5xl mx-auto w-full space-y-8', activeWorkspaceSection === 'generator' ? 'block' : 'hidden')}>

            <div className={cn(step === 1 ? 'block' : 'hidden')}>
                 <Card className="w-full shadow-lg border-primary/20">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary">
                            <FileUp className="size-6" />
                        </div>
                        <div>
                            <CardTitle>Upload School Form 1 Files</CardTitle>
                            <CardDescription>Select one or more SF1 files to begin.</CardDescription>
                        </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div 
                            className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center transition-colors duration-300 cursor-pointer bg-background hover:bg-muted"
                            onClick={handleUploadAreaClick}
                            onDrop={handleFileDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                        >
                            <Input
                            id="file-upload"
                            type="file"
                            className="hidden"
                            accept=".xls,.xlsx"
                            onChange={handleFileSelect}
                            disabled={isProcessing}
                            ref={fileUploadRef}
                            multiple
                            />
                            <label htmlFor="file-upload" className="cursor-pointer pointer-events-none">
                                <div className="mx-auto flex items-center justify-center size-12 rounded-full bg-muted text-primary">
                                    <Upload className="size-6" />
                                </div>
                                <p className="mt-4 text-primary font-semibold">
                                    Click to browse or drag & drop
                                </p>
                                <p className="text-sm text-muted-foreground">XLS or XLSX files</p>
                            </label>
                        </div>

                        {pendingFiles.length > 0 && (
                            <div className="mt-6">
                                <h3 className="font-semibold text-lg mb-2">Selected Files ({pendingFiles.length})</h3>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                    {pendingFiles.map(file => (
                                        <div key={file.name} className="flex items-center justify-between p-2 border rounded-lg bg-secondary/50">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <FileIcon className="size-5 text-muted-foreground" />
                                                <span className="text-sm font-medium truncate">{file.name}</span>
                                            </div>
                                            <Button variant="ghost" size="icon" className="size-7 flex-shrink-0" onClick={() => removePendingFile(file.name)}>
                                                <X className="size-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <Button 
                                  className="w-full mt-4" 
                                  size="lg"
                                  onClick={processFiles}
                                  disabled={isProcessing}
                                >
                                  <Files className="mr-2 size-5" />
                                  Process {pendingFiles.length} File(s)
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <div className={cn(step >= 2 ? 'block' : 'hidden')}>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-secondary mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <PackageIcon className="size-6 text-primary" />
                        <div>
                            <p className="font-medium">{filesData.length} file(s) processed</p>
                            <p className="text-xs text-muted-foreground">{totalSelectedStudents} total student(s) selected</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={resetState} disabled={isProcessing}>
                        <RotateCw className="mr-2 size-4" />
                        Start Over
                    </Button>
                </div>
            </div>

            <div className={cn(step === 2 ? 'block' : 'hidden')}>
                <Card className="w-full shadow-lg border-primary/20">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary">
                        <Table className="size-6" />
                      </div>
                      <div>
                        <CardTitle>Select Templates Data</CardTitle>
                        <CardDescription>Review the data and select records for each file.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-end mb-4">
                        <div className="flex items-center space-x-2">
                            <Switch id="middle-initial-switch" checked={useMiddleInitial} onCheckedChange={setUseMiddleInitial} />
                            <Label htmlFor="middle-initial-switch">Use Middle Initial in Names</Label>
                        </div>
                    </div>

                    <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions} className="w-full">
                        {filesData.map((fileData) => {
                            const isKindergarten = fileData.fileInfo.gradeLevel === 'Kinder';
                            const filteredStudents = fileData.studentData.filter(
                                d =>
                                  d.Name.toLowerCase().includes(fileData.searchTerm.toLowerCase()) ||
                                  d.LRN.includes(fileData.searchTerm)
                            );
                            
                            return (
                            <AccordionItem value={fileData.id} key={fileData.id} className="border-b-0">
                                <AccordionTrigger className="hover:no-underline border rounded-lg px-4 bg-muted/50 data-[state=open]:rounded-b-none data-[state=open]:border-b-0">
                                    <div className='flex items-center justify-between w-full'>
                                        <div className='flex items-center gap-3'>
                                            <FileCheck className="size-5 text-green-600" />
                                            <div>
                                                <p className="font-semibold text-left">{fileData.fileName}</p>
                                                <p className="text-xs text-muted-foreground text-left">{fileData.fileInfo.gradeLevel} - {fileData.fileInfo.section} &bull; {fileData.selectedRows.size} / {fileData.studentData.length} selected</p>
                                            </div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="border rounded-lg rounded-t-none border-t-0 p-4">
                                     <div className="sticky top-36 z-20 mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur">
                                        <div className="relative max-w-sm w-full">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Filter by Name or LRN..."
                                                value={fileData.searchTerm}
                                                onChange={(e) => handleSearchTermChange(fileData.id, e.target.value)}
                                                className="pl-10"
                                            />
                                        </div>
                                        <Button 
                                            variant="outline"
                                            onClick={() => handleSelectAll(fileData.id, filteredStudents)}
                                        >
                                           {fileData.selectedRows.size === filteredStudents.length ? 'Deselect All' : 'Select All'} ({filteredStudents.length})
                                        </Button>
                                    </div>
                                    <div className="relative rounded-lg border max-h-[50vh] overflow-auto">
                                      <ShadTable>
                                        <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
                                          <TableRow>
                                            <TableHead className="sticky left-0 z-20 w-[50px] bg-background/95 text-center">
                                              <Checkbox
                                                checked={
                                                  filteredStudents.length > 0 && fileData.selectedRows.size === filteredStudents.length
                                                }
                                                onCheckedChange={() => handleSelectAll(fileData.id, filteredStudents)}
                                                aria-label="Select all rows for this file"
                                              />
                                            </TableHead>
                                            <TableHead className="text-center">LRN</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead className="text-center">Sex</TableHead>
                                            <TableHead className="text-center">Birthdate</TableHead>
                                            {isKindergarten && (
                                              <>
                                                <TableHead className="min-w-[170px]">Municipality</TableHead>
                                                <TableHead className="min-w-[220px]">Father&apos;s Name</TableHead>
                                                <TableHead className="min-w-[220px]">Mother&apos;s Name</TableHead>
                                              </>
                                            )}
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {filteredStudents.length > 0 ? (
                                            filteredStudents.map((student) => (
                                              <TableRow
                                                key={student.LRN}
                                                className={cn("cursor-pointer", fileData.selectedRows.has(student.LRN) && 'bg-primary/5')}
                                                onClick={() => handleRowSelection(fileData.id, student.LRN)}
                                              >
                                                <TableCell className="sticky left-0 z-10 text-center group-hover:bg-muted/50" style={{background: fileData.selectedRows.has(student.LRN) ? 'hsl(var(--primary)/0.05)' : 'hsl(var(--background))'}}>
                                                  <Checkbox
                                                    checked={fileData.selectedRows.has(student.LRN)}
                                                    onCheckedChange={() => handleRowSelection(fileData.id, student.LRN)}
                                                    aria-label={`Select row for ${student.Name}`}
                                                  />
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-center">{student.LRN}</TableCell>
                                                <TableCell className="font-medium">
                                                    {useMiddleInitial ? formatNameWithMiddleInitial(student.Name) : student.Name}
                                                </TableCell>
                                                <TableCell className="text-center">{student.Sex}</TableCell>
                                                <TableCell className="text-center">{student.Birthdate}</TableCell>
                                                {isKindergarten && (
                                                  <>
                                                    <TableCell onClick={(event) => event.stopPropagation()}>
                                                      <Input value={student.Municipality} placeholder="Municipality" onChange={(event) => handleStudentInfoChange(fileData.id, student.LRN, 'Municipality', event.target.value.toUpperCase())} aria-label={`Municipality for ${student.Name}`} />
                                                    </TableCell>
                                                    <TableCell onClick={(event) => event.stopPropagation()}>
                                                      <Input value={student.FatherName || ''} placeholder="Father's name" onChange={(event) => handleStudentInfoChange(fileData.id, student.LRN, 'FatherName', event.target.value.toUpperCase())} aria-label={`Father's name for ${student.Name}`} />
                                                    </TableCell>
                                                    <TableCell onClick={(event) => event.stopPropagation()}>
                                                      <Input value={student.MotherName || ''} placeholder="Mother's name" onChange={(event) => handleStudentInfoChange(fileData.id, student.LRN, 'MotherName', event.target.value.toUpperCase())} aria-label={`Mother's name for ${student.Name}`} />
                                                    </TableCell>
                                                  </>
                                                )}
                                              </TableRow>
                                            ))
                                          ) : (
                                            <TableRow>
                                              <TableCell colSpan={isKindergarten ? 8 : 5} className="h-24 text-center">
                                                No results found for &quot;{fileData.searchTerm}&quot;.
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </TableBody>
                                      </ShadTable>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )})}
                    </Accordion>

                    <div className="sticky bottom-4 z-20 mt-6 flex items-center justify-between rounded-2xl border bg-card/95 p-3 shadow-lg shadow-primary/10 backdrop-blur">
                        <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                        <Button onClick={() => setStep(3)} disabled={totalSelectedStudents === 0}>
                            Continue ({totalSelectedStudents}) <ChevronRight className="ml-2 size-4" />
                        </Button>
                    </div>
                  </CardContent>
                </Card>
            </div>

            <div className={cn(step === 3 ? 'block' : 'hidden')}>
                <Card className="shadow-lg border-primary/20">
                    <CardHeader className="bg-gradient-to-r from-primary/5 via-accent/10 to-transparent border-b pb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center justify-center size-12 rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-4 ring-primary/10">
                                    <Download className="size-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-xl font-bold">Finalize & Generate</CardTitle>
                                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-semibold text-xs px-2.5 py-0.5">
                                            Step 3 of 3
                                        </Badge>
                                    </div>
                                    <CardDescription className="text-sm mt-0.5">Finalize shared school details and generate your official DepEd SF9 report cards.</CardDescription>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-8 pt-6">
                       <div>
                          <h3 className="text-lg font-medium mb-3">Per-section Information</h3>
                          <p className="text-sm text-muted-foreground mb-3">This information is specific to each file and was extracted automatically. You can edit the adviser&apos;s name if needed.</p>
                          <div className="border rounded-lg overflow-hidden">
                            <ShadTable>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>File</TableHead>
                                        <TableHead className="text-center">Grade Level</TableHead>
                                        <TableHead className="text-center">Section</TableHead>
                                        <TableHead>
                                            <div className="flex items-center gap-1.5">
                                              <span>Adviser</span>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                  <p className="text-xs">Format: First Name Middle Initial Last Name (e.g. Juan D. Cruz)</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </div>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filesData.map(file => (
                                    <TableRow key={file.id}>
                                        <TableCell className="font-medium text-sm truncate max-w-xs">{file.fileName}</TableCell>
                                        <TableCell className="text-center font-medium">{file.fileInfo.gradeLevel}</TableCell>
                                        <TableCell className="text-center font-medium">{file.fileInfo.section}</TableCell>
                                        <TableCell>
                                            <Input value={file.fileInfo.adviser} placeholder="e.g. Juan D. Cruz" onChange={(e) => handleFileInfoChange(file.id, 'adviser', e.target.value)} />
                                        </TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </ShadTable>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-medium mb-3">Shared School Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="md:col-span-2 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Label htmlFor="school">School Name</Label>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="font-semibold text-xs">Formatting Requirement:</p>
                                      <p className="text-xs">Must be in <strong>UPPERCASE</strong>. Abbreviations (ES, NHS, IS, CS) automatically expand to full names (e.g. ES &rarr; ELEMENTARY SCHOOL).</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <Input id="school" value={sharedInfo.school} placeholder="e.g. SAN JOSE ELEMENTARY SCHOOL" onChange={(e) => handleSharedInfoChange('school', expandSchoolName(e.target.value))} className={cn(!sharedInfo.school && 'border-destructive')} />
                                <p className="text-[11px] text-muted-foreground font-medium">Format: <span className="font-semibold text-foreground">UPPERCASE</span> (e.g. SAN JOSE ELEMENTARY SCHOOL)</p>
                                <HistoryBadges items={previousInfo.school} onSelect={(value) => handleSharedInfoChange('school', value)} />
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Label htmlFor="schoolHead">School Head</Label>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="font-semibold text-xs">Formatting Requirement:</p>
                                      <p className="text-xs">Must be in <strong>UPPERCASE / ALL CAPS</strong> (e.g. JUAN DELA CRUZ).</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <Input id="schoolHead" value={sharedInfo.schoolHead} placeholder="e.g. JUAN DELA CRUZ" onChange={(e) => handleSharedInfoChange('schoolHead', e.target.value.toUpperCase())} className={cn(!sharedInfo.schoolHead && 'border-destructive')} />
                                <p className="text-[11px] text-muted-foreground font-medium">Format: <span className="font-semibold text-foreground">UPPERCASE</span> (e.g. JUAN DELA CRUZ)</p>
                                <HistoryBadges items={previousInfo.schoolHead} onSelect={(value) => handleSharedInfoChange('schoolHead', value)} />
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Label htmlFor="schoolHeadDesignation">School Head Designation</Label>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="text-xs">Select official DepEd position title for the School Head.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <Select value={sharedInfo.schoolHeadDesignation} onValueChange={(value) => handleSharedInfoChange('schoolHeadDesignation', value)}>
                                  <SelectTrigger id="schoolHeadDesignation" className={cn(!sharedInfo.schoolHeadDesignation && 'border-destructive')}>
                                    <SelectValue placeholder="Select Designation (e.g. Principal I)" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[200px]">
                                    <SelectItem value="T-1/Teacher-in-Charge">T-1/Teacher-in-Charge</SelectItem>
                                    <SelectItem value="T-II/Teacher-in-Charge">T-II/Teacher-in-Charge</SelectItem>
                                    <SelectItem value="T-III/Teacher-in-Charge">T-III/Teacher-in-Charge</SelectItem>
                                    <SelectItem value="Head Teacher I">Head Teacher I</SelectItem>
                                    <SelectItem value="Head Teacher II">Head Teacher II</SelectItem>
                                    <SelectItem value="Head Teacher III">Head Teacher III</SelectItem>
                                    <SelectItem value="Head Teacher IV">Head Teacher IV</SelectItem>
                                    <SelectItem value="Principal I">Principal I</SelectItem>
                                    <SelectItem value="Principal II">Principal II</SelectItem>
                                    <SelectItem value="Principal III">Principal III</SelectItem>
                                    <SelectItem value="Principal IV">Principal IV</SelectItem>
                                    <SelectItem value="Asst. School Principal I">Asst. School Principal I</SelectItem>
                                    <SelectItem value="Asst. School Principal II">Asst. School Principal II</SelectItem>
                                    <SelectItem value="Asst. School Principal III">Asst. School Principal III</SelectItem>
                                    <SelectItem value="Asst. School Principal IV">Asst. School Principal IV</SelectItem>
                                  </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground font-medium">Format: Select official designation</p>
                                <HistoryBadges items={previousInfo.schoolHeadDesignation} onSelect={(value) => handleSharedInfoChange('schoolHeadDesignation', value)} />
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Label htmlFor="region">Region</Label>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="text-xs">DepEd Administrative Region (auto-populated from SF1 K3 cell).</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <Select value={sharedInfo.region} onValueChange={(value) => handleSharedInfoChange('region', value)}>
                                  <SelectTrigger id="region" className={cn(!sharedInfo.region && 'border-destructive')}>
                                    <SelectValue placeholder="Select Region (e.g. Region V)" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-56">
                                    {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground font-medium">Format: DepEd Region Name (e.g. Region V)</p>
                                <HistoryBadges items={previousInfo.region} onSelect={(value) => handleSharedInfoChange('region', value)} />
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Label htmlFor="division">Division</Label>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="font-semibold text-xs">Formatting Requirement:</p>
                                      <p className="text-xs">Must be in <strong>UPPERCASE / ALL CAPS</strong>. Auto-populated from SF1 source cell T3.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <Input id="division" value={sharedInfo.division} placeholder="e.g. ALBAY" onChange={(e) => handleSharedInfoChange('division', e.target.value.toUpperCase())} className={cn(!sharedInfo.division && 'border-destructive')} />
                                <p className="text-[11px] text-muted-foreground font-medium">Format: <span className="font-semibold text-foreground">UPPERCASE</span> (e.g. ALBAY)</p>
                                <HistoryBadges items={previousInfo.division} onSelect={(value) => handleSharedInfoChange('division', value)} />
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Label htmlFor="district">District</Label>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="font-semibold text-xs">Formatting Requirement:</p>
                                      <p className="text-xs">Must be in <strong>Proper Case</strong> (Capitalize each word). Auto-extracted from SF1 AM3 cell.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <Input id="district" value={sharedInfo.district} placeholder="e.g. Oas North" onChange={(e) => handleSharedInfoChange('district', toProperCase(e.target.value))} className={cn(!sharedInfo.district && 'border-destructive')} />
                                <p className="text-[11px] text-muted-foreground font-medium">Format: <span className="font-semibold text-foreground">Proper Case</span> (e.g. Oas North)</p>
                                <HistoryBadges items={previousInfo.district} onSelect={(value) => handleSharedInfoChange('district', value)} />
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Label htmlFor="municipality">Municipality</Label>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="font-semibold text-xs">Formatting Requirement:</p>
                                      <p className="text-xs">Municipality or City name. Use <strong>Proper Case</strong>. Auto-extracted from SF1 U3 cell or inferred from student rows.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <Input id="municipality" value={sharedInfo.municipality} placeholder="e.g. Irosin" onChange={(e) => handleSharedInfoChange('municipality', toProperCase(e.target.value))} className={cn(!sharedInfo.municipality && 'border-destructive')} />
                                <p className="text-[11px] text-muted-foreground font-medium">Format: <span className="font-semibold text-foreground">Proper Case</span> (e.g. Irosin)</p>
                                <HistoryBadges items={previousInfo.municipality} onSelect={(value) => handleSharedInfoChange('municipality', value)} />
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Label htmlFor="schoolYear">School Year</Label>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="text-xs">Select academic school year (e.g. 2025-2026).</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <Select value={sharedInfo.schoolYear} onValueChange={(value) => handleSharedInfoChange('schoolYear', value)}>
                                  <SelectTrigger id="schoolYear" className={cn(!sharedInfo.schoolYear && 'border-destructive')}>
                                    <SelectValue placeholder="Select School Year (e.g. 2025-2026)" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-56">
                                    {schoolYears.map(year => (
                                      <SelectItem key={year} value={year}>{year}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground font-medium">Format: <span className="font-semibold text-foreground">YYYY-YYYY</span> (e.g. 2025-2026)</p>
                                <HistoryBadges items={previousInfo.schoolYear} onSelect={(value) => handleSharedInfoChange('schoolYear', value)} />
                              </div>

                              {hasKindergartenFiles && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <Label htmlFor="schoolYearStartDate">School Year Start Date</Label>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <p className="text-xs">Kindergarten BOSY age is calculated on this date. EOSY age is calculated exactly 10 calendar months later.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                  <Input
                                    id="schoolYearStartDate"
                                    type="date"
                                    value={sharedInfo.schoolYearStartDate}
                                    onChange={(event) => handleSharedInfoChange('schoolYearStartDate', event.target.value)}
                                    className={cn(!sharedInfo.schoolYearStartDate && 'border-destructive')}
                                  />
                                  <p className="text-[11px] text-muted-foreground font-medium">Suggested from the selected school year; SY 2026-2027 uses June 8, 2026. Adjust it when necessary.</p>
                                </div>
                              )}
                              
                              <div className="md:col-span-2 space-y-1.5">
                                <Label>School Logo</Label>
                                <div className="flex items-start gap-4">
                                  <div className="flex flex-col items-center gap-2">
                                    <Input id="logo-upload" ref={logoInputRef} type="file" className="hidden" accept="image/Bearer " onChange={handleLogoUpload} />
                                    {croppedLogo ? (
                                      <Image src={croppedLogo} alt="School Logo" width={64} height={64} className="rounded-md border p-1 bg-white" />
                                    ) : (
                                      <div className="flex items-center justify-center size-16 rounded-md border border-dashed"><p className="text-xs text-muted-foreground">No Logo</p></div>
                                    )}
                                    <div className="flex gap-2">
                                      <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                                        {croppedLogo ? 'Change' : 'Upload'}
                                      </Button>
                                      {croppedLogo && (
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="icon" className='size-8'>
                                                    <Trash2 className='size-4'/>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>Remove Logo?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will remove the logo from the current session and from your previously used logos. This action cannot be undone.
                                                </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleRemoveCurrentLogo}>Remove</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {previousLogos.length > 0 && (
                                    <div className='flex-1 space-y-1'>
                                      <p className="text-sm text-muted-foreground font-medium">Recently Used</p>
                                      <Carousel opts={{ align: "start", slidesToScroll: 'auto' }} className="w-full max-w-xs">
                                        <CarouselContent>
                                          {previousLogos.map((logo, index) => (
                                            <CarouselItem key={index} className="basis-1/3">
                                              <div className="p-1 relative group">
                                                 <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="icon" className='absolute -top-1 -right-1 size-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10'>
                                                            <X className='size-3'/>
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                        <AlertDialogTitle>Remove This Logo?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will remove the logo from your previously used logos. This action cannot be undone.
                                                        </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleRemovePreviousLogo(logo)}>Remove</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                                <Card className={cn("overflow-hidden cursor-pointer hover:border-primary", croppedLogo === logo && "border-2 border-primary")}>
                                                  <CardContent className="flex aspect-square items-center justify-center p-0" onClick={() => setCroppedLogo(logo)}>
                                                    <Image src={logo} alt={`Previous logo ${index + 1}`} width={80} height={80} className='object-cover w-full h-full'/>
                                                  </CardContent>
                                                </Card>
                                              </div>
                                            </CarouselItem>
                                          ))}
                                        </CarouselContent>
                                        <CarouselPrevious />
                                        <CarouselNext />
                                      </Carousel>
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground px-1">Optional. Recommended size: 1x1 aspect ratio.</p>
                              </div>

                              <div className="space-y-1.5">
                                <Label>Paper size selection</Label>
                                <RadioGroup defaultValue="Custom" value={paperSize} onValueChange={setPaperSize} className="flex items-center space-x-4 pt-1">
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="A4" id="A4" />
                                    <Label htmlFor="A4">A4</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="A5" id="A5" />
                                    <Label htmlFor="A5">A5</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Custom" id="Custom" />
                                    <Label htmlFor="Custom">Custom (4x8.5)</Label>
                                  </div>
                                </RadioGroup>
                                <p className="text-xs text-muted-foreground px-1">Please use 180 GSM and above paper only.</p>

                              </div>
                          </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium mb-3">Generation Options</h3>
                            <div className="space-y-3 rounded-lg border bg-muted/20 p-4 mb-4">
                                <div>
                                    <h4 className="font-medium text-foreground">Document Type</h4>
                                    <p className="text-sm text-muted-foreground">DOCX generation is currently active.</p>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border bg-background p-4 text-sm">
                                    <span className="font-semibold">DOCX</span>
                                    <span className="text-xs text-muted-foreground">{TOKENS_PER_STUDENT_FORM} tokens/student</span>
                                </div>
                            </div>
                             {uniqueGradeLevels.length > 0 ? (
                                <div className="space-y-4">
                                    {uniqueGradeLevels.map(gradeLevel => {
                                        const selectedUrl = selectedTemplateUrls[gradeLevel];
                                        const selectedTemplate = templates.find(t => t.download_url === selectedUrl);
                                        const previewFile = filesData.find(f => f.fileInfo.gradeLevel === gradeLevel);
                                        const sampleStudent = previewFile?.studentData.find(student => previewFile.selectedRows.has(student.LRN)) || null;
                                        return (
                                            <div key={gradeLevel} className="flex flex-col md:flex-row gap-6 justify-between items-center border p-4 rounded-xl bg-card hover:shadow-sm transition-shadow">
                                                <div className="flex-1 space-y-3 flex flex-col justify-center w-full">
                                                    <div className="flex items-center space-x-2">
                                                        <FileIcon className="size-5 text-primary" />
                                                        <Label className="font-bold text-base text-foreground">Grade {gradeLevel} Template</Label>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Select the official Word (.docx) template layout for Grade {gradeLevel}.</p>
                                                    
                                                    <Select
                                                        value={selectedUrl || ''}
                                                        onValueChange={(value) => setSelectedTemplateUrls(prev => ({...prev, [gradeLevel]: value}))}
                                                    >
                                                        <SelectTrigger className={cn("w-full bg-background", !selectedUrl && "border-destructive")}>
                                                            <SelectValue placeholder="Choose a template..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {isTemplatesLoading ? (
                                                                <SelectItem value="loading" disabled>Loading templates...</SelectItem>
                                                            ) : templates.length > 0 ? (
                                                                templates.map(template => (
                                                                    <SelectItem key={template.name} value={template.download_url}>
                                                                        {template.name}
                                                                    </SelectItem>
                                                                ))
                                                            ) : (
                                                                <SelectItem value="no-files" disabled>No templates available.</SelectItem>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    
                                                    {selectedTemplate && (
                                                        <div className="flex items-center space-x-1.5 text-xs text-green-600 font-medium">
                                                            <CheckCircle2 className="size-4" />
                                                            <span>Template mapped successfully</span>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="flex-shrink-0 flex items-center justify-center bg-muted/20 dark:bg-muted/5 p-3 rounded-lg border border-dashed w-full md:w-auto">
                                                    <TemplateStatusCard 
                                                        gradeLevel={gradeLevel} 
                                                        templateName={selectedTemplate?.name || null}
                                                        schoolLogo={croppedLogo}
                                                        schoolName={previewFile?.fileInfo.school || sharedInfo.school || ''}
                                                        adviserName={previewFile?.fileInfo.adviser || ''}
                                                        schoolHead={sharedInfo.schoolHead}
                                                        schoolHeadDesignation={sharedInfo.schoolHeadDesignation}
                                                        region={sharedInfo.region}
                                                        division={sharedInfo.division}
                                                        section={previewFile?.fileInfo.section || ''}
                                                        schoolYear={sharedInfo.schoolYear}
                                                        sampleStudent={sampleStudent}
                                                        selectedCount={previewFile?.selectedRows.size || 0}
                                                        templateUrl={selectedUrl || null}
                                                        fileData={previewFile || null}
                                                        sharedInfo={sharedInfo}
                                                        useMiddleInitial={useMiddleInitial}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No files processed to select templates.</p>
                            )}

                            <p className="text-xs text-muted-foreground px-1 mt-4 flex items-center gap-1.5">
                                <HelpCircle className="size-3.5 text-primary shrink-0" />
                                <span>Note: Back part of the School Form 9 is included on the last page of each generated document copy.</span>
                            </p>

                            <div className="sticky bottom-4 z-20 mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-primary/10 bg-card/95 p-4 shadow-xl shadow-primary/10 backdrop-blur md:flex-row">
                                <div className="flex items-center gap-3">
                                    <Button variant="outline" size="lg" onClick={() => setStep(2)} className="h-12 px-5 font-medium border-muted-foreground/20 hover:bg-muted">
                                        Back
                                    </Button>
                                    <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground border-l pl-4 py-1">
                                        <Badge variant="secondary" className="font-semibold bg-primary/10 text-primary hover:bg-primary/15">
                                            {totalSelectedStudents} Student{totalSelectedStudents !== 1 ? 's' : ''} Ready
                                        </Badge>
                                        <Badge variant="outline" className="font-medium">
                                            {paperSize} Size
                                        </Badge>
                                    </div>
                                </div>

                                <Button 
                                    onClick={() => setIsSummaryDialogOpen(true)} 
                                    disabled={isSF9ActionDisabled} 
                                    size="lg" 
                                    className="w-full md:w-auto h-14 px-8 text-base font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 rounded-xl"
                                >
                                    <FileText className="mr-2.5 size-5 animate-bounce" /> Generate School Form 9
                                </Button>
                            </div>
                        </div>

                    </CardContent>
                </Card>
            </div>
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
