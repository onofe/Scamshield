/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { 
  Shield, 
  Search, 
  Mic, 
  Link as LinkIcon, 
  Users, 
  BookOpen, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Loader2,
  Upload,
  X,
  Square,
  Play,
  Copy,
  Share2,
  RefreshCw,
  WifiOff,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Tab = 'Analyze' | 'Voice' | 'Links' | 'Community' | 'Learn';

interface AnalysisResult {
  verdict: 'SCAM' | 'SUSPICIOUS' | 'LIKELY SAFE';
  confidence: number;
  red_flags: string[];
  explanation: string;
  pidgin_explanation: string;
  recommendation: string;
}

interface VoiceAnalysisResult extends AnalysisResult {
  transcript_summary: string;
  deepfake_likelihood: 'LIKELY AI' | 'UNCERTAIN' | 'LIKELY HUMAN';
  deepfake_reasoning: string;
}

interface LinkAnalysisResult {
  type: 'link' | 'phone' | 'account';
  verdict: 'HIGH RISK' | 'SUSPICIOUS' | 'LOOKS OKAY';
  confidence: number;
  specific_concerns: string[];
  explanation: string;
  pidgin_explanation: string;
  recommendation: string;
  similarity_alert?: string;
  domain_age?: string;
}

interface ScamReport {
  id: string;
  type: string;
  target: string;
  evidence: string;
  timestamp: number;
  upvotes: number;
  aiVerified?: boolean;
}

const ENCYCLOPEDIA_DATA = [
  {
    title: "Fake Job / Registration Fee",
    howItWorks: "Scammers post high-paying jobs on social media or via SMS. They then ask you to pay a small fee for 'ID cards', 'uniforms', or 'registration' before you can start.",
    example: "Urgent recruitment at NNPC! Salary ₦350k. Pay ₦5,000 for your staff ID card to start tomorrow. Account: 0234567890 Opay.",
    signs: ["Requests for money before work starts", "Unprofessional email addresses", "Urgent pressure to pay"],
    whatToDo: "Never pay money to get a job. Real companies never ask for recruitment fees."
  },
  {
    title: "Emergency Voice Note (Deepfake)",
    howItWorks: "Scammers use AI to clone the voice of your relative or friend. They send a voice note claiming they are in an accident or police trouble and need urgent money.",
    example: "Bros, it's me! I'm at the police station, they won't let me call. Please send ₦50k to this bail officer's account sharp sharp!",
    signs: ["Voice sounds slightly robotic", "Urgent emotional pressure", "Request to send money to a stranger's account"],
    whatToDo: "Call the person directly on their known phone number to verify. Ask a personal question only they would know."
  },
  {
    title: "Ponzi / Investment (CBEX-style)",
    howItWorks: "Promises of 'doubling' your money in minutes or hours. They often use terms like 'Binary Trading' or 'Crypto Mining' to sound legitimate.",
    example: "Invest ₦10,000 and get ₦20,000 in 45 minutes! Join the new WhatsApp group for binary trading. 100% guaranteed.",
    signs: ["Unrealistic returns", "Emphasis on recruiting others", "No real product or service"],
    whatToDo: "If it sounds too good to be true, it is. Block the sender and leave the group."
  },
  {
    title: "Fake Bank Alert",
    howItWorks: "A buyer 'pays' for your goods and shows you a fake SMS alert on their phone, or you receive a fake SMS that looks like it's from your bank.",
    example: "Credit: ₦150,000.00. Desc: TRF/John Doe. Date: 09-Apr-2026. Bal: ₦150,450.00.",
    signs: ["SMS comes from a regular phone number", "Balance doesn't update in your bank app", "Buyer is in a huge hurry to leave"],
    whatToDo: "Always check your actual bank app balance. Do not rely on SMS alerts."
  },
  {
    title: "Romance Scam",
    howItWorks: "Scammers create fake profiles on dating apps or social media. They build a relationship over weeks, then suddenly have an 'emergency' requiring money.",
    example: "My love, I'm stuck at the airport and they are seizing my goods. I need ₦80k to clear the customs fee so I can come see you.",
    signs: ["Refusal to video call", "Relationship moves very fast", "Sudden requests for money for 'emergencies'"],
    whatToDo: "Never send money to someone you haven't met in person, no matter how much you 'love' them."
  },
  {
    title: "Lottery / Prize Win",
    howItWorks: "You receive a message saying you've won a huge prize from a big brand (MTN, Dangote, etc.). You just need to pay a 'processing fee' or send airtime to claim it.",
    example: "Congratulations! Your mobile number has won ₦5,000,000 in the Coca-Cola Promo. To claim, call 08012345678 or send ₦2,000 airtime.",
    signs: ["You didn't enter any promo", "Requests for payment to receive a prize", "Uses names of famous brands without official links"],
    whatToDo: "Ignore it. Real promos don't ask winners to pay to receive their prizes."
  },
  {
    title: "Loan App Extortion",
    howItWorks: "Unlicensed loan apps offer quick cash but then harass your entire contact list with defamatory messages if you are even one day late on repayment.",
    example: "NOTICE: John Doe is a chronic debtor and thief. He used your name as a guarantor. Call him to pay his debt now or we will report you too.",
    signs: ["Extremely high interest rates", "Requests access to your contacts", "Aggressive and rude customer service"],
    whatToDo: "Only use licensed financial institutions. Report harassment to the FCCPC or Google Play Store."
  },
  {
    title: "Impersonation (EFCC, CBN, Police)",
    howItWorks: "Scammers pretend to be officials from the EFCC, CBN, or Police. They claim you are under investigation or your account is blocked and demand money to 'settle' it.",
    example: "This is the EFCC Cybercrime Unit. We have flagged your account for fraudulent activity. Pay ₦100k fine now to avoid immediate arrest.",
    signs: ["Official agencies don't ask for 'settlement' via Opay/Palmpay", "Threats of immediate arrest", "Grammatical errors in 'official' messages"],
    whatToDo: "Do not panic. Official agencies will never ask for money over WhatsApp or SMS to stop an investigation."
  }
];

const QUIZ_DATA = [
  {
    text: "Your account will be restricted in 24hrs due to BVN mismatch. Click https://cbn-verify-bvn.xyz to update.",
    answer: "scam",
    explanation: "CBN does not send SMS links to update BVN. The link is a phishing site designed to steal your details."
  },
  {
    text: "Your transfer of ₦5,000 to John Doe was successful. Ref: 12345. Avail Bal: ₦45,000.",
    answer: "safe",
    explanation: "This is a standard bank transaction alert format with no suspicious links or urgent threats."
  },
  {
    text: "Hello, I am calling from your bank's head office. We noticed a suspicious login. Please tell me your OTP to block it.",
    answer: "scam",
    explanation: "Banks will NEVER ask for your OTP or PIN over the phone. Anyone asking for this is a scammer."
  },
  {
    text: "Urgent: We are hiring remote assistants. Salary is ₦150k/month. No experience needed. Message us to start.",
    answer: "suspicious",
    explanation: "While not an immediate scam, unsolicited job offers for high pay with no experience are often the start of a 'registration fee' scam."
  },
  {
    text: "Congratulations! You have won ₦50,000 airtime in the MTN Weekly Draw. Dial *123*PIN# to load.",
    answer: "scam",
    explanation: "MTN doesn't give away large amounts of airtime randomly. Scammers use this to get you to call premium numbers or click links."
  }
];

const SCAM_OF_THE_DAY_DATA = [
  {
    title: "Fake Job Recruitment",
    message: "Urgent recruitment at [h]NNPC[/h]! Salary is ₦350,000 monthly. Pay [h]₦5,000 registration fee[/h] to get your ID card and start tomorrow. [h]Limited slots[/h] available.",
    whatTheyWant: "Your money (registration fee) and your personal data for identity theft.",
    protection: [
      "Real companies never ask for money to hire you.",
      "Check official company websites for job listings.",
      "Ignore 'limited slots' pressure tactics."
    ]
  },
  {
    title: "Emergency Relative Scam",
    message: "Bros abeg, I get [h]accident for road[/h]. Send me ₦20k sharp sharp make I pay chemist. [h]Don't call me[/h], my speaker spoil. Use this [h]Palmpay 9012345678[/h].",
    whatTheyWant: "Quick cash sent to an untraceable digital wallet account.",
    protection: [
      "Always call the person directly on their known number.",
      "Ask a personal question only they would know.",
      "Be wary of requests to send money to unknown accounts."
    ]
  },
  {
    title: "Ponzi / Doubling Scheme",
    message: "[h]Double your money[/h] in 45 mins! Join the new WhatsApp group for [h]binary trading[/h]. Invest ₦10k and get ₦20k [h]instantly[/h].",
    whatTheyWant: "Your initial investment. They might pay you once to build trust, then disappear with a larger amount.",
    protection: [
      "If it sounds too good to be true, it is.",
      "There is no legal investment that doubles money in minutes.",
      "Avoid 'investment' groups on WhatsApp/Telegram."
    ]
  },
  {
    title: "Fake Bank BVN Alert",
    message: "Your account has been [h]restricted[/h] due to BVN mismatch. Click [h]https://cbn-verify-bvn.xyz[/h] to update now or [h]lose your funds[/h].",
    whatTheyWant: "Your BVN, bank details, and OTP to empty your account.",
    protection: [
      "Banks never send links to update BVN via SMS.",
      "Check the link carefully — official sites end in .gov.ng or .com.ng.",
      "Visit your bank branch in person for account issues."
    ]
  },
  {
    title: "Lottery / Prize Win",
    message: "Congratulations! Your mobile number has [h]won ₦5,000,000[/h] in the Dangote promo. To claim, call 08012345678 or [h]send ₦2,000 airtime[/h] for processing.",
    whatTheyWant: "Airtime or 'processing fees' from thousands of victims.",
    protection: [
      "You cannot win a promo you didn't enter.",
      "Official promos never ask for airtime to claim prizes.",
      "Verify promos on the official social media pages of the brand."
    ]
  },
  {
    title: "Romance / Gift Scam",
    message: "My love, I sent you a [h]surprise package[/h] from London. The courier says you need to pay [h]₦45,000 clearance fee[/h] to the local agent to deliver it [h]today[/h].",
    whatTheyWant: "Clearance fees for a non-existent package.",
    protection: [
      "Never pay for a 'gift' being sent to you.",
      "Clearance fees are paid to official customs, not personal accounts.",
      "Be skeptical of 'lovers' who ask for money before meeting."
    ]
  },
  {
    title: "Loan App Defamation",
    message: "URGENT: John Doe is a [h]thief and fraudster[/h]. He took a loan and vanished. You are his [h]guarantor[/h]. Pay his debt now or [h]we will post your face[/h] too.",
    whatTheyWant: "Repayment of high-interest loans through illegal harassment.",
    protection: [
      "Avoid unlicensed 'quick cash' apps.",
      "Do not give apps permission to access your contacts.",
      "Report harassment to the FCCPC immediately."
    ]
  }
];

const SCAM_TYPES = [
  "Fake Job",
  "Emergency Transfer",
  "Ponzi/Investment",
  "Fake Bank",
  "Romance Scam",
  "Lottery",
  "Other"
];

const SEED_REPORTS: ScamReport[] = [
  {
    id: "1",
    type: "Fake Job",
    target: "08031234521",
    evidence: "We are hiring for NNPC! Salary is ₦350,000 monthly. Pay ₦5,000 registration fee to get your ID card and start tomorrow. Account: 0234567890 Opay.",
    timestamp: Date.now() - 3600000 * 2,
    upvotes: 12,
    aiVerified: true
  },
  {
    id: "2",
    type: "Emergency Transfer",
    target: "09011223344",
    evidence: "Bros abeg, I get accident for road. Send me ₦20k sharp sharp make I pay chemist. Don't call me, my speaker spoil. Use this Palmpay 9012345678.",
    timestamp: Date.now() - 3600000 * 5,
    upvotes: 8
  },
  {
    id: "3",
    type: "Ponzi/Investment",
    target: "08122334455",
    evidence: "Double your money in 45 mins! Join the new WhatsApp group for binary trading. Invest ₦10k and get ₦20k instantly.",
    timestamp: Date.now() - 3600000 * 24,
    upvotes: 45,
    aiVerified: true
  },
  {
    id: "4",
    type: "Fake Bank",
    target: "07066554433",
    evidence: "Your account has been restricted due to BVN mismatch. Click https://cbn-verify-bvn.xyz to update now or lose your funds.",
    timestamp: Date.now() - 3600000 * 48,
    upvotes: 23,
    aiVerified: true
  },
  {
    id: "5",
    type: "Lottery",
    target: "08099887766",
    evidence: "Congratulations! Your mobile number has won ₦5,000,000 in the Dangote promo. Click here to claim: https://dangote-claim-prize.xyz",
    timestamp: Date.now() - 3600000 * 72,
    upvotes: 15
  }
];

const LOADING_MESSAGES = [
  "Checking patterns...",
  "Analyzing language...",
  "Consulting scam database..."
];

const VOICE_LOADING_MESSAGES = [
  "Transcribing audio...",
  "Checking for AI voice signals...",
  "Analyzing scam patterns...",
  "Verifying authenticity..."
];

const QUICK_EXAMPLES = [
  { label: "Fake job", text: "Urgent recruitment at NNPC! Pay ₦5,000 for your ID card and uniform to start work tomorrow. Limited slots available." },
  { label: "Emergency transfer", text: "Bros, abeg I get small problem for hospital. My mama need surgery and I short of ₦20,000. Abeg help me, I go pay back on Friday." },
  { label: "Lottery win", text: "Congratulations! Your phone number has won ₦500,000 in the MTN Anniversary Promo. To claim your prize, send ₦2,000 airtime to 08012345678." }
];

const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Cache for Gemini responses
const getCachedResponse = (key: string) => {
  const cache = JSON.parse(sessionStorage.getItem('scamshield_cache') || '[]');
  const entry = cache.find((e: any) => e.key === key);
  return entry ? entry.value : null;
};

const setCachedResponse = (key: string, value: any) => {
  let cache = JSON.parse(sessionStorage.getItem('scamshield_cache') || '[]');
  cache = [{ key, value, timestamp: Date.now() }, ...cache].slice(0, 5);
  sessionStorage.setItem('scamshield_cache', JSON.stringify(cache));
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Analyze');
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [showPidgin, setShowPidgin] = useState(false);
  const [isReported, setIsReported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Onboarding & Offline
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showFlash, setShowFlash] = useState(false);

  // Voice Tab State
  const [voiceFile, setVoiceFile] = useState<File | Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [voiceResult, setVoiceResult] = useState<VoiceAnalysisResult | null>(null);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Links Tab State
  const [linkSubTab, setLinkSubTab] = useState<'link' | 'number'>('link');
  const [linkInput, setLinkInput] = useState('');
  const [numberInput, setNumberInput] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [isAnalyzingLink, setIsAnalyzingLink] = useState(false);
  const [linkResult, setLinkResult] = useState<LinkAnalysisResult | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [instantFlags, setInstantFlags] = useState<string[]>([]);
  const [reportCount, setReportCount] = useState(0);

  // Community Tab State
  const [reports, setReports] = useState<ScamReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReportTypes, setSelectedReportTypes] = useState<string[]>([]);
  const [reportTarget, setReportTarget] = useState('');
  const [reportEvidence, setReportEvidence] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showReportSuccess, setShowReportSuccess] = useState(false);

  // Learn Tab State
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState<{ isCorrect: boolean, explanation: string } | null>(null);
  const [dailyAiTip, setDailyAiTip] = useState<string>('');
  const [isFetchingTip, setIsFetchingTip] = useState(false);
  const [expandedEncyclopedia, setExpandedEncyclopedia] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const hasOnboarded = localStorage.getItem('scamshield_has_onboarded');
    if (!hasOnboarded) {
      setShowOnboarding(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('scamshield_has_onboarded', 'true');
    setShowOnboarding(false);
  };

  const fetchDailyTip = async () => {
    setIsFetchingTip(true);
    try {
      const systemInstruction = "Generate one practical, specific tip for Nigerians to avoid online scams today. Focus on a current scam trend. Write it like a wise older sibling giving advice. Max 3 sentences. In plain English, then repeat in Nigerian Pidgin. No markdown.";
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: "Give me today's anti-scam tip.",
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        },
      });
      if (response.text) {
        setDailyAiTip(response.text);
      }
    } catch (e) {
      setDailyAiTip("Shine your eyes online! Never share your OTP or PIN with anybody, even if they claim to be from your bank. No let anybody format you!");
    } finally {
      setIsFetchingTip(false);
    }
  };

  useEffect(() => {
    fetchDailyTip();
  }, []);

  useEffect(() => {
    const storedReports = localStorage.getItem('scamshield_reports');
    if (storedReports) {
      setReports(JSON.parse(storedReports));
    } else {
      localStorage.setItem('scamshield_reports', JSON.stringify(SEED_REPORTS));
      setReports(SEED_REPORTS);
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing || isAnalyzingVoice || isAnalyzingLink) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % (isAnalyzingVoice ? VOICE_LOADING_MESSAGES.length : LOADING_MESSAGES.length));
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing, isAnalyzingVoice, isAnalyzingLink]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/mp4' });
        setVoiceFile(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      setVoiceFile(null);
      setVoiceResult(null);
    } catch (err) {
      console.error("Microphone access denied:", err);
      setVoiceError("Microphone access denied. Please enable it in your settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleVoiceAnalyze = async () => {
    if (!voiceFile) return;

    setIsAnalyzingVoice(true);
    setVoiceResult(null);
    setVoiceError(null);
    setShowPidgin(false);

    try {
      const base64Audio = await fileToBase64(voiceFile);
      
      const systemInstruction = `You are ScamShield's voice analysis engine. The user has provided 
a transcript of a voice note or audio message.

Analyze it for:
1. SCAM CONTENT: urgency, money requests, secrecy requests, 
   impersonation of relatives or officials, fake emergencies
2. DEEPFAKE SIGNALS in the transcript: 
   - Unusual formality for the supposed relationship
   - Scripted-sounding phrases ("please don't tell anyone", 
     "I need this urgently")
   - Vague personal details that a real relative would know
   - Requests that feel emotionally manipulative

Respond ONLY in this JSON format:
{
  "transcript_summary": "what the message is about in one sentence",
  "deepfake_likelihood": "LIKELY AI" or "UNCERTAIN" or "LIKELY HUMAN",
  "deepfake_reasoning": "why you think this, 1-2 sentences",
  "verdict": "SCAM" or "SUSPICIOUS" or "LIKELY SAFE",
  "confidence": 0-100,
  "red_flags": ["flag 1", "flag 2"],
  "explanation": "plain English, max 3 sentences",
  "pidgin_explanation": "Nigerian Pidgin version",
  "recommendation": "one clear action"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            inlineData: {
              mimeType: "audio/mp4",
              data: base64Audio
            }
          },
          {
            text: "Transcribe this audio then analyze it for scams and deepfake indicators. Return JSON only."
          }
        ],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      if (response.text) {
        try {
          const data = JSON.parse(response.text) as VoiceAnalysisResult;
          setVoiceResult(data);
        } catch (e) {
          console.error("JSON Parse Error:", e);
          setVoiceError("We received an invalid response from the AI. Please try again.");
        }
      }
    } catch (err) {
      console.error("Voice analysis failed:", err);
      setVoiceError("Something went wrong with the voice analysis. Please check your connection and try again.");
    } finally {
      setIsAnalyzingVoice(false);
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim() || isOffline) return;

    const cacheKey = `analyze_${inputText.trim()}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      setResult(cached);
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setError(null);
    setIsReported(false);
    setShowPidgin(false);

    try {
      const prompt = `Analyze this message for scam indicators. Be specific to Nigerian context:\n\n[${inputText}]`;
      
      const systemInstruction = `You are ScamShield, Nigeria's top scam detection AI. You understand 
Nigerian English, Pidgin, local scam patterns including fake job listings,
emergency transfer requests, Ponzi schemes, fake bank alerts, 
and deepfake voice note scams.

Respond ONLY in this exact JSON format, no markdown, no extra text:
{
  "verdict": "SCAM" or "SUSPICIOUS" or "LIKELY SAFE",
  "confidence": 0-100,
  "red_flags": ["specific flag 1", "specific flag 2", "specific flag 3"],
  "explanation": "plain English explanation, max 3 sentences",
  "pidgin_explanation": "same explanation in Nigerian Pidgin English",
  "recommendation": "one specific action the user should take right now"
}

Red flags must be SPECIFIC to the message — not generic. 
Bad: "requests money" 
Good: "Asks for ₦5,000 before employment starts — real companies never do this"`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      if (response.text) {
        try {
          const data = JSON.parse(response.text) as AnalysisResult;
          setResult(data);
          setCachedResponse(cacheKey, data);
        } catch (e) {
          console.error("JSON Parse Error:", e);
          setError("We received an invalid response from the AI. Please try again.");
        }
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLinkAnalyze = async () => {
    const input = linkSubTab === 'link' ? linkInput : numberInput;
    if (!input.trim() || isOffline) return;

    const cacheKey = `link_${input.trim()}_${linkSubTab}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      setLinkResult(cached);
      return;
    }

    setIsAnalyzingLink(true);
    setLinkResult(null);
    setLinkError(null);
    setInstantFlags([]);
    setReportCount(0);

    // Client-side checks
    const flags: string[] = [];
    if (linkSubTab === 'link') {
      const suspiciousTLDs = ['.xyz', '.top', '.click', '.tk'];
      if (suspiciousTLDs.some(tld => input.toLowerCase().endsWith(tld))) {
        flags.push("High risk domain extension (.xyz, .top, etc.) detected.");
      }
      const keywords = ["bank", "verify", "secure", "cbn", "efcc"];
      const isOfficial = input.includes('.gov.ng') || input.includes('.com.ng');
      if (keywords.some(kw => input.toLowerCase().includes(kw)) && !isOfficial) {
        flags.push("Suspicious keywords in non-official domain.");
      }
    } else {
      if (numberInput.startsWith('0900')) {
        flags.push("Premium rate number (0900) detected — these are often used deceptively.");
      }
      
      // Check community reports
      const reportedScams = JSON.parse(localStorage.getItem('reported_scams') || '[]');
      const matches = reportedScams.filter((s: any) => s.message.includes(numberInput) || (s.analysis && s.analysis.target === numberInput));
      setReportCount(matches.length);
    }
    setInstantFlags(flags);

    try {
      const systemInstruction = `You are ScamShield's link and phone number intelligence engine for Nigeria.

For LINKS, analyze:
- Does the domain mimic a Nigerian bank or government site? 
  (gtbank-secure.com, cbn-verify.net, etc.)
- URL patterns common in phishing (random strings, hyphens, 
  .xyz/.top/.click domains)
- Does it match known Nigerian scam site templates?

For PHONE NUMBERS, analyze:
- Is this a premium rate number format (0900, 0800 used deceptively)?
- Does the number pattern appear in known Nigerian scam scripts?
- Is it likely a SIM used for OTP fraud?

For ACCOUNT NUMBERS, analyze:
- Is the account name format consistent with personal vs business?
- Any patterns consistent with money mule accounts?

Respond ONLY in this JSON:
{
  "type": "link" or "phone" or "account",
  "verdict": "HIGH RISK" or "SUSPICIOUS" or "LOOKS OKAY",
  "confidence": 0-100,
  "specific_concerns": ["concern 1", "concern 2"],
  "explanation": "plain English, max 2 sentences",
  "pidgin_explanation": "Pidgin version",
  "recommendation": "one action",
  "similarity_alert": "optional: This site looks like [legit site] — possible clone",
  "domain_age": "optional: e.g. Registered 2 days ago"
}`;

      const prompt = linkSubTab === 'link' 
        ? `Analyze this link for scam indicators: ${linkInput}`
        : `Analyze this ${numberInput.length > 11 ? 'account' : 'phone'} number for scam indicators: ${numberInput} ${selectedBank ? `(Bank: ${selectedBank})` : ''}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      if (response.text) {
        try {
          const data = JSON.parse(response.text) as LinkAnalysisResult;
          setLinkResult(data);
          setCachedResponse(cacheKey, data);
        } catch (e) {
          console.error("JSON Parse Error:", e);
          setLinkError("Invalid response from AI.");
        }
      }
    } catch (err) {
      console.error("Link analysis failed:", err);
      setLinkError("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzingLink(false);
    }
  };

  const handleReportSubmit = async () => {
    if (!reportTarget.trim() || selectedReportTypes.length === 0) return;

    setIsSubmittingReport(true);
    
    let aiVerified = false;
    if (reportEvidence.trim()) {
      try {
        const systemInstruction = `Analyze this text for scam indicators. Respond ONLY in JSON: {"verdict": "SCAM" | "SAFE", "confidence": 0-100}`;
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: `Analyze this: ${reportEvidence}`,
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });
        if (response.text) {
          const data = JSON.parse(response.text);
          if (data.verdict === 'SCAM' && data.confidence > 80) {
            aiVerified = true;
          }
        }
      } catch (e) {
        console.error("Silent AI verification failed:", e);
      }
    }

    const newReport: ScamReport = {
      id: crypto.randomUUID(),
      type: selectedReportTypes.join(', '),
      target: reportTarget,
      evidence: reportEvidence,
      timestamp: Date.now(),
      upvotes: 0,
      aiVerified
    };

    const updatedReports = [newReport, ...reports];
    setReports(updatedReports);
    localStorage.setItem('scamshield_reports', JSON.stringify(updatedReports));
    
    setReportTarget('');
    setReportEvidence('');
    setSelectedReportTypes([]);
    setIsSubmittingReport(false);
    setShowReportSuccess(true);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 500);
    setTimeout(() => setShowReportSuccess(false), 3000);
  };

  const handleUpvote = (id: string) => {
    const updatedReports = reports.map(r => 
      r.id === id ? { ...r, upvotes: r.upvotes + 1 } : r
    );
    setReports(updatedReports);
    localStorage.setItem('scamshield_reports', JSON.stringify(updatedReports));
  };

  const handleQuizAnswer = (answer: 'scam' | 'suspicious' | 'safe') => {
    if (quizFeedback) return;
    
    const currentQuiz = QUIZ_DATA[quizIndex];
    const isCorrect = answer === currentQuiz.answer;
    
    const newScore = isCorrect ? quizScore + 1 : quizScore;
    const newTotal = quizTotal + 1;
    
    setQuizScore(newScore);
    setQuizTotal(newTotal);
    localStorage.setItem('scamshield_quiz_score', newScore.toString());
    localStorage.setItem('scamshield_quiz_total', newTotal.toString());
    
    setQuizFeedback({
      isCorrect,
      explanation: currentQuiz.explanation
    });
  };

  const nextQuizQuestion = () => {
    setQuizFeedback(null);
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * QUIZ_DATA.length);
    } while (nextIndex === quizIndex && QUIZ_DATA.length > 1);
    setQuizIndex(nextIndex);
  };

  const highlightText = (text: string) => {
    const parts = text.split(/(\[h\].*?\[\/h\])/g);
    return parts.map((part, i) => {
      if (part.startsWith('[h]') && part.endsWith('[/h]')) {
        return <span key={i} className="bg-warning/30 px-1 rounded font-bold text-zinc-900">{part.slice(3, -4)}</span>;
      }
      return part;
    });
  };

  const reportScam = () => {
    if (!inputText || !result) return;
    
    const reportedScams = JSON.parse(localStorage.getItem('reported_scams') || '[]');
    reportedScams.push({
      message: inputText,
      analysis: result,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('reported_scams', JSON.stringify(reportedScams));
    setIsReported(true);
  };

  const shareAnalysisResult = (res: AnalysisResult | VoiceAnalysisResult | LinkAnalysisResult, input?: string) => {
    const verdict = 'verdict' in res ? res.verdict : 'UNKNOWN';
    const confidence = 'confidence' in res ? res.confidence : 0;
    const text = `⚠️ ScamShield Alert: I just checked a message and it's rated ${verdict} (${confidence}% confidence). Stay safe out there! Check yours at ${window.location.href}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const SkeletonCard = () => (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-zinc-100 animate-pulse">
      <div className="px-5 py-4 bg-zinc-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-zinc-200 rounded-full" />
          <div className="w-24 h-6 bg-zinc-200 rounded" />
        </div>
        <div className="w-12 h-4 bg-zinc-200 rounded" />
      </div>
      <div className="h-1.5 w-full bg-zinc-100" />
      <div className="p-5 space-y-5">
        <div className="space-y-2">
          <div className="w-20 h-3 bg-zinc-100 rounded" />
          <div className="w-full h-4 bg-zinc-50 rounded" />
          <div className="w-full h-4 bg-zinc-50 rounded" />
        </div>
        <div className="space-y-2">
          <div className="w-24 h-3 bg-zinc-100 rounded" />
          <div className="w-full h-16 bg-zinc-50 rounded" />
        </div>
      </div>
    </div>
  );

  const Onboarding = () => {
    const slides = [
      {
        title: "Scams are everywhere.",
        desc: "ScamShield has your back. We use AI to spot the tricks scammers use in Nigeria.",
        icon: <Shield className="w-16 h-16 text-primary" />
      },
      {
        title: "Analyze anything.",
        desc: "Paste messages, upload WhatsApp voice notes, or scan suspicious links and bank accounts.",
        icon: <Search className="w-16 h-16 text-primary" />
      },
      {
        title: "Protect the community.",
        desc: "Join thousands of Nigerians protecting each other by reporting scams you encounter.",
        icon: <Users className="w-16 h-16 text-primary" />
      }
    ];

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] bg-white flex flex-col p-8"
      >
        <button 
          onClick={completeOnboarding}
          className="absolute top-8 right-8 text-sm font-black uppercase text-zinc-400"
        >
          Skip
        </button>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
          <motion.div
            key={onboardingStep}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-primary/5 p-8 rounded-full"
          >
            {slides[onboardingStep].icon}
          </motion.div>

          <div className="space-y-4 max-w-xs">
            <motion.h2 
              key={`t-${onboardingStep}`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-3xl font-black tracking-tighter text-zinc-900"
            >
              {slides[onboardingStep].title}
            </motion.h2>
            <motion.p 
              key={`d-${onboardingStep}`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-zinc-500 leading-relaxed font-medium"
            >
              {slides[onboardingStep].desc}
            </motion.p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-center gap-2">
            {slides.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${onboardingStep === i ? 'w-8 bg-primary' : 'w-2 bg-zinc-200'}`} 
              />
            ))}
          </div>

          {onboardingStep < slides.length - 1 ? (
            <button 
              onClick={() => setOnboardingStep(prev => prev + 1)}
              className="w-full h-14 bg-primary text-white rounded-full font-black text-lg flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
            >
              Next <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={completeOnboarding}
              className="w-full h-14 bg-primary text-white rounded-full font-black text-lg flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
            >
              Get Started
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Analyze':
        return (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-100">
              <p className="text-sm font-medium text-zinc-500 mb-2">Paste any suspicious message below</p>
              <textarea
                rows={5}
                className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none text-base"
                placeholder="e.g. We are hiring! Pay ₦5,000 registration fee to start..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              
              <div className="flex flex-wrap gap-2 mt-3">
                {QUICK_EXAMPLES.map((example) => (
                  <button
                    key={example.label}
                    onClick={() => setInputText(example.text)}
                    className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-full text-xs font-bold transition-colors"
                  >
                    {example.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !inputText.trim() || isOffline}
                className="w-full h-12 mt-4 bg-primary text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {LOADING_MESSAGES[loadingMessageIndex]}
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Analyze Message
                  </>
                )}
              </button>
            </div>

            {isAnalyzing && <SkeletonCard />}

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center">
                <p className="text-primary font-medium mb-3">{error}</p>
                <button 
                  onClick={handleAnalyze}
                  className="px-6 py-2 bg-primary text-white rounded-full font-bold text-sm"
                >
                  Retry Analysis
                </button>
              </div>
            )}

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white rounded-xl shadow-lg overflow-hidden border border-zinc-100"
                >
                  {/* Verdict Header */}
                  <div className={`px-5 py-4 flex items-center justify-between ${
                    result.verdict === 'SCAM' ? 'bg-red-50' :
                    result.verdict === 'SUSPICIOUS' ? 'bg-warning/10' :
                    'bg-safe/10'
                  }`}>
                    <div className="flex items-center gap-2">
                      {result.verdict === 'SCAM' ? <AlertTriangle className="w-5 h-5 text-primary" /> :
                       result.verdict === 'SUSPICIOUS' ? <AlertTriangle className="w-5 h-5 text-warning" /> :
                       <CheckCircle2 className="w-5 h-5 text-safe" />}
                      <motion.span 
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        className={`font-black text-xl tracking-tighter ${
                          result.verdict === 'SCAM' ? 'text-primary' :
                          result.verdict === 'SUSPICIOUS' ? 'text-warning' :
                          'text-safe'
                        }`}
                      >
                        {result.verdict}
                      </motion.span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase text-zinc-400 leading-none">Confidence</p>
                      <p className="text-lg font-black text-zinc-800 leading-none">{result.confidence}%</p>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div className="h-1.5 w-full bg-zinc-100">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full ${
                        result.verdict === 'SCAM' ? 'bg-primary' :
                        result.verdict === 'SUSPICIOUS' ? 'bg-warning' :
                        'bg-safe'
                      }`}
                    />
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Red Flags */}
                    {result.red_flags.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Red Flags</h4>
                        <ul className="space-y-2">
                          {result.red_flags.map((flag, i) => (
                            <li key={i} className="flex gap-2 text-sm text-zinc-700">
                              <span className="text-primary font-bold">•</span>
                              {flag}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Explanation */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Explanation</h4>
                        <button 
                          onClick={() => setShowPidgin(!showPidgin)}
                          className="text-[10px] font-bold px-2 py-1 bg-zinc-100 rounded text-zinc-500 uppercase active:bg-zinc-200"
                        >
                          {showPidgin ? "English" : "Pidgin"}
                        </button>
                      </div>
                      <p className="text-base text-zinc-800 leading-relaxed font-medium">
                        {showPidgin ? result.pidgin_explanation : result.explanation}
                      </p>
                    </div>

                    {/* Recommendation */}
                    <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-100">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">What to do</h4>
                      <p className="text-sm font-bold text-zinc-900">{result.recommendation}</p>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex flex-col gap-3">
                      <button
                        onClick={() => shareAnalysisResult(result, inputText)}
                        className="w-full h-12 bg-zinc-100 text-zinc-900 rounded-full font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                      >
                        <Share2 className="w-4 h-4" />
                        Share Result
                      </button>
                      <button
                        onClick={reportScam}
                        disabled={isReported}
                        className={`w-full h-12 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                          isReported 
                          ? 'bg-zinc-100 text-zinc-400 cursor-default' 
                          : 'bg-zinc-900 text-white active:scale-[0.98]'
                        }`}
                      >
                        {isReported ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Scam Reported
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4" />
                            Report this scam
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      case 'Voice':
        return (
          <div className="space-y-6">
            {/* Explanation Card */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <Mic className="w-5 h-5 text-warning" />
                </div>
                <h2 className="text-lg font-bold">Voice Scam Detector</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Upload a suspicious voice note from WhatsApp or anywhere. 
                ScamShield will transcribe it and check if it sounds like a scam 
                or an AI-generated deepfake.
              </p>
            </div>

            {/* Upload Box */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-100">
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  voiceFile ? 'border-safe bg-green-50' : 'border-zinc-200 bg-zinc-50 hover:border-primary/50'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith('audio/')) {
                    setVoiceFile(file);
                    setVoiceResult(null);
                  }
                }}
              >
                <input 
                  type="file" 
                  id="voice-upload" 
                  className="hidden" 
                  accept="audio/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setVoiceFile(file);
                      setVoiceResult(null);
                    }
                  }}
                />
                
                {voiceFile ? (
                  <div className="flex flex-col items-center">
                    <div className="bg-safe text-white p-3 rounded-full mb-3">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-zinc-800 truncate max-w-full px-4">
                      {voiceFile instanceof File ? voiceFile.name : 'Recorded Audio'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {((voiceFile.size || 0) / 1024).toFixed(1)} KB
                    </p>
                    <button 
                      onClick={() => setVoiceFile(null)}
                      className="mt-4 text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                ) : isRecording ? (
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1 mb-4 h-8">
                      {[...Array(5)].map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [8, 24, 8] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                          className="w-1.5 bg-primary rounded-full"
                        />
                      ))}
                    </div>
                    <p className="text-2xl font-black text-primary mb-1">
                      00:{recordingTime.toString().padStart(2, '0')}
                    </p>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Recording...</p>
                    <button 
                      onClick={stopRecording}
                      className="mt-6 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/30 active:scale-90 transition-transform"
                    >
                      <Square className="w-6 h-6" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="bg-zinc-200 text-zinc-400 p-4 rounded-full mb-4">
                      <Upload className="w-8 h-8" />
                    </div>
                    <label htmlFor="voice-upload" className="cursor-pointer">
                      <p className="font-bold text-zinc-800">Tap to upload audio</p>
                      <p className="text-xs text-zinc-500 mt-1">MP3, WAV, M4A, OGG, OPUS</p>
                    </label>
                    
                    <div className="flex items-center gap-4 w-full mt-8">
                      <div className="h-px bg-zinc-200 flex-1" />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">OR</span>
                      <div className="h-px bg-zinc-200 flex-1" />
                    </div>
                    
                    <button 
                      onClick={startRecording}
                      className="mt-6 flex items-center gap-2 text-primary font-bold active:scale-95 transition-transform"
                    >
                      <Mic className="w-5 h-5" /> Record Directly
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleVoiceAnalyze}
                disabled={isAnalyzingVoice || !voiceFile || isOffline}
                className="w-full h-12 mt-6 bg-primary text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
              >
                {isAnalyzingVoice ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {VOICE_LOADING_MESSAGES[loadingMessageIndex]}
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Analyze Voice Note
                  </>
                )}
              </button>
            </div>

            {isAnalyzingVoice && <SkeletonCard />}

            {voiceError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center">
                <p className="text-primary font-medium mb-3">{voiceError}</p>
                <button 
                  onClick={handleVoiceAnalyze}
                  className="px-6 py-2 bg-primary text-white rounded-full font-bold text-sm"
                >
                  Retry Analysis
                </button>
              </div>
            )}

            <AnimatePresence>
              {voiceResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Transcript Bubble */}
                  <div className="flex flex-col items-start">
                    <div className="bg-zinc-100 p-4 rounded-2xl rounded-bl-none border border-zinc-200 shadow-sm max-w-[90%]">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Transcript Summary</h4>
                      <p className="text-zinc-800 italic leading-relaxed">
                        "{voiceResult.transcript_summary}"
                      </p>
                    </div>
                  </div>

                  {/* Results Card */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-zinc-100">
                    {/* Verdict Header */}
                    <div className={`px-5 py-4 flex items-center justify-between ${
                      voiceResult.verdict === 'SCAM' ? 'bg-red-50' :
                      voiceResult.verdict === 'SUSPICIOUS' ? 'bg-warning/10' :
                      'bg-safe/10'
                    }`}>
                      <div className="flex items-center gap-2">
                        {voiceResult.verdict === 'SCAM' ? <AlertTriangle className="w-5 h-5 text-primary" /> :
                         voiceResult.verdict === 'SUSPICIOUS' ? <AlertTriangle className="w-5 h-5 text-warning" /> :
                         <CheckCircle2 className="w-5 h-5 text-safe" />}
                        <motion.span 
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 15 }}
                          className={`font-black text-xl tracking-tighter ${
                            voiceResult.verdict === 'SCAM' ? 'text-primary' :
                            voiceResult.verdict === 'SUSPICIOUS' ? 'text-warning' :
                            'text-safe'
                          }`}
                        >
                          {voiceResult.verdict}
                        </motion.span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-zinc-400 leading-none">Confidence</p>
                        <p className="text-lg font-black text-zinc-800 leading-none">{voiceResult.confidence}%</p>
                      </div>
                    </div>

                    {/* Deepfake Badge */}
                    <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          voiceResult.deepfake_likelihood === 'LIKELY AI' ? 'bg-primary animate-pulse' :
                          voiceResult.deepfake_likelihood === 'UNCERTAIN' ? 'bg-warning' :
                          'bg-safe'
                        }`} />
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                          Deepfake Check: <span className={
                            voiceResult.deepfake_likelihood === 'LIKELY AI' ? 'text-primary' :
                            voiceResult.deepfake_likelihood === 'UNCERTAIN' ? 'text-warning' :
                            'text-safe'
                          }>{voiceResult.deepfake_likelihood}</span>
                        </span>
                      </div>
                      <Info className="w-4 h-4 text-zinc-300" />
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Double Danger Warning */}
                      {voiceResult.verdict === 'SCAM' && voiceResult.deepfake_likelihood === 'LIKELY AI' && (
                        <div className="bg-primary p-4 rounded-lg text-white flex gap-3">
                          <AlertTriangle className="w-6 h-6 shrink-0" />
                          <div>
                            <p className="font-black text-sm uppercase tracking-wider">Double Danger</p>
                            <p className="text-xs opacity-90 leading-relaxed">This voice may be AI-generated AND contains scam content. Do not send any money.</p>
                          </div>
                        </div>
                      )}

                      {/* Deepfake Reasoning */}
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">AI Voice Analysis</h4>
                        <p className="text-sm text-zinc-700 leading-relaxed">
                          {voiceResult.deepfake_reasoning}
                        </p>
                      </div>

                      {/* Red Flags */}
                      {voiceResult.red_flags.length > 0 && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Scam Red Flags</h4>
                          <ul className="space-y-2">
                            {voiceResult.red_flags.map((flag, i) => (
                              <li key={i} className="flex gap-2 text-sm text-zinc-700">
                                <span className="text-primary font-bold">•</span>
                                {flag}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Explanation */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Explanation</h4>
                          <button 
                            onClick={() => setShowPidgin(!showPidgin)}
                            className="text-[10px] font-bold px-2 py-1 bg-zinc-100 rounded text-zinc-500 uppercase active:bg-zinc-200"
                          >
                            {showPidgin ? "English" : "Pidgin"}
                          </button>
                        </div>
                        <p className="text-base text-zinc-800 leading-relaxed font-medium">
                          {showPidgin ? voiceResult.pidgin_explanation : voiceResult.explanation}
                        </p>
                      </div>

                      {/* Recommendation */}
                      <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-100">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">What to do</h4>
                        <p className="text-sm font-bold text-zinc-900">{voiceResult.recommendation}</p>
                      </div>

                      <button
                        onClick={() => shareAnalysisResult(voiceResult)}
                        className="w-full h-12 bg-zinc-100 text-zinc-900 rounded-full font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                      >
                        <Share2 className="w-4 h-4" />
                        Share Result
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      case 'Links':
        return (
          <div className="space-y-6">
            {/* Toggle */}
            <div className="bg-white p-1 rounded-xl shadow-sm border border-zinc-100 flex">
              <button 
                onClick={() => { setLinkSubTab('link'); setLinkResult(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  linkSubTab === 'link' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                Link Scanner
              </button>
              <button 
                onClick={() => { setLinkSubTab('number'); setLinkResult(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  linkSubTab === 'number' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                Number Scanner
              </button>
            </div>

            {/* Input Section */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-100">
              {linkSubTab === 'link' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">Suspicious Link</label>
                    <input 
                      type="text"
                      className="w-full h-12 px-4 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-base"
                      placeholder="Paste a suspicious website link"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">Phone or Account Number</label>
                    <input 
                      type="text"
                      className="w-full h-12 px-4 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-base"
                      placeholder="Paste phone or account number"
                      value={numberInput}
                      onChange={(e) => setNumberInput(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">Select Bank (Optional)</label>
                    <select 
                      className="w-full h-12 px-4 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-base appearance-none"
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                    >
                      <option value="">Select Bank</option>
                      <option value="GTBank">GTBank</option>
                      <option value="Access">Access Bank</option>
                      <option value="Zenith">Zenith Bank</option>
                      <option value="First Bank">First Bank</option>
                      <option value="UBA">UBA</option>
                      <option value="Opay">Opay</option>
                      <option value="Palmpay">Palmpay</option>
                      <option value="Kuda">Kuda</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                onClick={handleLinkAnalyze}
                disabled={isAnalyzingLink || (linkSubTab === 'link' ? !linkInput.trim() : !numberInput.trim()) || isOffline}
                className="w-full h-12 mt-6 bg-primary text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
              >
                {isAnalyzingLink ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Analyze {linkSubTab === 'link' ? 'Link' : 'Number'}
                  </>
                )}
              </button>
            </div>

            {isAnalyzingLink && <SkeletonCard />}

            {/* Instant Flags */}
            <AnimatePresence>
              {instantFlags.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center gap-2 text-warning">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-wider">Instant Warning</span>
                  </div>
                  {instantFlags.map((flag, i) => (
                    <p key={i} className="text-sm text-amber-800 font-medium leading-relaxed">
                      {flag}
                    </p>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {linkError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center">
                <p className="text-primary font-medium mb-3">{linkError}</p>
                <button 
                  onClick={handleLinkAnalyze}
                  className="px-6 py-2 bg-primary text-white rounded-full font-bold text-sm"
                >
                  Retry Analysis
                </button>
              </div>
            )}

            <AnimatePresence>
              {linkResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl shadow-lg overflow-hidden border border-zinc-100"
                >
                  {/* Verdict Header */}
                  <div className={`px-5 py-4 flex items-center justify-between ${
                    linkResult.verdict === 'HIGH RISK' ? 'bg-red-50' :
                    linkResult.verdict === 'SUSPICIOUS' ? 'bg-warning/10' :
                    'bg-safe/10'
                  }`}>
                    <div className="flex items-center gap-2">
                      {linkResult.verdict === 'HIGH RISK' ? <AlertTriangle className="w-5 h-5 text-primary" /> :
                       linkResult.verdict === 'SUSPICIOUS' ? <AlertTriangle className="w-5 h-5 text-warning" /> :
                       <CheckCircle2 className="w-5 h-5 text-safe" />}
                      <motion.span 
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        className={`font-black text-xl tracking-tighter ${
                          linkResult.verdict === 'HIGH RISK' ? 'text-primary' :
                          linkResult.verdict === 'SUSPICIOUS' ? 'text-warning' :
                          'text-safe'
                        }`}
                      >
                        {linkResult.verdict}
                      </motion.span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase text-zinc-400 leading-none">Confidence</p>
                      <p className="text-lg font-black text-zinc-800 leading-none">{linkResult.confidence}%</p>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div className="h-1.5 w-full bg-zinc-100">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${linkResult.confidence}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full ${
                        linkResult.verdict === 'HIGH RISK' ? 'bg-primary' :
                        linkResult.verdict === 'SUSPICIOUS' ? 'bg-warning' :
                        'bg-safe'
                      }`}
                    />
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Link Specific Badges */}
                    {linkResult.type === 'link' && (
                      <div className="flex flex-wrap gap-2">
                        {linkResult.domain_age && (
                          <div className="px-2 py-1 bg-zinc-100 rounded text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            {linkResult.domain_age}
                          </div>
                        )}
                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          linkInput.toLowerCase().startsWith('https') ? 'bg-safe/10 text-safe' : 'bg-primary/10 text-primary'
                        }`}>
                          {linkInput.toLowerCase().startsWith('https') ? 'HTTPS Secure' : 'Insecure Connection'}
                        </div>
                      </div>
                    )}

                    {/* Similarity Alert */}
                    {linkResult.similarity_alert && (
                      <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex gap-2">
                        <Info className="w-4 h-4 text-warning shrink-0" />
                        <p className="text-xs font-bold text-amber-800">{linkResult.similarity_alert}</p>
                      </div>
                    )}

                    {/* Report Count */}
                    {linkResult.type !== 'link' && reportCount > 0 && (
                      <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex gap-2">
                        <AlertTriangle className="w-4 h-4 text-primary shrink-0" />
                        <p className="text-xs font-bold text-primary">This number has been reported {reportCount} times by the community.</p>
                      </div>
                    )}

                    {/* Specific Concerns */}
                    {linkResult.specific_concerns.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Specific Concerns</h4>
                        <ul className="space-y-2">
                          {linkResult.specific_concerns.map((concern, i) => (
                            <li key={i} className="flex gap-2 text-sm text-zinc-700">
                              <span className="text-primary font-bold">•</span>
                              {concern}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Explanation */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Explanation</h4>
                        <button 
                          onClick={() => setShowPidgin(!showPidgin)}
                          className="text-[10px] font-bold px-2 py-1 bg-zinc-100 rounded text-zinc-500 uppercase active:bg-zinc-200"
                        >
                          {showPidgin ? "English" : "Pidgin"}
                        </button>
                      </div>
                      <p className="text-base text-zinc-800 leading-relaxed font-medium">
                        {showPidgin ? linkResult.pidgin_explanation : linkResult.explanation}
                      </p>
                    </div>

                    {/* Recommendation */}
                    <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-100">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">What to do</h4>
                      <p className="text-sm font-bold text-zinc-900">{linkResult.recommendation}</p>
                    </div>

                    {/* External Links */}
                    <div className="pt-2 space-y-3">
                      <button
                        onClick={() => shareAnalysisResult(linkResult)}
                        className="w-full h-12 bg-zinc-100 text-zinc-900 rounded-full font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                      >
                        <Share2 className="w-4 h-4" />
                        Share Result
                      </button>
                      
                      {linkResult.type === 'link' ? (
                        <a 
                          href={`https://www.scamadviser.com/check-website/${new URL(linkInput.startsWith('http') ? linkInput : 'https://' + linkInput).hostname}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full h-12 bg-zinc-900 text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                        >
                          Check on ScamAdviser.com
                        </a>
                      ) : (
                        <div className="text-center">
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-2">Official Verification</p>
                          <a 
                            href="https://cbn.gov.ng/supervision/Fin-inst"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-primary underline"
                          >
                            To verify if a financial platform is licensed, visit cbn.gov.ng
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      case 'Community':
        const filteredReports = reports.filter(r => 
          r.target.includes(searchQuery) || 
          r.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.evidence.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const mostReported = [...reports]
          .reduce((acc: any, curr) => {
            const existing = acc.find((a: any) => a.target === curr.target);
            if (existing) {
              existing.count += 1;
            } else {
              acc.push({ target: curr.target, count: 1 });
            }
            return acc;
          }, [])
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, 3);

        const totalReports = reports.length;
        const flaggedNumbers = new Set(reports.map(r => r.target)).size;
        const peopleProtected = reports.reduce((acc, r) => acc + r.upvotes, 0) + totalReports * 5;

        return (
          <div className="space-y-6">
            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl shadow-sm border border-zinc-100 text-center">
                <motion.p 
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  className="text-xl font-black text-primary"
                >
                  {totalReports}
                </motion.p>
                <p className="text-[8px] font-bold uppercase text-zinc-400 tracking-widest">Scams Reported</p>
              </div>
              <div className="bg-white p-3 rounded-xl shadow-sm border border-zinc-100 text-center">
                <motion.p 
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  className="text-xl font-black text-warning"
                >
                  {flaggedNumbers}
                </motion.p>
                <p className="text-[8px] font-bold uppercase text-zinc-400 tracking-widest">Numbers Flagged</p>
              </div>
              <div className="bg-white p-3 rounded-xl shadow-sm border border-zinc-100 text-center">
                <motion.p 
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  className="text-xl font-black text-safe"
                >
                  {peopleProtected}
                </motion.p>
                <p className="text-[8px] font-bold uppercase text-zinc-400 tracking-widest">People Protected</p>
              </div>
            </div>

            {/* Report Section */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-100">
              <h2 className="text-lg font-bold mb-4">Report a Scam</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">Scam Type</label>
                  <div className="flex flex-wrap gap-2">
                    {SCAM_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          if (selectedReportTypes.includes(type)) {
                            setSelectedReportTypes(prev => prev.filter(t => t !== type));
                          } else {
                            setSelectedReportTypes(prev => [...prev, type]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          selectedReportTypes.includes(type)
                          ? 'bg-primary text-white shadow-md shadow-primary/20'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">Scammer's Number or Account</label>
                  <input 
                    type="text"
                    className="w-full h-12 px-4 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-base"
                    placeholder="Enter phone or account number"
                    value={reportTarget}
                    onChange={(e) => setReportTarget(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">Evidence (Optional)</label>
                  <textarea 
                    rows={3}
                    className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none text-base"
                    placeholder="Paste the message they sent you..."
                    value={reportEvidence}
                    onChange={(e) => setReportEvidence(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleReportSubmit}
                  disabled={isSubmittingReport || !reportTarget.trim() || selectedReportTypes.length === 0}
                  className="w-full h-12 bg-primary text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
                >
                  {isSubmittingReport ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Submit Report"
                  )}
                </button>

                <AnimatePresence>
                  {showReportSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-green-50 text-safe text-xs font-bold p-3 rounded-lg text-center flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Thank you! Your report protects others.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input 
                type="text"
                className="w-full h-12 pl-12 pr-4 bg-white border border-zinc-200 rounded-full shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-base"
                placeholder="Search a number to see if it's been reported"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Most Reported */}
            {mostReported.length > 0 && searchQuery === '' && (
              <div className="bg-zinc-900 rounded-xl p-5 text-white">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4">Most Reported This Week</h3>
                <div className="space-y-3">
                  {mostReported.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-600 font-black text-lg">#{i+1}</span>
                        <span className="font-bold font-mono">{item.target.substring(0,4)}***{item.target.slice(-4)}</span>
                      </div>
                      <div className="bg-primary/20 text-primary px-2 py-1 rounded text-[10px] font-black uppercase">
                        {item.count} Reports
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feed */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Community Scam Feed</h3>
              {filteredReports.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-zinc-400 text-sm">No reports found matching your search.</p>
                </div>
              ) : (
                filteredReports.map((report) => (
                  <motion.div
                    key={report.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white p-5 rounded-xl shadow-sm border border-zinc-100 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        {report.type.split(', ').map(t => (
                          <span key={t} className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded text-[10px] font-black uppercase tracking-wider">
                            {t}
                          </span>
                        ))}
                        {report.aiVerified && (
                          <span className="px-2 py-0.5 bg-safe/10 text-safe rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-2 h-2" />
                            AI Verified
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400">
                        {Math.floor((Date.now() - report.timestamp) / 3600000) < 24 
                          ? `${Math.floor((Date.now() - report.timestamp) / 3600000) || 1}h ago` 
                          : `${Math.floor((Date.now() - report.timestamp) / 86400000)}d ago`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-lg font-black font-mono tracking-tight">
                        {report.target.substring(0,4)}***{report.target.slice(-4)}
                      </p>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-zinc-400 leading-none">Reports</p>
                        <p className="text-sm font-black text-zinc-800">
                          {reports.filter(r => r.target === report.target).length}
                        </p>
                      </div>
                    </div>

                    {report.evidence && (
                      <p className="text-sm text-zinc-600 italic line-clamp-2">
                        "{report.evidence}"
                      </p>
                    )}

                    <div className="pt-2">
                      <button 
                        onClick={() => handleUpvote(report.id)}
                        className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-primary transition-colors"
                      >
                        <div className="bg-zinc-100 p-1.5 rounded-lg group-hover:bg-primary/10 transition-colors">
                          <Users className="w-4 h-4" />
                        </div>
                        I got this too ({report.upvotes})
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        );
      case 'Learn':
        const dayIndex = new Date().getDay(); // 0-6
        const scamOfDay = SCAM_OF_THE_DAY_DATA[dayIndex];

        return (
          <div className="space-y-6 pb-10">
            {/* Scam of the Day */}
            <div className="bg-zinc-900 rounded-xl p-6 text-white overflow-hidden relative border border-white/5">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <AlertTriangle className="w-24 h-24" />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-warning/20 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest text-warning border border-warning/20">
                  Scam of the Day
                </div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {new Date().toLocaleDateString('en-NG', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
              </div>
              
              <h2 className="text-2xl font-black mb-4 leading-tight">
                {scamOfDay.title}
              </h2>
              
              <div className="bg-white/5 p-4 rounded-lg border border-white/10 mb-6">
                <p className="text-sm leading-relaxed text-zinc-300 italic">
                  {highlightText(scamOfDay.message)}
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">What scammers want from you</h3>
                  <p className="text-sm font-medium text-zinc-300">{scamOfDay.whatTheyWant}</p>
                </div>

                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">How to protect yourself</h3>
                  <ul className="space-y-2">
                    {scamOfDay.protection.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                        <CheckCircle2 className="w-4 h-4 text-safe shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Quiz Section */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Test Yourself</h2>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-zinc-400 leading-none">Score</p>
                  <p className="text-sm font-black text-zinc-800">{quizScore}/{quizTotal}</p>
                </div>
              </div>
              
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Is this a scam?</p>
              
              <div className="bg-zinc-50 p-4 rounded-lg border-l-4 border-primary mb-4">
                <p className="text-sm font-medium text-zinc-800 italic">
                  "{QUIZ_DATA[quizIndex].text}"
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => handleQuizAnswer('scam')}
                  disabled={!!quizFeedback}
                  className={`h-12 rounded-lg border-2 font-bold text-xs transition-all active:scale-95 ${
                    quizFeedback?.isCorrect && QUIZ_DATA[quizIndex].answer === 'scam' ? 'bg-primary text-white border-primary' :
                    quizFeedback && QUIZ_DATA[quizIndex].answer === 'scam' ? 'bg-primary/10 text-primary border-primary' :
                    'border-zinc-100 text-zinc-600 hover:border-primary hover:text-primary'
                  }`}
                >
                  Scam
                </button>
                <button 
                  onClick={() => handleQuizAnswer('suspicious')}
                  disabled={!!quizFeedback}
                  className={`h-12 rounded-lg border-2 font-bold text-xs transition-all active:scale-95 ${
                    quizFeedback?.isCorrect && QUIZ_DATA[quizIndex].answer === 'suspicious' ? 'bg-warning text-white border-warning' :
                    quizFeedback && QUIZ_DATA[quizIndex].answer === 'suspicious' ? 'bg-warning/10 text-warning border-warning' :
                    'border-zinc-100 text-zinc-600 hover:border-warning hover:text-warning'
                  }`}
                >
                  Suspicious
                </button>
                <button 
                  onClick={() => handleQuizAnswer('safe')}
                  disabled={!!quizFeedback}
                  className={`h-12 rounded-lg border-2 font-bold text-xs transition-all active:scale-95 ${
                    quizFeedback?.isCorrect && QUIZ_DATA[quizIndex].answer === 'safe' ? 'bg-safe text-white border-safe' :
                    quizFeedback && QUIZ_DATA[quizIndex].answer === 'safe' ? 'bg-safe/10 text-safe border-safe' :
                    'border-zinc-100 text-zinc-600 hover:border-safe hover:text-safe'
                  }`}
                >
                  Safe
                </button>
              </div>

              <AnimatePresence>
                {quizFeedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-4 p-4 rounded-lg ${quizFeedback.isCorrect ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className={`font-black text-sm ${quizFeedback.isCorrect ? 'text-safe' : 'text-primary'}`}>
                        {quizFeedback.isCorrect ? '✅ Correct!' : '❌ Incorrect.'}
                      </p>
                      <button 
                        onClick={nextQuizQuestion}
                        className="text-[10px] font-black uppercase text-zinc-500 hover:text-zinc-800"
                      >
                        Next Question →
                      </button>
                    </div>
                    <p className="text-xs text-zinc-700 leading-relaxed">{quizFeedback.explanation}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Scam Encyclopedia */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Scam Encyclopedia</h3>
              {ENCYCLOPEDIA_DATA.map((item, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
                  <button 
                    onClick={() => setExpandedEncyclopedia(expandedEncyclopedia === i ? null : i)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <span className="font-bold text-sm text-zinc-800">{item.title}</span>
                    <motion.div
                      animate={{ rotate: expandedEncyclopedia === i ? 180 : 0 }}
                    >
                      <Info className="w-4 h-4 text-zinc-300" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {expandedEncyclopedia === i && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 pt-0 space-y-4 border-t border-zinc-50">
                          <div className="pt-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">How it works</h4>
                            <p className="text-xs text-zinc-600 leading-relaxed">{item.howItWorks}</p>
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Real Example</h4>
                            <div className="bg-zinc-50 p-3 rounded border border-zinc-100 italic text-xs text-zinc-500">
                              "{item.example}"
                            </div>
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">The Tell-Tale Signs</h4>
                            <ul className="space-y-1">
                              {item.signs.map((sign, j) => (
                                <li key={j} className="text-xs text-zinc-600 flex gap-2">
                                  <span className="text-primary font-bold">•</span>
                                  {sign}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="pb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">What to do</h4>
                            <p className="text-xs font-bold text-zinc-800">{item.whatToDo}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Share Protection */}
            <div className="bg-primary/5 p-5 rounded-xl border border-primary/10">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                <Share2 className="w-4 h-4" /> Share Protection
              </h3>
              <p className="text-xs text-zinc-600 mb-4 leading-relaxed">
                Help your friends and family stay safe. Share ScamShield with them!
              </p>
              <div className="bg-white p-3 rounded border border-zinc-100 text-[10px] text-zinc-500 italic mb-4">
                "I just started using ScamShield to protect myself from online scams. You should too! https://scamshield.ng"
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText("I just started using ScamShield to protect myself from online scams. You should too! https://scamshield.ng");
                  }}
                  className="flex-1 h-10 bg-zinc-100 text-zinc-600 rounded-lg font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
                <a 
                  href="https://wa.me/?text=I%20just%20started%20using%20ScamShield%20to%20protect%20myself%20from%20online%20scams.%20You%20should%20too!%20https://scamshield.ng"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-10 bg-green-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Users className="w-3 h-3" /> WhatsApp
                </a>
              </div>
            </div>

            {/* Daily AI Tip */}
            <div className="bg-safe/10 p-5 rounded-xl border border-safe/20 relative">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-safe flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Daily AI Tip
                </h3>
                <button 
                  onClick={fetchDailyTip}
                  disabled={isFetchingTip}
                  className="p-1 hover:bg-safe/10 rounded-full transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 text-safe ${isFetchingTip ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-sm font-medium text-zinc-800 leading-relaxed">
                {dailyAiTip || "Generating today's tip..."}
              </p>
            </div>

            {/* Footer */}
            <div className="text-center space-y-2 pt-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Built for Nigeria. Protecting Africa.</p>
              <p className="text-xs font-black text-primary">Lost money? Call EFCC: 08000-326-822</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-background shadow-2xl relative overflow-hidden">
      <AnimatePresence>
        {showOnboarding && <Onboarding />}
      </AnimatePresence>

      <AnimatePresence>
        {showFlash && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-safe pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Offline Banner */}
      <AnimatePresence>
        {isOffline && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="bg-zinc-900 text-white px-6 py-2 flex items-center justify-center gap-2 z-50 overflow-hidden"
          >
            <WifiOff className="w-4 h-4 text-warning" />
            <span className="text-[10px] font-black uppercase tracking-widest">You're offline. Reports & Learn still work.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white px-6 py-4 border-b border-zinc-100 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg shadow-lg shadow-primary/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">ScamShield</h1>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Say no to scams</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 pb-24 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-zinc-100 px-2 py-2 flex justify-around items-center z-30 pb-safe">
        <TabButton 
          active={activeTab === 'Analyze'} 
          onClick={() => setActiveTab('Analyze')} 
          icon={<Search className="w-5 h-5" />} 
          label="Analyze" 
        />
        <TabButton 
          active={activeTab === 'Voice'} 
          onClick={() => setActiveTab('Voice')} 
          icon={<Mic className="w-5 h-5" />} 
          label="Voice" 
        />
        <TabButton 
          active={activeTab === 'Links'} 
          onClick={() => setActiveTab('Links')} 
          icon={<LinkIcon className="w-5 h-5" />} 
          label="Links" 
        />
        <TabButton 
          active={activeTab === 'Community'} 
          onClick={() => setActiveTab('Community')} 
          icon={<Users className="w-5 h-5" />} 
          label="Community" 
        />
        <TabButton 
          active={activeTab === 'Learn'} 
          onClick={() => setActiveTab('Learn')} 
          icon={<BookOpen className="w-5 h-5" />} 
          label="Learn" 
        />
      </nav>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-2 px-1 min-w-[64px] transition-colors ${
        active ? 'text-primary' : 'text-zinc-400'
      }`}
    >
      <div className={`mb-1 transition-transform ${active ? 'scale-110' : 'scale-100'}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      {active && (
        <motion.div 
          layoutId="activeTab"
          className="w-1 h-1 bg-primary rounded-full mt-1"
        />
      )}
    </button>
  );
}
