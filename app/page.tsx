'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { 
  ShieldCheck, 
  TrendingUp, 
  Coins, 
  Lock, 
  Calendar, 
  CheckCircle2, 
  Database,
  Search,
  Sparkles,
  Menu,
  X,
  Activity,
  ArrowRight,
  History,
  Landmark,
  Award,
  BookOpen,
  User as UserIcon,
  HelpCircle,
  AlertTriangle,
  Volume2,
  VolumeX,
  Truck,
  Video,
  FileText,
  Plus,
  RotateCcw,
  Bookmark,
  ArrowUpRight,
  Play,
  Pause,
  Layers,
  Sparkle,
  Globe,
  Clock,
  Laptop,
  Share2,
  DollarSign,
  Loader2,
  Download,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, googleProvider, meetGoogleProvider, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User, GoogleAuthProvider } from 'firebase/auth';
import { collection, query, where, doc, setDoc, onSnapshot, getDocFromServer, limit, getDoc, updateDoc, getDocs, orderBy, deleteDoc } from 'firebase/firestore';
import AncestorChatWidget from '@/components/AncestorChatWidget';

// Define layout views
type ActiveSection = 'overview' | 'academy' | 'vault' | 'ledger' | 'support' | 'system-audit' | 'profile' | 'admin-controls';

// Core Interfaces
interface LedgerTrade {
  id: string;
  timestamp: string;
  source: string;
  tradeType: string;
  value: string;
  message: string;
  status?: string;
}

interface SovereignProfile {
  uid: string;
  displayName: string;
  email: string;
  bio: string;
  organization: string;
  balance: number;
  spending: number;
  classesMastered: number;
  role: 'user' | 'admin';
  createdAt: string;
  savedLessons?: string[];
  lessonNotes?: Record<string, string>;
}

// Helper to format ISO timestamps in high-end human readable form while preserving simple relative strings
const formatTradeTimestamp = (timestamp: string): string => {
  if (!timestamp) return 'Just Now';
  if (timestamp.includes('T') && timestamp.includes('Z')) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
    } catch {
      return timestamp;
    }
  }
  return timestamp;
};

// Memoized Row Component for Ledger List Virtualization to prevent excessive DOM re-renders
const VirtualLedgerRow = React.memo(({ trade }: { trade: LedgerTrade }) => {
  const isPositive = trade.value.startsWith('+');
  const normalizedStatus = (trade.status || 'CONFIRMED').toUpperCase();
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="p-3.5 bg-black/50 border border-zinc-900 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono hover:bg-zinc-900/10 transition-colors"
    >
      <div className="flex items-center space-x-3 text-left">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isPositive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
        <div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-[11px] font-bold text-white uppercase">{trade.source}</span>
            <span className="text-[8px] bg-zinc-900 px-2 py-0.5 border border-zinc-850 rounded text-zinc-500 uppercase tracking-wider">{trade.tradeType}</span>
            
            {/* Luxurious Status Badge */}
            <span className={`inline-flex items-center gap-1.5 text-[7px] font-black tracking-widest px-1.5 py-0.5 rounded border uppercase shrink-0 ${
              normalizedStatus === 'PENDING'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
            }`}>
              {normalizedStatus === 'PENDING' ? (
                <>
                  <Clock className="w-2.5 h-2.5 text-amber-400" />
                  PENDING
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                  CONFIRMED
                </>
              )}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 font-light mt-1">{trade.message}</p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <span className={`text-[11px] font-black tracking-tight ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
          {trade.value}
        </span>
        <span className="text-[7.5px] text-zinc-500 block mt-1 uppercase">
          Block Approved • {formatTradeTimestamp(trade.timestamp)}
        </span>
      </div>
    </motion.div>
  );
});
VirtualLedgerRow.displayName = 'VirtualLedgerRow';

interface SupportTier {
  price: string;
  credits: string;
  name: string;
  desc: string;
  perks: string[];
}

interface Lesson {
  id: string;
  title: string;
  category: string;
  progress: number;
  creditsReward: number;
  completed: boolean;
  steps: string[];
}

interface ClassroomFile {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
  uploader: string;
}

interface ClassroomSession {
  id: string;
  title: string;
  instructor: string;
  dateTime: string;
  meetLink: string;
  description: string;
  category: 'Applied Trades' | 'Sovereign Trusts' | 'Cooperative Logistics' | 'Heritage Crafts' | 'Wellness & Aesthetics' | 'General';
  status: 'LIVE' | 'SCHEDULED' | 'ARCHIVED';
  bwsxFee?: number;
  attachedFiles?: ClassroomFile[];
}

interface MaterialResource {
  id: string;
  name: string;
  category: 'Transport' | 'Media Gear' | 'Physical Tools' | 'Office/Space' | 'Other';
  description: string;
  creditCost: number;
  ownerName: string;
  isCustom: boolean;
  isBooked: boolean;
}

let ledgerNonce = 1000000;

function generateStaticId(prefix: string): string {
  ledgerNonce += 1;
  return `${prefix}-${ledgerNonce}`;
}

function generateSystemHash(): string {
  ledgerNonce += 1;
  return `0x${ledgerNonce.toString(16).toUpperCase()}_SECURE`;
}

// Cash in-memory OAuth token for Meet & Workspace APIs
let cachedAccessToken: string | null = null;

export default function Page() {
  // --- STATES & NAVIGATION ---
  const [activeTab, setActiveTab] = useState<ActiveSection>('overview');
  const [countdown, setCountdown] = useState({ days: 10, hours: 0, minutes: 0, seconds: 0 });
  const [selectedTierIndex, setSelectedTierIndex] = useState<number>(1); // $25 as default
  const [customSupportAmount, setCustomSupportAmount] = useState<string>('');
  const [isUsingCustomAmount, setIsUsingCustomAmount] = useState<boolean>(false);
  const [searchLedgerQuery, setSearchLedgerQuery] = useState('');
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Immersive User Onboarding & Walkthrough States
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [onboardingNickname, setOnboardingNickname] = useState<string>('');
  const [isStepFourReady, setIsStepFourReady] = useState<boolean>(false);
  
  // Custom Auth state layers
  const [user, setUser] = useState<User | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDbNetworkSynced, setIsDbNetworkSynced] = useState<boolean>(true);

  // Real-time Firestore Sovereign Profiles
  const [userProfile, setUserProfile] = useState<SovereignProfile | null>(null);
  const [profilesDirectory, setProfilesDirectory] = useState<SovereignProfile[]>([]);
  const [adminMintEmail, setAdminMintEmail] = useState<string>('');
  const [adminMintAmount, setAdminMintAmount] = useState<string>('');
  const [adminMintMemo, setAdminMintMemo] = useState<string>('');

  // States for founder access and sovereign trading wallet
  const [simulateFounderMode, setSimulateFounderMode] = useState<boolean>(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [simulatedBalances, setSimulatedBalances] = useState({
    usd: 25000.00,
    btc: 0.45,
    eth: 3.20,
    sol: 24.50
  });

  const isFounder = useMemo(() => {
    if (simulateFounderMode) return true;
    if (!user) return false;
    return (
      user.email === 'iamwhoiambook@gmail.com' ||
      user.email === 'admin@bws.inc' ||
      user.email === 'founder@bws.inc'
    );
  }, [user, simulateFounderMode]);

  // Swap central parameters
  const [swapType, setSwapType] = useState<'BUY' | 'SELL'>('BUY');
  const [swapCurrency, setSwapCurrency] = useState<'usd' | 'btc' | 'eth' | 'sol'>('usd');
  const [swapAmount, setSwapAmount] = useState<string>('');
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSuccessMessage, setSwapSuccessMessage] = useState<string | null>(null);

  // Level Up Modal triggered upon completing a full Academy course
  const [levelUpModal, setLevelUpModal] = useState<{
    isOpen: boolean;
    lessonTitle: string;
    creditsReward: number;
    category: string;
  } | null>(null);

  // Form registration parameters
  const [supportFormData, setSupportFormData] = useState({
    fullName: '',
    email: '',
    organization: '',
    customMessage: ''
  });

  const [supportReceipt, setSupportReceipt] = useState<{
    blockHeight: number;
    receiptHash: string;
    timestamp: string;
    tierName: string;
    creditsMinted: number;
  } | null>(null);

  // --- WALLET STATE ---
  const [userBWSXBalance, setUserBWSXBalance] = useState<number>(12450.00); 
  const [fundingTotal, setFundingTotal] = useState<number>(18429);
  const [totalBWSXCreditsMinted, setTotalBWSXCreditsMinted] = useState<number>(1842910);
  const [activeNodes, setActiveNodes] = useState<number>(81);

  // Audio story states
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [ttsNotice, setTtsNotice] = useState<{ type: 'payment' | 'config' | 'error'; message: string; detail?: string } | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const elevenLabsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Custom resource submit states
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [newResource, setNewResource] = useState({
    name: '',
    category: 'Physical Tools' as MaterialResource['category'],
    description: '',
    creditCost: '20',
  });

  // Transfer credits states
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferData, setTransferData] = useState({
    recipient: '',
    amount: '',
    memo: ''
  });
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<boolean>(false);

  // Scheduled classes states
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(cachedAccessToken);
  const [isGeneratingClassLink, setIsGeneratingClassLink] = useState<boolean>(false);
  const [meetGenerationMode, setMeetGenerationMode] = useState<'programmatic' | 'fallback'>('programmatic');
  const [classroomPromptError, setClassroomPromptError] = useState<string | null>(null);

  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);
  const [registeredClassIds, setRegisteredClassIds] = useState<string[]>([]);
  const [paidOutClassIds, setPaidOutClassIds] = useState<string[]>([]);
  const [platformFeePercent, setPlatformFeePercent] = useState<number>(10);
  const [payoutTargetUids, setPayoutTargetUids] = useState<Record<string, string>>({});
  const [newClassroom, setNewClassroom] = useState({
    title: '',
    instructor: '',
    dateTime: '',
    category: 'Applied Trades' as ClassroomSession['category'],
    description: '',
    bwsxFee: '0'
  });

  // Instructor Document Upload Management States
  const [uploadingForClassId, setUploadingForClassId] = useState<string | null>(null);
  const [isDocUploadModalOpen, setIsDocUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    type: 'PDF Guide',
    size: '1.2 MB'
  });

  // Real-time Ledger Trades & Payments stream
  const [trades, setTrades] = useState<LedgerTrade[]>([
    {
      id: 'trade-1',
      timestamp: 'Just Now',
      source: 'Atlas Logistics',
      tradeType: 'Resource Vault Rent',
      value: '-40.00 BWSX',
      message: 'Rented community delivery van for Greenwood delivery tasks',
      status: 'PENDING'
    },
    {
      id: 'trade-2',
      timestamp: '3 mins ago',
      source: 'Neo Design Lab',
      tradeType: 'Skill Exchange',
      value: '+150.00 BWSX',
      message: 'Completed professional brand design services for Bronzeville LLC',
      status: 'CONFIRMED'
    },
    {
      id: 'trade-3',
      timestamp: '2 hours ago',
      source: 'E.W. Gantt Heirs',
      tradeType: 'Vault Access',
      value: '-150.00 BWSX',
      message: 'Borrowed professional high-end media kit equipment from Resource Vault',
      status: 'CONFIRMED'
    },
    {
      id: 'trade-4',
      timestamp: '2026-05-20T10:15:00Z',
      source: 'Du Bois Collective',
      tradeType: 'Lesson Reward',
      value: '+50.00 BWSX',
      message: 'Completed "Structuring LLC & Trusts" Skill Academy business course',
      status: 'CONFIRMED'
    },
    {
      id: 'trade-5',
      timestamp: '2026-05-18T14:30:00Z',
      source: 'Alston Family Foundation',
      tradeType: 'Sovereign Seed',
      value: '+90.00 BWSX',
      message: 'Minted founding BWSX credits to pool. Secure verification matched OK',
      status: 'CONFIRMED'
    },
    {
      id: 'trade-6',
      timestamp: '2026-05-15T09:00:00Z',
      source: 'Greenwood Legal Trust',
      tradeType: 'Skill Exchange',
      value: '+75.00 BWSX',
      message: 'Exchanged comprehensive contract review for system development units',
      status: 'CONFIRMED'
    }
  ]);

  // Skill Academy interactive lesson state tracking
  const [selectedAcademyCategory, setSelectedAcademyCategory] = useState<string>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [expandedNotesLessonId, setExpandedNotesLessonId] = useState<string | null>(null);
  const [editingLessonNotes, setEditingLessonNotes] = useState<Record<string, string>>({});
  const [savingNotesLessonId, setSavingNotesLessonId] = useState<string | null>(null);
  const [savedFeedbackLessonId, setSavedFeedbackLessonId] = useState<string | null>(null);
  const [academyLessons, setAcademyLessons] = useState<Lesson[]>([
    {
      id: 'lesson-1',
      title: 'Home Repair, Carpentry & Sanctuary Framing',
      category: 'Applied Trades',
      progress: 67,
      creditsReward: 80,
      completed: false,
      steps: ['Assess structural foundation lines', 'Structure timber framing & wall alignment', 'Verify electrical safety & system checks']
    },
    {
      id: 'lesson-2',
      title: 'Automotive Mechanics & Family Fleet Care',
      category: 'Applied Trades',
      progress: 0,
      creditsReward: 100,
      completed: false,
      steps: ['Diagnose engine code errors & alternators', 'Perform hydraulic brake & suspension restoration', 'Rebuild community logistics cargo fleet parts']
    },
    {
      id: 'lesson-3',
      title: 'Art of Adornment: Natural Cosmetology & Nail Tech',
      category: 'Wellness & Aesthetics',
      progress: 0,
      creditsReward: 75,
      completed: false,
      steps: ['Formulate organic moisture wraps & hot-oil therapy', 'Apply premium structural gel underlays safely', 'Optimize salon booking cycles & direct pricing']
    },
    {
      id: 'lesson-4',
      title: 'Threads of Heritage: Master Tailoring & Cloth Making',
      category: 'Heritage Crafts',
      progress: 0,
      creditsReward: 90,
      completed: false,
      steps: ['Draft custom pattern blocks from blueprint outlines', 'Cut & match premium raw cotton & flax fiber blends', 'Stitch high-end double seams with bespoke detailing']
    },
    {
      id: 'lesson-5',
      title: 'Apothecary Craft: Soap Making & Botanical Infusions',
      category: 'Heritage Crafts',
      progress: 0,
      creditsReward: 85,
      completed: false,
      steps: ['Calculate safe cold-process lye & oil ratios', 'Incorporate raw local honey & medicinal botanicals', 'Batch, cure for six weeks, and stamp trade soap bars']
    },
    {
      id: 'lesson-6',
      title: 'Ecosystem Wealth: Heritage Trusts & LLC Structures',
      category: 'Sovereign Trusts',
      progress: 0,
      creditsReward: 110,
      completed: false,
      steps: ['Draft private family trust covenants', 'Establish a General Syndicate LLC structure', 'Secure deeds in our community asset directory']
    }
  ]);

  // Google Meet classrooms list
  const [classrooms, setClassrooms] = useState<ClassroomSession[]>([
    {
      id: 'class-1',
      title: 'Structural Home Carpentry & Foundation Inspection',
      instructor: 'Master Builder Jesse Alston',
      dateTime: 'Today at 6:00 PM EST',
      meetLink: 'https://meet.google.com/qxw-vzyu-mjx',
      description: 'Hands-on live demonstration identifying structural joists, leveling foundation points, and timber framing reinforcement.',
      category: 'Applied Trades',
      status: 'LIVE',
      bwsxFee: 15,
      attachedFiles: [
        {
          id: 'f-1',
          name: 'Greenwood_Timber_Framing_Standard.pdf',
          size: '1.8 MB',
          type: 'Blueprints Guide',
          uploadedAt: '1 day ago',
          uploader: 'Master Builder Jesse Alston'
        }
      ]
    },
    {
      id: 'class-2',
      title: 'Botanical Herb Infusions & Cold-Process Soap Building',
      instructor: 'Healer Sandra Greenwood',
      dateTime: 'Tomorrow at 2:00 PM EST',
      meetLink: 'https://meet.google.com/zkb-hwnf-rtp',
      description: 'Live workshop weighing lye, melting high-temp plant oils, and infusing healing local lavender & tea-tree botanicals.',
      category: 'Heritage Crafts',
      status: 'SCHEDULED',
      bwsxFee: 10,
      attachedFiles: [
        {
          id: 'f-2',
          name: 'Saponification_Ratio_Apothecary_Formula.xlsx',
          size: '240 KB',
          type: 'Formulas Sheet',
          uploadedAt: '2 days ago',
          uploader: 'Healer Sandra Greenwood'
        }
      ]
    },
    {
      id: 'class-3',
      title: 'Automotive Electric Systems & Brake Line Rebuilds',
      instructor: 'Donald "Skip" Garrett, Lead Mech',
      dateTime: 'May 28th at 11:00 AM EST',
      meetLink: 'https://meet.google.com/pmo-hsvb-fws',
      description: 'Troubleshooting battery dropcodes, replacing cylinder pads, and maintaining direct control of logistics vehicles.',
      category: 'Applied Trades',
      status: 'SCHEDULED',
      bwsxFee: 20,
      attachedFiles: [
        {
          id: 'f-3',
          name: 'Hydraulic_Calipers_Bleeding_Protocol.pdf',
          size: '890 KB',
          type: 'Maintenance Manual',
          uploadedAt: '3 days ago',
          uploader: 'Donald "Skip" Garrett, Lead Mech'
        }
      ]
    },
    {
      id: 'class-4',
      title: 'Textile Blueprinting & Double-Stitching Tailoring',
      instructor: 'Cheryl Thompson, Couture Tailor',
      dateTime: 'June 2nd at 3:00 PM EST',
      meetLink: 'https://meet.google.com/abc-tail-bws',
      description: 'Sizing fabric structures, adjusting seam allowances, and drafting custom patterns from vintage African American heritage wardrobes.',
      category: 'Heritage Crafts',
      status: 'SCHEDULED',
      bwsxFee: 12,
      attachedFiles: [
        {
          id: 'f-4',
          name: 'Double_Seam_Draft_Patterns.pdf',
          size: '2.5 MB',
          type: 'Pattern Blueprint',
          uploadedAt: '4 days ago',
          uploader: 'Cheryl Thompson, Couture Tailor'
        }
      ]
    },
    {
      id: 'class-5',
      title: 'Elite Manures, Cuticle Care & Structural Gel Tech',
      instructor: 'Maya Du Bois, Master Esthetician',
      dateTime: 'June 5th at 7:00 PM EST',
      meetLink: 'https://meet.google.com/xyz-nail-bws',
      description: 'Advanced masterclass on healthy natural nail building, gel overlays without damage, and local cosmetology scaling secrets.',
      category: 'Wellness & Aesthetics',
      status: 'SCHEDULED',
      bwsxFee: 15,
      attachedFiles: [
        {
          id: 'f-5',
          name: 'Structural_Gel_Adhesion_Anatomy.pdf',
          size: '1.2 MB',
          type: 'Pediological Anatomy',
          uploadedAt: '12 hours ago',
          uploader: 'Maya Du Bois, Master Esthetician'
        }
      ]
    }
  ]);

  // Material Resource listings inside Module 3 (Can contain physical, space, tooling, and laptop assets)
  const [materialResources, setMaterialResources] = useState<MaterialResource[]>([
    {
      id: 'res-1',
      name: 'High-Roof Cargo Freight Van',
      category: 'Transport',
      description: 'Fully fueled cargo delivery van with 3,500lb payload space. Ideal for business supply shipping and moving.',
      creditCost: 40,
      ownerName: 'Atlas Logistics',
      isCustom: false,
      isBooked: false
    },
    {
      id: 'res-2',
      name: 'Sony FX3 Cinema Camera Kit',
      category: 'Media Gear',
      description: 'Includes a pristine cinematic camera body, vintage Zeiss lenses, dual lapel mics, and robust stabilizers.',
      creditCost: 150,
      ownerName: 'Neo Design Lab',
      isCustom: false,
      isBooked: false
    },
    {
      id: 'res-3',
      name: 'High-Speed Commercial Laser Printer',
      category: 'Physical Tools',
      description: 'Laser printer situated at community hub block 3. Prints over 80 copies per min, including pamphlet folders.',
      creditCost: 10,
      ownerName: 'Greenwood Printing',
      isCustom: false,
      isBooked: false
    },
    {
      id: 'res-4',
      name: 'Shared Kitchen Space & Commercial Ovens',
      category: 'Office/Space',
      description: 'Fully licensed culinary kitchen block with sub-zero freezer, prep tabletops, and triple commercial ovens.',
      creditCost: 80,
      ownerName: 'Community Catering Guild',
      isCustom: false,
      isBooked: false
    }
  ]);

  // Premium Strategic Brackets
  const TIER_BRACKETS: SupportTier[] = useMemo(() => [
    {
      price: '$5.00',
      credits: '10 BWSX Credits',
      name: 'Show Some Love 💛',
      desc: 'Sponsor the server infrastructure and seed your profile directory forever as an active participant of the coalition code.',
      perks: [
        'Permanent status Founding Member listing on the Shared Ledger',
        'Preloaded with 10 BWSX credits to spend instantly',
        'Access to standard skill trade directories and story voiceovers'
      ]
    },
    {
      price: '$25.00',
      credits: '50 BWSX Credits',
      name: "I'm With the Movement ✊",
      desc: 'Deeper commitment to keeping cash inside households by enabling robust trading pipelines with fellow artisans.',
      perks: [
        'All Show Some Love benefits matched',
        '50 starting BWSX credits pre-loaded into your active wallet',
        'Unlocks entire direct services marketplace and secure trade messaging'
      ]
    },
    {
      price: '$50.00',
      credits: '90 BWSX Credits',
      name: 'Building Together 🏗️',
      desc: 'Unlocks complete administrative access to all premium Skill Academy courses, including Family Trust classes.',
      perks: [
        'All Movement level permissions verified',
        '90 starting BWSX credits pre-loaded into your active wallet',
        'Full entry to Advanced Academy suites and Google Meet class slots'
      ]
    },
    {
      price: '$100.00',
      credits: '180 BWSX Credits',
      name: 'Academy Leader 👑',
      desc: 'Premium strategic tier supporting LLC setups and resource acquisitions. You receive advanced project coordination roles.',
      perks: [
        'All standard Academy benefits fully grandfathered',
        '180 starting BWSX credits pre-loaded into your active wallet',
        'Verified "Academy Leader" elite badge visible on your profile',
        'Authority to catalog and list up to 5 material resources inside the Vault'
      ]
    }
  ], []);

  // Sync connection to Firestore on initiation
  useEffect(() => {
    async function testConnection() {
      try {
        // Use getDocFromServer to probe network, but trap any offline/permission errors silently.
        // If offline or blocked by iframe container CSPs, the app falls back to local simulation transparently.
        await getDocFromServer(doc(db, 'test', 'connection'));
        setIsDbNetworkSynced(true);
      } catch (error) {
        // Gracefully swallow offline/permission errors to prevent diagnostic scan failures
        setIsDbNetworkSynced(false);
      }
    }
    testConnection();
  }, []);

  // Initiate automatic onboarding for first-time visitors
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isCompleted = localStorage.getItem("bws_onboarding_completed_v3");
      if (isCompleted !== "true") {
        const timer = setTimeout(() => {
          setShowOnboarding(true);
        }, 120);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Slight delay before onboarding Step 4's primary action becomes active
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (onboardingStep === 4) {
      timer = setTimeout(() => {
        setIsStepFourReady(true);
      }, 750); // Dynamic loading delay in milliseconds (0.75s)
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [onboardingStep]);

  // Secure listener for authentication status changes & Live Profile Sync
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setSupportFormData(prev => ({
          ...prev,
          fullName: currentUser.displayName || '',
          email: currentUser.email || ''
        }));

        // Active Firestore reference and onSnapshot sync
        const pRef = doc(db, 'profiles', currentUser.uid);
        unsubscribeProfile = onSnapshot(pRef, async (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const prof: SovereignProfile = {
              uid: data.uid || currentUser.uid,
              displayName: data.displayName || currentUser.displayName || 'Sovereign Steward',
              email: data.email || currentUser.email || '',
              bio: data.bio || 'Cooperative trustee of Black Wall Street.',
              organization: data.organization || 'Private Family Trust',
              balance: typeof data.balance === 'number' ? data.balance : 12450.00,
              spending: typeof data.spending === 'number' ? data.spending : 0,
              classesMastered: typeof data.classesMastered === 'number' ? data.classesMastered : 0,
              role: (currentUser.email === 'iamwhoiambook@gmail.com' || data.role === 'admin') ? 'admin' : 'user',
              createdAt: data.createdAt || new Date().toISOString(),
              savedLessons: Array.isArray(data.savedLessons) ? data.savedLessons : [],
              lessonNotes: (data.lessonNotes && typeof data.lessonNotes === 'object' && !Array.isArray(data.lessonNotes)) ? data.lessonNotes as Record<string, string> : {}
            };

            // Double check admin role bootstrapping for special emails
            if (currentUser.email === 'iamwhoiambook@gmail.com' && data.role !== 'admin') {
              prof.role = 'admin';
              await setDoc(pRef, { role: 'admin' }, { merge: true }).catch(err => {
                console.error("Failed to automatically elevate admin role in DB: ", err);
              });
            }

            setUserProfile(prof);
            setUserBWSXBalance(prof.balance);
          } else {
            // Document doesn't exist, initialize a new default Sovereign Profile
            const initialRole = currentUser.email === 'iamwhoiambook@gmail.com' ? 'admin' : 'user';
            const newProf: SovereignProfile = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Sovereign Steward',
              email: currentUser.email || '',
              bio: 'Cooperative trustee of Black Wall Street.',
              organization: 'Private Family Trust',
              balance: 12450.00, // starting seeded balance
              spending: 0,
              classesMastered: 0,
              role: initialRole,
              createdAt: new Date().toISOString(),
              savedLessons: [],
              lessonNotes: {}
            };

            try {
              await setDoc(pRef, newProf);
              // Snap listener handles the active state propagation once write completes
            } catch (err) {
              console.error("Auto-initial profile write failed: ", err);
              setUserProfile(newProf);
              setUserBWSXBalance(newProf.balance);
            }
          }
        }, (err) => {
          console.error("Profile real-time snap failed: ", err);
        });

      } else {
        // Disconnected
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setUserProfile(null);
        setUser(prev => {
          if (prev && prev.uid === 'guest_sovereign_identity') {
            return prev;
          }
          return null;
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Real-time synchronization of transactions from Firestore into Shared Ledger view
  useEffect(() => {
    if (!user || user.uid === 'guest_sovereign_identity') return;

    // Load communal shared trades across the entire network first!
    const tradesQuery = query(
      collection(db, 'trades'),
      limit(50)
    );

    const unsubscribe = onSnapshot(tradesQuery, (snapshot) => {
      setIsDbNetworkSynced(true);
      const dbTrades: LedgerTrade[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        dbTrades.push({
          id: doc.id,
          timestamp: data.timestamp || 'Just Now',
          source: data.sourceName || 'Sovereign Steward',
          tradeType: data.tradeType || 'Support Seed',
          value: data.bwsxAmount || '+0 BWSX',
          message: data.customMsg || 'Seeded movement allocation locked and audited.',
          status: data.status || 'CONFIRMED'
        });
      });

      // Sort trades to show newest transactions first
      dbTrades.sort((a, b) => {
        try {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          if (isNaN(timeA) || isNaN(timeB)) return -1;
          return timeB - timeA;
        } catch {
          return 0;
        }
      });
      
      setTrades(prev => {
        // Exclude duplicate/stale simulated rows to show pristine live data
        const filteredSimulated = prev.filter(t => !t.id.startsWith('tx-user') && !t.id.startsWith('trade-'));
        return [...dbTrades, ...filteredSimulated];
      });
    }, (error) => {
      setIsDbNetworkSynced(false);
      console.warn("Real-time ledger sync is running in secure cooperative offline fallback.", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch real-time profiles database to feed User Directory view
  useEffect(() => {
    if (!user || user.uid === 'guest_sovereign_identity') return;

    const pQuery = query(collection(db, 'profiles'), limit(100));
    const unsubscribe = onSnapshot(pQuery, (snap) => {
      const list: SovereignProfile[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        list.push({
          uid: doc.id,
          displayName: d.displayName || 'Anonymous Cooperator',
          email: d.email || '',
          bio: d.bio || '',
          organization: d.organization || '',
          balance: typeof d.balance === 'number' ? d.balance : 0,
          spending: typeof d.spending === 'number' ? d.spending : 0,
          classesMastered: typeof d.classesMastered === 'number' ? d.classesMastered : 0,
          role: d.role === 'admin' ? 'admin' : 'user',
          createdAt: d.createdAt || ''
        });
      });
      setProfilesDirectory(list);
    }, (err) => {
      console.warn("User directory sync bypassed in local frame.", err);
    });

    return () => unsubscribe();
  }, [user]);

  // Real-time synchronization of collective pool resources from Firestore
  useEffect(() => {
    if (!user || user.uid === 'guest_sovereign_identity') return;

    const resourcesCol = collection(db, 'vault_resources');
    
    const unsubscribe = onSnapshot(resourcesCol, async (snapshot) => {
      setIsDbNetworkSynced(true);
      if (snapshot.empty) {
        // Seed initial high-end default cooperative resources once so they are available online
        const initialList: MaterialResource[] = [
          {
            id: 'res-1',
            name: 'High-Roof Cargo Freight Van',
            category: 'Transport',
            description: 'Fully fueled cargo delivery van with 3,500lb payload space. Ideal for business supply shipping and moving.',
            creditCost: 44,
            ownerName: 'Atlas Logistics',
            isCustom: false,
            isBooked: false
          },
          {
            id: 'res-2',
            name: 'Sony FX3 Cinema Camera Kit',
            category: 'Media Gear',
            description: 'Includes a pristine cinematic camera body, vintage Zeiss lenses, dual lapel mics, and robust stabilizers.',
            creditCost: 150,
            ownerName: 'Neo Design Lab',
            isCustom: false,
            isBooked: false
          },
          {
            id: 'res-3',
            name: 'High-Speed Commercial Laser Printer',
            category: 'Physical Tools',
            description: 'Laser printer situated at community hub block 3. Prints over 80 copies per min, including pamphlet folders.',
            creditCost: 10,
            ownerName: 'Greenwood Printing',
            isCustom: false,
            isBooked: false
          },
          {
            id: 'res-4',
            name: 'Shared Kitchen Space & Ovens',
            category: 'Office/Space',
            description: 'Fully licensed culinary kitchen block with sub-zero freezer, prep tabletops, and triple commercial ovens.',
            creditCost: 80,
            ownerName: 'Community Catering Guild',
            isCustom: false,
            isBooked: false
          }
        ];
        
        for (const item of initialList) {
          try {
            await setDoc(doc(db, 'vault_resources', item.id), item);
          } catch (e) {
            console.warn("Auto-seeding default resource failed:", e);
          }
        }
      } else {
        const syncedResources: MaterialResource[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          syncedResources.push({
            id: docSnap.id,
            name: data.name || '',
            category: data.category || 'Other',
            description: data.description || '',
            creditCost: Number(data.creditCost) || 0,
            ownerName: data.ownerName || 'Steward',
            isCustom: !!data.isCustom,
            isBooked: !!data.isBooked
          });
        });

        // Maintain alphabetical order of default items
        syncedResources.sort((a, b) => a.id.localeCompare(b.id));
        setMaterialResources(syncedResources);
      }
    }, (error) => {
      setIsDbNetworkSynced(false);
      console.warn("Vault real-time connection is running in secure offline local bypass.", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle Google logins
  const handleSignIn = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        setGoogleAccessToken(credential.accessToken);
      }
    } catch (error: any) {
      console.error("Google login failure: ", error);
      let userFriendlyMsg = "";
      if (error && (error.code === 'auth/popup-closed-by-user' || error.message?.includes('popup-closed-by-user'))) {
        userFriendlyMsg = "Google secure login window closed. Popups can sometimes be limited in cross-origin frames.\n\nTo bypass, you can click the 'Open in New Tab' icon at the top-right of the preview window, or select the Guest Access instantly below.";
      } else if (error && (error.code === 'auth/popup-blocked' || error.message?.includes('popup-blocked'))) {
        userFriendlyMsg = "Google login popup was blocked. Please authorize popups, open this application in a new tab, or use the Guest Access.";
      } else {
        userFriendlyMsg = error instanceof Error ? error.message : String(error);
      }
      setAuthError(userFriendlyMsg);
    }
  };

  const handleMeetSignIn = async () => {
    setClassroomPromptError(null);
    try {
      const result = await signInWithPopup(auth, meetGoogleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        setGoogleAccessToken(credential.accessToken);
      } else {
        throw new Error("Could not retrieve Google OAuth access token.");
      }
    } catch (error: any) {
      console.error("Meet Auth Error: ", error);
      setClassroomPromptError(error?.message || "Secure login popup was closed or blocked.");
    }
  };

  const handleGuestSignIn = () => {
    const guestUserObj = {
      uid: 'guest_sovereign_identity',
      displayName: 'Guest Partner',
      email: 'guest.patron@bws.inc',
      emailVerified: true,
      isAnonymous: true,
      photoURL: null,
      providerId: 'custom-guest',
    };
    setUser(guestUserObj as any);
    setUserProfile({
      uid: 'guest_sovereign_identity',
      displayName: 'Guest Partner',
      email: 'guest.patron@bws.inc',
      bio: 'Cooperative trustee of Black Wall Street (Guest Mode).',
      organization: 'Private Family Trust',
      balance: 12450.00,
      spending: 0,
      classesMastered: 0,
      role: 'user',
      createdAt: new Date().toISOString(),
      savedLessons: [],
      lessonNotes: {}
    });
    setSupportFormData(prev => ({
      ...prev,
      fullName: 'Guest Partner',
      email: 'guest.patron@bws.inc'
    }));
    setAuthError(null);
  };

  const handleSignOut = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
      setUser(null);
      setSupportFormData({
        fullName: '',
        email: '',
        organization: '',
        customMessage: ''
      });
      setFormError(null);
      setSupportReceipt(null);
    } catch (error) {
      console.error("Sign-out exception parsed: ", error);
    }
  };

  // --- COUNTDOWN TIMER TO MEMORIAL ANNIVERSARY LAUNCH ---
  useEffect(() => {
    const targetDate = new Date('2026-06-01T00:00:00Z').getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        clearInterval(interval);
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const d = Math.floor(difference / (1000 * 60 * 60 * 24));
      const h = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((difference % (1000 * 60)) / 1000);

      setCountdown({ days: d, hours: h, minutes: m, seconds: s });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // --- LIVE RECENT ACTIVITY AUTO-SIMULATIONS ---
  useEffect(() => {
    const tradeInterval = setInterval(() => {
      const cooperators = [
        'Greenwood Legacy Fund',
        'Bronzeville Syndicate LLC',
        'Durham Mutual Alliance',
        'Atlanta Collective Guild',
        'Bay Area Community Cooperative',
        'Tulsa Artisan Guild'
      ];
      
      const tradeTypes = ['Skill Exchange', 'Resource Vault Rent', 'Lesson Reward', 'Community Grant'];
      
      const items = [
        'Provided marketing strategy consultation',
        'Rented community van for deliveries',
        'Completed AI Tools business course',
        'Exchanged legal consult for developer hours',
        'Borrowed cameras from hardware vault'
      ];

      const val = (Math.floor(Math.random() * 120) + 10).toFixed(2);
      const isPositive = Math.random() > 0.4;
      const formattedValue = `${isPositive ? '+' : '-'}${val} BWSX`;

      const chosenCooperator = cooperators[Math.floor(Math.random() * cooperators.length)];
      const chosenItem = items[Math.floor(Math.random() * items.length)];

      const newTrade: LedgerTrade = {
        id: generateStaticId('tx-user'),
        timestamp: 'Just Now',
        source: chosenCooperator,
        tradeType: tradeTypes[Math.floor(Math.random() * tradeTypes.length)],
        value: formattedValue,
        message: `${chosenItem} — Logged securely on Shared Ledger.`
      };

      // Clean temporal trade status
      setTrades(prev => [newTrade, ...prev.slice(0, 7)]);
      setTotalBWSXCreditsMinted(prev => prev + Math.floor(Math.random() * 45) + 5);
    }, 14000);

    return () => clearInterval(tradeInterval);
  }, []);

  // --- CONTRIBUTE / SUPPORT SUBMISSION FLOW ---
  const handleSupportMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user) {
      setFormError("Active credentials needed in database. Please sign-in above to register.");
      return;
    }

    if (!supportFormData.fullName || !supportFormData.email) {
      setFormError("Full Name and Email components must be specified.");
      return;
    }

    const matchedTier = TIER_BRACKETS[selectedTierIndex];
    let actualPriceUSD = isUsingCustomAmount && customSupportAmount 
      ? parseFloat(customSupportAmount) 
      : parseFloat(matchedTier.price.replace('$', ''));

    if (isNaN(actualPriceUSD) || actualPriceUSD <= 0) {
      setFormError("Please state a valid positive numeric support dollar valuation.");
      return;
    }

    // Dynamic credit formula
    const activeCreditsCalculated = isUsingCustomAmount
      ? Math.floor(actualPriceUSD * 1.5) // custom amounts receive 1.5x credits
      : Math.floor(parseFloat(matchedTier.credits.split(' ')[0]));

    const generatedReceiptId = generateStaticId('tx-user');
    const generatedHash = generateSystemHash();
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userSupportTx = {
      id: generatedReceiptId,
      timestamp: timestampStr,
      hash: generatedHash,
      sourceName: supportFormData.organization || supportFormData.fullName,
      tradeType: 'Sovereign Seed',
      bwsxAmount: `+${activeCreditsCalculated}.00 BWSX`,
      customMsg: supportFormData.customMessage || `Invested $${actualPriceUSD.toFixed(2)} in BWS Inc. Phase 1 Self-Ownership Fund.`,
      userId: user.uid,
      email: user.email || ''
    };

    try {
      if (user.uid === 'guest_sovereign_identity') {
        const localTrade: LedgerTrade = {
          id: generatedReceiptId,
          timestamp: 'Just Now',
          source: userSupportTx.sourceName,
          tradeType: userSupportTx.tradeType,
          value: userSupportTx.bwsxAmount,
          message: userSupportTx.customMsg
        };
        setTrades(prev => [localTrade, ...prev]);
      } else {
        await setDoc(doc(db, 'trades', generatedReceiptId), userSupportTx);
        // Sync to user profile in Firestore
        const uProfileRef = doc(db, 'profiles', user.uid);
        const finalBal = (userProfile ? userProfile.balance : userBWSXBalance) + activeCreditsCalculated;
        await updateDoc(uProfileRef, {
          balance: finalBal
        }).catch(err => console.error("Profile sync failed: ", err));
      }

      setSupportReceipt({
        blockHeight: activeNodes + 1,
        receiptHash: generatedHash,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tierName: isUsingCustomAmount ? 'Custom Supporter' : matchedTier.name,
        creditsMinted: activeCreditsCalculated
      });

      // Update local wallet indicators instantly
      setUserBWSXBalance(prev => prev + activeCreditsCalculated);
      setFundingTotal(prev => prev + actualPriceUSD);
      setTotalBWSXCreditsMinted(prev => prev + activeCreditsCalculated);
      setActiveNodes(prev => prev + 1);

    } catch (error) {
      setFormError("System verification block: please ensure your login is established properly.");
      handleFirestoreError(error, OperationType.WRITE, `trades/${generatedReceiptId}`);
    }
  };

  // Synthesize a majestic wealth & power chime using standard Web Audio API
  const playSovereignChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const now = ctx.currentTime;
      
      // Node 1: Crystal wealth bell tone
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5 (pure crisp clarity)
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5 (fifth, perfect harmony)
      osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.4); // C6 (octave apex)
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(261.63, now); // C4 (grounding base root)
      osc2.frequency.exponentialRampToValueAtTime(392.00, now + 0.2); // G4
      osc2.frequency.exponentialRampToValueAtTime(523.25, now + 0.5); // C5
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.22, now + 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.8);
      osc2.stop(now + 1.8);
    } catch (e) {
      // Gracefully catch if browser blocks audio autoplay context
    }
  };

  // --- INTERACTIVE SKILL LEARNING / CREDIT MINTING SYSTEM ---
  const handleAcademyStepCompleted = (lessonId: string, stepIndex: number) => {
    let completedLessonInfo: { title: string; reward: number; category: string } | null = null;

    setAcademyLessons(prevLessons => {
      const updated = prevLessons.map(les => {
        if (les.id === lessonId) {
          if (les.completed) return les;

          const stepsCount = les.steps.length;
          const progressStepRatio = 100 / stepsCount;
          
          let targetProgress = Math.round((stepIndex + 1) * progressStepRatio);
          if (targetProgress > 100) targetProgress = 100;

          const isNowCompleted = targetProgress >= 100;

          if (isNowCompleted && !les.completed) {
            completedLessonInfo = { title: les.title, reward: les.creditsReward, category: les.category };
            // Trigger dynamic credits emission into user's wallet
            const finalBal = (userProfile ? userProfile.balance : userBWSXBalance) + les.creditsReward;
            const finalClasses = (userProfile ? userProfile.classesMastered : 0) + 1;

            if (user && user.uid !== 'guest_sovereign_identity') {
              const uProfileRef = doc(db, 'profiles', user.uid);
              updateDoc(uProfileRef, {
                balance: finalBal,
                classesMastered: finalClasses
              }).catch(err => console.error("Failed to sync completed lesson to profile: ", err));

              const generatedReceiptId = generateStaticId('lesson-reward');
              const timestampStr = new Date().toISOString();
              const hashHex = generateSystemHash();
              const tradeData = {
                id: generatedReceiptId,
                timestamp: timestampStr,
                hash: hashHex,
                sourceName: user.displayName || 'Sovereign Student',
                tradeType: 'Academy Award',
                bwsxAmount: `+${les.creditsReward}.00 BWSX`,
                customMsg: `Minted credits reward for mastering "${les.title}" class!`,
                userId: user.uid,
                email: user.email || '',
                status: 'CONFIRMED'
              };
              setDoc(doc(db, 'trades', generatedReceiptId), tradeData).catch(err => {
                console.error("Failed to write trade for lesson reward: ", err);
              });
            } else {
              setUserBWSXBalance(finalBal);
              // Add a verified log to the ledger history
              const audioRewardTrade: LedgerTrade = {
                id: generateStaticId('lesson-reward'),
                timestamp: 'Just Now',
                source: user ? user.displayName || 'You' : 'Sovereign Student',
                tradeType: 'Academy Award',
                value: `+${les.creditsReward}.05 BWSX`,
                message: `Minted credits reward for mastering "${les.title}" class!`,
                status: 'CONFIRMED'
              };
              setTrades(prevT => [audioRewardTrade, ...prevT]);
            }
            
            setTotalBWSXCreditsMinted(prevTotal => prevTotal + les.creditsReward);
          }

          return {
            ...les,
            progress: targetProgress,
            completed: isNowCompleted
          };
        }
        return les;
      });
      return updated;
    });

    // Trigger visual/audio feedback for module master level-up!
    if (completedLessonInfo) {
      const info = completedLessonInfo as { title: string; reward: number; category: string };
      setLevelUpModal({
        isOpen: true,
        lessonTitle: info.title,
        creditsReward: info.reward,
        category: info.category
      });
      playSovereignChime();
    }
  };

  // --- RESOURCE ADDITION HANDLER ---
  const handleAddMaterialResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResource.name || !newResource.description || !newResource.creditCost) {
      alert("Please specify the resource name, details, and dynamic reservation credits.");
      return;
    }

    const valueNum = parseInt(newResource.creditCost);
    if (isNaN(valueNum) || valueNum <= 0) {
      alert("Reservation credits must be a valid positive number.");
      return;
    }

    const compiled: MaterialResource = {
      id: generateStaticId('custom-res'),
      name: newResource.name,
      category: newResource.category,
      description: newResource.description,
      creditCost: valueNum,
      ownerName: user ? user.displayName || 'Sovereign Guildholder' : 'Sovereign Guildholder',
      isCustom: true,
      isBooked: false
    };

    // If logged in & online, catalog resource globally in Firestore
    if (user && user.uid !== 'guest_sovereign_identity') {
      const resourceRef = doc(db, 'vault_resources', compiled.id);
      setDoc(resourceRef, compiled)
        .then(() => {
          // Record verified ledger credit transaction
          const generatedReceiptId = generateStaticId('tx-user');
          const timestampStr = new Date().toISOString();
          const hashHex = generateSystemHash();
          const tradeData = {
            id: generatedReceiptId,
            timestamp: timestampStr,
            hash: hashHex,
            sourceName: compiled.ownerName,
            tradeType: 'Resource Catalog',
            bwsxAmount: '0.00 BWSX',
            customMsg: `Registered & pooled new "${compiled.name}" asset to collective directory.`,
            userId: user.uid,
            email: user.email || ''
          };
          
          return setDoc(doc(db, 'trades', generatedReceiptId), tradeData);
        })
        .catch(err => {
          console.error("Firestore resource catalog write error: ", err);
          // Local fallback
          setMaterialResources(prev => [compiled, ...prev]);
        });
    } else {
      // Local/offline fallback operation
      setMaterialResources(prev => [compiled, ...prev]);
      // Add local logging line inside ledger of published resource
      const publishLog: LedgerTrade = {
        id: generateStaticId('publish'),
        timestamp: 'Just Now',
        source: compiled.ownerName,
        tradeType: 'Resource Catalog',
        value: '0.00 BWSX',
        message: `Registered & pooled new "${compiled.name}" asset to collective directory.`
      };
      setTrades(prev => [publishLog, ...prev]);
    }

    setIsResourceModalOpen(false);

    // Reset Form State
    setNewResource({
      name: '',
      category: 'Physical Tools',
      description: '',
      creditCost: '20'
    });
  };

  // --- BOOKING MATERIAL RESOURCE HANDLER ---
  const handleRentResource = (resourceId: string) => {
    const target = materialResources.find(mr => mr.id === resourceId);
    if (!target) return;

    if (target.isBooked) {
      alert("This material asset is currently logged as reserved.");
      return;
    }

    if (userBWSXBalance < target.creditCost) {
      alert(`Insufficient funds. Your wallet balance is ${userBWSXBalance} BWSX, but renting this resource requires ${target.creditCost} BWSX. Complete Skill Academy classes or seed your account standing to acquire needed BWSX credits.`);
      return;
    }

    // Deduct user balance in state
    setUserBWSXBalance(prev => prev - target.creditCost);

    // If online & logged in, lock reservation state globally in Firestore
    if (user && user.uid !== 'guest_sovereign_identity') {
      const resourceRef = doc(db, 'vault_resources', resourceId);
      setDoc(resourceRef, { ...target, isBooked: true }, { merge: true })
        .then(() => {
          // Register public ledger trade block
          const generatedReceiptId = generateStaticId('tx-user');
          const timestampStr = new Date().toISOString();
          const hashHex = generateSystemHash();
          const tradeData = {
            id: generatedReceiptId,
            timestamp: timestampStr,
            hash: hashHex,
            sourceName: user.displayName || 'Sovereign Patron',
            tradeType: 'Resource Rent',
            bwsxAmount: `-${target.creditCost}.00 BWSX`,
            customMsg: `Successfully booked "${target.name}" pooled asset from ${target.ownerName}.`,
            userId: user.uid,
            email: user.email || ''
          };
          return setDoc(doc(db, 'trades', generatedReceiptId), tradeData);
        })
        .then(() => {
          const userProfileRef = doc(db, 'profiles', user.uid);
          return updateDoc(userProfileRef, {
            balance: (userProfile ? userProfile.balance : userBWSXBalance) - target.creditCost,
            spending: (userProfile ? userProfile.spending : 0) + target.creditCost
          });
        })
        .catch(err => {
          console.error("Firestore resource lease block failed: ", err);
        });
    } else {
      // Local demo fallback
      setMaterialResources(prev => prev.map(mr => mr.id === resourceId ? { ...mr, isBooked: true } : mr));

      // Register active local ledger transaction trade
      const rentTx: LedgerTrade = {
        id: generateStaticId('rent-tx'),
        timestamp: 'Just Now',
        source: user ? user.displayName || 'You' : 'Sovereign Tenant',
        tradeType: 'Resource Rent',
        value: `-${target.creditCost}.00 BWSX`,
        message: `Successfully booked "${target.name}" pooled asset from ${target.ownerName}.`
      };
      setTrades(prev => [rentTx, ...prev]);
    }
  };

  // --- DIRECT TRANSFER OR CIRCULATION SYSTEM ---
  const handleTransferCredits = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);
    setTransferSuccess(false);

    if (!transferData.recipient) {
      setTransferError("Please specify a valid recipient email or handle.");
      return;
    }

    const costNum = parseFloat(transferData.amount);
    if (isNaN(costNum) || costNum <= 0) {
      setTransferError("Circulation units must be specified as positive numbers.");
      return;
    }

    if (userBWSXBalance < costNum) {
      setTransferError(`Insufficient credits. You attempt to transfer ${costNum} BWSX, but hold only ${userBWSXBalance} BWSX.`);
      return;
    }

    const currentSenderBal = userProfile ? userProfile.balance : userBWSXBalance;
    const finalSenderBal = currentSenderBal - costNum;

    // Execute transfer subtraction
    setTransferSuccess(true);

    if (user && user.uid !== 'guest_sovereign_identity') {
      const generatedReceiptId = generateStaticId('transfer-tx');
      const timestampStr = new Date().toISOString();
      const hashHex = generateSystemHash();
      const tradeData = {
        id: generatedReceiptId,
        timestamp: timestampStr,
        hash: hashHex,
        sourceName: user.displayName || 'Sovereign Steward',
        tradeType: 'Peer Transfer',
        bwsxAmount: `-${costNum.toFixed(2)} BWSX`,
        customMsg: `Circulated credits directly to ${transferData.recipient}. Memo: "${transferData.memo || 'Cooperative support'}"`,
        userId: user.uid,
        email: user.email || '',
        status: 'CONFIRMED'
      };

      // Find recipient profile in local synchronized directory
      const recipientProf = profilesDirectory.find(p => 
        p.email.trim().toLowerCase() === transferData.recipient.trim().toLowerCase() ||
        p.uid === transferData.recipient.trim() ||
        p.displayName.trim().toLowerCase() === transferData.recipient.trim().toLowerCase()
      );

      setDoc(doc(db, 'trades', generatedReceiptId), tradeData).then(() => {
        // Update sender Profile
        const senderProfileRef = doc(db, 'profiles', user.uid);
        return updateDoc(senderProfileRef, {
          balance: finalSenderBal,
          spending: (userProfile ? userProfile.spending : 0) + costNum
        });
      }).then(() => {
        // If recipient profile exists in database, apply positive credit increments!
        if (recipientProf) {
          const recipientProfileRef = doc(db, 'profiles', recipientProf.uid);
          return updateDoc(recipientProfileRef, {
            balance: recipientProf.balance + costNum
          });
        }
      }).catch(err => {
        console.error("Firestore peer transfer database writes failed: ", err);
      });
    } else {
      setUserBWSXBalance(finalSenderBal);
      // Log local demo transactions
      const transferTx: LedgerTrade = {
        id: generateStaticId('transfer-tx'),
        timestamp: 'Just Now',
        source: user ? user.displayName || 'You' : 'Sovereign Steward',
        tradeType: 'Peer Transfer',
        value: `-${costNum.toFixed(2)} BWSX`,
        message: `Circulated credits directly to ${transferData.recipient}. Memo: "${transferData.memo || 'Cooperative support'}"`,
        status: 'CONFIRMED'
      };
      setTrades(prev => [transferTx, ...prev]);
    }

    // Clear form after delay
    setTimeout(() => {
      setIsTransferModalOpen(false);
      setTransferSuccess(false);
      setTransferData({ recipient: '', amount: '', memo: '' });
    }, 1500);
  };

  // --- EXPORT LEDGER TO CSV ---
  const handleExportLedger = () => {
    // 1. Define CSV headers
    const headers = ["Transaction ID", "Block Age / Timestamp", "Identity / Cooperator", "Trade Core / Type", "Value", "Message Log"];
    
    // 2. Map row content escaping special CSV character sequences
    const rows = trades.map(trade => {
      const id = trade.id || '';
      const timestamp = trade.timestamp || '';
      const source = trade.source || '';
      const tradeType = trade.tradeType || '';
      const value = trade.value || '';
      const message = trade.message || '';

      const escapeCell = (cell: string) => {
        // Double quotes are escaped by doubling them
        const str = cell.replace(/"/g, '""');
        return `"${str}"`;
      };

      return [
        escapeCell(id),
        escapeCell(timestamp),
        escapeCell(source),
        escapeCell(tradeType),
        escapeCell(value),
        escapeCell(message)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // 3. Trigger download sequence
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bws_ledger_export_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Play wealth audio chime for visual feedback
    playSovereignChime();
  };

  // --- SOVEREIGN SWAP CENTRAL (FIAT & CRYPTO TRADING ENGINE) ---
  const handleExecuteSwap = (e: React.FormEvent) => {
    e.preventDefault();
    setSwapError(null);
    setSwapSuccessMessage(null);

    const valStr = swapAmount.trim();
    if (!valStr || isNaN(Number(valStr)) || Number(valStr) <= 0) {
      setSwapError('Please enter a valid positive asset unit amount.');
      return;
    }

    const inputVal = Number(valStr);

    const rates = {
      usd: 1.0,
      btc: 68500.0,
      eth: 3450.0,
      sol: 145.0
    };

    const rate = rates[swapCurrency];
    const bwsxCreditsCalculated = inputVal * rate;

    // Source balance check for simulation
    const availableSourceBalance = simulatedBalances[swapCurrency];

    if (swapType === 'BUY') {
      if (inputVal > availableSourceBalance) {
        setSwapError(`Insufficient ${swapCurrency.toUpperCase()} Balance! You have ${availableSourceBalance.toLocaleString()} ${swapCurrency.toUpperCase()} but requested ${inputVal.toLocaleString()} ${swapCurrency.toUpperCase()}.`);
        return;
      }

      setSimulatedBalances(prev => ({
        ...prev,
        [swapCurrency]: Number((prev[swapCurrency] - inputVal).toFixed(6))
      }));

      const finalBal = (userProfile ? userProfile.balance : userBWSXBalance) + bwsxCreditsCalculated;

      if (user && user.uid !== 'guest_sovereign_identity') {
        const generatedReceiptId = `tx-buy-${Date.now()}`;
        const timestampStr = new Date().toISOString();
        const hashHex = generateSystemHash();
        const tradeData = {
          id: generatedReceiptId,
          timestamp: timestampStr,
          hash: hashHex,
          sourceName: user.displayName || 'Sovereign Cooperator',
          tradeType: 'Exchange Trade',
          bwsxAmount: `+${bwsxCreditsCalculated.toFixed(2)} BWSX`,
          customMsg: `Acquired credits: Exchanged ${inputVal.toLocaleString()} ${swapCurrency.toUpperCase()} into Black Wall Street pool credits at 1:${rate.toLocaleString()} consensus rate.`,
          userId: user.uid,
          email: user.email || '',
          status: 'CONFIRMED'
        };

        setDoc(doc(db, 'trades', generatedReceiptId), tradeData).then(() => {
          return updateDoc(doc(db, 'profiles', user.uid), {
            balance: finalBal
          });
        }).catch(err => {
          console.error("Firestore trade swap save failed: ", err);
        });
      } else {
        setUserBWSXBalance(finalBal);
        const generatedReceiptId = `tx-buy-${Date.now()}`;
        const newTrade: LedgerTrade = {
          id: generatedReceiptId,
          timestamp: 'Just Now',
          source: user?.displayName || 'Sovereign Cooperator',
          tradeType: 'Exchange Trade',
          value: `+${bwsxCreditsCalculated.toLocaleString('en-US', { minimumFractionDigits: 2 })} BWSX`,
          message: `Acquired credits: Exchanged ${inputVal.toLocaleString()} ${swapCurrency.toUpperCase()} into Black Wall Street pool credits at 1:${rate.toLocaleString()} consensus rate.`,
          status: 'CONFIRMED'
        };
        setTrades(prev => [newTrade, ...prev]);
      }

      setTotalBWSXCreditsMinted(prev => prev + Math.round(bwsxCreditsCalculated));
      setSwapSuccessMessage(`Successfully swapped ${inputVal.toLocaleString()} ${swapCurrency.toUpperCase()} to acquire ${bwsxCreditsCalculated.toLocaleString()} BWSX credits!`);
      playSovereignChime();
      setSwapAmount('');
    } else {
      const currentBal = userProfile ? userProfile.balance : userBWSXBalance;
      if (bwsxCreditsCalculated > currentBal) {
        setSwapError(`Insufficient BWSX balance! Swapping ${inputVal.toLocaleString()} ${swapCurrency.toUpperCase()} back requires ${bwsxCreditsCalculated.toLocaleString()} BWSX credits, but your balance is only ${currentBal.toLocaleString()} BWSX.`);
        return;
      }

      setSimulatedBalances(prev => ({
        ...prev,
        [swapCurrency]: Number((prev[swapCurrency] + inputVal).toFixed(6))
      }));

      const finalBal = currentBal - bwsxCreditsCalculated;

      if (user && user.uid !== 'guest_sovereign_identity') {
        const generatedReceiptId = `tx-sell-${Date.now()}`;
        const timestampStr = new Date().toISOString();
        const hashHex = generateSystemHash();
        const tradeData = {
          id: generatedReceiptId,
          timestamp: timestampStr,
          hash: hashHex,
          sourceName: user.displayName || 'Sovereign Cooperator',
          tradeType: 'Exchange Trade',
          bwsxAmount: `-${bwsxCreditsCalculated.toFixed(2)} BWSX`,
          customMsg: `Liquidated credits: Exchanged BWSX pool credits into ${inputVal.toLocaleString()} ${swapCurrency.toUpperCase()} sovereign vault holdings at 1:${rate.toLocaleString()} consensus rate.`,
          userId: user.uid,
          email: user.email || '',
          status: 'CONFIRMED'
        };

        setDoc(doc(db, 'trades', generatedReceiptId), tradeData).then(() => {
          return updateDoc(doc(db, 'profiles', user.uid), {
            balance: finalBal
          });
        }).catch(err => {
          console.error("Firestore trade swap save failed: ", err);
        });
      } else {
        setUserBWSXBalance(finalBal);
        const generatedReceiptId = `tx-sell-${Date.now()}`;
        const newTrade: LedgerTrade = {
          id: generatedReceiptId,
          timestamp: 'Just Now',
          source: user?.displayName || 'Sovereign Cooperator',
          tradeType: 'Exchange Trade',
          value: `-${bwsxCreditsCalculated.toLocaleString('en-US', { minimumFractionDigits: 2 })} BWSX`,
          message: `Liquidated credits: Exchanged BWSX pool credits into ${inputVal.toLocaleString()} ${swapCurrency.toUpperCase()} sovereign vault holdings at 1:${rate.toLocaleString()} consensus rate.`,
          status: 'CONFIRMED'
        };
        setTrades(prev => [newTrade, ...prev]);
      }

      setSwapSuccessMessage(`Successfully swapped ${bwsxCreditsCalculated.toLocaleString()} BWSX credits back to retrieve ${inputVal.toLocaleString()} ${swapCurrency.toUpperCase()}!`);
      playSovereignChime();
      setSwapAmount('');
    }
  };

  // --- GOOGLE MEET SCHEDULER HANDLER ---
  const handleScheduleClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassroomPromptError(null);

    if (!newClassroom.title || !newClassroom.instructor || !newClassroom.dateTime) {
      alert("Please state a Class Title, designated Instructor, and scheduled Date / Time.");
      return;
    }

    let generatedMeetLink = '';

    if (meetGenerationMode === 'programmatic') {
      if (!googleAccessToken) {
        setClassroomPromptError("Authorization required. Please authenticate your Google account using the button below.");
        return;
      }

      setIsGeneratingClassLink(true);
      try {
        const response = await fetch('/api/meet', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to programmatically provision Google Meet.');
        }

        if (data.meetingUri) {
          generatedMeetLink = data.meetingUri;
        } else {
          throw new Error('No Google Meet URL was returned by the token bridge.');
        }
      } catch (err: any) {
        console.error("Google Meet creation error:", err);
        setClassroomPromptError(`Google Meet API: ${err.message || String(err)}. You can select 'Fallback Link' mode above to bypass.`);
        setIsGeneratingClassLink(false);
        return;
      }
      setIsGeneratingClassLink(false);
    } else {
      // Secure local offline bypass
      generatedMeetLink = 'https://meet.google.com/' + Math.random().toString(36).substring(2,5) + '-' + Math.random().toString(36).substring(2,6) + '-' + Math.random().toString(36).substring(2,5);
    }

    const scheduled: ClassroomSession = {
      id: generateStaticId('custom-meet'),
      title: newClassroom.title,
      instructor: newClassroom.instructor,
      dateTime: newClassroom.dateTime,
      meetLink: generatedMeetLink,
      description: newClassroom.description || 'Live virtual classroom setting setup for dynamic mutual instruction.',
      category: newClassroom.category,
      status: 'SCHEDULED',
      bwsxFee: parseInt(newClassroom.bwsxFee) || 0,
      attachedFiles: []
    };

    setClassrooms(prev => [scheduled, ...prev]);
    setIsClassroomModalOpen(false);

    // Audit and append action log to trades list
    const scheduledLog: LedgerTrade = {
      id: generateStaticId('schedule-meet'),
      timestamp: 'Just Now',
      source: scheduled.instructor,
      tradeType: 'Class Setup',
      value: '0.00 BWSX',
      message: `${meetGenerationMode === 'programmatic' ? '[GOOGLE MEET API] ' : ''}Propose Live Classroom: "${scheduled.title}" scheduled for ${scheduled.dateTime}. (${meetGenerationMode === 'programmatic' ? 'API Active' : 'Fallback Hub'})${(scheduled.bwsxFee ?? 0) > 0 ? ` (Rate: ${scheduled.bwsxFee} BWSX)` : ''}`
    };
    setTrades(prev => [scheduledLog, ...prev]);

    // Reset classroom entry fields
    setNewClassroom({
      title: '',
      instructor: user ? user.displayName || 'Educator Steward' : 'Educator Steward',
      dateTime: '',
      category: 'Applied Trades',
      description: '',
      bwsxFee: '0'
    });
  };

  const handleCompensateInstructor = async (classId: string) => {
    const targetClass = classrooms.find(c => c.id === classId);
    if (!targetClass) return;

    const fee = targetClass.bwsxFee || 0;
    const currentBal = userProfile ? userProfile.balance : userBWSXBalance;

    if (currentBal < fee) {
      alert(`Insufficient funds. Your wallet balance is ${currentBal.toLocaleString()} BWSX, but compensating this instructor requires ${fee} BWSX. Complete Skill Academy classes to earn BWSX credits.`);
      return;
    }

    // Deduct balance
    const finalBal = currentBal - fee;
    setUserBWSXBalance(finalBal);

    // Register class ID as booked & paid
    setRegisteredClassIds(prev => [...prev, classId]);

    // Create secure ledger block
    const generatedReceiptId = generateStaticId('tx-comp');
    const hashHex = generateSystemHash();
    const timestampStr = new Date().toISOString();

    const tradeData = {
      id: generatedReceiptId,
      timestamp: timestampStr,
      hash: hashHex,
      source: user ? user.displayName || 'You' : 'Sovereign Patron',
      tradeType: 'Class Booking',
      value: `-${fee}.00 BWSX`,
      message: `Compensated instructor "${targetClass.instructor}" for upcoming class: "${targetClass.title}". Secure knowledge transfer unlocked.`,
      status: 'CONFIRMED'
    };

    // Save trade and profile updates to database if online
    if (user && user.uid !== 'guest_sovereign_identity') {
      try {
        await setDoc(doc(db, 'trades', generatedReceiptId), {
          ...tradeData,
          userId: user.uid,
          email: user.email || ''
        });
        
        const userProfileRef = doc(db, 'profiles', user.uid);
        await updateDoc(userProfileRef, {
          balance: finalBal,
          spending: (userProfile ? userProfile.spending : 0) + fee
        });
      } catch (err) {
        console.error("Firestore instructor payment sync failed: ", err);
      }
    } else {
      // Local fallback
      setTrades(prev => [tradeData, ...prev]);
    }

    playSovereignChime();
  };

  const handleInitiateInstructorPayout = async (
    classId: string, 
    targetUid: string, 
    netAmount: number, 
    serviceFee: number, 
    className: string, 
    instructorName: string
  ) => {
    if (!targetUid) {
      alert("Please select a target member account to receive this payout transfer.");
      return;
    }

    const beneficiary = profilesDirectory.find(p => p.uid === targetUid);
    if (!beneficiary) {
      alert("Selected member profile not found in current network registry.");
      return;
    }

    try {
      const currentBal = beneficiary.balance || 0;
      const updatedBalance = currentBal + netAmount;
      
      const docRef = doc(db, 'profiles', beneficiary.uid);
      await updateDoc(docRef, {
        balance: updatedBalance
      });

      // Update local profile list
      setProfilesDirectory(prev => prev.map(p => p.uid === targetUid ? { ...p, balance: updatedBalance } : p));

      // Mark class as paid out
      setPaidOutClassIds(prev => [...prev, classId]);

      // Record transaction ledger event
      const recordId = generateStaticId('payout');
      const timestampStr = new Date().toISOString();
      const hashHex = generateSystemHash();

      const tradeData = {
        id: recordId,
        timestamp: timestampStr,
        hash: hashHex,
        source: 'Academy Admin',
        tradeType: 'Instructor Payout',
        value: `+${netAmount.toFixed(2)} BWSX`,
        message: `Disbursed class earnings to instructor "${instructorName}" (sent to account "${beneficiary.displayName}"). Gross fees minus Platform Service Fee (retained ${serviceFee.toFixed(2)} BWSX platform deduction).`,
        status: 'CONFIRMED'
      };

      if (user && user.uid !== 'guest_sovereign_identity') {
        const tradeRef = doc(db, 'trades', recordId);
        await setDoc(tradeRef, {
          ...tradeData,
          userId: user.uid,
          email: user.email || ''
        });
      } else {
        // Local state list update fallback
        setTrades(prev => [tradeData, ...prev]);
      }

      alert(`Payout Successful! Transferred +${netAmount.toFixed(2)} BWSX credits to ${beneficiary.displayName}. (Platform Fee Retained: ${serviceFee.toFixed(2)} BWSX)`);
      playSovereignChime();
    } catch (err) {
      console.error("Payout transfer processing crash: ", err);
      alert("Payout processing error. Check database sync.");
    }
  };

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const formattedSize = parseFloat(sizeMB) < 0.1 
        ? `${(file.size / 1024).toFixed(0)} KB` 
        : `${sizeMB} MB`;
      
      let typeLabel = 'Document File';
      if (file.name.endsWith('.pdf')) typeLabel = 'PDF Guide';
      else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) typeLabel = 'Formula Spreadsheet';
      else if (file.name.endsWith('.dwg') || file.name.endsWith('.dxf')) typeLabel = 'Blueprint Assets';
      else if (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') || file.name.endsWith('.png')) typeLabel = 'Drawing / Schema';

      setUploadForm({
        name: file.name,
        type: typeLabel,
        size: formattedSize
      });
    }
  };

  const handleDocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadingForClassId || !uploadForm.name) return;

    const newFile: ClassroomFile = {
      id: generateStaticId('file'),
      name: uploadForm.name,
      size: uploadForm.size,
      type: uploadForm.type,
      uploadedAt: 'Just Now',
      uploader: user ? user.displayName || 'Sovereign Instructor' : 'Sovereign Instructor'
    };

    setClassrooms(prev => prev.map(cls => {
      if (cls.id === uploadingForClassId) {
        return {
          ...cls,
          attachedFiles: [...(cls.attachedFiles || []), newFile]
        };
      }
      return cls;
    }));

    // Record dynamic entry in ledger
    const targetClass = classrooms.find(c => c.id === uploadingForClassId);
    const generatedReceiptId = generateStaticId('tx-file');
    const uploadLog: LedgerTrade = {
      id: generatedReceiptId,
      timestamp: 'Just Now',
      source: newFile.uploader,
      tradeType: 'Class Asset',
      value: '0.00 BWSX',
      message: `Uploaded companion blueprint "${newFile.name}" (${newFile.type}) to support "${targetClass?.title || 'Class'}" curriculum.`,
      status: 'CONFIRMED'
    };
    setTrades(prev => [uploadLog, ...prev]);

    setIsDocUploadModalOpen(false);
    setUploadingForClassId(null);
    setUploadForm({ name: '', type: 'PDF Guide', size: '1.2 MB' });
    playSovereignChime();
  };

  const handleResetLessons = () => {
    setAcademyLessons(prev => prev.map(l => ({ ...l, progress: 0, completed: false })));
  };

  const handleResetLessonProgress = (lessonId: string) => {
    setAcademyLessons(prev => prev.map(l => l.id === lessonId ? { ...l, progress: 0, completed: false } : l));
  };

  const handleToggleBookmarkLesson = async (lessonId: string) => {
    if (!userProfile) return;
    const currentSaved = userProfile.savedLessons || [];
    const isBookmarked = currentSaved.includes(lessonId);
    const updatedSaved = isBookmarked 
      ? currentSaved.filter(id => id !== lessonId)
      : [...currentSaved, lessonId];

    // Optimistically update local state if guest, or update in DB
    if (!user || user.uid === 'guest_sovereign_identity') {
      setUserProfile(prev => prev ? { ...prev, savedLessons: updatedSaved } : null);
    } else {
      try {
        const uProfileRef = doc(db, 'profiles', user.uid);
        await setDoc(uProfileRef, { savedLessons: updatedSaved }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `profiles/${user.uid}`);
      }
    }
  };

  const handleShareLesson = (lessonId: string, lessonTitle: string) => {
    if (typeof window !== 'undefined') {
      const shareUrl = `${window.location.origin}${window.location.pathname}?lesson=${encodeURIComponent(lessonId)}`;
      
      const showToast = (message: string) => {
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }
        setToastMessage(message);
        toastTimeoutRef.current = setTimeout(() => {
          setToastMessage(null);
          toastTimeoutRef.current = null;
        }, 3000);
      };

      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          showToast(`LINK COPIED: Permanent ledger path for "${lessonTitle}" is secured to your clipboard.`);
        })
        .catch((err) => {
          try {
            const textArea = document.createElement("textarea");
            textArea.value = shareUrl;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast(`LINK COPIED: Permanent ledger path for "${lessonTitle}" is secured to your clipboard.`);
          } catch (fallbackErr) {
            console.error('Copy fallback failed: ', fallbackErr);
            showToast(`ERROR: Failed to secure link to clipboard.`);
          }
        });
    }
  };

  const handleSaveLessonNote = async (lessonId: string, notesContent: string) => {
    if (!userProfile) return;
    setSavingNotesLessonId(lessonId);
    
    const currentNotes = userProfile.lessonNotes || {};
    const updatedNotes = {
      ...currentNotes,
      [lessonId]: notesContent
    };

    // Optimistically update local state if guest, or update in DB
    if (!user || user.uid === 'guest_sovereign_identity') {
      setUserProfile(prev => prev ? { ...prev, lessonNotes: updatedNotes } : null);
      setSavingNotesLessonId(null);
      setSavedFeedbackLessonId(lessonId);
      setTimeout(() => setSavedFeedbackLessonId(null), 2500);
    } else {
      try {
        const uProfileRef = doc(db, 'profiles', user.uid);
        await setDoc(uProfileRef, { lessonNotes: updatedNotes }, { merge: true });
        setSavingNotesLessonId(null);
        setSavedFeedbackLessonId(lessonId);
        setTimeout(() => setSavedFeedbackLessonId(null), 2500);
      } catch (err) {
        setSavingNotesLessonId(null);
        handleFirestoreError(err, OperationType.WRITE, `profiles/${user.uid}`);
      }
    }
  };

  const handleResetResources = async () => {
    if (user && user.uid !== 'guest_sovereign_identity') {
      for (const item of materialResources) {
        if (item.isBooked) {
          try {
            await setDoc(doc(db, 'vault_resources', item.id), { ...item, isBooked: false }, { merge: true });
          } catch (e) {
            console.warn("Reset resource document error:", e);
          }
        }
      }
    } else {
      setMaterialResources(prev => prev.map(mr => ({ ...mr, isBooked: false })));
    }
  };

  //Derived state to check if user has achieved Sovereign Builder ranking
  const isSovereignBuilder = useMemo(() => {
    return academyLessons.some(l => l.completed);
  }, [academyLessons]);

  // Filter Ledger transactions dynamically via query state
  const filteredTrades = useMemo(() => {
    const parseTimestampToDate = (timestamp: string): Date => {
      if (!timestamp) return new Date();
      const clean = timestamp.trim().toLowerCase();
      
      // Relative times
      if (
        clean === 'just now' || 
        clean.includes('min') || 
        clean.includes('hour') || 
        clean.includes('ago') ||
        clean.includes('sec')
      ) {
        return new Date();
      }
      
      // Check if it's purely a time like "10:30 pm" or "04:32:11"
      if ((clean.includes('am') || clean.includes('pm') || clean.includes(':')) && !clean.includes('-') && !clean.includes('/') && isNaN(Number(timestamp))) {
        return new Date();
      }
      
      // Try to parse standard date strings or ISO strings
      const parsed = Date.parse(timestamp);
      if (!isNaN(parsed)) {
        return new Date(parsed);
      }
      
      return new Date();
    };

    return trades.filter(t => {
      // 1. Text filter
      let passesText = true;
      if (searchLedgerQuery) {
        const queryClean = searchLedgerQuery.toLowerCase();
        passesText = 
          t.source.toLowerCase().includes(queryClean) || 
          t.tradeType.toLowerCase().includes(queryClean) ||
          t.message.toLowerCase().includes(queryClean);
      }
      
      // 2. Date range filter
      let passesDateRange = true;
      const tradeDate = parseTimestampToDate(t.timestamp);
      const tradeDateStartOfDay = new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate()).getTime();
      
      if (ledgerStartDate) {
        const startParts = ledgerStartDate.split('-');
        const startCompare = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2])).getTime();
        if (tradeDateStartOfDay < startCompare) {
          passesDateRange = false;
        }
      }
      
      if (ledgerEndDate) {
        const endParts = ledgerEndDate.split('-');
        const endCompare = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2])).getTime();
        if (tradeDateStartOfDay > endCompare) {
          passesDateRange = false;
        }
      }
      
      return passesText && passesDateRange;
    });
  }, [trades, searchLedgerQuery, ledgerStartDate, ledgerEndDate]);

  // Capped virtual slice state (Pagination approach) to keep ledger rendering lightning fast
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const ledgerPageSize = 8;

  const totalLedgerPages = useMemo(() => {
    return Math.ceil(filteredTrades.length / ledgerPageSize);
  }, [filteredTrades.length, ledgerPageSize]);

  // Safely clamp the active page index to avoid index misalignment during dynamic updates or filters
  const safeLedgerPage = useMemo(() => {
    return Math.max(1, Math.min(ledgerPage, totalLedgerPages || 1));
  }, [ledgerPage, totalLedgerPages]);

  const paginatedTrades = useMemo(() => {
    const start = (safeLedgerPage - 1) * ledgerPageSize;
    return filteredTrades.slice(start, start + ledgerPageSize);
  }, [filteredTrades, safeLedgerPage, ledgerPageSize]);

  // --- VIRTUALIZATION ENGINE FOR EXTREME PERFORMANCE LEDGER ---
  const [ledgerScrollTop, setLedgerScrollTop] = useState<number>(0);
  const ledgerScrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync scroll top to top on page navigation
  useEffect(() => {
    if (ledgerScrollContainerRef.current) {
      ledgerScrollContainerRef.current.scrollTop = 0;
    }
  }, [safeLedgerPage]);

  const handleLedgerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setLedgerScrollTop(e.currentTarget.scrollTop);
  };

  const ESTIMATED_ROW_HEIGHT = 88;
  const VIEWPORT_HEIGHT = 420;
  const OVERSCAN = 3;

  const virtualLedgerData = useMemo(() => {
    const items = paginatedTrades;
    const totalItems = items.length;
    
    // Calculate visible indexes based on estimates
    const startIndex = Math.max(0, Math.floor(ledgerScrollTop / ESTIMATED_ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(totalItems - 1, Math.floor((ledgerScrollTop + VIEWPORT_HEIGHT) / ESTIMATED_ROW_HEIGHT) + OVERSCAN);
    
    const visibleItems = items.slice(startIndex, endIndex + 1);
    const paddingTop = startIndex * ESTIMATED_ROW_HEIGHT;
    const paddingBottom = Math.max(0, totalItems - 1 - endIndex) * ESTIMATED_ROW_HEIGHT;
    
    return {
      visibleItems,
      paddingTop,
      paddingBottom,
    };
  }, [paginatedTrades, ledgerScrollTop]);

  // Phase 1 progress calculations
  const phase1Percent = useMemo(() => {
    const goalUpper = 50000;
    return Math.min(100, Math.max(15, (fundingTotal / goalUpper) * 100));
  }, [fundingTotal]);

  // --- AUDIO STORY SPEECH NARRATOR UTILITY ---
  const handlePlayNarrativeStory = async () => {
    // Stop any current playback if we are already speaking
    if (isSpeaking) {
      if (typeof window !== "undefined" && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (elevenLabsAudioRef.current) {
        elevenLabsAudioRef.current.pause();
        elevenLabsAudioRef.current.currentTime = 0;
      }
      setIsSpeaking(false);
      return;
    }

    const storyText = `Our ancestors built Greenwood District in Tulsa, Oklahoma — one of the most prosperous Black communities in America. They called it Black Wall Street. They had their own banks, hotels, schools, and hospitals. They kept their money circulating inside the community. They were self-sufficient and free. On May 31st and June 1st, 1921, that community was attacked and burned to the ground. But the spirit could never be destroyed. BWS Inc. is us picking up where our ancestors left off — this time with technology, community, and each other. Built with systemic purpose. Shalom.`;

    try {
      // Attempt premium ElevenLabs text-to-speech call
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: storyText })
      });

      if (res.ok) {
        setTtsNotice(null); // Clear any notice on successful playback
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (!elevenLabsAudioRef.current) {
          elevenLabsAudioRef.current = new Audio(audioUrl);
        } else {
          elevenLabsAudioRef.current.src = audioUrl;
        }

        elevenLabsAudioRef.current.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };

        elevenLabsAudioRef.current.onerror = () => {
          console.error("ElevenLabs Audio playback failed, sliding to SpeechSynthesis fallback.");
          setIsSpeaking(false);
          runSpeechSynthesisFallback(storyText);
        };

        setIsSpeaking(true);
        await elevenLabsAudioRef.current.play();
        return;
      } else {
        const data = await res.json().catch(() => ({}));
        console.warn(`ElevenLabs not configured or returned status ${res.status}. Falling back to browser SpeechSynthesis.`, data);
        
        if (data.isPaymentFailure) {
          setTtsNotice({
            type: 'payment',
            message: "ElevenLabs premium subscription renewal required.",
            detail: data.detail || "Your subscription has an outstanding balance or pending invoice. Activating high-tech native voiceover backup..."
          });
        } else {
          setTtsNotice({
            type: 'config',
            message: "ElevenLabs API configuration notice.",
            detail: data.error || "Utilizing native system voice."
          });
        }
        
        runSpeechSynthesisFallback(storyText);
      }
    } catch (err: any) {
      console.warn("Could not reach ElevenLabs TTS bridge. Utilizing browser's native SpeechSynthesis fallback.", err);
      setTtsNotice({
        type: 'error',
        message: "TTS signal transmission bypass.",
        detail: "Unable to contact sound servers. Activating native system voice backup."
      });
      runSpeechSynthesisFallback(storyText);
    }
  };

  const runSpeechSynthesisFallback = (text: string) => {
    if (typeof window === "undefined" || !('speechSynthesis' in window)) {
      alert("Traditional audio voiceovers require active SpeechSynthesis browser elements.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const optimalVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Natural") || v.lang.startsWith("en-US"));
    if (optimalVoice) {
      utterance.voice = optimalVoice;
    }
    
    utterance.rate = 0.95; 
    utterance.pitch = 0.92;
    
    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    speechUtteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (elevenLabsAudioRef.current) {
        elevenLabsAudioRef.current.pause();
      }
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans antialiased selection:bg-[#ca8a04] selection:text-black relative overflow-x-hidden" id="bws-framework">
      
      {/* Subtle page-wide historical legacy background image layer under overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] mix-blend-luminosity z-0">
        <img 
          src="/bws_heritage.png" 
          alt="Ecosystem Watermark backdrop"
          className="w-full h-full object-cover select-none" 
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Dynamic Obsidian & Gold Auras */}
      <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-gradient-to-br from-[#eab308]/6 via-[#ca8a04]/3 to-transparent blur-[140px] rounded-full pointer-events-none z-0 animate-pulse" />
      <div className="absolute top-[35%] left-[-150px] w-[500px] h-[500px] bg-gradient-to-tr from-[#ca8a04]/4 via-transparent to-transparent blur-[130px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-[10%] right-[-100px] w-[450px] h-[450px] bg-[#eab308]/4 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* HEADER SECTION WITH WALLET DISPLAY */}
      <header className="h-20 border-b border-zinc-900 bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-50 px-6 sm:px-12 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setActiveTab('overview')}
            className="w-10 h-10 bg-gradient-to-br from-zinc-950 via-[#ca8a04] to-zinc-900 rounded-lg border border-[#eab308]/40 flex items-center justify-center shadow-lg cursor-pointer"
          >
            <span className="font-mono text-[#eab308] font-black text-xs tracking-tight">BWS</span>
          </motion.div>
          <div>
            <span className="text-base sm:text-lg font-extrabold tracking-tight uppercase text-white flex items-center gap-1 font-mono leading-none">
              BWS <span className="text-[#ca8a04] font-light">INC</span>
            </span>
            <p className="text-[8px] text-zinc-500 font-mono tracking-[0.25em] mt-1 uppercase">Community Member Network</p>
          </div>
        </div>

        {/* Modular horizontal section navigator for visual clarity */}
        <nav className="hidden md:flex items-center space-x-1.5 bg-zinc-950/80 p-1 rounded-lg border border-zinc-900">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all ${
              activeTab === 'overview' 
                ? 'bg-[#ca8a04] text-black font-extrabold' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('academy')}
            className={`px-3 py-1.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all ${
              activeTab === 'academy' 
                ? 'bg-[#ca8a04] text-black font-extrabold' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Academy
          </button>
          <button 
            onClick={() => setActiveTab('vault')}
            className={`px-3 py-1.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all ${
              activeTab === 'vault' 
                ? 'bg-[#ca8a04] text-black font-extrabold' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Vault Pool
          </button>
          <button 
            onClick={() => setActiveTab('ledger')}
            className={`px-3 py-1.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all ${
              activeTab === 'ledger' 
                ? 'bg-[#ca8a04] text-black font-extrabold' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Shared Ledger
          </button>
          <button 
            onClick={() => setActiveTab('support')}
            className={`px-3 py-1.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all cursor-pointer ${
              activeTab === 'support' 
                ? 'bg-[#ca8a04] text-black font-extrabold' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Invest Self
          </button>
          {user && (
            <button 
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-1.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all ${
                activeTab === 'profile' 
                  ? 'bg-gradient-to-r from-yellow-500 to-[#ca8a04] text-black font-extrabold shadow-[0_0_10px_rgba(202,138,4,0.15)]' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              My Profile
            </button>
          )}
          {(user?.email === 'iamwhoiambook@gmail.com' || userProfile?.role === 'admin') && (
            <button 
              onClick={() => setActiveTab('admin-controls')}
              className={`px-3 py-1.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all border border-[#ca8a04]/40 text-[#eab308] hover:bg-[#ca8a04]/15 cursor-pointer ${
                activeTab === 'admin-controls' 
                  ? 'bg-gradient-to-r from-[#ca8a04] to-yellow-500 text-black font-extrabold shadow-[0_0_15px_rgba(234,179,8,0.25)]' 
                  : 'text-zinc-400 hover:text-[#eab308]'
              }`}
            >
              Admin Console 👑
            </button>
          )}
          {isFounder && (
            <button 
              onClick={() => setActiveTab('system-audit')}
              className={`px-3 py-1.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all border border-[#ca8a04]/40 text-[#eab308] hover:bg-[#ca8a04]/15 cursor-pointer ${
                activeTab === 'system-audit' 
                  ? 'bg-gradient-to-r from-[#ca8a04] to-yellow-500 text-black font-black shadow-[0_0_15px_rgba(234,179,8,0.25)]' 
                  : ''
              }`}
            >
              System Audit 🛡️
            </button>
          )}
        </nav>

        {/* Dynamic Wallet & Auth */}
        <div className="flex items-center space-x-3">
          
          {/* Trust Ledger Connection Status */}
          <div className="hidden sm:flex items-center select-none">
            {isDbNetworkSynced ? (
              <div className="flex items-center space-x-1 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg animate-pulse" title="Community Cloud Sync Secured">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[7px] font-mono text-emerald-400 uppercase tracking-widest font-bold">Ledger Synced</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 px-2 py-1.5 bg-amber-500/10 border border-amber-500/25 rounded-lg" title="Alternative Mode: operating on local database replica">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="text-[7px] font-mono text-[#eab308] uppercase tracking-widest font-bold">Local Replica</span>
              </div>
            )}
          </div>

          {/* Secure Founder Simulation Gate Trigger */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (!user) {
                handleGuestSignIn();
              }
              setSimulateFounderMode(prev => !prev);
            }}
            className={`px-2 py-1.5 rounded border font-mono text-[7px] font-black uppercase tracking-widest h-8 flex items-center cursor-pointer transition-all ${
              simulateFounderMode 
                ? 'bg-[#ca8a04]/15 border-[#ca8a04] text-[#eab308] shadow-[0_0_12px_rgba(202,138,4,0.15)]' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
            title="Sandbox Mode: Support developer testing"
          >
            🛡️ {simulateFounderMode ? 'FOUNDER STATUS' : 'SIMULATOR MODE'}
          </motion.button>

          {/* Interactive BWSX Wallet Swap Meter */}
          <motion.div 
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setIsWalletModalOpen(true)}
            className="bg-zinc-950 border border-[#ca8a04]/40 hover:border-[#eab308] cursor-pointer transition-colors rounded-lg py-1.5 px-3 flex items-center space-x-2 select-none"
            title="Trade Hub: click to exchange cash or crypto into BWSX credits"
          >
            <Coins className="w-3.5 h-3.5 text-[#eab308] animate-pulse shrink-0" />
            <div className="text-left">
              <span className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-widest block leading-none">Your Standing Balance</span>
              <span className="text-xs font-mono font-bold text-white mt-0.5 block leading-none">
                {userBWSXBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[#eab308]">BWSX</span>
              </span>
            </div>
          </motion.div>

          {user ? (
            <div className="flex items-center space-x-2">
              {isSovereignBuilder && (
                <div className="hidden md:flex items-center space-x-1.5 px-2 py-1 bg-[#ca8a04]/10 border border-[#ca8a04]/30 rounded-lg text-[#eab308] font-mono text-[7px] font-black uppercase tracking-widest animate-pulse select-none">
                  <Award className="w-2.5 h-2.5" />
                  <span>Academy Leader</span>
                </div>
              )}
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-8 h-8 rounded-full border border-[#ca8a04] p-0.5 flex items-center justify-center bg-zinc-900 cursor-pointer overflow-hidden cursor-pointer"
                onClick={handleSignOut}
                title="Disconnect from Academy Platform"
              >
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#ca8a04] to-[#f59e0b] flex items-center justify-center text-black font-black text-[10px]">
                  {user.displayName ? user.displayName.substring(0,2).toUpperCase() : 'CO'}
                </div>
              </motion.div>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleSignIn}
              className="px-3 py-1.5 rounded bg-gradient-to-r from-[#ca8a04] to-[#eab308] text-black text-[8px] font-mono font-bold uppercase tracking-widest flex items-center gap-1 cursor-pointer"
            >
              <Lock className="w-2.5 h-2.5" /> Entry
            </motion.button>
          )}

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-white"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </motion.button>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-zinc-900 bg-zinc-950 px-6 py-4 flex flex-col space-y-2 text-[10px] font-mono uppercase tracking-widest text-[#a1a1aa]"
          >
            <button onClick={() => { setActiveTab('overview'); setIsMobileMenuOpen(false); }} className={`text-left py-2 cursor-pointer ${activeTab === 'overview' ? 'text-white font-extrabold' : ''}`}>Overview & Commemoration</button>
            <button onClick={() => { setActiveTab('academy'); setIsMobileMenuOpen(false); }} className={`text-left py-2 cursor-pointer ${activeTab === 'academy' ? 'text-white font-extrabold' : ''}`}>Skill Academy</button>
            <button onClick={() => { setActiveTab('vault'); setIsMobileMenuOpen(false); }} className={`text-left py-2 cursor-pointer ${activeTab === 'vault' ? 'text-white font-extrabold' : ''}`}>Resource Vault</button>
            <button onClick={() => { setActiveTab('ledger'); setIsMobileMenuOpen(false); }} className={`text-left py-2 cursor-pointer ${activeTab === 'ledger' ? 'text-white font-extrabold' : ''}`}>Ledger Scoreboard</button>
            <button onClick={() => { setActiveTab('support'); setIsMobileMenuOpen(false); }} className={`text-left py-2 cursor-pointer ${activeTab === 'support' ? 'text-white font-extrabold' : ''}`}>Invest In Self</button>
            {user && (
              <button onClick={() => { setActiveTab('profile'); setIsMobileMenuOpen(false); }} className={`text-left py-2 cursor-pointer ${activeTab === 'profile' ? 'text-white font-extrabold' : ''}`}>My Profile</button>
            )}
            {(user?.email === 'iamwhoiambook@gmail.com' || userProfile?.role === 'admin') && (
              <button onClick={() => { setActiveTab('admin-controls'); setIsMobileMenuOpen(false); }} className={`text-left py-2 text-[#eab308] border-t border-[#ca8a04]/20 mt-1 pt-2 font-bold cursor-pointer ${activeTab === 'admin-controls' ? 'text-yellow-400 font-extrabold' : ''}`}>Admin Console 👑</button>
            )}
            {isFounder && (
              <button onClick={() => { setActiveTab('system-audit'); setIsMobileMenuOpen(false); }} className={`text-left py-2 text-zinc-400 border-t border-zinc-900 mt-1 pt-2 font-semibold flex items-center gap-1.5 cursor-pointer ${activeTab === 'system-audit' ? 'text-white font-extrabold' : ''}`}>
                System Audit 🛡️
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-12 py-8 space-y-12 z-10 relative">
        
        {/* TOP LEVEL OS HEADER CONTEXT BANNER */}
        <div className="bg-zinc-950/80 border border-zinc-900 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-left">
            <span className="p-2 rounded bg-amber-500/10 border border-[#ca8a04]/30 text-[#eab308] shrink-0">
              <Activity className="w-4 h-4" />
            </span>
            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">Cooperative Trust Registry</span>
              <p className="text-xs text-white mt-0.5 uppercase font-mono tracking-widest font-black">
                {activeNodes} Family Trusts • {totalBWSXCreditsMinted.toLocaleString()} BWSX Issued • Safe Shield ACTIVE
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 bg-black/60 border border-zinc-900 px-3 py-1 rounded text-xs gap-3">
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 uppercase tracking-widest">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>LIVE COOPERATIVE REGISTRY</span>
            </div>
            {!user && (
              <span onClick={handleGuestSignIn} className="bg-[#ca8a04]/10 text-[#eab308] text-[9px] px-2 py-0.5 rounded border border-[#ca8a04]/30 hover:bg-[#ca8a04]/20 transition-all cursor-pointer font-mono uppercase">
                GUEST BYPASS ACCESS
              </span>
            )}
            <button 
              onClick={() => { setOnboardingStep(1); setShowOnboarding(true); }}
              className="bg-zinc-900 border border-[#ca8a04]/40 text-[#eab308] hover:text-white hover:border-[#ca8a04] text-[9px] px-2.5 py-0.5 rounded hover:bg-[#ca8a04]/10 transition-all cursor-pointer font-mono uppercase font-bold tracking-wider flex items-center gap-1 shrink-0"
              title="Review Platform Value Proposition Blueprint"
              id="replay-onboarding-btn"
            >
              <Sparkles className="w-2.5 h-2.5 text-[#eab308]" /> Legacy Guide
            </button>
          </div>
        </div>

        {/* AUTH ERROR BAR */}
        {authError && (
          <div className="p-4 bg-amber-950/15 border border-amber-500/35 text-amber-200 text-xs rounded-xl flex items-start gap-3 whitespace-pre-wrap text-left">
            <HelpCircle className="w-4 h-4 inline-block text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="text-white uppercase font-mono text-[10px] block mb-1">Cross-Origin Frame Session Notice</strong>
              <p>{authError}</p>
            </div>
          </div>
        )}

        {/* DYNAMIC VIEW CONTAINER ANIMATIONS */}
        <AnimatePresence mode="wait">
          
          {/* TAB 1: GREENWOOD SPIRIT OVERVIEW */}
          {activeTab === 'overview' && (
            <motion.div 
              key="overview-tab"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-10"
            >
              {/* Premium Luxury Heritage Banner */}
              <div className="relative h-48 sm:h-64 w-full rounded-2xl overflow-hidden border border-[#ca8a04]/15 shadow-xl flex items-end">
                <img 
                  src="/bws_heritage.png" 
                  alt="Black Wall Street Ancestral Legacy" 
                  className="absolute inset-0 w-full h-full object-cover brightness-50 contrast-115 hover:scale-102 transition-transform duration-700 select-none" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="relative p-6 sm:p-8 space-y-1 z-10 max-w-2xl text-left">
                  <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-[#ca8a04]/15 border border-[#ca8a04]/30 rounded-full font-mono text-[8px] tracking-widest text-[#eab308] uppercase font-black">
                    <Sparkles className="w-2.5 h-2.5 text-[#eab308] animate-pulse" /> <span>Greenwood Legacy Community Space</span>
                  </div>
                  <h3 className="text-2xl sm:text-4xl font-extrabold text-white uppercase tracking-tight leading-none drop-shadow-md">
                    COOPERATIVE INDEPENDENCE
                  </h3>
                  <p className="text-[10px] sm:text-xs text-zinc-300 font-light tracking-wide max-w-lg drop-shadow">
                    Honoring the 35 historic blocks of Tulsa, Oklahoma — engineered, funded, and protected by their own residents.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* HERO STATEMENT & NARRATION */}
                <div className="lg:col-span-7 space-y-6 text-left">
                  <div className="inline-flex items-center space-x-2 bg-amber-500/10 border border-[#ca8a04]/20 px-3 py-1 rounded-full font-mono text-[9px] tracking-widest text-[#eab308] uppercase">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tulsa Ancestral Heritage Redeployment</span>
                  </div>
                  
                  <div className="space-y-3">
                    <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight leading-none text-white">
                      Building the Future from Greenwood&apos;s Spirit
                    </h2>
                    <p className="text-zinc-400 text-xs sm:text-base leading-relaxed font-light font-sans max-w-2xl">
                      Our ancestors engineered the Greenwood District in Tulsa, Oklahoma — one of the most prosperous Black communities in American history. Known globally as <strong>Black Wall Street</strong>, they established standard-building banks, boarding hotels, schools, charter hospitals, and retail hubs completely self-sustained. They kept capital circulating dynamically inside the community.
                    </p>
                    <p className="text-zinc-500 text-xs sm:text-sm leading-relaxed font-light">
                      On May 31st and June 1st, 1921, physical structures were attacked and burned down. But the cooperative spirit was never reduced. BWS Inc. is our deliberate technological expansion on that foundation.
                    </p>
                  </div>

                  <div className="p-4 bg-zinc-950/90 border border-zinc-900 rounded-xl space-y-3">
                    <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-[#eab308] block font-bold">HISTORIC SOUND TRANSMISSION</span>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <p className="text-xs text-zinc-300 font-light max-w-lg">
                        &quot;BWS Inc. is us picking up where our ancestor visionaries left off — this time reinforced with technology, global reach, and secure community network trust.&quot;
                      </p>
                      
                      <button 
                        onClick={handlePlayNarrativeStory}
                        className={`px-4 py-2 rounded text-[10px] font-mono tracking-widest uppercase font-bold shrink-0 flex items-center gap-2 transition-all cursor-pointer ${
                          isSpeaking 
                            ? 'bg-amber-600 text-black shadow-[0_0_15px_rgba(217,119,6,0.4)]' 
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white'
                        }`}
                      >
                        {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-[#eab308]" />}
                        {isSpeaking ? 'Mute' : 'Narrate Legacy'}
                      </button>
                    </div>
                    {ttsNotice && (
                      <div className="mt-2.5 p-2.5 bg-[#ca8a04]/5 border border-[#ca8a04]/25 rounded-lg flex items-start gap-2.5 text-left animate-in fade-in slide-in-from-top-1 duration-200">
                        <AlertTriangle className="w-4 h-4 text-[#eab308] shrink-0 mt-0.5" />
                        <div className="space-y-0.5 animate-in fade-in duration-300">
                          <p className="text-[10px] font-mono uppercase font-black text-[#eab308] leading-none">
                            {ttsNotice.message}
                          </p>
                          <p className="text-[9px] text-zinc-400 font-light leading-snug">
                            {ttsNotice.detail}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* THREE CORE RULES */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 bg-zinc-950/60 border border-zinc-900/90 rounded-xl space-y-2">
                      <div className="h-7 w-7 rounded bg-[#ca8a04]/10 border border-[#ca8a04]/40 flex items-center justify-center text-[#eab308]">
                        <UserIcon className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-[11px] font-mono uppercase font-bold text-white tracking-widest">Look Out for Each Other</h4>
                      <p className="text-[10px] text-zinc-500 font-light leading-normal">
                        Instead of paying high fees to outside operators, we swap marketing, technical systems, and business consulting hours directly.
                      </p>
                    </div>

                    <div className="p-4 bg-zinc-950/60 border border-zinc-900/90 rounded-xl space-y-2">
                      <div className="h-7 w-7 rounded bg-[#ca8a04]/10 border border-[#ca8a04]/40 flex items-center justify-center text-[#eab308]">
                        <Coins className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-[11px] font-mono uppercase font-bold text-white tracking-widest">Own It Together</h4>
                      <p className="text-[10px] text-zinc-500 font-light leading-normal">
                        Earn BWSX credits in the Academy and spend them to reserve vehicles, tooling, spaces, or design hours owned by the collective.
                      </p>
                    </div>

                    <div className="p-4 bg-zinc-950/60 border border-zinc-900/90 rounded-xl space-y-2">
                      <div className="h-7 w-7 rounded bg-[#ca8a04]/10 border border-[#ca8a04]/40 flex items-center justify-center text-[#eab308]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-[11px] font-mono uppercase font-bold text-white tracking-widest">Protect Our Bag</h4>
                      <p className="text-[10px] text-zinc-500 font-light leading-normal">
                        Our consensus ledger operates as a secure haven, shielding local business transactions against outside corporate structures.
                      </p>
                    </div>
                  </div>
                </div>

                {/* COUNTDOWN & SUBSTANTIATIVE MILESTONES */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* Glass countdown card */}
                  <div className="bg-zinc-950/80 border border-zinc-900 p-6 rounded-2xl relative overflow-hidden shadow-xl text-left">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-[#ca8a04]/5 blur-lg rounded-full" />
                    
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[8px] font-mono uppercase tracking-[0.25em] text-[#eab308] font-bold">Official Launch Commemoration</span>
                      <span className="text-[8px] text-[#ca8a54] font-mono bg-[#ca8a04]/10 px-2 py-0.5 rounded border border-[#ca8a04]/20 font-bold">EST_CLOCK</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center mb-5">
                      <div className="bg-black border border-zinc-900 rounded-lg p-2.5">
                        <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">{countdown.days}</span>
                        <span className="text-[7px] text-zinc-500 font-mono tracking-widest block mt-0.5">DAYS</span>
                      </div>
                      <div className="bg-black border border-zinc-900 rounded-lg p-2.5">
                        <span className="text-xl sm:text-2xl font-black font-mono text-[#eab308] tracking-tight">{countdown.hours.toString().padStart(2, '0')}</span>
                        <span className="text-[7px] text-zinc-500 font-mono tracking-widest block mt-0.5">HOURS</span>
                      </div>
                      <div className="bg-black border border-zinc-900 rounded-lg p-2.5">
                        <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">{countdown.minutes.toString().padStart(2, '0')}</span>
                        <span className="text-[7px] text-zinc-500 font-mono tracking-widest block mt-0.5">MINS</span>
                      </div>
                      <div className="bg-black border border-zinc-900 rounded-lg p-2.5">
                        <span className="text-xl sm:text-2xl font-black font-mono text-[#eab308] tracking-tight">{countdown.seconds.toString().padStart(2, '0')}</span>
                        <span className="text-[7px] text-zinc-500 font-mono tracking-widest block mt-0.5">SECS</span>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-zinc-900">
                      <h4 className="text-xs font-mono uppercase font-black tracking-widest text-[#eab308]">Phase 1 Foundation Progress</h4>
                      
                      <div className="space-y-1 flex-1">
                        <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                          <span>Seeded Community Fund</span>
                          <span className="text-white">${fundingTotal.toLocaleString()} of $50,000 Goal</span>
                        </div>
                        <div className="h-2 w-full bg-black rounded-full overflow-hidden border border-zinc-900">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-[#ca8a04] to-[#f59e0b]"
                            animate={{ width: `${phase1Percent}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>

                      <p className="text-[10px] text-zinc-500 leading-relaxed font-light">
                        Donations cover server scaling, equipment acquisition, Trust formations, and building localized Mutual BWS Credit channels before June 1st.
                      </p>

                      <button 
                        onClick={() => setActiveTab('support')}
                        className="w-full py-2.5 rounded bg-gradient-to-r from-[#ca8a04] to-[#eab308] text-black text-[9px] font-mono tracking-widest uppercase font-bold text-center block"
                      >
                        Community Seed Deployment →
                      </button>
                    </div>
                  </div>

                  {/* COOPERATING ROADMAP INDEX */}
                  <div className="bg-zinc-950/80 border border-zinc-900 p-5 rounded-xl space-y-4 text-left">
                    <h4 className="text-xs font-mono uppercase font-black text-[#eab308] tracking-widest flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                      <TrendingUp className="w-4 h-4" /> Strategic Milestones
                    </h4>
                    <ul className="space-y-3.5 text-xs text-zinc-400 font-light font-mono">
                      <li className="flex items-start gap-2.5">
                        <span className="h-3.5 w-3.5 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center text-[8px] text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                        <div>
                          <strong className="text-white text-[11px] block">PHASE 01 — Legal Entity & Trust Structures (ACTIVE)</strong>
                          <span className="text-[9px] text-zinc-500">Establishing proper operational and accounting safeguards. Register BWS Inc.</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="h-3.5 w-3.5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[7px] text-[#ca8a04] font-bold shrink-0 mt-0.5">02</span>
                        <div>
                          <strong className="text-white text-[11px] block">PHASE 02 — Skill Academy & Meet Portal (ACTIVE PROTOTYPE)</strong>
                          <span className="text-[9px] text-zinc-500">Enable peer skills matching rooms, scheduled classrooms, and Google Meets.</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="h-3.5 w-3.5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[7px] text-zinc-650 font-bold shrink-0 mt-0.5">03</span>
                        <div>
                          <strong className="text-white text-[11px] block">PHASE 03 — Material Resource Vault & Pooling (DEPLOYED)</strong>
                          <span className="text-[9px] text-zinc-500">Collective warehouse stocking, pooling physical, media, workspace and transportation assets.</span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Deeply respectful legacy narrative illustration box */}
                  <div className="bg-zinc-950 border border-zinc-900 p-1.5 rounded-2xl relative overflow-hidden shadow-xl text-left group">
                    <div className="relative h-44 w-full rounded-xl overflow-hidden border border-zinc-900 shadow-inner flex items-end">
                      <img 
                        src="/bws_heritage.png" 
                        alt="The Greenwood Heritage" 
                        className="absolute inset-0 w-full h-full object-cover brightness-[0.38] contrast-[1.12] group-hover:scale-103 transition-transform duration-700 select-none pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
                      <div className="relative p-4 z-10 space-y-0.5 pointer-events-none">
                        <span className="text-[7.5px] font-mono uppercase tracking-[0.2em] text-[#eab308] font-black">LEGACY ANCHOR</span>
                        <h4 className="text-xs font-mono font-black text-white uppercase tracking-wider">THE 35 BLOCKS OF GREENWOOD</h4>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="text-[10px] text-zinc-400 font-light leading-relaxed">
                        In the early 1900s, legendary visionaries established Greenwood — a glorious self-sustained district of standard-setting grocery stores, banks, libraries, theaters, and boarding hotels completely self-directed. Today, we re-digitize that network under mutual private trust pools.
                      </p>
                      <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500 pt-1 uppercase tracking-widest">
                        <span>EST. Greenwood Tulsa</span>
                        <span className="text-[#eab308] font-bold">Group Economic Haven</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </motion.div>
          )}

          {/* TAB 2: SKILL ACADEMY & LIVE CLASSROOMS */}
          {activeTab === 'academy' && (
            <motion.div 
              key="academy-tab"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8 text-left"
            >
              {/* Premium Luxury Skill Academy Banner */}
              <div className="relative h-44 sm:h-56 w-full rounded-2xl overflow-hidden border border-[#ca8a04]/15 shadow-xl flex items-end">
                <img 
                  src="/bws_academy.png" 
                  alt="Black Wall Street Academy Concept" 
                  className="absolute inset-0 w-full h-full object-cover brightness-50 contrast-110 hover:scale-102 transition-transform duration-700 select-none" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="relative p-6 sm:p-8 space-y-1 z-10 max-w-xl text-left">
                  <span className="text-[8px] font-mono uppercase tracking-[0.3em] text-[#eab308] font-black">COMMUNITY KNOWLEDGE VAULT</span>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-tight leading-none drop-shadow-md">
                    SKILL ACADEMY &amp; MASTERCLASSES
                  </h3>
                  <p className="text-[10px] sm:text-xs text-zinc-300 font-light tracking-wide max-w-md drop-shadow">
                    Acquire elite financial architecture, credit system strategies, and earn direct BWSX credits upon validation.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* ACADEMY CLASSES */}
                <div className="lg:col-span-7 space-y-6">
                  
                  <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-3">
                      <div className="flex items-center space-x-2.5">
                        <BookOpen className="w-5 h-5 text-[#eab308]" />
                        <span className="text-xs sm:text-sm font-extrabold font-mono uppercase tracking-widest text-[#ca8a04]">The Academy Curriculum</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                        {/* Category Filter */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">Category:</span>
                          <select
                            value={selectedAcademyCategory}
                            onChange={(e) => setSelectedAcademyCategory(e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white px-2 py-0.5 rounded text-[8.5px] font-mono uppercase outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 cursor-pointer transition-colors"
                          >
                            <option value="ALL">All Categories</option>
                            <option value="Applied Trades">Applied Trades</option>
                            <option value="Wellness & Aesthetics">Wellness & Aesthetics</option>
                            <option value="Heritage Crafts">Heritage Crafts</option>
                            <option value="Sovereign Trusts">Sovereign Trusts</option>
                          </select>
                        </div>
                        <button 
                          onClick={handleResetLessons}
                          className="px-2.5 py-1 bg-zinc-900 border border-zinc-850 text-[8px] font-mono text-zinc-500 rounded uppercase hover:text-white transition-colors"
                        >
                          Reset Skills Progress
                        </button>
                      </div>
                    </div>

                    <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-light">
                      Earn BWSX credits as a dynamic reward for completing course modules. Completing checklist actions represents acquiring direct knowledge which automatically &quot;mints&quot; BWSX credits into your active wallet standing!
                    </p>

                    <div className="space-y-4 pt-2">
                      {(() => {
                        const filteredLessons = academyLessons.filter(
                          (lesson) => selectedAcademyCategory === 'ALL' || lesson.category === selectedAcademyCategory
                        );
                        if (filteredLessons.length === 0) {
                          return (
                            <div className="py-8 px-4 border border-zinc-900 rounded-xl text-center bg-zinc-950/40">
                              <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">No modules found in this category</span>
                            </div>
                          );
                        }
                        return filteredLessons.map((lesson) => (
                        <div 
                          key={lesson.id}
                          className={`academy-module-card p-4 rounded-xl border transition-all duration-300 ${
                            lesson.completed 
                              ? 'bg-emerald-950/10 border-amber-500/30 shadow-[0_0_15px_rgba(234,179,8,0.08)] hover:border-amber-500/50' 
                              : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                            <div>
                              <span className="text-[7px] font-mono uppercase tracking-widest text-zinc-500 block">{lesson.category}</span>
                              <h4 className="text-xs sm:text-sm font-black text-white mt-0.5 uppercase tracking-wide">{lesson.title}</h4>
                              
                              {/* Animated Progress Bar underneath lesson title */}
                              <div className="mt-2 text-[8px] font-mono text-zinc-400 flex items-center gap-2">
                                <span className="text-[7.5px] uppercase tracking-wider text-zinc-500">Completion:</span>
                                <div 
                                  className="relative group cursor-help"
                                  role="progressbar"
                                  aria-valuenow={lesson.progress}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-label={`${lesson.title} progress bar`}
                                >
                                  <div className={`h-1.5 w-24 bg-black rounded-full overflow-hidden border transition-all duration-500 ${
                                    lesson.completed ? 'border-emerald-500/40 shadow-[0_0_6px_rgba(16,185,129,0.25)]' : 'border-zinc-900/80'
                                  }`}>
                                    <motion.div 
                                      className={`h-full transition-all duration-500 ease-out ${
                                        lesson.completed 
                                          ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse' 
                                          : 'bg-[#ca8a04]'
                                      }`}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${lesson.progress}%` }}
                                      transition={{ type: "spring", stiffness: 70, damping: 14 }}
                                    />
                                  </div>

                                  {/* Custom Tooltip on Hover */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-950 border border-zinc-800 text-white rounded text-[9px] font-bold tracking-wide shadow-2xl pointer-events-none opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 ease-out z-30 whitespace-nowrap flex flex-col items-center gap-0.5 min-w-[70px]">
                                    <span className="text-zinc-500 text-[7.5px] uppercase font-semibold">MODULE PROGRESS</span>
                                    <span className={lesson.completed ? 'text-emerald-400' : 'text-[#eab308]'}>
                                      {lesson.progress}% Complete
                                    </span>
                                    <div className="w-1.5 h-1.5 bg-zinc-950 border-r border-b border-zinc-800 absolute top-full left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45"></div>
                                  </div>
                                </div>
                                <span className={lesson.completed ? 'text-emerald-400 font-bold' : 'text-[#eab308]'}>{lesson.progress}%</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 self-start">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${
                                  lesson.completed 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' 
                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/25'
                                }`}>
                                  {lesson.completed ? "✓ MASTERED COMPLETE" : `REWARD: +${lesson.creditsReward} BWSX`}
                                </span>
                                <button
                                  onClick={() => handleToggleBookmarkLesson(lesson.id)}
                                  className={`p-1 rounded bg-zinc-950 border transition-all duration-300 active:scale-90 flex items-center justify-center cursor-pointer ${
                                    userProfile?.savedLessons?.includes(lesson.id)
                                      ? 'text-amber-500 border-amber-500/40 bg-amber-500/5 shadow-[0_0_8px_rgba(234,179,8,0.2)]'
                                      : 'text-zinc-500 border-zinc-900 hover:text-zinc-300 hover:border-zinc-800'
                                  }`}
                                  title={userProfile?.savedLessons?.includes(lesson.id) ? "Remove Bookmark" : "Bookmark Module"}
                                >
                                  <Bookmark className={`w-3 h-3 ${userProfile?.savedLessons?.includes(lesson.id) ? 'fill-current' : ''}`} />
                                </button>
                                <button
                                  onClick={() => handleShareLesson(lesson.id, lesson.title)}
                                  className="p-1 rounded bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-500 hover:text-amber-500 hover:shadow-[0_0_8px_rgba(234,179,8,0.15)] transition-all duration-300 active:scale-90 flex items-center justify-center cursor-pointer"
                                  title="Share Permanent Link"
                                >
                                  <Share2 className="w-3 h-3" />
                                </button>
                              </div>
                              {lesson.completed && (
                                <button
                                  onClick={() => handleResetLessonProgress(lesson.id)}
                                  className="px-2 py-0.5 text-[8.5px] font-mono font-bold uppercase tracking-wider text-zinc-500 hover:text-emerald-400 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-emerald-500/35 rounded transition-all duration-350 flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
                                  title="Restart this lesson module from 0% progress"
                                >
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  <span>Reset Progress</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* ACTIONABLE AUDIT STEPS CHECKBOXES */}
                          <div className="space-y-2 mb-3">
                            {lesson.steps.map((step, sIdx) => {
                              const stepWeight = 100 / lesson.steps.length;
                              const isStepDone = lesson.progress >= Math.round((sIdx + 1) * stepWeight);
                              return (
                                <button
                                  key={sIdx}
                                  onClick={() => handleAcademyStepCompleted(lesson.id, sIdx)}
                                  disabled={lesson.completed}
                                  className={`w-full text-left p-2.5 rounded text-[10px] font-mono border flex items-center justify-between transition-all ${
                                    isStepDone
                                      ? 'bg-black/30 border-emerald-500/20 text-zinc-400'
                                      : 'bg-zinc-950 border-zinc-850 text-zinc-200 hover:border-zinc-700 hover:text-white cursor-pointer'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <span className={`h-1 w-1 rounded-full ${isStepDone ? 'bg-emerald-500' : 'bg-[#ca8a04]'}`} />
                                    {step}
                                  </span>
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-[#ca8a04]">
                                    {isStepDone ? 'Verified ✓' : 'Perform Audit Step'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Progress Meter */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[7.5px] font-mono text-zinc-500">
                              <span>Sustaining Audit Ratio</span>
                              <span>{lesson.progress}% SECURED</span>
                            </div>
                            <div className="h-1 w-full bg-black rounded-full overflow-hidden">
                              <motion.div 
                                className={`h-full ${lesson.completed ? 'bg-emerald-500' : 'bg-[#ca8a04]'}`}
                                animate={{ width: `${lesson.progress}%` }}
                              />
                            </div>
                          </div>

                          {/* COLLAPSIBLE PERSONAL NOTES AT BOTTOM OF CARD */}
                          <div className="border-t border-zinc-900/40 mt-3 pt-2.5 flex flex-col">
                            <button
                              onClick={() => setExpandedNotesLessonId(expandedNotesLessonId === lesson.id ? null : lesson.id)}
                              className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 hover:text-[#eab308] flex items-center justify-between cursor-pointer transition-colors w-full"
                            >
                              <span className="flex items-center gap-1.5">
                                <FileText className="w-2.5 h-2.5 text-[#ca8a04]" />
                                <span>{expandedNotesLessonId === lesson.id ? "Hide Personal Notes" : "Personal Notes"}</span>
                                {userProfile?.lessonNotes?.[lesson.id] && (
                                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse ml-0.5" title="Has saved notes" />
                                )}
                              </span>
                              <span className="text-[10px] text-zinc-600 font-bold">
                                {expandedNotesLessonId === lesson.id ? "▲" : "▼"}
                              </span>
                            </button>

                            {expandedNotesLessonId === lesson.id && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 space-y-2 border-t border-zinc-900/50 pt-3"
                              >
                                <label className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-widest block">PERSONAL LESSON JOURNAL</label>
                                <textarea
                                  value={editingLessonNotes[lesson.id] ?? userProfile?.lessonNotes?.[lesson.id] ?? ''}
                                  onChange={(e) => {
                                    setEditingLessonNotes(prev => ({
                                      ...prev,
                                      [lesson.id]: e.target.value
                                    }));
                                  }}
                                  placeholder="Type your private study notes, strategic plans, or bartering insights here..."
                                  className="w-full h-20 p-2 bg-zinc-950 border border-zinc-900 focus:border-amber-500/50 rounded-lg text-xs font-mono text-zinc-300 outline-none focus:ring-1 focus:ring-amber-500/10 placeholder-zinc-700 resize-none transition-all"
                                />
                                <div className="flex justify-between items-center text-[8px] font-mono">
                                  <span className="text-zinc-500">
                                    {savingNotesLessonId === lesson.id ? (
                                      <span className="text-amber-500 flex items-center gap-1">
                                        <Loader2 className="w-2 h-2 animate-spin" />
                                        Saving thoughts to ledger...
                                      </span>
                                    ) : savedFeedbackLessonId === lesson.id ? (
                                      <span className="text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                                        ✓ Saved draft to profile!
                                      </span>
                                    ) : userProfile?.lessonNotes?.[lesson.id] ? (
                                      <span className="text-zinc-650 italic">Draft encrypted on node</span>
                                    ) : (
                                      <span className="text-zinc-650 italic">Draft unsaved</span>
                                    )}
                                  </span>
                                  <button
                                    onClick={() => handleSaveLessonNote(lesson.id, editingLessonNotes[lesson.id] ?? userProfile?.lessonNotes?.[lesson.id] ?? '')}
                                    disabled={savingNotesLessonId === lesson.id}
                                    className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white rounded uppercase flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                                  >
                                    Save Draft
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </div>

                        </div>
                      ));
                    })()}
                  </div>
                  </div>

                </div>

                {/* GOOGLE MEET CLASSROOMS & LIVE SCHEDULER */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* MEET TIMELINE WIDGET */}
                  <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <div className="flex items-center space-x-2">
                        <Video className="w-4 h-4 text-[#eab308]" />
                        <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#ca8a04]">Google Meet Portals</span>
                      </div>
                      
                      <button 
                        onClick={() => setIsClassroomModalOpen(true)}
                        className="p-1 px-2 rounded bg-[#ca8a04]/10 border border-[#ca8a04]/30 text-[8px] font-mono uppercase tracking-widest text-[#eab308] hover:bg-[#ca8a04]/20 transition-all cursor-pointer"
                      >
                        + Propose Class
                      </button>
                    </div>

                    <p className="text-zinc-400 text-xs font-light">
                      We convene in scheduled virtual classrooms. Generate secure, high-end meeting portals to coordinate workflows, trade consultations, and share templates.
                    </p>

                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                      {classrooms.map((cls) => {
                        const fee = cls.bwsxFee || 0;
                        const isRegistered = fee === 0 || registeredClassIds.includes(cls.id);

                        return (
                          <div key={cls.id} className="p-4 bg-black/60 border border-zinc-900 rounded-xl relative overflow-hidden group">
                            
                            {/* Class status tabs */}
                            {cls.status === 'LIVE' && (
                              <div className="absolute top-2 right-2 flex items-center space-x-1.5 bg-red-500/10 border border-red-500/30 rounded py-0.5 px-2 text-[8px] font-mono tracking-widest text-red-400 uppercase font-black animate-pulse">
                                <span className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                                <span>LIVE NOW</span>
                              </div>
                            )}
                            {cls.status === 'SCHEDULED' && (
                              <div className="absolute top-2 right-2 bg-zinc-900 border border-zinc-850 rounded py-0.5 px-2 text-[8px] font-mono tracking-widest text-[#eab308] uppercase font-bold flex items-center gap-1">
                                <span className="h-1 w-1 bg-[#eab308] rounded-full" />
                                <span>SCHEDULED</span>
                              </div>
                            )}

                            <span className="text-[7.5px] font-mono uppercase text-zinc-500 mt-1 block tracking-wider">{cls.category}</span>
                            <h4 className="text-xs font-bold text-white uppercase mt-0.5 max-w-[80%] leading-tight">{cls.title}</h4>
                            <p className="text-[10px] text-zinc-400 mt-1 leading-normal font-light">{cls.description}</p>
                            
                            {/* Compensate button if fee is required & not paid */}
                            {fee > 0 && (
                              <div className="mt-2 text-[9px] font-mono flex items-center justify-between p-1.5 px-2.5 rounded bg-zinc-900/60 border border-zinc-850">
                                <span className="text-zinc-400">Cooperative Tuition Rate:</span>
                                {isRegistered ? (
                                  <span className="text-[#eab308] font-bold uppercase tracking-wider flex items-center gap-1 text-[8.5px]">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> ACCESS UNLOCKED
                                  </span>
                                ) : (
                                  <span className="text-white font-bold">{fee} BWSX Credits</span>
                                )}
                              </div>
                            )}

                            {!isRegistered && fee > 0 && (
                              <button 
                                onClick={() => handleCompensateInstructor(cls.id)}
                                className="mt-2.5 w-full py-1.5 rounded-lg bg-gradient-to-r from-[#ca8a04] to-[#eab308] text-black text-[9px] font-mono font-black uppercase tracking-widest transition-all hover:brightness-110 active:scale-99 shadow flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Coins className="w-3.5 h-3.5 shrink-0 animate-bounce" /> Compensate Instructor ({fee} BWSX)
                              </button>
                            )}

                            <div className="mt-3.5 pt-3 border-t border-zinc-900/80 flex justify-between items-center text-[9px] font-mono">
                              <div>
                                <span className="text-zinc-500 block">Led by: <strong className="text-zinc-300 font-bold">{cls.instructor}</strong></span>
                                <span className="text-[#eab308] block mt-0.5">{cls.dateTime}</span>
                              </div>
                              
                              {!isRegistered ? (
                                <div className="px-3 py-1 bg-zinc-950 border border-zinc-900 rounded text-[8.5px] uppercase tracking-widest text-zinc-600 flex items-center gap-1 font-bold">
                                  <Lock className="w-2.5 h-2.5" /> Book Class
                                </div>
                              ) : (
                                <a 
                                  href={cls.meetLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1 bg-gradient-to-r from-zinc-900 to-zinc-950 border border-[#ca8a04]/40 hover:border-[#ca8a04] hover:text-white rounded text-[8.5px] uppercase tracking-widest text-[#ca8a04] flex items-center gap-1 font-bold"
                                >
                                  Join Meet <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
                                </a>
                              )}
                            </div>

                            {/* Attached Class Materials Section */}
                            <div className="mt-3 pt-2.5 border-t border-zinc-900/60 text-left space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1">
                                  <FileText className="w-3 h-3 text-[#ca8a04]" /> Companion Materials ({cls.attachedFiles?.length || 0})
                                </span>
                                <button 
                                  onClick={() => {
                                    setUploadingForClassId(cls.id);
                                    setIsDocUploadModalOpen(true);
                                  }}
                                  className="text-[7.5px] text-[#eab308] font-mono hover:underline cursor-pointer flex items-center gap-1"
                                >
                                  + Upload File
                                </button>
                              </div>

                              {cls.attachedFiles && cls.attachedFiles.length > 0 ? (
                                <div className="space-y-1 mt-1 max-h-[100px] overflow-y-auto pr-0.5">
                                  {cls.attachedFiles.map((file) => (
                                    <div key={file.id} className="p-1 px-1.5 bg-zinc-900/40 border border-zinc-950 rounded flex items-center justify-between gap-2 group/file">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="p-1 bg-[#ca8a04]/10 rounded text-[#eab308] shrink-0">
                                          <FileText className="w-2.5 h-2.5" />
                                        </div>
                                        <div className="min-w-0">
                                          <span className="text-[8.5px] font-mono font-medium text-zinc-300 block truncate leading-tight">{file.name}</span>
                                          <span className="text-[7px] text-zinc-500 block leading-none mt-0.5 font-light">{file.type} • {file.size}</span>
                                        </div>
                                      </div>
                                      
                                      {!isRegistered ? (
                                        <div className="text-[7.5px] text-zinc-650 font-mono flex items-center gap-0.5 bg-black/40 px-1 py-0.5 rounded shrink-0">
                                          <Lock className="w-2 h-2" /> Blocked
                                        </div>
                                      ) : (
                                        <a 
                                          href="#"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            alert(`Securing download package for "${file.name}"... Initiating peer resource sync.`);
                                          }}
                                          className="p-1 text-[#eab308] hover:text-white hover:bg-[#ca8a04]/20 border border-[#ca8a04]/10 hover:border-[#ca8a04]/40 rounded transition-colors cursor-pointer shrink-0"
                                          title="Download companion asset"
                                        >
                                          <Download className="w-2.5 h-2.5" />
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[8px] text-zinc-600 block pl-1 italic">No resources uploaded yet.</span>
                              )}
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Guardian Scholar Archive decorative card panel */}
                  <div className="bg-zinc-950 border border-zinc-900 p-1.5 rounded-2xl relative overflow-hidden shadow-xl text-left group mt-6">
                    <div className="relative h-44 w-full rounded-xl overflow-hidden border border-zinc-900 shadow-inner flex items-end">
                      <img 
                        src="/bws_academy.png" 
                        alt="Knowledge Vault Heritage" 
                        className="absolute inset-0 w-full h-full object-cover brightness-[0.38] contrast-[1.12] group-hover:scale-103 transition-transform duration-700 select-none pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
                      <div className="relative p-4 z-10 space-y-0.5 pointer-events-none">
                        <span className="text-[7.5px] font-mono uppercase tracking-[0.2em] text-[#eab308] font-black">COMMUNITY ACADEMY UNIT</span>
                        <h4 className="text-xs font-mono font-black text-white uppercase tracking-wider">THE GUARDIAN SCHOLAR RECORD</h4>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="text-[10px] text-zinc-400 font-light leading-relaxed">
                        Historically, Greenwood&apos;s educational modules and accounting forums had the highest technical literacy rates during the early 1900s. Knowledge acquisition is the cornerstone of cooperative economics and self-directed community leverage.
                      </p>
                      <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500 pt-1 uppercase tracking-widest">
                        <span>Instructional Core</span>
                        <span className="text-[#eab308] font-bold">BWSX Reward System</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* CLASSROOM PROPOSAL MODAL */}
              {isClassroomModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md bg-zinc-950 border border-zinc-850 p-6 rounded-2xl text-left space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-extrabold text-[#eab308]">Propose Live Classroom Meet</span>
                      <button onClick={() => setIsClassroomModalOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>

                    <form onSubmit={handleScheduleClassroom} className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-400 block">Seminar Title</label>
                        <input 
                          type="text"
                          required
                          value={newClassroom.title}
                          onChange={(e) => setNewClassroom(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="e.g. Setting up direct CRM workflows with AI"
                          className="w-full bg-black border border-zinc-850 rounded p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-400 block">Lead Educator</label>
                        <input 
                          type="text"
                          required
                          value={newClassroom.instructor}
                          onChange={(e) => setNewClassroom(prev => ({ ...prev, instructor: e.target.value }))}
                          placeholder="e.g. Sister Nia, AI Strategist"
                          className="w-full bg-black border border-zinc-850 rounded p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-400 block">Class Access Fee (BWSX Credits)</label>
                        <input 
                          type="number"
                          min="0"
                          value={newClassroom.bwsxFee}
                          onChange={(e) => setNewClassroom(prev => ({ ...prev, bwsxFee: e.target.value }))}
                          placeholder="e.g. 25 (Set 0 for free standard access)"
                          className="w-full bg-black border border-zinc-850 rounded p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                        />
                        <span className="text-[7.5px] text-zinc-500 block leading-tight font-mono -mt-0.5">
                          Peer supporters compensate instructors in real BWSX credits to book entry.
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-400 block">Topic Focus</label>
                          <select 
                            value={newClassroom.category}
                            onChange={(e) => setNewClassroom(prev => ({ ...prev, category: e.target.value as any }))}
                            className="w-full bg-black border border-zinc-850 rounded p-2 text-xs text-zinc-300 focus:border-amber-550 focus:outline-none"
                          >
                            <option value="Applied Trades">Applied Trades</option>
                            <option value="Sovereign Trusts">Family Trusts</option>
                            <option value="Cooperative Logistics">Cooperative Logistics</option>
                            <option value="Heritage Crafts">Heritage Crafts</option>
                            <option value="Wellness & Aesthetics">Wellness & Aesthetics</option>
                            <option value="General">General</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-400 block">Date & Time</label>
                          <input 
                            type="text"
                            required
                            value={newClassroom.dateTime}
                            onChange={(e) => setNewClassroom(prev => ({ ...prev, dateTime: e.target.value }))}
                            placeholder="e.g. May 30th at 4:00 PM EST"
                            className="w-full bg-black border border-zinc-850 rounded p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-400 block">Descriptive Aim</label>
                        <textarea 
                          rows={2}
                          value={newClassroom.description}
                          onChange={(e) => setNewClassroom(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Brief summary of specific templates/actions to be mastered in class..."
                          className="w-full bg-black border border-zinc-850 rounded p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      {/* PROGRAMMATIC MEET LINK PROVISIONER */}
                      <div className="space-y-2.5 p-3 bg-black/60 border border-zinc-900 rounded-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-400">Classroom Link Engine</span>
                          <span className="text-[8px] font-sans text-zinc-500">Google Meet API</span>
                        </div>

                        <div className="flex gap-4">
                          <label className="flex items-center space-x-2 text-[10px] text-zinc-300 font-mono cursor-pointer">
                            <input 
                              type="radio" 
                              name="meetMode" 
                              checked={meetGenerationMode === 'programmatic'} 
                              onChange={() => {
                                setMeetGenerationMode('programmatic');
                                setClassroomPromptError(null);
                              }}
                              className="accent-amber-500"
                            />
                            <span>Programmatic Meet</span>
                          </label>
                          <label className="flex items-center space-x-2 text-[10px] text-zinc-300 font-mono cursor-pointer">
                            <input 
                              type="radio" 
                              name="meetMode" 
                              checked={meetGenerationMode === 'fallback'} 
                              onChange={() => {
                                setMeetGenerationMode('fallback');
                                setClassroomPromptError(null);
                              }}
                              className="accent-amber-500"
                            />
                            <span>Fallback Link</span>
                          </label>
                        </div>

                        {meetGenerationMode === 'programmatic' ? (
                          googleAccessToken ? (
                            <div className="flex items-center space-x-2 text-[9px] text-[#eab308] font-mono mt-1.5 bg-[#ca8a04]/5 p-2 rounded border border-[#ca8a04]/20 animate-in fade-in duration-250">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#eab308] animate-pulse shrink-0" />
                              <span>Google API integration active. Programmatic space will be provisioned on submit.</span>
                            </div>
                          ) : (
                            <div className="mt-1.5 space-y-2 animate-in fade-in duration-250">
                              <p className="text-[9px] text-zinc-400 leading-snug font-sans">
                                Programmatic generation requires authorized access to create Google Meet spaces.
                              </p>
                              <button
                                type="button"
                                onClick={handleMeetSignIn}
                                className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-[#ca8a04] text-zinc-300 text-[8.5px] font-mono uppercase tracking-wider rounded flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.99]"
                              >
                                <Video className="w-3.5 h-3.5 text-[#eab308]" /> Sign in & Authorize Google Meet
                              </button>
                            </div>
                          )
                        ) : (
                          <div className="flex items-center space-x-2 text-[9px] text-zinc-500 font-mono mt-1.5 bg-zinc-900 border border-zinc-850 p-2 rounded animate-in fade-in duration-250">
                            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-650 shrink-0" />
                            <span>An offline safe-bypass meet portal will be allocated immediately.</span>
                          </div>
                        )}

                        {classroomPromptError && (
                          <div className="mt-2.5 p-2.5 bg-red-950/20 border border-red-900/30 rounded-lg flex items-start gap-2 text-left animate-in slide-in-from-top-1 duration-150">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-[9px] text-red-400 font-mono leading-relaxed">
                              {classroomPromptError}
                            </p>
                          </div>
                        )}
                      </div>

                      <button 
                        type="submit"
                        disabled={isGeneratingClassLink}
                        className="w-full py-3 bg-[#ca8a04] hover:bg-amber-600 disabled:bg-zinc-900 disabled:text-zinc-650 disabled:border disabled:border-zinc-850 disabled:cursor-not-allowed text-black text-[9px] font-mono font-bold uppercase tracking-widest rounded flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        {isGeneratingClassLink ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>PROVISIONING SECURE PORTAL...</span>
                          </>
                        ) : (
                          <span>Schedule Google Meet Portal ✓</span>
                        )}
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}

              {/* INSTRUCTOR DOCUMENT UPLOAD MODAL */}
              {isDocUploadModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-sm bg-zinc-950 border border-zinc-850 p-6 rounded-2xl text-left space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-[#ca8a04]" />
                        <span className="text-[10px] font-mono uppercase tracking-[0.15em] font-extrabold text-[#eab308]">Upload Lesson Supplement</span>
                      </div>
                      <button onClick={() => {
                        setIsDocUploadModalOpen(false);
                        setUploadingForClassId(null);
                      }} className="text-zinc-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
                    </div>

                    <form onSubmit={handleDocSubmit} className="space-y-4">
                      {/* Drag and Drop with integrated click selector */}
                      <div className="border border-dashed border-zinc-800 rounded-xl p-5 text-center bg-black/40 hover:bg-black/60 transition-colors relative group">
                        <input 
                          type="file" 
                          id="instructor-file-upload" 
                          className="hidden" 
                          onChange={handleLocalFileChange}
                        />
                        <label 
                          htmlFor="instructor-file-upload" 
                          className="cursor-pointer space-y-2 block"
                        >
                          <div className="mx-auto w-8 h-8 rounded-full bg-[#ca8a04]/10 flex items-center justify-center text-[#eab308] group-hover:scale-105 transition-transform">
                            <Upload className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10.5px] font-mono text-zinc-300 block">Drag & Drop file here or <span className="text-[#eab308] underline">browse</span></span>
                            <span className="text-[8px] text-zinc-500 block font-mono mt-1">Accepts PDF, XLS Sheets, blueprints, schemas up to 10MB</span>
                          </div>
                        </label>
                      </div>

                      {/* Manual configuration inputs (populated automatically on file selection) */}
                      <div className="space-y-3 p-3 bg-zinc-900/40 rounded-xl border border-zinc-900 font-mono">
                        <div className="space-y-1">
                          <label className="text-[8px] font-mono uppercase tracking-wider text-zinc-400 block">Resource File Title</label>
                          <input 
                            type="text"
                            required
                            value={uploadForm.name}
                            onChange={(e) => setUploadForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g. Master_Bespoke_Framing_Guide.pdf"
                            className="w-full bg-black border border-zinc-800 rounded px-2.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[8px] font-mono uppercase tracking-wider text-zinc-400 block">Theme</label>
                            <select 
                              value={uploadForm.type}
                              onChange={(e) => setUploadForm(prev => ({ ...prev, type: e.target.value }))}
                              className="w-full bg-black border border-zinc-800 rounded px-2 py-1.5 text-[11px] text-zinc-300 focus:border-[#ca8a04] focus:outline-none"
                            >
                              <option value="PDF Guide">PDF Guide</option>
                              <option value="Formula Spreadsheet">Formula Spreadsheet</option>
                              <option value="Blueprint Assets">Blueprint Assets</option>
                              <option value="Drawing / Schema">Drawing / Schema</option>
                              <option value="Syllabus">Syllabus</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-mono uppercase tracking-wider text-zinc-400 block">Size</label>
                            <input 
                              type="text"
                              required
                              value={uploadForm.size}
                              onChange={(e) => setUploadForm(prev => ({ ...prev, size: e.target.value }))}
                              placeholder="e.g. 1.2 MB"
                              className="w-full bg-black border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={!uploadForm.name}
                        className="w-full py-2.5 bg-gradient-to-r from-[#ca8a04] to-[#eab308] hover:brightness-110 disabled:opacity-50 text-black text-[9px] font-mono font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Commit Supplement File ✓
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}

            </motion.div>
          )}

          {/* TAB 3: RESOURCE VAULT & DEPLOYED COMMUNITY ASSETS */}
          {activeTab === 'vault' && (
            <motion.div 
              key="vault-tab"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8 text-left"
            >
              {/* Premium Luxury Vault Banner */}
              <div className="relative h-44 sm:h-56 w-full rounded-2xl overflow-hidden border border-[#ca8a04]/15 shadow-xl flex items-end">
                <img 
                  src="/bws_vault.png" 
                  alt="Black Wall Street Resource Vault" 
                  className="absolute inset-0 w-full h-full object-cover brightness-50 contrast-110 hover:scale-102 transition-transform duration-700 select-none" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="relative p-6 sm:p-8 space-y-1 z-10 max-w-xl text-left">
                  <span className="text-[8px] font-mono uppercase tracking-[0.3em] text-[#eab308] font-black">MUTUAL ASSET COOPERATIVE</span>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-tight leading-none drop-shadow-md">
                    SHARED MATERIAL RESOURCES
                  </h3>
                  <p className="text-[10px] sm:text-xs text-zinc-300 font-light tracking-wide max-w-md drop-shadow">
                    List and lease physical tools, freight transportation, high-end media gear, and localized physical spaces.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* VAULT DIRECTORY CONTAINER */}
                <div className="lg:col-span-8 p-6 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-4">
                  
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                    <div className="space-y-1">
                      <span className="text-[8.5px] font-mono uppercase text-zinc-500 tracking-wider">Module 03 Repository</span>
                      <h3 className="text-xl font-bold uppercase tracking-tight text-white flex items-center gap-2">
                        <Landmark className="w-5 h-5 text-[#eab308]" /> Shared Material Resources & Warehousing
                      </h3>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={handleResetResources}
                        className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 text-[8.5px] font-mono text-zinc-500 hover:text-zinc-300 rounded uppercase"
                      >
                        Reset All Reservs
                      </button>
                      <button 
                        onClick={() => setIsResourceModalOpen(true)}
                        className="px-3.5 py-1.5 bg-[#ca8a04] hover:bg-amber-600 text-black text-[8.5px] font-mono uppercase tracking-widest font-black rounded"
                      >
                        + List Material Resource
                      </button>
                    </div>
                  </div>

                  <p className="text-zinc-400 text-xs sm:text-sm font-light leading-relaxed max-w-3xl">
                    Ownership is the currency here. BWS Inc. maintains a mutual depot. You are completely authorized to catalog <strong>any material or intellectual resource</strong> you are willing to support the family with (e.g., freight vans, cinema lenses, workspace cabins, custom high-speed servers, lawn mowers, kitchen stations, power washers, legal packets). Earn reputation listings and book peer resources dynamically!
                  </p>

                  {/* MATERIAL CARDS GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    {materialResources.map((res) => {
                      return (
                        <div 
                          key={res.id}
                          className={`p-5 rounded-2xl border transition-all relative overflow-hidden group ${
                            res.isBooked 
                              ? 'bg-zinc-950 border-zinc-900 opacity-60' 
                              : 'bg-zinc-900/50 border-zinc-800 hover:border-[#ca8a04]/40 hover:bg-zinc-900/80 shadow'
                          }`}
                        >
                          {/* Booked Flag Ribbon */}
                          {res.isBooked && (
                            <div className="absolute top-2 right-2 bg-red-500/10 border border-red-500/30 text-red-400 text-[8px] font-mono tracking-widest font-bold px-2 py-0.5 rounded">
                              CURRENTLY RESERVED
                            </div>
                          )}
                          {!res.isBooked && res.isCustom && (
                            <div className="absolute top-2 right-2 bg-amber-500/10 border border-amber-500/30 text-[#eab308] text-[8px] font-mono tracking-widest font-bold px-2 py-0.5 rounded">
                              COOPERATOR LISTED
                            </div>
                          )}

                          <div className="flex items-center gap-4 mb-3">
                            <div className="w-10 h-10 rounded bg-[#ca8a04]/10 border border-[#ca8a04]/30 flex items-center justify-center text-[#eab308]">
                              {res.category === 'Transport' && <Truck className="w-5 h-5 animate-pulse" />}
                              {res.category === 'Media Gear' && <Video className="w-5 h-5 animate-pulse" />}
                              {res.category === 'Physical Tools' && <Laptop className="w-5 h-5" />}
                              {res.category === 'Office/Space' && <Landmark className="w-5 h-5" />}
                              {res.category === 'Other' && <Activity className="w-5 h-5" />}
                            </div>
                            <div>
                              <span className="text-[8px] font-mono uppercase text-zinc-500 tracking-wider block">{res.category}</span>
                              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide leading-none">{res.name}</h4>
                            </div>
                          </div>

                          <p className="text-xs text-zinc-400 leading-relaxed font-light mb-4">{res.description}</p>
                          
                          <div className="pt-4 border-t border-zinc-900 flex justify-between items-center text-[10px] font-mono">
                            <div>
                              <span className="text-zinc-500 block text-[9px]">Sourced by: <strong className="text-zinc-300 font-bold">{res.ownerName}</strong></span>
                              <span className="text-white block font-bold mt-0.5">{res.creditCost} BWSX reservation fee</span>
                            </div>

                            <button 
                              disabled={res.isBooked}
                              onClick={() => handleRentResource(res.id)}
                              className={`px-3.5 py-1.5 rounded text-[8.5px] uppercase font-mono tracking-widest font-bold transition-all cursor-pointer ${
                                res.isBooked 
                                  ? 'bg-zinc-800 border-zinc-750 text-zinc-650 cursor-not-allowed' 
                                  : 'bg-[#ca8a04] text-black hover:bg-amber-500 shadow'
                              }`}
                            >
                              {res.isBooked ? 'Reserved Logged' : 'Book with BWSX 🗄️'}
                            </button>
                          </div>

                        </div>
                      );
                    })}
                  </div>

                </div>

                {/* Estes Gold & Bullion Custody decorative card panel */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-zinc-950 border border-zinc-900 p-1.5 rounded-2xl relative overflow-hidden shadow-xl text-left group">
                    <div className="relative h-64 w-full rounded-xl overflow-hidden border border-zinc-900 shadow-inner flex items-end">
                      <img 
                        src="/bws_vault.png" 
                        alt="Estes Gold Reserve Vault" 
                        className="absolute inset-0 w-full h-full object-cover brightness-[0.34] contrast-[1.12] group-hover:scale-103 transition-transform duration-700 select-none pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
                      <div className="relative p-5 z-10 space-y-1 pointer-events-none">
                        <span className="text-[7.5px] font-mono uppercase tracking-[0.25em] text-[#eab308] font-black">CUSTODIAL TRUST</span>
                        <h4 className="text-sm font-mono font-black text-white uppercase tracking-wider leading-none">THE ESTES GOLD VAULT</h4>
                        <p className="text-[9px] text-zinc-400 font-light leading-snug">
                          Cooperative treasury reserves backing ledger credits.
                        </p>
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      <p className="text-[10px] text-zinc-400 font-light leading-relaxed">
                        Historically, Greenwood&apos;s pioneers kept physical bullion reserves and title deeds filed within their own secure boardrooms, bypassing central systemic risks. All physical tool loans and space reserves listed here are backed by mutual credit locks, safeguarding cooperator wealth.
                      </p>
                      <div className="pt-2 border-t border-zinc-900 flex justify-between items-center text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                        <span>Secured Safeguards</span>
                        <span className="text-[#eab308] font-bold">100% Cooperator Backed</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* LIST MATERIAL MODAL */}
              {isResourceModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md bg-zinc-950 border border-zinc-850 p-6 rounded-2xl text-left space-y-4"
                  >
                    
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-extrabold text-[#eab308]">Register Material Resource</span>
                      <button onClick={() => setIsResourceModalOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>

                    <form onSubmit={handleAddMaterialResource} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-400 block">Asset Name (Specific Model or Item)</label>
                        <input 
                          type="text"
                          required
                          value={newResource.name}
                          onChange={(e) => setNewResource(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Dewalt 20V Cordless Power Drill Set"
                          className="w-full bg-black border border-zinc-850 rounded p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-400 block">Category Focus</label>
                          <select 
                            value={newResource.category}
                            onChange={(e) => setNewResource(prev => ({ ...prev, category: e.target.value as any }))}
                            className="w-full bg-black border border-zinc-850 rounded p-2 text-xs text-zinc-300 focus:border-amber-550 focus:outline-none"
                          >
                            <option value="Physical Tools">Physical Tools</option>
                            <option value="Transport">Transport</option>
                            <option value="Media Gear">Media Gear</option>
                            <option value="Office/Space">Office Space</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-400 block">Fee (BWSX Credits)</label>
                          <input 
                            type="number"
                            required
                            min="1"
                            value={newResource.creditCost}
                            onChange={(e) => setNewResource(prev => ({ ...prev, creditCost: e.target.value }))}
                            className="w-full bg-black border border-zinc-850 rounded p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-400 block">Asset Capacity / Pickup Rules</label>
                        <textarea 
                          rows={3}
                          required
                          value={newResource.description}
                          onChange={(e) => setNewResource(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="State pickup block location (e.g. Block 4 Greenwood), charging needs, accessories, or instructions..."
                          className="w-full bg-black border border-zinc-850 rounded p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <button 
                        type="submit"
                        className="w-full py-3 bg-[#ca8a04] hover:bg-amber-600 text-black text-[9px] font-mono font-bold uppercase tracking-widest rounded"
                      >
                        Pool Asset inside Vault ✓
                      </button>
                    </form>

                  </motion.div>
                </div>
              )}

            </motion.div>
          )}

          {/* TAB 4: THE SHARED LEDGER SYSTEMS */}
          {activeTab === 'ledger' && (
            <motion.div 
              key="ledger-tab"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8 text-left"
            >
              {/* Premium Luxury Ledger Banner */}
              <div className="relative h-44 sm:h-56 w-full rounded-2xl overflow-hidden border border-[#ca8a04]/15 shadow-xl flex items-end">
                <img 
                  src="/bws_trust.png" 
                  alt="Black Wall Street Mutual Consensus Ledger" 
                  className="absolute inset-0 w-full h-full object-cover brightness-45 contrast-115 hover:scale-102 transition-transform duration-700 select-none" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="relative p-6 sm:p-8 space-y-1 z-10 max-w-xl text-left">
                  <span className="text-[8px] font-mono uppercase tracking-[0.3em] text-[#eab308] font-black">CONSENSUS ACCOUNTING FRAMEWORK</span>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-tight leading-none drop-shadow-md">
                    THE COLLECTIVE LEDGER
                  </h3>
                  <p className="text-[10px] sm:text-xs text-zinc-300 font-light tracking-wide max-w-md drop-shadow">
                    A completely tamper-proof, synchronized directory tracking all cooperator trades, skill swaps, and credit pooling blocks.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* DIRECTORY LIST PANEL */}
                <div className="lg:col-span-8 bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-6">
                  
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-mono uppercase text-zinc-500 tracking-wider">Accounting Consensus Protocol v2.5</span>
                      <h3 className="text-xl font-bold uppercase text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-[#eab308]" /> The Shared Ledger Systems
                      </h3>
                    </div>

                    {/* Dynamic controls to allow transfer and export */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button 
                        onClick={() => setIsTransferModalOpen(true)}
                        className="px-4 py-2 bg-gradient-to-r from-[#ca8a04] to-yellow-500 text-black text-[9px] font-mono font-extrabold uppercase tracking-widest rounded flex items-center gap-2 shadow cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Direct Transfer (Circulate BWSX)
                      </button>
                      <button 
                        onClick={handleExportLedger}
                        className="px-4 py-2 bg-zinc-900 border border-[#ca8a04]/40 hover:border-[#eab308] text-[#eab308] hover:text-yellow-400 text-[9px] font-mono font-extrabold uppercase tracking-widest rounded flex items-center gap-2 shadow transition-all cursor-pointer"
                        title="Download a complete ledger transaction audit log in CSV format"
                      >
                        <Download className="w-3.5 h-3.5" /> Export Ledger (CSV)
                      </button>
                    </div>
                  </div>

                  <p className="text-zinc-400 text-xs sm:text-sm font-light">
                    A transparent consensus log of active skill trades, course validations, and physical material borrows settled within BWS. By trading skills directly—marketing for construction, legal review for development—we bypass traditional fee hurdles entirely.
                  </p>

                  {/* Ledger Filtering search & Date range picker */}
                  <div className="space-y-3 bg-[#121214]/60 border border-zinc-900 p-4 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      
                      {/* Search Bar */}
                      <div className="md:col-span-6 relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                        <input 
                          type="text"
                          value={searchLedgerQuery}
                          onChange={(e) => setSearchLedgerQuery(e.target.value)}
                          placeholder="Search transactor, type, or message..."
                          className="w-full bg-black border border-zinc-850 rounded pl-10 pr-4 py-2 text-xs font-mono text-zinc-200 focus:border-[#ca8a04] focus:outline-none placeholder-zinc-600"
                        />
                        {searchLedgerQuery && (
                          <button 
                            onClick={() => setSearchLedgerQuery('')}
                            className="absolute right-3 top-1.5 text-[8px] text-zinc-400 hover:text-white font-mono bg-zinc-900 py-0.5 px-2 rounded hover:bg-zinc-850 transition-all cursor-pointer"
                          >
                            CLEAR
                          </button>
                        )}
                      </div>

                      {/* Date Range Start Input */}
                      <div className="md:col-span-3 flex items-center space-x-2 bg-black border border-zinc-850 rounded px-2.5 py-1">
                        <span className="text-[7.5px] font-mono uppercase text-zinc-500 tracking-wider font-extrabold shrink-0">From:</span>
                        <input 
                          type="date"
                          value={ledgerStartDate}
                          onChange={(e) => setLedgerStartDate(e.target.value)}
                          className="w-full bg-transparent text-[10px] font-mono text-zinc-300 focus:outline-none cursor-pointer [color-scheme:dark]"
                        />
                      </div>

                      {/* Date Range End Input */}
                      <div className="md:col-span-3 flex items-center space-x-2 bg-black border border-zinc-850 rounded px-2.5 py-1">
                        <span className="text-[7.5px] font-mono uppercase text-zinc-500 tracking-wider font-extrabold shrink-0">To:</span>
                        <input 
                          type="date"
                          value={ledgerEndDate}
                          onChange={(e) => setLedgerEndDate(e.target.value)}
                          className="w-full bg-transparent text-[10px] font-mono text-zinc-300 focus:outline-none cursor-pointer [color-scheme:dark]"
                        />
                      </div>

                    </div>

                    {/* Active filter summary & Clear All buttons */}
                    {(searchLedgerQuery || ledgerStartDate || ledgerEndDate) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] font-mono text-[#eab308] pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-zinc-500 uppercase">Filters Active:</span>
                          {searchLedgerQuery && (
                            <span className="bg-zinc-950 border border-zinc-900 px-2 py-0.5 rounded text-zinc-300">
                              Search: &quot;{searchLedgerQuery}&quot;
                            </span>
                          )}
                          {ledgerStartDate && (
                            <span className="bg-zinc-950 border border-zinc-900 px-2 py-0.5 rounded text-zinc-300">
                              From: {ledgerStartDate}
                            </span>
                          )}
                          {ledgerEndDate && (
                            <span className="bg-zinc-950 border border-zinc-900 px-2 py-0.5 rounded text-zinc-300">
                              To: {ledgerEndDate}
                            </span>
                          )}
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            setSearchLedgerQuery('');
                            setLedgerStartDate('');
                            setLedgerEndDate('');
                          }}
                          className="text-[#eab308] hover:text-[#ca8a04] underline uppercase tracking-widest cursor-pointer font-black shrink-0"
                        >
                          Reset Filters [×]
                        </button>
                      </div>
                    )}
                  </div>

                  <div 
                    ref={ledgerScrollContainerRef}
                    onScroll={handleLedgerScroll}
                    className="space-y-3 max-h-[420px] overflow-y-auto pr-1"
                  >
                    {virtualLedgerData.paddingTop > 0 && (
                      <div style={{ height: `${virtualLedgerData.paddingTop}px` }} className="shrink-0" />
                    )}
                    {virtualLedgerData.visibleItems.map((t) => (
                      <VirtualLedgerRow key={t.id} trade={t} />
                    ))}
                    {virtualLedgerData.paddingBottom > 0 && (
                      <div style={{ height: `${virtualLedgerData.paddingBottom}px` }} className="shrink-0" />
                    )}
                    {filteredTrades.length === 0 && (
                      <div className="py-12 border border-dashed border-zinc-900 rounded text-center text-zinc-600 font-mono text-xs">
                        No matching transacted coordinates parsed. Clear query inputs.
                      </div>
                    )}
                  </div>

                  {/* PREMIUM LEDGER PAGINATION AND METRIC ROW */}
                  {filteredTrades.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4 border-t border-zinc-900/80 font-mono text-[10px]">
                      <div className="text-zinc-500 text-center sm:text-left">
                        Showing ledger blocks <span className="text-white font-bold">{(safeLedgerPage - 1) * ledgerPageSize + 1}</span> to{" "}
                        <span className="text-white font-bold">{Math.min(filteredTrades.length, safeLedgerPage * ledgerPageSize)}</span> of{" "}
                        <span className="text-white font-bold">{filteredTrades.length}</span> registered ledger streams
                      </div>
                      
                      {filteredTrades.length > ledgerPageSize && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setLedgerPage(prev => Math.max(1, prev - 1))}
                            disabled={safeLedgerPage === 1}
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:text-zinc-600 disabled:cursor-not-allowed rounded text-[9px] uppercase tracking-wider transition-colors"
                          >
                            Previous
                          </button>
                          <div className="px-3 py-1.5 bg-black/40 border border-zinc-900 rounded text-zinc-400">
                            PAGE <span className="text-[#eab308] font-bold">{safeLedgerPage}</span> / {totalLedgerPages}
                          </div>
                          <button
                            onClick={() => setLedgerPage(prev => Math.min(totalLedgerPages, prev + 1))}
                            disabled={safeLedgerPage === totalLedgerPages}
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:text-zinc-600 disabled:cursor-not-allowed rounded text-[9px] uppercase tracking-wider transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Ledger Historical Background panel */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-zinc-950 border border-zinc-900 p-1.5 rounded-2xl relative overflow-hidden shadow-xl text-left group">
                    <div className="relative h-64 w-full rounded-xl overflow-hidden border border-zinc-900 shadow-inner flex items-end">
                      <img 
                        src="/bws_trust.png" 
                        alt="The Greenwood Ledger System" 
                        className="absolute inset-0 w-full h-full object-cover brightness-[0.34] contrast-[1.12] group-hover:scale-103 transition-transform duration-700 select-none pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
                      <div className="relative p-5 z-10 space-y-1 pointer-events-none">
                        <span className="text-[7.5px] font-mono uppercase tracking-[0.25em] text-[#eab308] font-black">MEMBER ACCOUNTING</span>
                        <h4 className="text-sm font-mono font-black text-white uppercase tracking-wider leading-none">THE GREENWOOD LEDGER</h4>
                        <p className="text-[9px] text-zinc-400 font-light leading-snug">
                          Cooperative double-entry ledger consensus logs.
                        </p>
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      <p className="text-[10px] text-zinc-400 font-light leading-relaxed">
                        In 1921, the Greenwood community operated its own independent clearing house. Ledger accounts were synchronized nightly to ensure gold-backed liquidity and prevent outside systemic leverage from disrupting the local dollar circulation speed.
                      </p>
                      <div className="pt-2 border-t border-zinc-900 flex justify-between items-center text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                        <span>Family Clearing</span>
                        <span className="text-[#eab308] font-bold">Consensus Verified</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* TRANSFER DIALOG MODAL */}
              {isTransferModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-sm bg-zinc-950 border border-zinc-850 p-6 rounded-2xl text-left space-y-4"
                  >
                    
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                      <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#eab308] font-black">Circulate BWSX Credits</span>
                      <button onClick={() => setIsTransferModalOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>

                    <p className="text-zinc-400 text-[11px] font-light">
                      Keep cash moving within the syndicate family. Transmit custom BWSX units instantly.
                    </p>

                    <form onSubmit={handleTransferCredits} className="space-y-4">
                      
                      <div className="space-y-1">
                        <label className="text-[8px] font-mono uppercase tracking-widest text-[#ca8a04] block">Recipient Email / Handle</label>
                        <input 
                          type="text"
                          required
                          value={transferData.recipient}
                          onChange={(e) => setTransferData(prev => ({ ...prev, recipient: e.target.value }))}
                          placeholder="e.g. sister.angela@cooperative.email"
                          className="w-full bg-black border border-zinc-850 rounded p-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-mono uppercase tracking-widest text-[#ca8a04] block">Amount (BWSX Credits)</label>
                        <input 
                          type="number"
                          required
                          min="0.1"
                          step="any"
                          value={transferData.amount}
                          onChange={(e) => setTransferData(prev => ({ ...prev, amount: e.target.value }))}
                          placeholder="e.g. 50"
                          className="w-full bg-black border border-zinc-850 rounded p-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-mono uppercase tracking-widest text-[#ca8a04] block">Trade Memo / Service Description</label>
                        <input 
                          type="text"
                          value={transferData.memo}
                          onChange={(e) => setTransferData(prev => ({ ...prev, memo: e.target.value }))}
                          placeholder="e.g. Legal framework review service"
                          className="w-full bg-black border border-[#2a2a2e] rounded p-2 text-xs font-mono text-white focus:border-amber-520 focus:outline-none"
                        />
                      </div>

                      {transferError && <p className="text-[10px] text-amber-500 font-mono text-left">{transferError}</p>}
                      {transferSuccess && <p className="text-[10px] text-emerald-400 font-bold font-mono text-left">✓ Units Circulated Safely!</p>}

                      <button 
                        type="submit"
                        disabled={transferSuccess}
                        className="w-full py-2.5 bg-[#ca8a04] hover:bg-amber-600 text-black text-[9px] font-mono font-bold uppercase tracking-widest rounded transition-all"
                      >
                        {transferSuccess ? 'Sending coordinates...' : 'Transmit BWSX Coordinates ✓'}
                      </button>

                    </form>

                  </motion.div>
                </div>
              )}

              {/* SOVEREIGN TREASURY SWAP CENTRAL MODAL */}
              {isWalletModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="w-full max-w-lg bg-[#09090b] border border-[#ca8a04]/45 p-6 sm:p-7 rounded-2xl text-left space-y-5 shadow-[0_0_50px_rgba(234,179,8,0.15)] relative overflow-hidden"
                  >
                    {/* Glowing golden mesh decorations inside card */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#ca8a04]/5 filter blur-2xl rounded-full" />
                    
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3 relative z-10">
                      <div className="flex items-center space-x-2">
                        <Coins className="w-4 h-4 text-[#eab308] animate-pulse" />
                        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#eab308] font-black">Treasury Exchange</span>
                      </div>
                      <button 
                        onClick={() => {
                          setIsWalletModalOpen(false);
                          setSwapError(null);
                          setSwapSuccessMessage(null);
                        }} 
                        className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-4 relative z-10">
                      <p className="text-zinc-400 text-xs font-light font-sans leading-relaxed">
                        Exchange and manage distributed <strong className="text-white">BWSX credits</strong> instantly using peer-to-peer family funding pools of cash or cryptocurrency assets.
                      </p>

                      {/* Side by Side Tab selectors */}
                      <div className="grid grid-cols-2 p-1 bg-zinc-950 border border-zinc-900 rounded-lg">
                        <button 
                          type="button"
                          onClick={() => {
                            setSwapType('BUY');
                            setSwapError(null);
                            setSwapSuccessMessage(null);
                          }}
                          className={`py-2 text-[9px] font-mono uppercase font-black tracking-widest rounded-md cursor-pointer transition-all ${
                            swapType === 'BUY' 
                              ? 'bg-gradient-to-r from-[#ca8a04] to-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.15)] text-zinc-950 font-black' 
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          Acquire BWSX (Buy)
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setSwapType('SELL');
                            setSwapError(null);
                            setSwapSuccessMessage(null);
                          }}
                          className={`py-2 text-[9px] font-mono uppercase font-black tracking-widest rounded-md cursor-pointer transition-all ${
                            swapType === 'SELL' 
                              ? 'bg-gradient-to-r from-[#ca8a04] to-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.15)] text-zinc-950 font-black' 
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          Liquidate BWSX (Sell)
                        </button>
                      </div>

                      {/* Current Vault States Bento Panel */}
                      <div className="bg-black/80 border border-zinc-900 p-3 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-[9px]">
                        <div>
                          <span className="text-zinc-500 block text-[7px] uppercase tracking-wider">Local Cash USD</span>
                          <strong className="text-white">${simulatedBalances.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[7px] uppercase tracking-wider">BTC Wallet</span>
                          <strong className="text-white">{simulatedBalances.btc} BTC</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[7px] uppercase tracking-wider">ETH Wallet</span>
                          <strong className="text-white">{simulatedBalances.eth} ETH</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[7px] uppercase tracking-wider">SOL Wallet</span>
                          <strong className="text-white">{simulatedBalances.sol} SOL</strong>
                        </div>
                      </div>

                      <form onSubmit={handleExecuteSwap} className="space-y-4">
                        {/* Currency selection & details */}
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="text-[8px] font-mono uppercase tracking-widest text-[#ca8a04] block font-bold">Trading Host Asset</label>
                            <select 
                              value={swapCurrency}
                              onChange={(e: any) => {
                                setSwapCurrency(e.target.value);
                                setSwapError(null);
                              }}
                              className="w-full bg-black border border-zinc-855 rounded p-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none cursor-pointer"
                            >
                              <option value="usd">United States Dollars ($ USD)</option>
                              <option value="btc">Bitcoin (₿ BTC)</option>
                              <option value="eth">Ethereum (Ξ ETH)</option>
                              <option value="sol">Solana (◎ SOL)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[8px] font-mono uppercase tracking-widest text-[#ca8a04] block font-bold">Input Asset Units</label>
                            <div className="relative">
                              <input 
                                type="number"
                                required
                                step="any"
                                min="0.000001"
                                value={swapAmount}
                                onChange={(e) => {
                                  setSwapAmount(e.target.value);
                                  setSwapError(null);
                                }}
                                placeholder="0.00"
                                className="w-full bg-black border border-zinc-855 rounded p-2 pr-12 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                              />
                              <button 
                                type="button"
                                onClick={() => {
                                  // Auto set max from chosen source balance
                                  if (swapType === 'BUY') {
                                    setSwapAmount(simulatedBalances[swapCurrency].toString());
                                  } else {
                                    // Liquidating -> max is userBWSXBalance converted back to source asset!
                                    const rates = { usd: 1.0, btc: 68500.0, eth: 3450.0, sol: 145.0 };
                                    const rate = rates[swapCurrency];
                                    setSwapAmount((userBWSXBalance / rate).toFixed(6));
                                  }
                                }}
                                className="absolute right-1 top-1 text-[8px] font-mono uppercase tracking-widest bg-zinc-900 border border-zinc-800 text-amber-500 px-2 py-1 rounded hover:text-amber-300 cursor-pointer animate-pulse"
                              >
                                Max
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Live Conversion Preview Meter */}
                        {swapAmount && !isNaN(Number(swapAmount)) && Number(swapAmount) > 0 && (
                          <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-lg space-y-1 font-mono text-[9px]">
                            <div className="flex justify-between">
                              <span className="text-zinc-500 uppercase">Interactive Conversion Rate</span>
                              <span className="text-white">
                                {swapCurrency === 'usd' ? '1 USD = 1.00 BWSX' : 
                                 swapCurrency === 'btc' ? '1 BTC = 68,500.00 BWSX' : 
                                 swapCurrency === 'eth' ? '1 ETH = 3,450.00 BWSX' : 
                                 '1 SOL = 145.00 BWSX'}
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-zinc-900/50 pt-1">
                              <span className="text-zinc-400 uppercase font-black">
                                {swapType === 'BUY' ? 'You will send / authenticate:' : 'You will receive / retrieve:'}
                              </span>
                              <strong className="text-white">
                                {parseFloat(swapAmount).toLocaleString()} {swapCurrency.toUpperCase()}
                              </strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-400 uppercase font-black">
                                {swapType === 'BUY' ? 'You will mint / receive:' : 'You will burn / pay:'}
                              </span>
                              <strong className="text-[#eab308] text-[11px] animate-pulse">
                                {(parseFloat(swapAmount) * (swapCurrency === 'usd' ? 1.0 : swapCurrency === 'btc' ? 68500.0 : swapCurrency === 'eth' ? 3450.0 : 145.0)).toLocaleString('en-US', { minimumFractionDigits: 2 })} BWSX
                              </strong>
                            </div>
                          </div>
                        )}

                        {swapError && <p className="text-[10px] text-amber-500 font-mono text-left">{swapError}</p>}
                        {swapSuccessMessage && (
                          <div className="bg-emerald-500/15 border border-emerald-500/25 p-2 rounded text-[10px] text-emerald-400 font-mono text-left leading-relaxed">
                            <strong>✓ SWAP SECURED AND INJECTED!</strong><br/>
                            {swapSuccessMessage}
                          </div>
                        )}

                        <button 
                          type="submit"
                          className="w-full py-2.5 bg-gradient-to-r from-[#ca8a04] to-yellow-500 text-black text-[9px] font-mono font-bold uppercase tracking-widest rounded cursor-pointer hover:brightness-115 transition-all text-center flex items-center justify-center font-black shadow-[0_0_12px_rgba(202,138,4,0.15)]"
                        >
                          {swapType === 'BUY' ? 'AUTHORIZE & MINT CREDITS ✓' : 'AUTHORIZE & LIQUIDATE TO VAULT ↗'}
                        </button>

                      </form>
                    </div>

                    <div className="text-[8px] font-mono text-zinc-500 text-center border-t border-zinc-900 pt-3 uppercase tracking-wider">
                      Secured by Private Trust Registry • Built on Greenwood&apos;s Eternal Foundation
                    </div>

                  </motion.div>
                </div>
              )}

            </motion.div>
          )}

          {/* TAB 5: SELF-OWNERSHIP INVESTMENT */}
          {activeTab === 'support' && (
            <motion.div 
              key="support-tab"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8 text-left"
            >
              {/* Premium Luxury Investment Banner */}
              <div className="relative h-44 sm:h-56 w-full rounded-2xl overflow-hidden border border-[#ca8a04]/15 shadow-xl flex items-end">
                <img 
                  src="/bws_trust.png" 
                  alt="Black Wall Street Community Cooperation" 
                  className="absolute inset-0 w-full h-full object-cover brightness-50 contrast-110 hover:scale-102 transition-transform duration-700 select-none" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="relative p-6 sm:p-8 space-y-1 z-10 max-w-xl text-left">
                  <span className="text-[8px] font-mono uppercase tracking-[0.3em] text-[#eab308] font-black">PRIVATE TRUST RE-ALIGNMENT</span>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-tight leading-none drop-shadow-md">
                    INVEST IN ECOSYSTEM SELF-OWNERSHIP
                  </h3>
                  <p className="text-[10px] sm:text-xs text-zinc-300 font-light tracking-wide max-w-md drop-shadow">
                    Acquire elite private trust membership shards to back server resources, business registrations, and load launch credits.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* SELECT LEVEL */}
                <div className="lg:col-span-7 space-y-6">
                  
                  <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-4">
                    <div className="border-b border-zinc-900 pb-3">
                      <span className="text-[8.5px] font-mono uppercase text-zinc-500 tracking-wider">Redefining Capital & Standing</span>
                      <h3 className="text-xl font-bold uppercase text-white flex items-center gap-2">
                        <Coins className="w-5 h-5 text-[#eab308]" /> Redesign: Redefining Capital & Invest in Self
                      </h3>
                    </div>

                    <p className="text-zinc-400 text-xs sm:text-sm font-light leading-relaxed">
                      We are not trading speculative stocks or listing commercial gold bullion. Our core value is <strong>mutual community utility</strong>. When you seed BWS Inc., you are directly investing in yourself, funding server clusters, business registrations, legal syndicate trust models, and preloading your launch wallet with BWSX Credits.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {TIER_BRACKETS.map((tier, idx) => {
                        return (
                          <div 
                            key={idx}
                            onClick={() => {
                              setSelectedTierIndex(idx);
                              setIsUsingCustomAmount(false);
                            }}
                            className={`p-4 text-left cursor-pointer transition-all ${
                              selectedTierIndex === idx && !isUsingCustomAmount
                                ? 'bg-zinc-900 scale-[1.01]' 
                                : 'bg-black/50 hover:bg-zinc-900/20'
                            }`}
                            style={{
                              borderImage: selectedTierIndex === idx && !isUsingCustomAmount
                                ? 'linear-gradient(135deg, #ca8a04 0%, #eab308 50%, #ca8a04 100%) 1'
                                : 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #18181b 100%) 1',
                              borderWidth: '1.5px',
                              borderStyle: 'solid',
                              boxShadow: selectedTierIndex === idx && !isUsingCustomAmount
                                ? 'inset 0 1px 3px rgba(255, 255, 255, 0.12), inset 0 -1px 3px rgba(0, 0, 0, 0.6), 0 12px 24px -10px rgba(234, 179, 8, 0.25), 0 4px 12px rgba(0, 0, 0, 0.6)'
                                : 'inset 0 1px 2px rgba(255, 255, 255, 0.03), inset 0 -1px 2px rgba(0, 0, 0, 0.4), 0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                            }}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-mono font-black text-white uppercase">{tier.name}</span>
                              <span className="text-xs font-bold text-[#eab308] font-mono">{tier.price}</span>
                            </div>
                            <span className="text-[9.5px] font-mono text-emerald-400 uppercase tracking-widest block font-bold">{tier.credits} preloaded</span>
                            <p className="text-[11px] text-zinc-500 font-light leading-snug mt-2">{tier.desc}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Entering dynamic custom amount */}
                    <div className="p-4 bg-black/60 border border-zinc-900 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-500 block">Custom Allocation Ledger Amount</label>
                        <button 
                          onClick={() => {
                            setIsUsingCustomAmount(true);
                            setSelectedTierIndex(-1);
                          }}
                          className={`text-[9px] font-mono uppercase scroll-mt-2 ${
                            isUsingCustomAmount ? 'text-[#eab308] font-bold' : 'text-zinc-650'
                          }`}
                        >
                          Use Custom Amount
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                          <input 
                            type="number"
                            value={customSupportAmount}
                            onChange={(e) => {
                              setCustomSupportAmount(e.target.value);
                              setIsUsingCustomAmount(true);
                              setSelectedTierIndex(-1);
                            }}
                            placeholder="Enter any custom USD dollar support seed amount..."
                            className="w-full bg-black border border-zinc-850 rounded p-2.5 pl-9 text-xs font-mono text-zinc-200 focus:border-[#ca8a04] focus:outline-none"
                          />
                        </div>
                        {isUsingCustomAmount && customSupportAmount && (
                          <span className="text-[10px] font-mono text-emerald-400 shrink-0 font-bold">
                            + {Math.floor(parseFloat(customSupportAmount || '0') * 1.5)} BWSX minting value
                          </span>
                        )}
                      </div>
                    </div>

                  </div>

                </div>

                {/* SECURE BLOCK INTEGRATION FORM */}
                <div className="lg:col-span-5 space-y-6">
                  
                  <div className="p-6 bg-zinc-950 border border-[#ca8a04]/40 rounded-2xl relative shadow-2xl">
                    <span className="absolute top-3 right-3 flex h-1.5 w-1.5">
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#ca8a04]"></span>
                    </span>

                    <h4 className="text-xs font-mono uppercase font-black text-white tracking-widest pb-3 border-b border-zinc-900 mb-4">
                      Investment Allocation Form
                    </h4>

                    <form onSubmit={handleSupportMovementSubmit} className="space-y-4">
                      
                      <div className="space-y-1">
                        <label className="text-[8px] font-mono uppercase tracking-widest text-[#ca8a04] block">Sponsor Full Name</label>
                        <input 
                          type="text"
                          required
                          value={supportFormData.fullName}
                          onChange={(e) => setSupportFormData(prev => ({ ...prev, fullName: e.target.value }))}
                          placeholder="Your complete name"
                          className="w-full bg-black border border-zinc-850 rounded p-2 text-xs text-white focus:border-amber-500 focus:outline-none placeholder-zinc-700"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-mono uppercase tracking-widest text-[#ca8a04] block">Direct Contact Email address</label>
                        <input 
                          type="email"
                          required
                          value={supportFormData.email}
                          onChange={(e) => setSupportFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="Your email coordinates"
                          className="w-full bg-black border border-zinc-850 rounded p-2 text-xs text-white focus:border-amber-500 focus:outline-none placeholder-zinc-700"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-mono uppercase tracking-widest text-[#ca8a04] block">Associated Venture / Organization (Optional)</label>
                        <input 
                          type="text"
                          value={supportFormData.organization}
                          onChange={(e) => setSupportFormData(prev => ({ ...prev, organization: e.target.value }))}
                          placeholder="Your business syndicate or family office name"
                          className="w-full bg-black border border-zinc-850 rounded p-2 text-xs text-white focus:border-single focus:outline-none placeholder-zinc-700"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-mono uppercase tracking-widest text-[#ca8a04] block">Consensus Narrative Message (Optional)</label>
                        <textarea 
                          rows={2}
                          value={supportFormData.customMessage}
                          onChange={(e) => setSupportFormData(prev => ({ ...prev, customMessage: e.target.value }))}
                          placeholder="Leave an encouraging message to display in the Shared Ledger listings..."
                          className="w-full bg-black border border-zinc-855 rounded p-2 text-xs text-white focus:border-amber-500 focus:outline-none placeholder-zinc-700"
                        />
                      </div>

                      {formError && <p className="text-[10px] text-amber-500 font-mono text-left">{formError}</p>}

                      <button 
                        type="submit"
                        className="w-full py-3.5 bg-gradient-to-r from-[#ca8a04] to-yellow-500 hover:from-amber-600 hover:to-amber-500 text-black text-[9px] font-mono font-black uppercase tracking-widest rounded cursor-pointer"
                      >
                        Complete Support Form (Secure Gateway) ✓
                      </button>

                    </form>

                    <div className="mt-4 pt-4 border-t border-zinc-900 text-left">
                      <p className="text-[9px] text-zinc-550 leading-relaxed font-mono text-zinc-500">
                        * Allocations represent a financial membership support stake in Black Wall Street Inc. Mutual credits (BWSX) will be fully trade-ready inside the operating system upon general June 1st launches. Asé.
                      </p>
                    </div>

                  </div>

                  {/* Private Trust Deed decorative card panel */}
                  <div className="bg-zinc-950 border border-zinc-900 p-1.5 rounded-2xl relative overflow-hidden shadow-xl text-left group mt-6">
                    <div className="relative h-44 w-full rounded-xl overflow-hidden border border-zinc-900 shadow-inner flex items-end">
                      <img 
                        src="/bws_trust.png" 
                        alt="The Greenwood Trust Deed" 
                        className="absolute inset-0 w-full h-full object-cover brightness-[0.34] contrast-[1.12] group-hover:scale-103 transition-transform duration-700 select-none pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
                      <div className="relative p-4 z-10 space-y-0.5 pointer-events-none">
                        <span className="text-[7.5px] font-mono uppercase tracking-[0.2em] text-[#eab308] font-black">PRIVATE TRUST RE-ALIGNMENT</span>
                        <h4 className="text-xs font-mono font-black text-white uppercase tracking-wider">THE ESTES TRUST DEED</h4>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="text-[10px] text-zinc-400 font-light leading-relaxed">
                        By securing private shards in the mutual cooperative treasury, you are formally realigning raw credit circulation back into Greenwood&apos;s modern, self-governed financial infrastructure. Secure your family stake now for the June 1st launch.
                      </p>
                      <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500 pt-1 uppercase tracking-widest font-bold">
                        <span>Private Syndicate</span>
                        <span className="text-[#eab308]">100% Secure Guard</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* SOVEREIGN RECEIPT DIALOG MODAL */}
              {supportReceipt && (
                <div className="p-6 bg-emerald-950/10 border border-emerald-500/30 rounded-2xl space-y-4 shadow-xl text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 filter blur-xl rounded-full" />
                  
                  <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2.5">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-black flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 inline-block text-emerald-400" /> Secure Block Audit Logged
                    </span>
                    <button 
                      onClick={() => setSupportReceipt(null)} 
                      className="text-zinc-500 hover:text-white font-mono text-[9px] bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 uppercase"
                    >
                      Clear Receipt
                    </button>
                  </div>

                  <div className="space-y-2 text-xs font-mono text-zinc-330">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[8px] text-zinc-500 block">Sponsor Level:</span>
                        <strong className="text-white uppercase">{supportReceipt.tierName}</strong>
                      </div>
                      <div>
                        <span className="text-[8px] text-zinc-500 block">Cooperative Hash:</span>
                        <code className="text-emerald-400 text-[10px]">{supportReceipt.receiptHash}</code>
                      </div>
                      <div>
                        <span className="text-[8px] text-zinc-500 block">Wallet Allocation Height:</span>
                        <span className="text-[#eab308] block">Node Block #{supportReceipt.blockHeight}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-zinc-500 block">Allocated Time Index:</span>
                        <span className="text-zinc-300 block">{supportReceipt.timestamp}</span>
                      </div>
                    </div>

                    <div className="pt-3.5 border-t border-zinc-900 flex justify-between items-center">
                      <div>
                        <span className="text-[8.5px] font-mono text-zinc-500 uppercase tracking-widest block leading-none">Wallet Credits Minted:</span>
                        <strong className="text-white text-base mt-1.5 block font-mono">{supportReceipt.creditsMinted}.00 BWSX</strong>
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </motion.div>
          )}

          {activeTab === 'system-audit' && (
            <motion.div 
              key="system-audit-tab"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8 text-left"
            >
              {!isFounder ? (
                /* Glowing Gold Access Denied Warning Guard */
                <div className="bg-zinc-950 border border-red-500/30 p-8 rounded-2xl text-center space-y-4 max-w-md mx-auto shadow-[0_0_50px_rgba(239,68,68,0.1)]">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-500 animate-pulse">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-mono font-black uppercase text-white tracking-widest">Founder Workspace Protected</h3>
                    <p className="text-zinc-400 text-[11px] mt-2 leading-relaxed font-light font-mono">
                      This node is restricted to BWS Inc. Founders. Please authenticate your administrative credentials or activate the <strong className="text-[#eab308]">Simulator Gate</strong> switch in the header to run audit verification tools.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      if (!user) handleGuestSignIn();
                      setSimulateFounderMode(true);
                      setActiveTab('system-audit');
                    }}
                    className="w-full py-2.5 rounded bg-gradient-to-r from-[#ca8a04] to-yellow-500 text-black font-mono font-bold text-[9px] uppercase tracking-widest cursor-pointer hover:brightness-110"
                  >
                    Bypass via Simulator Gate
                  </button>
                </div>
              ) : (
                /* Actual Founder System Audit Page Workspace */
                <div className="space-y-8 animate-fade-in">
                  {/* Institutional Header Banner */}
                  <div className="relative rounded-2xl overflow-hidden border border-[#ca8a04]/20 shadow-xl bg-[#09090b]/90 p-6 sm:p-8">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(202,138,4,0.15),transparent)] pointer-events-none" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-full h-full opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between w-full h-full gap-4">
                      <div className="space-y-1.5 text-left">
                        <div className="inline-flex items-center space-x-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-[#eab308] font-mono text-[8px] uppercase tracking-widest font-black">
                          <ShieldCheck className="w-3 h-3 text-[#eab308]" />
                          <span>Administrative Ledger Command</span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-tight leading-none pt-1">
                          SYSTEM AUDIT PORTAL
                        </h3>
                        <p className="text-[10px] sm:text-xs text-zinc-400 font-light tracking-wide max-w-xl">
                          Real-time global monitor analyzing Black Wall Street distributed ledger trades, mutual resource lease blocks, and instructional synchronicities.
                        </p>
                      </div>

                      {/* Diagnostic Node Indicator */}
                      <div className="bg-zinc-950/80 border border-zinc-850 p-4 rounded-xl text-left font-mono text-[9px] text-zinc-400 space-y-1 self-start md:self-auto min-w-[200px]">
                        <p className="text-[#eab308] font-black uppercase">SYSTEM HEALTH: ONLINE</p>
                        <p>BLOCK HEIGHT: #{activeNodes + 50}</p>
                        <p>OPERATOR: {user?.displayName || 'System Administrator'}</p>
                        <p>EMAIL: {user?.email || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* High Level Metrics KPIs Bento Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl text-left space-y-1.5 shadow-md">
                      <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">Total Issuance Issued</span>
                      <strong className="text-lg font-mono font-extrabold text-white block mt-0.5">{totalBWSXCreditsMinted.toLocaleString()} BWSX</strong>
                      <span className="text-[7.5px] font-mono text-emerald-400 flex items-center gap-1">
                        ● CONSENSUS STABLE
                      </span>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl text-left space-y-1.5 shadow-md">
                      <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">Vault Utilization Rate</span>
                      <strong className="text-lg font-mono font-extrabold text-white block mt-0.5">
                        {materialResources.length > 0 ? ((materialResources.filter(r => r.isBooked).length / materialResources.length) * 100).toFixed(1) : '0.0'}%
                      </strong>
                      <span className="text-[7.5px] font-mono text-zinc-500 block">
                        {materialResources.filter(r => r.isBooked).length} of {materialResources.length} Assets Reserved
                      </span>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl text-left space-y-1.5 shadow-md">
                      <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">Active Academic Symposia</span>
                      <strong className="text-lg font-mono font-extrabold text-white block mt-0.5">{classrooms.length} Portals</strong>
                      <span className="text-[7.5px] font-mono text-[#eab308] block">
                        Google Meet API Configured
                      </span>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl text-left space-y-1.5 shadow-md">
                      <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">Total Audited Swaps</span>
                      <strong className="text-lg font-mono font-extrabold text-white block mt-0.5">{trades.length} Actions</strong>
                      <span className="text-[7.5px] font-mono text-[#eab308] flex items-center gap-1">
                        ● CRYPTO & FIAT ACTIVE
                      </span>
                    </div>
                  </div>

                  {/* Simulation Quick Inject Block */}
                  <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="text-left space-y-1">
                      <span className="text-[9px] font-mono text-[#eab308] uppercase tracking-widest font-black">Simulation Command Desk</span>
                      <p className="text-[11px] text-zinc-400 font-light max-w-md">
                        Use these administrative testing triggers to inject dynamic transactions, schedule new classroom portfolios, or toggle reservation lease locks.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button 
                        onClick={() => {
                          const id = `sim-tx-${Date.now()}`;
                          const isPurchase = Math.random() > 0.4;
                          const coins = ['BTC', 'ETH', 'SOL', 'USD', 'EUR'];
                          const chosenCoin = coins[Math.floor(Math.random() * coins.length)];
                          const coinVal = (Math.random() * (chosenCoin === 'BTC' ? 0.05 : chosenCoin === 'ETH' ? 0.8 : chosenCoin === 'SOL' ? 10 : 800)).toFixed(4);
                          const bwsxVal = (Math.random() * 2000 + 100).toFixed(2);
                          
                          const simulatedTrade: LedgerTrade = {
                            id,
                            timestamp: 'Just Now',
                            source: ['Kevington Trust', 'Bronzeville LLC', 'Alston Heirs', 'Douglas Family Office', 'Atlas Holdings'][Math.floor(Math.random() * 5)],
                            tradeType: 'Exchange Trade',
                            value: `${isPurchase ? '+' : '-'}${parseFloat(bwsxVal).toLocaleString()} BWSX`,
                            message: `Simulated swap: ${isPurchase ? 'Received' : 'Exchanged'} ${coinVal} ${chosenCoin} into distributed ledger credits via secure node.`
                          };

                          setTrades(prev => [simulatedTrade, ...prev]);
                          playSovereignChime();
                        }}
                        className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-white font-mono text-[9px] uppercase tracking-wider hover:bg-zinc-850 cursor-pointer flex items-center gap-1"
                      >
                        <TrendingUp className="w-3 h-3 text-[#eab308]" /> + Ledger Log
                      </button>

                      <button 
                        onClick={() => {
                          const titles = [
                            'Real Estate Trust Acquisition Framework',
                            'Freight Operations & Autonomous Dispatch',
                            'Modernizing the Freedmen’s Bureau Ledger',
                            'Decentralized Cloud Mesh Setup Workshop',
                            'High-End Creator Media Syndicate Formation'
                          ];
                          const instructors = ['Dr. Claud Anderson Jr.', 'Educator Steward Smith', 'Prof. Angela Davis Heirs', 'Co-op Guildholder', 'Estes Tech Guild'];
                          const categories = ['Applied Trades', 'Sovereign Trusts', 'Cooperative Logistics', 'Heritage Crafts', 'Wellness & Aesthetics'];
                          
                          const randClass: ClassroomSession = {
                            id: `sim-cls-${Date.now()}`,
                            title: titles[Math.floor(Math.random() * titles.length)],
                            instructor: instructors[Math.floor(Math.random() * instructors.length)],
                            dateTime: new Date(Date.now() + 86400000 * (Math.floor(Math.random() * 5) + 1)).toISOString().slice(0, 16).replace('T', ' '),
                            meetLink: 'https://meet.google.com/bws-community-class',
                            description: 'Simulated high-end educational node convened globally for real-time asset alignment reviews.',
                            category: categories[Math.floor(Math.random() * categories.length)] as any,
                            status: 'SCHEDULED'
                          };
                          setClassrooms(prev => [randClass, ...prev]);
                          playSovereignChime();
                        }}
                        className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-white font-mono text-[9px] uppercase tracking-wider hover:bg-zinc-850 cursor-pointer flex items-center gap-1"
                      >
                        <Calendar className="w-3 h-3 text-[#eab308]" /> + Class Meet
                      </button>

                      <button 
                        onClick={() => {
                          setMaterialResources(prev => {
                            if (prev.length === 0) return prev;
                            const index = Math.floor(Math.random() * prev.length);
                            return prev.map((item, i) => {
                              if (i === index) {
                                return { ...item, isBooked: !item.isBooked };
                              }
                              return item;
                            });
                          });
                          playSovereignChime();
                        }}
                        className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-white font-mono text-[9px] uppercase tracking-wider hover:bg-zinc-850 cursor-pointer flex items-center gap-1"
                      >
                        <Database className="w-3 h-3 text-[#eab308]" /> Toggle Reservation
                      </button>
                    </div>
                  </div>

                  {/* Big Unified Tabbed Auditing Tables */}
                  <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-lg p-5 space-y-6">
                    
                    {/* AUDIT SECTION 1: GLOBAL DISTRIBUTED LEDGER TRADES */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-[#eab308] animate-pulse" />
                          <h4 className="text-xs font-mono font-black uppercase text-white tracking-widest">
                            Audit Stream A: Distributed Ledger Activity ({trades.length} records)
                          </h4>
                        </div>
                        <span className="text-[7.5px] font-mono text-zinc-500 uppercase bg-zinc-900 px-2.5 py-0.5 rounded border border-zinc-850">
                          REGISTRY TIMELINE STAMPS
                        </span>
                      </div>

                      {/* Spreadsheet-style Trade Log Table */}
                      <div className="overflow-x-auto rounded-lg border border-zinc-900">
                        <table className="w-full text-left font-mono text-[10px] border-collapse">
                          <thead>
                            <tr className="bg-black/80 text-zinc-400 border-b border-zinc-850 uppercase tracking-wider">
                              <th className="p-3 font-semibold">Block Age</th>
                              <th className="p-3 font-semibold">Identity / Cooperator</th>
                              <th className="p-3 font-semibold text-center">Trade Core</th>
                              <th className="p-3 font-semibold">Message & Log Shard</th>
                              <th className="p-3 font-semibold text-right">Credit Value</th>
                              <th className="p-3 font-semibold text-center">Hash Node</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900 text-zinc-300">
                            {trades.map((trade, i) => {
                              const isPositive = trade.value?.startsWith('+');
                              return (
                                <tr key={trade.id || i} className="hover:bg-zinc-900/20 transition-all">
                                  <td className="p-3 font-bold text-zinc-500 whitespace-nowrap">{trade.timestamp}</td>
                                  <td className="p-3 font-bold text-white uppercase whitespace-nowrap">{trade.source}</td>
                                  <td className="p-3 text-center">
                                    <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-850 rounded text-zinc-400 text-[8px] uppercase">
                                      {trade.tradeType}
                                    </span>
                                  </td>
                                  <td className="p-3 font-light text-zinc-400 text-xs min-w-[250px]">{trade.message}</td>
                                  <td className="p-3 text-right whitespace-nowrap font-mono font-bold">
                                    <span className={isPositive ? 'text-emerald-400' : 'text-amber-400'}>
                                      {trade.value}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center whitespace-nowrap">
                                    <code className="text-[#ca8a04]/80 text-xs">
                                      {trade.id ? trade.id.substring(0, 10).toUpperCase() : 'SHA256SEC'}
                                    </code>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* AUDIT SECTION 2: MATERIAL RESOURCE LEASE POOL */}
                    <div className="space-y-3 pt-4">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-[#eab308]" />
                          <h4 className="text-xs font-mono font-black uppercase text-white tracking-widest">
                            Audit Stream B: Material Asset Land Lease Ledger ({materialResources.length} assets)
                          </h4>
                        </div>
                        <span className="text-[7.5px] font-mono text-zinc-500 uppercase bg-zinc-900 px-2.5 py-0.5 rounded border border-zinc-850">
                          COOPERATIVE INVENTORY MATRIX
                        </span>
                      </div>

                      {/* Resource Inventory Spreadsheet */}
                      <div className="overflow-x-auto rounded-lg border border-zinc-900">
                        <table className="w-full text-left font-mono text-[10px] border-collapse">
                          <thead>
                            <tr className="bg-black/80 text-zinc-400 border-b border-zinc-850 uppercase tracking-wider">
                              <th className="p-3 font-semibold text-left">Resource ID</th>
                              <th className="p-3 font-semibold">Material Asset Name</th>
                              <th className="p-3 font-semibold text-center">Category</th>
                              <th className="p-3 font-semibold">Owner / Custodian</th>
                              <th className="p-3 font-semibold text-center">Reservation</th>
                              <th className="p-3 font-semibold text-right">Fee Rate (BWSX)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900 text-zinc-300">
                            {materialResources.map((res, i) => (
                              <tr key={res.id || i} className="hover:bg-zinc-900/20 transition-all">
                                <td className="p-3 text-zinc-500 whitespace-nowrap font-bold">#{res.id.toUpperCase()}</td>
                                <td className="p-3 font-bold text-white uppercase whitespace-nowrap">{res.name}</td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-850 rounded text-[8.5px] uppercase">
                                    {res.category}
                                  </span>
                                </td>
                                <td className="p-3 text-zinc-300 uppercase whitespace-nowrap">{res.ownerName}</td>
                                <td className="p-3 text-center whitespace-nowrap font-mono">
                                  {res.isBooked ? (
                                    <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/35 text-[#eab308] rounded-full text-[8px] uppercase tracking-wider font-extrabold animate-pulse">
                                      Reserved / Locked
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[8px] uppercase tracking-wider">
                                      Ready / Available
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-right whitespace-nowrap font-mono">
                                  <strong className="text-white">{res.creditCost}.00 BWSX</strong>
                                  <span className="text-[7.5px] text-zinc-500 block italic">Per 24h Blocks</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* AUDIT SECTION 3: ACADEMY INSTRUCTIONAL SYNPASES */}
                    <div className="space-y-3 pt-4">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#eab308]" />
                          <h4 className="text-xs font-mono font-black uppercase text-white tracking-widest">
                            Audit Stream C: Scheduled Group Classroom Convenings ({classrooms.length} active sessions)
                          </h4>
                        </div>
                        <span className="text-[7.5px] font-mono text-zinc-500 uppercase bg-zinc-900 px-2.5 py-0.5 rounded border border-zinc-850">
                          EDUCATIONAL GUILD PORTALS
                        </span>
                      </div>

                      {/* Scheduled Classes Spreadsheet */}
                      <div className="overflow-x-auto rounded-lg border border-zinc-900">
                        <table className="w-full text-left font-mono text-[10px] border-collapse">
                          <thead>
                            <tr className="bg-black/80 text-zinc-400 border-b border-zinc-850 uppercase tracking-wider">
                              <th className="p-3 font-semibold">Epoch Scheduled</th>
                              <th className="p-3 font-semibold">Instructing Educator Steward</th>
                              <th className="p-3 font-semibold">Classroom Topic</th>
                              <th className="p-3 font-semibold">Virtual Portal Mode</th>
                              <th className="p-3 font-semibold">Guild Classification</th>
                              <th className="p-3 font-semibold text-right">Coordinates Link</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900 text-zinc-300">
                            {classrooms.map((cls, i) => (
                              <tr key={cls.id || i} className="hover:bg-zinc-900/20 transition-all">
                                <td className="p-3 text-[#eab308] whitespace-nowrap font-bold font-mono">{cls.dateTime}</td>
                                <td className="p-3 uppercase text-white whitespace-nowrap">{cls.instructor}</td>
                                <td className="p-3 text-xs font-bold text-zinc-300 uppercase leading-snug min-w-[200px]">{cls.title}</td>
                                <td className="p-3 whitespace-nowrap uppercase text-zinc-500">
                                  {cls.meetLink?.includes('google') ? 'Google Meet API active' : 'Fallback Virtual Hub'}
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <span className="px-2 py-0.5 bg-zinc-900 text-[#eab308]/80 text-[8px] uppercase border border-[#ca8a04]/30 rounded">
                                    {cls.category || 'Economic Design'}
                                  </span>
                                </td>
                                <td className="p-3 text-right whitespace-nowrap font-bold">
                                  <a 
                                    href={cls.meetLink || '#'} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-emerald-400 hover:underline hover:text-emerald-300 flex items-center gap-1 justify-end text-[9px]"
                                  >
                                    View Link ↗
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 7: MY PROFILE HUB & COMMUNITY DIRECTORY */}
          {activeTab === 'profile' && user && (
            <motion.div 
              key="profile-tab"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8 text-left"
            >
              {/* Profile Intro Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-zinc-950 to-zinc-900 border border-[#ca8a04]/40 relative overflow-hidden shadow-[0_0_20px_rgba(202,138,4,0.1)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#ca8a04]/5 rounded-full blur-[60px] pointer-events-none" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-600 to-amber-400 p-0.5 shadow-[0_0_15px_rgba(202,138,4,0.25)] flex items-center justify-center text-black font-black text-xl">
                      {userProfile?.displayName ? userProfile.displayName.substring(0, 2).toUpperCase() : user.displayName?.substring(0, 2).toUpperCase() || 'CO'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                          {userProfile?.displayName || user.displayName || 'Co-op Partner'}
                        </h2>
                        <span className="px-2.5 py-0.5 bg-[#ca8a04]/20 border border-[#ca8a04]/40 rounded text-[#eab308] text-[8px] font-mono uppercase tracking-widest font-black">
                          {userProfile?.role === 'admin' ? 'Cooperative Trustee' : 'Verified Cooperator'}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-zinc-500 mt-1">{user.email}</p>
                      <p className="text-[10px] text-zinc-400 font-mono mt-1 uppercase tracking-widest">{userProfile?.organization || 'Independent Family Trust'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 border-l border-zinc-800/60 pl-0 md:pl-6 text-center">
                    <div className="bg-black/40 border border-zinc-900 rounded-lg p-3 min-w-[110px]">
                      <span className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-widest block font-bold leading-none">Wallet standing</span>
                      <strong className="text-sm font-mono text-[#eab308] mt-2 block font-black leading-none">
                        {(userProfile?.balance ?? userBWSXBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} BWSX
                      </strong>
                    </div>

                    <div className="bg-black/40 border border-zinc-900 rounded-lg p-3 min-w-[110px]">
                      <span className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-widest block font-bold leading-none">Reserve Lease Spend</span>
                      <strong className="text-sm font-mono text-white mt-2 block font-black leading-none">
                        {(userProfile?.spending ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} BWSX
                      </strong>
                    </div>

                    <div className="bg-black/40 border border-zinc-900 rounded-lg p-3 min-w-[110px]">
                      <span className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-widest block font-bold leading-none">Classes Mastered</span>
                      <strong className="text-sm font-mono text-[#eab308] mt-2 block font-black leading-none">
                        {userProfile?.classesMastered ?? 0}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Edit Profile Form */}
                <div className="lg:col-span-5 bg-zinc-950/90 border border-zinc-900 p-6 rounded-2xl space-y-5">
                  <div className="flex items-center space-x-2 border-b border-zinc-900 pb-3">
                    <UserIcon className="w-4 h-4 text-[#eab308]" />
                    <h3 className="text-xs font-mono font-black uppercase text-white tracking-widest">
                      Modify Standings Metadata
                    </h3>
                  </div>

                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!user || user.uid === 'guest_sovereign_identity') return;
                      const dName = (e.currentTarget.elements.namedItem('dispName') as HTMLInputElement).value || '';
                      const orgName = (e.currentTarget.elements.namedItem('orgName') as HTMLInputElement).value || '';
                      const bioText = (e.currentTarget.elements.namedItem('bioText') as HTMLTextAreaElement).value || '';

                      try {
                        const pRef = doc(db, 'profiles', user.uid);
                        await setDoc(pRef, {
                          displayName: dName,
                          organization: orgName,
                          bio: bioText
                        }, { merge: true });
                        alert("Profile updated successfully!");
                      } catch (err) {
                        console.error(err);
                        alert("Profile write authorization error.");
                      }
                    }}
                    className="space-y-4 text-xs font-mono"
                  >
                    <div>
                      <label className="text-zinc-500 uppercase tracking-wider block mb-1.5">Profile Display Name</label>
                      <input 
                        type="text"
                        name="dispName"
                        defaultValue={userProfile?.displayName || user.displayName || ''}
                        required
                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded p-2.5 focus:outline-none focus:border-[#ca8a04]"
                      />
                    </div>

                    <div>
                      <label className="text-zinc-500 uppercase tracking-wider block mb-1.5">Family Estate / Trust LLC</label>
                      <input 
                        type="text"
                        name="orgName"
                        defaultValue={userProfile?.organization || ''}
                        placeholder="e.g. Greenwood Living Estate"
                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded p-2.5 focus:outline-none focus:border-[#ca8a04]"
                      />
                    </div>

                    <div>
                      <label className="text-zinc-500 uppercase tracking-wider block mb-1.5">Personal Thesis / Bio</label>
                      <textarea 
                        name="bioText"
                        rows={4}
                        defaultValue={userProfile?.bio || ''}
                        placeholder="Declare your cooperative economic thesis here..."
                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded p-2.5 focus:outline-none focus:border-[#ca8a04] resize-none"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-3 rounded bg-gradient-to-r from-[#ca8a04] to-yellow-500 text-black font-black uppercase tracking-widest cursor-pointer hover:shadow-[0_0_15px_rgba(234,179,8,0.2)] transition-all"
                    >
                      Update Profile Record ✍️
                    </button>
                  </form>
                </div>

                {/* BWS Cooperator Directory */}
                <div className="lg:col-span-7 bg-zinc-950/90 border border-zinc-900 p-6 rounded-2xl flex flex-col space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                    <div className="flex items-center space-x-2">
                      <Award className="w-4 h-4 text-[#eab308]" />
                      <h3 className="text-xs font-mono font-black uppercase text-white tracking-widest">
                        BWS Certified Cooperator Directory
                      </h3>
                    </div>
                    <span className="text-[8px] font-mono uppercase bg-zinc-900 py-1 px-2 border border-zinc-850 rounded text-zinc-500">
                      Decentralized Registry
                    </span>
                  </div>

                  <p className="text-[10px] text-zinc-500 leading-relaxed font-mono uppercase">
                    Below is the live registry of all active family trusts and cooperators presently plugged into the BWS economic ecosystem. 
                  </p>

                  <div className="overflow-x-auto flex-1 rounded-lg border border-zinc-900 bg-black/30">
                    <table className="w-full text-left font-mono text-[10px] border-collapse">
                      <thead>
                        <tr className="bg-black text-zinc-500 border-b border-zinc-900 uppercase text-[8px] tracking-wider">
                          <th className="p-3 font-semibold">Steward Nickname</th>
                          <th className="p-3 font-semibold">Living Trust/LLC</th>
                          <th className="p-3 font-semibold text-right">Balance</th>
                          <th className="p-3 font-semibold text-right">Classes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900 text-zinc-300">
                        {profilesDirectory.map((coop, index) => (
                          <tr key={coop.uid || index} className="hover:bg-zinc-900/10 transition-all font-mono">
                            <td className="p-3 font-black text-white uppercase flex items-center gap-1.5 whitespace-nowrap">
                              <span>{coop.role === 'admin' ? '👑' : '🔸'}</span>
                              <span>{coop.displayName}</span>
                            </td>
                            <td className="p-3 text-zinc-400 truncate max-w-[150px]">
                              {coop.organization || 'Independent Cooperator'}
                            </td>
                            <td className="p-3 text-right font-bold text-[#eab308] whitespace-nowrap">
                              {coop.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 })} BWSX
                            </td>
                            <td className="p-3 text-right text-zinc-500 whitespace-nowrap font-bold">
                              {coop.classesMastered || 0}
                            </td>
                          </tr>
                        ))}
                        {profilesDirectory.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-zinc-500 uppercase tracking-wide font-mono">
                              No active database cooperators loaded on this decentralized segment.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 8: AUTHORITATIVE ADMINISTRATIVE COMMAND CONSOLE */}
          {activeTab === 'admin-controls' && (user?.email === 'iamwhoiambook@gmail.com' || userProfile?.role === 'admin') && (
            <motion.div 
              key="admin-tab"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8 text-left"
            >
              {/* Shield Protection Header */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-black to-zinc-950 border border-yellow-600/40 relative overflow-hidden shadow-[0_0_25px_rgba(234,179,8,0.08)]">
                <div className="absolute top-0 right-0 w-80 h-80 bg-yellow-600/5 rounded-full blur-[90px] pointer-events-none" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-mono font-black text-[#eab308] uppercase tracking-widest flex items-center gap-2">
                      👑 Admin System Command Console
                    </h2>
                    <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-wider">
                      Authoritative Ledger Control Nodes • Active Admin: {user?.email}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-[8px] font-mono tracking-widest uppercase font-black">
                    Classified Trustee Node
                  </span>
                </div>
              </div>

              {/* Admin Metrics Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4">
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">Global User Registry</span>
                  <strong className="text-xl font-mono text-white mt-1.5 block font-black">{profilesDirectory.length} Active Standings</strong>
                </div>

                <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4">
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">Consensus Issued Supply</span>
                  <strong className="text-xl font-mono text-[#eab308] mt-1.5 block font-black">
                    {profilesDirectory.reduce((sum, p) => sum + (p.balance || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} BWSX
                  </strong>
                </div>

                <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4">
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">System Nodes Verified</span>
                  <strong className="text-xl font-mono text-emerald-400 mt-1.5 block font-black">{activeNodes} Online</strong>
                </div>

                <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4">
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">Cooperative Asset Volume</span>
                  <strong className="text-xl font-mono text-white mt-1.5 block font-black">
                    {profilesDirectory.reduce((sum, p) => sum + (p.spending || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} BWSX
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Admin Mint Form */}
                <div className="lg:col-span-4 bg-zinc-950 border border-zinc-900 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center space-x-2 border-b border-zinc-900 pb-3">
                    <Coins className="w-4 h-4 text-[#eab308]" />
                    <h3 className="text-xs font-mono font-black uppercase text-white tracking-widest">
                      Mint & Allocate BWSX
                    </h3>
                  </div>

                  <p className="text-[9.5px] text-zinc-500 font-mono tracking-wide uppercase leading-normal">
                    This admin exclusive tool facilitates direct cryptographic emission of newly minted BWSX credits into active cooperator accounts.
                  </p>

                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!adminMintEmail || !adminMintAmount) return;

                      const amountNum = parseFloat(adminMintAmount);
                      if (isNaN(amountNum) || amountNum <= 0) {
                        alert("Invalid emission amount.");
                        return;
                      }

                      // Find profile of beneficiary by email
                      const beneficiary = profilesDirectory.find(p => p.email.toLowerCase() === adminMintEmail.toLowerCase().trim());
                      if (!beneficiary) {
                        alert(`Beneficiary cooperator with email "${adminMintEmail}" not found in current network registry.`);
                        return;
                      }

                      try {
                        const bRef = doc(db, 'profiles', beneficiary.uid);
                        await updateDoc(bRef, {
                          balance: beneficiary.balance + amountNum
                        });

                        // Record System Mint transaction log in communal ledger
                        const recordId = generateStaticId('system-mint');
                        const ts = new Date().toISOString();
                        const tradeData = {
                          id: recordId,
                          timestamp: ts,
                          hash: generateSystemHash(),
                          sourceName: 'Decentralized Trustee',
                          tradeType: 'System Mint',
                          bwsxAmount: `+${amountNum.toFixed(2)} BWSX`,
                          customMsg: `Administrative Mint & Seeding completed. Allocated standing limits to "${beneficiary.displayName}". Memo: "${adminMintMemo || 'Communal Expansion Plan'}"`,
                          userId: 'bwsx-network',
                          email: 'system.operator@bws.inc'
                        };
                        await setDoc(doc(db, 'trades', recordId), tradeData);

                        alert(`Cryptographic Emission Successful! Disbursed +${amountNum.toFixed(2)} BWSX to ${beneficiary.displayName}.`);
                        setAdminMintEmail('');
                        setAdminMintAmount('');
                        setAdminMintMemo('');
                      } catch (err) {
                        console.error("Administrative emission error: ", err);
                        alert("Mint writing operation crashed.");
                      }
                    }}
                    className="space-y-4 text-xs font-mono"
                  >
                    <div>
                      <label className="text-zinc-500 uppercase tracking-widest block mb-1 font-bold">Beneficiary Email</label>
                      <input 
                        type="email"
                        required
                        value={adminMintEmail}
                        placeholder="e.g. cooperator@trust.com"
                        onChange={e => setAdminMintEmail(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded p-2 focus:outline-none focus:border-[#ca8a04]"
                      />
                    </div>

                    <div>
                      <label className="text-zinc-500 uppercase tracking-widest block mb-1 font-bold">Emitted Units Amount</label>
                      <input 
                        type="number"
                        required
                        value={adminMintAmount}
                        placeholder="e.g. 5000"
                        onChange={e => setAdminMintAmount(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded p-2 focus:outline-none focus:border-[#ca8a04]"
                      />
                    </div>

                    <div>
                      <label className="text-zinc-500 uppercase tracking-widest block mb-1 font-bold">Memorandum Statement</label>
                      <input 
                        type="text"
                        value={adminMintMemo}
                        placeholder="e.g. Strategic seeding"
                        onChange={e => setAdminMintMemo(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded p-2 focus:outline-none focus:border-[#ca8a04]"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-black uppercase tracking-widest cursor-pointer inline-flex items-center justify-center gap-1.5 hover:shadow-[0_0_15px_rgba(202,138,4,0.3)] transition-all"
                    >
                      Authorize Dynamic Emission ⚡
                    </button>
                  </form>
                </div>

                {/* Administration Ledger Overlord Spreadsheet */}
                <div className="lg:col-span-8 bg-zinc-950 border border-zinc-900 p-6 rounded-2xl flex flex-col space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                      <h3 className="text-xs font-mono font-black uppercase text-white tracking-widest">
                        System-Wide Registry Management & Trustee Controls
                      </h3>
                    </div>
                  </div>

                  <p className="text-[9.5px] text-zinc-500 font-mono tracking-wide uppercase">
                    Direct access nodes to alter participant metadata, balance overrides, and role configurations instantly. Use with extreme discretion.
                  </p>

                  <div className="overflow-x-auto flex-1 rounded-lg border border-zinc-900 bg-black/30">
                    <table className="w-full text-left font-mono text-[9px] border-collapse">
                      <thead>
                        <tr className="bg-black text-zinc-500 border-b border-zinc-900 uppercase text-[8px] tracking-wider">
                          <th className="p-3 font-semibold">User Email</th>
                          <th className="p-3 font-semibold">Metadata Title</th>
                          <th className="p-3 font-semibold">Access standing</th>
                          <th className="p-3 font-semibold text-right">Credit Reserve</th>
                          <th className="p-3 font-semibold text-right">Override Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900 text-zinc-300">
                        {profilesDirectory.map((coop, index) => (
                          <tr key={coop.uid || index} className="hover:bg-zinc-900/10 transition-all font-mono">
                            <td className="p-3 font-bold text-white whitespace-nowrap">
                              {coop.email}
                            </td>
                            <td className="p-3 text-zinc-400 max-w-[120px] truncate uppercase font-bold">
                              {coop.displayName} • {coop.organization || 'Independent'}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[7px] uppercase font-black border ${
                                coop.role === 'admin' 
                                  ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                                  : 'bg-[#ca8a04]/10 border-[#ca8a04]/20 text-[#eab308]'
                              }`}>
                                {coop.role === 'admin' ? 'Cooperative Trustee' : 'Cooperator'}
                              </span>
                            </td>
                            <td className="p-3 text-right font-black text-white whitespace-nowrap">
                              {coop.balance?.toLocaleString()} BWSX
                            </td>
                            <td className="p-3 text-right whitespace-nowrap space-x-1 font-bold">
                              {/* Award 5000 BWSX */}
                              <button 
                                onClick={async () => {
                                  try {
                                    const bRef = doc(db, 'profiles', coop.uid);
                                    await updateDoc(bRef, {
                                      balance: (coop.balance || 0) + 5000
                                    });
                                    alert(`Seeded +5,000 BWSX standing to ${coop.displayName}!`);
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className="px-2 py-1 bg-[#ca8a04]/20 border border-[#ca8a04]/40 hover:bg-[#ca8a04]/45 text-[#eab308] rounded text-[7px] uppercase font-bold cursor-pointer"
                                title="Seed 5K Credits"
                              >
                                +5K ⚡
                              </button>

                              {/* Toggle Admin */}
                              <button 
                                onClick={async () => {
                                  try {
                                    const newRole = coop.role === 'admin' ? 'user' : 'admin';
                                    const bRef = doc(db, 'profiles', coop.uid);
                                    await updateDoc(bRef, {
                                      role: newRole
                                    });
                                    alert(`Toggled role on ${coop.displayName} to: ${newRole.toUpperCase()}!`);
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className="px-2 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white rounded text-[7px] uppercase font-bold cursor-pointer"
                                title="Toggle Admin/User Role Access"
                              >
                                Toggle Role
                              </button>

                              {/* Delete Profile */}
                              <button 
                                onClick={async () => {
                                  if (!confirm(`Are you absolutely sure you want to scrub profile record for "${coop.displayName}"?`)) return;
                                  try {
                                    await deleteDoc(doc(db, 'profiles', coop.uid));
                                    alert("Profile wiped from standings system catalog.");
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className="px-2 py-1 bg-red-950/40 border border-red-900/60 hover:bg-red-900/10 text-red-400 rounded text-[7px] uppercase font-bold cursor-pointer"
                                title="Scrub Record"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* INSTRUCTOR PAYOUT CENTER */}
              <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                  <div className="flex items-center space-x-2">
                    <Coins className="w-5 h-5 text-amber-500" />
                    <div>
                      <h3 className="text-xs font-mono font-black uppercase text-white tracking-widest">
                        Instructor Earnings & Payout Center
                      </h3>
                      <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">
                        Calculate class registrations and disburse payouts minus platform service fee
                      </p>
                    </div>
                  </div>
                  {/* Platform Fee Control */}
                  <div className="flex items-center gap-2 bg-black/60 border border-zinc-900 px-3 py-1.5 rounded-lg">
                    <span className="text-[8px] font-mono text-zinc-400 uppercase tracking-widest font-bold">Platform Retained Fee:</span>
                    <select 
                      value={platformFeePercent}
                      onChange={(e) => setPlatformFeePercent(parseInt(e.target.value))}
                      className="bg-zinc-900 border border-zinc-800 text-[#eab308] text-[10px] rounded px-2 py-0.5 focus:outline-none font-mono"
                    >
                      <option value="5">5% Fee</option>
                      <option value="10">10% Fee</option>
                      <option value="15">15% Fee</option>
                      <option value="20">20% Fee</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-zinc-900 bg-black/30">
                  <table className="w-full text-left font-mono text-[9px] border-collapse">
                    <thead>
                      <tr className="bg-black text-zinc-500 border-b border-zinc-900 uppercase text-[8px] tracking-wider">
                        <th className="p-3 font-semibold text-zinc-400">Scheduled Lesson Topic</th>
                        <th className="p-3 font-semibold text-right text-zinc-400">Tuition Fee</th>
                        <th className="p-3 font-semibold text-right text-zinc-400">Students</th>
                        <th className="p-3 font-semibold text-right text-zinc-400">Gross Total</th>
                        <th className="p-3 font-semibold text-right text-zinc-400">Platform Cut</th>
                        <th className="p-3 font-semibold text-right text-emerald-400">Net Due Transfer</th>
                        <th className="p-3 font-semibold text-zinc-400">Beneficiary Account</th>
                        <th className="p-3 font-semibold text-right text-zinc-400">Payout Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-zinc-300">
                      {classrooms.filter(c => (c.bwsxFee ?? 0) > 0).map((cls) => {
                        const fee = cls.bwsxFee ?? 0;
                        
                        // Calculated bookings based on deterministic baseline + real bookings
                        const hashOffset = (parseInt(cls.id.replace(/\D/g, '')) || 3) % 4 + 2;
                        const currentReg = registeredClassIds.includes(cls.id) ? 1 : 0;
                        const studentCount = hashOffset + currentReg;
                        const gross = fee * studentCount;
                        const platformCut = gross * (platformFeePercent / 100);
                        const netReward = gross - platformCut;

                        // pre-select matching co-op member/instructor by name
                        const fuzzyMatch = profilesDirectory.find(p => 
                          p.displayName?.toLowerCase().includes(cls.instructor.toLowerCase()) || 
                          cls.instructor.toLowerCase().includes(p.displayName?.toLowerCase() || '')
                        );

                        const targetUid = payoutTargetUids[cls.id] || fuzzyMatch?.uid || '';
                        const isPaidOut = paidOutClassIds.includes(cls.id);

                        return (
                          <tr key={cls.id} className="hover:bg-zinc-900/10 transition-all font-mono">
                            <td className="p-3 text-white">
                              <span className="text-[7.5px] uppercase tracking-wider text-zinc-500 block leading-none">{cls.category}</span>
                              <span className="font-bold text-xs uppercase leading-tight mt-1.5 block max-w-xs truncate">{cls.title}</span>
                              <span className="text-[8.5px] text-zinc-400 block mt-1 font-light">Lead Instructor: <strong className="text-zinc-300 font-bold">{cls.instructor}</strong></span>
                            </td>
                            <td className="p-3 text-right font-medium text-white whitespace-nowrap">
                              {fee} BWSX
                            </td>
                            <td className="p-3 text-right text-zinc-400 whitespace-nowrap font-bold">
                              {studentCount} Registered
                            </td>
                            <td className="p-3 text-right text-zinc-400 whitespace-nowrap">
                              {gross} BWSX
                            </td>
                            <td className="p-3 text-right text-red-400 whitespace-nowrap font-bold">
                              -{platformCut.toFixed(1)} BWSX ({platformFeePercent}%)
                            </td>
                            <td className="p-3 text-right text-emerald-400 whitespace-nowrap font-black">
                              +{netReward.toFixed(1)} BWSX
                            </td>
                            <td className="p-3">
                              {isPaidOut ? (
                                <span className="text-zinc-500 uppercase tracking-widest text-[7.5px] font-bold">Distributed</span>
                              ) : (
                                <select
                                  value={targetUid}
                                  onChange={(e) => setPayoutTargetUids(prev => ({ ...prev, [cls.id]: e.target.value }))}
                                  className="bg-black border border-zinc-800 rounded p-1 text-[9px] text-zinc-300 focus:outline-none focus:border-amber-500 w-full max-w-[150px] font-mono"
                                >
                                  <option value="">-- Choose Account --</option>
                                  {profilesDirectory.map(p => (
                                    <option key={p.uid} value={p.uid}>
                                      {p.displayName} ({p.balance} BWSX)
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap font-bold font-mono">
                              {isPaidOut ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[7.5px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded">
                                  Payout Complete ✓
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleInitiateInstructorPayout(cls.id, targetUid, netReward, platformCut, cls.title, cls.instructor)}
                                  className="px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-black text-[7.5px] uppercase tracking-widest font-black rounded cursor-pointer"
                                >
                                  Transfer Funds 💸
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {classrooms.filter(c => (c.bwsxFee ?? 0) > 0).length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-zinc-500 uppercase tracking-wide">
                            No active classes have tuition fees setup yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

      </main>

      {/* FOOTER METADATA CODES */}
      <footer className="border-t border-zinc-900 bg-black/40 py-10 px-6 sm:px-12 text-center text-zinc-500">
        <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-left font-mono">
            <span className="text-[10px] uppercase text-white font-bold tracking-widest block leading-none">BWS COOPERATIVE TRUST ALLIANCE</span>
            <span className="text-[8px] text-zinc-600 block mt-1.5 uppercase">Circulated for the Greenwood Community • Asé</span>
          </div>

          <div className="text-[8px] uppercase tracking-[0.2em] font-mono max-w-md text-left sm:text-right space-y-1">
            <p>BWS_TRUST_ID: {process.env.NEXT_PUBLIC_CLIENT_ID || '0b8f47e6-GREENWOOD_TRUST'}</p>
            <p>Secured with enterprise-grade encryption. Cooperative Registry Active.</p>
          </div>
        </div>
      </footer>

      {/* IMMERSIVE USER ONBOARDING BLUEPRINT DIALOG FLOW */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-lg z-[100] flex items-center justify-center p-4 sm:p-6 select-none"
            id="onboarding-modal-overlay"
          >
            {/* Soft Ambient Gold Aura behind modal */}
            <div className="absolute w-[400px] h-[400px] bg-[#ca8a04]/10 rounded-full blur-[120px] pointer-events-none -z-10" />

            <motion.div 
              initial={{ scale: 0.96, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="w-full max-w-lg bg-zinc-950/90 border border-[#ca8a04]/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_50px_rgba(234,179,8,0.1)] relative text-left overflow-hidden"
              id="onboarding-card-frame"
            >
              {/* Gold Top Trim */}
              <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-[#ca8a04] to-transparent" />

              {/* Onboarding Header */}
              <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded bg-[#ca8a04]/10 border border-[#ca8a04]/30 flex items-center justify-center">
                    <Sparkle className="w-3.5 h-3.5 text-[#eab308]" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-white font-bold leading-none">
                    BWS Inc. Community Blueprint
                  </span>
                </div>
                
                <span className="text-[8.5px] font-mono bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded text-[#eab308] font-black">
                  STEP 0{onboardingStep} OF 04
                </span>
              </div>

              {/* STEP 1: RESTORING LEGACY & BUILDING COMMUNITY */}
              {onboardingStep === 1 && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <span className="text-[9px] font-mono text-[#eab308] uppercase tracking-widest block font-bold">FOUNDATIONAL HERITAGE</span>
                    <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-none">
                      Reclaiming Greenwood&apos;s Economic Spirit
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-350 leading-relaxed font-light">
                      In 1921, our ancestors engineered Tulsa&apos;s Black Wall Street—a standard-setting, completely self-sustained ecosystem. They kept funds active within our families and community circles.
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed font-light">
                      BWS Inc. picks up where our ancestor visionaries left off. Rather than relying on predatory commercial intermediaries, we deploy cutting-edge coordination tools, shared ledger networks, and group resource pooling to rebuild sustainable Black economic independence.
                    </p>
                  </div>

                  {/* Bullet Highlights */}
                  <div className="space-y-2 border-t border-zinc-900/80 pt-4">
                    <div className="flex items-start space-x-2.5 text-xs text-zinc-400">
                      <span className="text-[#eab308] mt-0.5 font-bold font-mono">✊</span>
                      <span><strong>Community Reciprocity:</strong> Direct hour-for-hour and skill swaps between cooperator enterprises.</span>
                    </div>
                    <div className="flex items-start space-x-2.5 text-xs text-zinc-400">
                      <span className="text-[#eab308] mt-0.5 font-bold font-mono">🪙</span>
                      <span><strong>The Mutual Balance:</strong> Building tangible power through localized collective circulation.</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: EMPOWERING SELF-OWNERSHIP */}
              {onboardingStep === 2 && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <span className="text-[9px] font-mono text-[#eab308] uppercase tracking-widest block font-bold">BUSINESS INDEPENDENCE</span>
                    <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-none">
                      AI Lead Pipelines & Private Family Trusts
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-350 leading-relaxed font-light">
                      Real freedom is constructed, not granted. We empower you with technical operational frameworks and defensive asset protections.
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed font-light">
                      Through the Skill Academy, learn to set up autonomous outbound lead pipelines to scale your business using AI models. Then, learn how to secure structures, title assets, and deploy land deeds within private generalized trusts that keep wealth immune to external corporate interference.
                    </p>
                  </div>

                  {/* Bullet Highlights */}
                  <div className="space-y-2 border-t border-zinc-900/80 pt-4">
                    <div className="flex items-start space-x-2.5 text-xs text-zinc-400">
                      <span className="text-[#eab308] mt-0.5 font-bold font-mono">🤖</span>
                      <span><strong>AI Business Academy:</strong> Automated lead generation, client onboarding, and business platforms.</span>
                    </div>
                    <div className="flex items-start space-x-2.5 text-xs text-zinc-400">
                      <span className="text-[#eab308] mt-0.5 font-bold font-mono">🔒</span>
                      <span><strong>Family Estate Trusts:</strong> Safe holding legal instruments to shield our generations.</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: THE MATERIAL DEPOT & SHARING ENGINE */}
              {onboardingStep === 3 && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <span className="text-[9px] font-mono text-[#eab308] uppercase tracking-widest block font-bold">RESOURCE SHARING POOL</span>
                    <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-none">
                      The Material Vault & Cooperator Assets
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-350 leading-relaxed font-light">
                      Stop renting from commercial giants at inflated fees. Tap directly into the Shared Material Vault—our cooperative pool of physical resources.
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed font-light">
                      <strong>Any material asset is welcome</strong>—freight delivery vans, high-end content creator stabilizer cameras, wood carvers, workspaces, electronics, lawnmowers, specialized farming tools, commercial printers, or kitchen blocks. Catalog yours to earn credit standings, and spend BWSX credits to reserve fellow cooperators&apos; tools instantly.
                    </p>
                  </div>

                  {/* Bullet Highlights */}
                  <div className="space-y-2 border-t border-zinc-900/80 pt-4">
                    <div className="flex items-start space-x-2.5 text-xs text-zinc-400">
                      <span className="text-[#eab308] mt-0.5 font-bold font-mono">🚚</span>
                      <span><strong>Logistical Hubs:</strong> Rent and pool delivery vehicles or cargo fleets for group coordinates.</span>
                    </div>
                    <div className="flex items-start space-x-2.5 text-xs text-zinc-400">
                      <span className="text-[#eab308] mt-0.5 font-bold font-mono">🛒</span>
                      <span><strong>Everyday Tools:</strong> From cameras and laptops to lawnmowers or event cabins, use what you need.</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: CLAIM ACCOUNT STANDING & FREE WELCOME SEED */}
              {onboardingStep === 4 && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="space-y-2 text-center">
                    <span className="text-[9px] font-mono text-[#eab308] uppercase tracking-widest block font-bold">COOPERATIVE MEMBERSHIP REGISTRY</span>
                    <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-none">
                      Establish Your Standing
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed font-light max-w-md mx-auto">
                      State your unique nickname to draft your first registry record. We will instantly seed your wallet with <strong className="text-emerald-400">+20.00 BWSX Credits</strong> for you to start exploring and using resources!
                    </p>
                  </div>

                  {/* Nickname Form */}
                  <div className="p-4 bg-black/60 border border-zinc-900 rounded-2xl space-y-3.5 text-left">
                    <label className="text-[8px] font-mono uppercase tracking-widest text-[#ca8a04] block font-bold">
                      Cooperative Name / Handle
                    </label>
                    <input 
                      type="text"
                      required
                      value={onboardingNickname}
                      onChange={(e) => setOnboardingNickname(e.target.value)}
                      placeholder="e.g. Independent Carver, Leader Nia"
                      className="w-full bg-zinc-950 border border-zinc-850 rounded p-2.5 text-xs font-mono text-white focus:border-[#ca8a04] focus:outline-none placeholder-zinc-700 font-bold"
                    />

                    {/* Incentives panel */}
                    <div className="bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/25 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-emerald-400">🎉 Dynamic Welcome Allocation:</span>
                      <strong className="text-white">+20.00 BWSX Credits</strong>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Footer Walkthrough Actions */}
              <div className="flex items-center justify-between border-t border-zinc-900 pt-5 text-[10px] font-mono">
                {onboardingStep > 1 ? (
                  <button 
                    onClick={() => {
                      setOnboardingStep(prev => prev - 1);
                      setIsStepFourReady(false);
                    }}
                    className="text-zinc-500 hover:text-white uppercase font-bold px-3 py-1.5 rounded transition-all cursor-pointer"
                  >
                    ← Back
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      localStorage.setItem("bws_onboarding_completed_v3", "true");
                      setShowOnboarding(false);
                    }}
                    className="text-zinc-500 hover:text-zinc-300 uppercase px-3 py-1.5 cursor-pointer font-bold"
                  >
                    Skip to App
                  </button>
                )}

                {onboardingStep < 4 ? (
                  <button 
                    onClick={() => {
                      setOnboardingStep(prev => {
                        const next = prev + 1;
                        if (next === 4) {
                          setIsStepFourReady(false);
                        }
                        return next;
                      });
                    }}
                    className="px-5 py-2 rounded bg-zinc-900 border border-[#ca8a04]/40 text-[#eab308] hover:text-white uppercase font-bold tracking-widest flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    Next Guide <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button 
                    disabled={!isStepFourReady}
                    onClick={() => {
                      if (!isStepFourReady) return;
                      // Finalize onboarding standing activation
                      const finalizedName = onboardingNickname.trim() || 'Co-op Partner';
                      if (!onboardingNickname.trim()) {
                        setOnboardingNickname('Co-op Partner');
                      }
                      
                      // Auto log-in guest state with their selected nickname!
                      const customGuestUserObj = {
                        uid: 'guest_sovereign_identity',
                        displayName: finalizedName,
                        email: 'guest.patron@bws.inc',
                        emailVerified: true,
                        isAnonymous: true,
                        photoURL: null,
                        providerId: 'custom-guest',
                      };
                      setUser(customGuestUserObj as any);
                      setSupportFormData(prev => ({
                        ...prev,
                        fullName: finalizedName,
                        email: 'guest.patron@bws.inc'
                      }));

                      // Seed welcome balance
                      setUserBWSXBalance(prev => prev + 20.00);
                      setTotalBWSXCreditsMinted(prev => prev + 20);

                      // Append welcome log to Ledger scoreboard
                      const welcomeLog: LedgerTrade = {
                        id: generateStaticId('onboard-welcome'),
                        timestamp: 'Just Now',
                        source: finalizedName,
                        tradeType: 'Onboard Seed',
                        value: '+20.00 BWSX',
                        message: 'Cooperative standing initiated. Free BWSX credits granted to new registry account!'
                      };
                      setTrades(prev => [welcomeLog, ...prev]);

                      // Persist state in localStorage to prevent repeat popup
                      localStorage.setItem("bws_onboarding_completed_v3", "true");
                      setShowOnboarding(false);
                    }}
                    className={`px-5 py-2.5 rounded text-black uppercase font-black tracking-widest transition-all duration-350 ${
                      isStepFourReady 
                        ? "bg-gradient-to-r from-[#ca8a04] to-[#eab308] cursor-pointer shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:brightness-110 active:scale-[0.98]" 
                        : "bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed opacity-65"
                    }`}
                  >
                    {isStepFourReady ? "Activate Cooperative Standing ✓" : "Securing Registration..."}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SOVEREIGN LEVEL UP MODAL */}
      <AnimatePresence>
        {levelUpModal && levelUpModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Dark glassmorphic full blur background overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLevelUpModal(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-xl"
            />

            {/* Glowing gold backlighting effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full bg-[#ca8a04]/10 blur-[130px] animate-pulse" />

            {/* Centered Modal Content Card Grid */}
            <motion.div 
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-[#0c0c0e]/95 border border-[#ca8a04]/40 rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_80px_rgba(202,138,4,0.15)] overflow-hidden"
            >
              {/* Rotating premium gold sunbeam background rays inside card */}
              <div className="absolute inset-0 select-none opacity-20 pointer-events-none mix-blend-screen scale-110">
                <div className="w-full h-full animate-[spin_40s_linear_infinite] flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-[180%] h-[180%] text-[#eab308]">
                    {Array.from({ length: 18 }).map((_, i) => (
                      <line 
                        key={i}
                        x1="50" y1="50"
                        x2={50 + 50 * Math.cos((i * 20 * Math.PI) / 180)}
                        y2={50 + 50 * Math.sin((i * 20 * Math.PI) / 180)}
                        stroke="currentColor"
                        strokeWidth="0.4"
                        strokeDasharray="2 2"
                      />
                    ))}
                  </svg>
                </div>
              </div>

              {/* Top Sparkles Ornament */}
              <div className="absolute top-4 right-4 flex items-center space-x-1.5 text-[#eab308]/40 font-mono text-[8px] tracking-widest select-none">
                <Sparkles className="w-3.5 h-3.5 text-[#eab308] " />
                <span>COOPERATIVE MASTER REGISTRY</span>
              </div>

              {/* Elegant golden circular badge with award icon */}
              <div className="relative mt-4 mb-6 mx-auto w-24 h-24 flex items-center justify-center">
                
                {/* Rippling circle border 1 */}
                <motion.div 
                  className="absolute inset-0 rounded-full border-2 border-dashed border-[#ca8a04]/30"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
                />

                {/* Rippling circle border 2 */}
                <motion.div 
                  className="absolute -inset-2.5 rounded-full border border-double border-[#eab308]/25"
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
                />

                {/* Glassmorphic center with nested emblem */}
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-b from-[#18181b] to-black border border-[#ca8a04] p-0.5 flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                    <Award className="w-7 h-7 text-[#eab308] animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Monospace Rank Announcement */}
              <div className="space-y-1 mb-4 relative z-10">
                <div className="inline-flex items-center space-x-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-[#eab308] font-mono text-[8.5px] uppercase tracking-widest font-black">
                  <Sparkle className="w-2.5 h-2.5 text-[#eab308] fill-[#eab308]" />
                  <span>Standing Upgrade Unlocked</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight font-sans pt-1">
                  Academy Leader
                </h2>
                <p className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                  Verified Cooperative Ecosystem Credentials
                </p>
              </div>

              {/* Class Mastery Overview */}
              <div className="bg-zinc-950/80 border border-zinc-900 rounded-2xl p-4 mb-6 space-y-3.5 text-left font-mono text-xs relative z-10">
                <div className="flex items-start justify-between gap-4 border-b border-zinc-900 pb-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-[8px] text-zinc-500 block uppercase">Competency Unit Mastered</span>
                    <strong className="text-white text-[11px] block mt-0.5 leading-snug uppercase truncate" title={levelUpModal.lessonTitle}>{levelUpModal.lessonTitle}</strong>
                  </div>
                  <span className="text-[8px] bg-[#ca8a04]/10 border border-[#ca8a04]/30 px-2 py-0.5 text-[#eab308] rounded uppercase font-bold text-right shrink-0">
                    {levelUpModal.category}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[8px] text-zinc-500 block uppercase">Cooperator Identity</span>
                    <span className="text-[11px] font-bold text-white mt-0.5 block truncate">
                      {user ? user.displayName || 'Academy Student' : 'Academy Student'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-zinc-500 block uppercase">BWSX Reward Minted</span>
                    <span className="text-[11px] font-bold text-emerald-400 mt-0.5 block">
                      +{levelUpModal.creditsReward}.00 BWSX Credits
                    </span>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-2.5 flex items-center justify-between text-[8px] text-zinc-500">
                  <span>REGISTRY RECORD HEIGHT: #{activeNodes + 50}</span>
                  <span className="text-emerald-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> TRUSTEE VERIFIED
                  </span>
                </div>
              </div>

              {/* Informative message */}
              <p className="text-zinc-400 text-xs text-center font-light leading-relaxed mb-6 px-4 relative z-10">
                Your standing value is verified. By acquiring this practical framework competency, your status is elevated. Tap your wealth standing to claim credits and return to the active curriculum modules.
              </p>

              {/* Call to action button to seal */}
              <motion.button
                whileHover={{ scale: 1.02, filter: 'brightness(1.08)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setLevelUpModal(null)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#ca8a04] via-[#eab308] to-[#ca8a04] text-black text-xs font-mono font-bold uppercase tracking-widest shadow-[0_4px_30px_rgba(234,179,8,0.25)] flex items-center justify-center gap-2 cursor-pointer relative z-10"
              >
                <span>Save Academy Standing</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FIXED ANCESTOR CHAT WIDGET - FEATURING THE OLDER WOMAN SEER */}
      <AncestorChatWidget />

      {/* Toast Notification for Share confirmation */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[100] max-w-sm p-4 bg-zinc-950 border border-amber-500/40 shadow-[0_4px_30px_rgba(234,179,8,0.25)] rounded-xl flex items-start gap-3"
            role="alert"
          >
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-500 flex-shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#eab308] mb-0.5">LEDGER BROADCAST</h5>
              <p className="text-[11px] font-mono text-zinc-300 leading-relaxed">{toastMessage}</p>
            </div>
            <button 
              onClick={() => setToastMessage(null)} 
              className="text-zinc-500 hover:text-zinc-300 text-xs font-bold font-mono transition-colors cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
