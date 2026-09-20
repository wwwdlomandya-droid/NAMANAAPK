import { COMMON_DIAGNOSES, MODALITIES_LIST, BLOOD_GROUPS } from '../constants';
import { Patient, PaymentMethod, VisitType } from '../types';

export interface FollowUpVoiceFields {
  action?: 'add' | 'update';
  sessionNumber?: number;
  date?: string;
  time?: string;
  notes?: string;
  painScaleBefore?: number;
  painScaleAfter?: number;
  treatmentsGiven?: string[];
  fee?: string | number;
  paymentMethod?: PaymentMethod;
  visitType?: VisitType;
  seenBy?: string;
  receiptNo?: string;
}

export interface RecognizedClinicalFields {
  name?: string;
  age?: string | number;
  sex?: 'Male' | 'Female' | 'Other';
  gender?: string;
  contact?: string;
  address?: string;
  height?: string;
  weight?: string;
  bloodGroup?: string;
  date?: string;
  time?: string;
  regNo?: string;
  receiptNo?: string;
  diagnosis?: string;
  history?: string;
  painScaleBefore?: number;
  painScaleAfter?: number;
  treatmentFee?: string | number;
  paymentMethod?: PaymentMethod;
  visitType?: VisitType;
  referredBy?: string;
  seenBy?: string;
  comorbid?: {
    diabetes?: boolean;
    bp?: boolean;
    thyroid?: boolean;
    other?: boolean;
    otherText?: string;
  };
  modalities?: string[];
  followUp?: FollowUpVoiceFields;
  [key: string]: any;
}

/**
 * Handles the two-field Clinical Diagnosis & Assessment behavior:
 * 1. 2nd field copies what is chosen in the 1st field.
 * 2. Once the user enters '+', choosing in the 1st field again adds/appends to the 2nd field.
 */
export function applyDiagnosisSelection(currentDiagnosis: string, selectedChoice: string): string {
  if (!selectedChoice || selectedChoice === '__custom__') return currentDiagnosis || '';

  const trimmed = (currentDiagnosis || '').trim();

  // If 2nd field ends with '+' (e.g. "Cervical Spondylosis +" or "Cervical Spondylosis + ")
  if (trimmed.endsWith('+')) {
    // Avoid duplicate if already ends with this diagnosis
    if (trimmed.includes(selectedChoice)) {
      return trimmed;
    }
    return `${trimmed} ${selectedChoice}`.replace(/\s+/g, ' ').trim();
  }

  // If 2nd field is empty, copy what is chosen in 1st field
  if (!trimmed) {
    return selectedChoice;
  }

  // If 2nd field already has text without '+', selecting a new one replaces it,
  // unless user enters '+' (they can also click the [+] combiner button)
  return selectedChoice;
}

/**
 * Fast, robust client-side clinical NLP regex parser for spoken transcripts.
 * Works 100% offline, on mobile APK, and without any API key requirements.
 */
export function parseVoiceClinicalTranscript(
  transcript: string,
  existingData?: Partial<Patient>
): RecognizedClinicalFields {
  const text = transcript.trim();
  const lower = text.toLowerCase();
  const result: RecognizedClinicalFields = {};

  // 1. Patient Name
  // Matches "patient name [is] John Doe", "name [is] John Doe", "patient John Doe"
  const nameMatch =
    text.match(/(?:patient\s+name\s+is|patient\s+name|name\s+is|name)\s*[:=]?\s*([A-Za-z\s.'’]+?)(?=\s*(?:,|\.|\b(?:age|years|gender|sex|phone|contact|mobile|diagnosis|chief|history|complaint|pain|fee|charge|visit|referred|seen|blood|height|weight)\b|$))/i);
  if (nameMatch && nameMatch[1]) {
    const cleanName = nameMatch[1].trim().replace(/^(is|called)\s+/i, '');
    if (cleanName.length >= 2 && !/^(male|female|other|years|age|pain|none|na)$/i.test(cleanName)) {
      result.name = cleanName
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  }

  // 2. Age
  // Matches "age 45", "45 years old", "age is 32"
  const ageMatch = text.match(/(?:age\s+(?:is\s+)?|aged\s+)(\d{1,3})|(\d{1,3})\s*(?:years?\s*old|yrs?\s*old)/i);
  if (ageMatch) {
    const ageVal = parseInt(ageMatch[1] || ageMatch[2], 10);
    if (ageVal > 0 && ageVal < 125) {
      result.age = ageVal;
    }
  }

  // 3. Gender / Sex
  if (/\b(?:female|woman|lady|girl)\b/i.test(text)) {
    result.sex = 'Female';
  } else if (/\b(?:male|man|gentleman|boy)\b/i.test(text)) {
    result.sex = 'Male';
  } else if (/\b(?:transgender|other\s+gender|non\s*binary)\b/i.test(text)) {
    result.sex = 'Other';
  }

  // 4. Contact / Phone
  // Matches 10 digit Indian/international numbers e.g. 9880517715 or with spaces/dashes
  const phoneMatch = text.match(/(?:phone|mobile|contact|cell|number)?\s*[:=]?\s*(\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5}|\b\d{10}\b)/i);
  if (phoneMatch) {
    const rawDigits = (phoneMatch[2] || phoneMatch[0]).replace(/\D/g, '');
    if (rawDigits.length === 10) {
      result.contact = rawDigits;
    }
  }

  // 5. Blood Group
  const bgMatch = text.match(/\b(a|b|ab|o)\s*(positive|\+|negative|-)\b/i) || text.match(/\b(a\+|a-|b\+|b-|ab\+|ab-|o\+|o-)\b/i);
  if (bgMatch) {
    let grp = bgMatch[0].toUpperCase().replace(/\s+/g, '');
    if (grp.includes('POSITIVE')) grp = grp.replace('POSITIVE', '+');
    if (grp.includes('NEGATIVE')) grp = grp.replace('NEGATIVE', '-');
    if (BLOOD_GROUPS.includes(grp)) {
      result.bloodGroup = grp;
    }
  }

  // 6. Height
  const heightMatch =
    text.match(/(?:height\s*(?:is)?\s*)?(\d)\s*(?:foot|feet|ft|'|\s)\s*(\d{1,2})?\s*(?:inches|inch|in|")?/i) ||
    text.match(/(?:height\s*(?:is)?\s*)?(\d{2,3})\s*(?:cms?|centimeters?)/i);
  if (heightMatch) {
    if (heightMatch[2] !== undefined) {
      const feet = heightMatch[1];
      const inches = heightMatch[2] || '0';
      result.height = `${feet}'${inches}"`;
    } else if (heightMatch[1] && parseInt(heightMatch[1], 10) >= 90) {
      result.height = `${heightMatch[1]} cm`;
    }
  }

  // 7. Weight
  const weightMatch = text.match(/(?:weight\s*(?:is)?\s*)?(\d{2,3}(?:\.\d)?)\s*(?:kg|kgs|kilos|kilograms)\b/i) ||
    text.match(/weight\s*(?:is)?\s*(\d{2,3})\b/i);
  if (weightMatch && weightMatch[1]) {
    result.weight = `${weightMatch[1]} kg`;
  }

  // 8. Diagnosis
  // Check if user says "add diagnosis X" or "plus diagnosis X"
  const isAddDiagnosis = /\b(?:add\s+diagnosis|plus\s+diagnosis|add\s+condition|also\s+has)\b/i.test(text);
  
  // Match common preset diagnoses
  let detectedDiag: string | null = null;
  for (const diag of COMMON_DIAGNOSES) {
    const diagKeywords = diag
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['bilateral', 'grade', 'post', 'disc', 'pain'].includes(w));
    
    // Check if key terms of diagnosis are spoken
    const matchesCount = diagKeywords.filter((k) => lower.includes(k)).length;
    if (matchesCount >= Math.min(2, diagKeywords.length)) {
      detectedDiag = diag;
      break;
    }
  }

  // Or explicit "diagnosis [is] X"
  if (!detectedDiag) {
    const diagExplicit = text.match(/(?:diagnosis\s+is|diagnosis|condition\s+is|condition|diagnosed\s+with)\s*[:=]?\s*([^,.;\n]+?)(?=\s*(?:,|\.|\b(?:chief|history|complaint|pain|fee|charge|visit|modalities|treatment|referred|seen)\b|$))/i);
    if (diagExplicit && diagExplicit[1]) {
      const raw = diagExplicit[1].trim();
      if (raw.length > 3 && !/^(is|none|na|unknown)$/i.test(raw)) {
        detectedDiag = raw.charAt(0).toUpperCase() + raw.slice(1);
      }
    }
  }

  if (detectedDiag) {
    if (isAddDiagnosis && existingData?.diagnosis) {
      result.diagnosis = `${existingData.diagnosis} + ${detectedDiag}`.trim();
    } else {
      result.diagnosis = detectedDiag;
    }
  }

  // 9. Chief Complaints & Clinical History
  const historyMatch = text.match(/(?:chief\s+complaints?|complaints?|clinical\s+history|history|examination|symptoms?)\s*[:=]?\s*([^;]+?)(?=\s*(?:,|\.|\b(?:diagnosis|pain|fee|charge|modalities|treatment|visit|referred|seen)\b|$))/i);
  if (historyMatch && historyMatch[1]) {
    const h = historyMatch[1].trim();
    if (h.length > 4) {
      result.history = h.charAt(0).toUpperCase() + h.slice(1);
    }
  }

  // 10. Pain Scale (VAS 0 to 10)
  // Before treatment
  const painBeforeMatch = text.match(/(?:pain\s*(?:scale|score|level)?\s*(?:before\s*(?:treatment)?)?)\s*[:=]?\s*(\d{1,2})\s*(?:\/\s*10)?/i);
  if (painBeforeMatch && painBeforeMatch[1]) {
    const score = parseInt(painBeforeMatch[1], 10);
    if (score >= 0 && score <= 10) {
      result.painScaleBefore = score;
    }
  }
  // After treatment
  const painAfterMatch = text.match(/(?:pain\s*(?:scale|score|level)?\s*after\s*(?:treatment)?)\s*[:=]?\s*(\d{1,2})\s*(?:\/\s*10)?/i);
  if (painAfterMatch && painAfterMatch[1]) {
    const score = parseInt(painAfterMatch[1], 10);
    if (score >= 0 && score <= 10) {
      result.painScaleAfter = score;
    }
  }

  // 11. Treatment Fee / Consultation Fee
  const feeMatch = text.match(/(?:fee|charge|amount|cost|consultation\s+fee|treatment\s+fee)\s*[:=]?\s*(?:rs\.?|inr|₹)?\s*(\d{2,6})\b/i) ||
    text.match(/(?:rs\.?|inr|₹)\s*(\d{2,6})\b/i);
  if (feeMatch && feeMatch[1]) {
    result.treatmentFee = parseInt(feeMatch[1], 10);
  }

  // 12. Payment Mode
  if (/\b(?:upi|gpay|google\s*pay|phonepe|paytm|online|qr)\b/i.test(text)) {
    result.paymentMethod = 'UPI';
  } else if (/\b(?:cash|hard\s+cash)\b/i.test(text)) {
    result.paymentMethod = 'Cash';
  } else if (/\b(?:card|credit\s+card|debit\s+card|pos)\b/i.test(text)) {
    result.paymentMethod = 'Card';
  } else if (/\b(?:bank\s+transfer|neft|rtgs|imps|cheque)\b/i.test(text)) {
    result.paymentMethod = 'Bank Transfer';
  }

  // 13. Visit Type
  if (/\b(?:home\s+visit|house\s+visit|domiciliary)\b/i.test(text)) {
    result.visitType = 'Home Visit';
  } else if (/\b(?:clinic|in\s*clinic|outpatient|opd)\b/i.test(text)) {
    result.visitType = 'Clinic';
  }

  // 14. Referred By & Seen By
  const refMatch = text.match(/(?:referred\s+by|ref\s+by)\s*[:=]?\s*([A-Za-z\s.'’]+?)(?=\s*(?:,|\.|\b(?:seen|doctor|diagnosis|fee|pain|visit|time|date)\b|$))/i);
  if (refMatch && refMatch[1]) {
    const ref = refMatch[1].trim();
    if (ref.length > 2 && !/^(none|self|doctor)$/i.test(ref)) {
      result.referredBy = ref;
    }
  }

  const seenMatch = text.match(/(?:seen\s+by|attending\s+doctor|consultant|doctor)\s*[:=]?\s*([A-Za-z\s.'’]+?)(?=\s*(?:,|\.|\b(?:referred|diagnosis|fee|pain|visit|time|date)\b|$))/i);
  if (seenMatch && seenMatch[1]) {
    const seen = seenMatch[1].trim();
    if (seen.length > 2 && !/^(none|self|doctor)$/i.test(seen)) {
      result.seenBy = seen;
    }
  }

  // 15. Address / Location
  const addressMatch = text.match(/(?:address\s*(?:is)?|residence\s*(?:is)?|location\s*(?:is)?)\s*[:=]?\s*([^,.;\n]+?)(?=\s*(?:,|\.|\b(?:phone|contact|age|diagnosis|fee|pain|visit|referred|seen|time|date)\b|$))/i);
  if (addressMatch && addressMatch[1]) {
    const addr = addressMatch[1].trim();
    if (addr.length > 2 && !/^(is|none|unknown)$/i.test(addr)) {
      result.address = addr;
    }
  }

  // 16. Date & Time
  const dateMatch = text.match(/(?:date\s*(?:is)?)\s*[:=]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|today)/i);
  if (dateMatch) {
    if (dateMatch[1].toLowerCase() === 'today') {
      result.date = new Date().toISOString().split('T')[0];
    } else {
      result.date = dateMatch[1];
    }
  }

  const timeMatch = text.match(/(?:time\s*(?:is)?)\s*[:=]?\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (timeMatch) {
    result.time = timeMatch[1];
  }

  // 17. Comorbidities
  const comorbid: any = {};
  if (/\b(?:diabetes|diabetic|sugar)\b/i.test(text)) comorbid.diabetes = true;
  if (/\b(?:bp|blood\s+pressure|hypertension|hypertensive)\b/i.test(text)) comorbid.bp = true;
  if (/\b(?:thyroid|hypothyroid|hyperthyroid)\b/i.test(text)) comorbid.thyroid = true;
  if (Object.keys(comorbid).length > 0) {
    result.comorbid = comorbid;
  }

  // 18. Treatment Modalities
  const detectedModalities: string[] = [];
  if (/\b(?:ift|interferential)\b/i.test(text)) detectedModalities.push('Interferential Therapy (IFT)');
  if (/\b(?:ust|ultrasound)\b/i.test(text)) detectedModalities.push('Ultrasound Therapy (UST)');
  if (/\b(?:moist|hydrocollator|hot\s+pack|steam)\b/i.test(text)) detectedModalities.push('Moist Therapy');
  if (/\b(?:exercise|exercises|strengthening)\b/i.test(text)) detectedModalities.push('Therapeutic Exercise');
  if (/\b(?:cervical\s+traction|neck\s+traction)\b/i.test(text)) detectedModalities.push('Intermittent Cervical Traction');
  if (/\b(?:pelvic\s+traction|lumbar\s+traction)\b/i.test(text)) detectedModalities.push('Intermittent Pelvic Traction');
  if (/\b(?:cold\s+pack|ice\s+pack|cryo)\b/i.test(text)) detectedModalities.push('Cold Pack');
  if (/\b(?:tens)\b/i.test(text)) detectedModalities.push('TENS');
  if (/\b(?:wax|paraffin)\b/i.test(text)) detectedModalities.push('Paraffin Wax Bath');
  if (/\b(?:manual|mobilization|manipulation)\b/i.test(text)) detectedModalities.push('Manual Therapy');
  if (/\b(?:gait|walking\s+training)\b/i.test(text)) detectedModalities.push('Gait Training');
  if (/\b(?:postural|posture|ergonomic)\b/i.test(text)) detectedModalities.push('Postural Re-education');
  if (detectedModalities.length > 0) {
    result.modalities = detectedModalities;
  }

  // 19. Follow-Up Session Details
  const isFollowUpCommand = /(?:follow\s*up|session|subsequent\s+visit)\b/i.test(text);
  if (isFollowUpCommand) {
    const sessionMatch = text.match(/(?:session|visit)\s*(?:number|#)?\s*(\d+)/i);
    const sessionNum = sessionMatch ? parseInt(sessionMatch[1], 10) : undefined;

    let notes = '';
    const notesMatch = text.match(/(?:notes?|remarks?|progress|findings?|patient\s+reported?)\s*[:=]?\s*([^;]+?)(?=\s*(?:,|\.|\b(?:pain|fee|charge|modalities|treatment|seen|payment|visit)\b|$))/i);
    if (notesMatch && notesMatch[1]) {
      notes = notesMatch[1].trim();
    }

    result.followUp = {
      action: /(?:update|edit|change)\s+follow\s*up/i.test(text) ? 'update' : 'add',
      sessionNumber: sessionNum,
      date: result.date || new Date().toISOString().split('T')[0],
      time: result.time,
      notes: notes || undefined,
      painScaleBefore: result.painScaleBefore,
      painScaleAfter: result.painScaleAfter,
      treatmentsGiven: detectedModalities.length > 0 ? detectedModalities : undefined,
      fee: result.treatmentFee,
      paymentMethod: result.paymentMethod,
      visitType: result.visitType,
      seenBy: result.seenBy,
    };
  }

  return result;
}

export type VoiceActionType =
  | 'create_patient'
  | 'update_patient'
  | 'add_followup'
  | 'update_followup'
  | 'find_patient'
  | 'navigate'
  | 'search'
  | 'download_pdf'
  | 'create_receipt';

export interface UnifiedVoiceCommandResult {
  action: VoiceActionType;
  targetPatientName?: string | null;
  targetView?: 'patients' | 'monthly' | 'fees' | 'itreturn' | 'backup' | 'locum' | null;
  searchQuery?: string | null;
  actionSummary: string;
  fields: RecognizedClinicalFields;
  source: 'gemini' | 'client-nlp';
}

/**
 * Client-side intent parser when offline or backend Gemini is unavailable.
 */
export function detectVoiceIntent(
  transcript: string,
  existingData?: Partial<Patient>
): {
  action: VoiceActionType;
  targetPatientName?: string | null;
  targetView?: 'patients' | 'monthly' | 'fees' | 'itreturn' | 'backup' | 'locum' | null;
  searchQuery?: string | null;
  actionSummary: string;
} {
  const text = transcript.trim();
  const lower = text.toLowerCase();

  // 1. Follow-up Sessions (PRIORITY over general patient creation)
  if (/(?:add\s+follow\s*up|new\s+follow\s*up|follow\s*up\s+session|add\s+session|follow\s*up\s+visit|record\s+follow\s*up)\b/i.test(text)) {
    return {
      action: 'add_followup',
      targetPatientName: existingData?.name || null,
      actionSummary: existingData?.name
        ? `Add Follow-up Session for ${existingData.name}`
        : 'Add New Follow-up Session',
    };
  }

  if (/(?:update\s+follow\s*up|edit\s+follow\s*up|change\s+follow\s*up|in\s+session\s+\d+|session\s+\d+\s+pain)\b/i.test(text)) {
    return {
      action: 'update_followup',
      targetPatientName: existingData?.name || null,
      actionSummary: existingData?.name
        ? `Update Follow-up Session for ${existingData.name}`
        : 'Update Follow-up Session',
    };
  }

  // 2. Navigation
  if (/(?:go\s+to\s+monthly|show\s+monthly|monthly\s+report|monthly\s+data|monthly\s+analytics)\b/i.test(text)) {
    return {
      action: 'navigate',
      targetView: 'monthly',
      actionSummary: 'Switch to Monthly Data & Analytics',
    };
  }
  if (/(?:go\s+to\s+fees?|show\s+fees?|fee\s+collected|fee\s+report|fees\s+overview)\b/i.test(text)) {
    return {
      action: 'navigate',
      targetView: 'fees',
      actionSummary: 'Switch to Fee Collected Overview',
    };
  }
  if (/(?:go\s+to\s+it\s*return|show\s+it\s*return|44ada|annual\s+statement|tax\s+return)\b/i.test(text)) {
    return {
      action: 'navigate',
      targetView: 'itreturn',
      actionSummary: 'Switch to Income Tax / Section 44ADA Return',
    };
  }
  if (/(?:go\s+to\s+backup|show\s+backup|google\s+sheets|cloud\s+sync|backup\s+data)\b/i.test(text)) {
    return {
      action: 'navigate',
      targetView: 'backup',
      actionSummary: 'Switch to Cloud Sync & Google Sheets Backup',
    };
  }
  if (/(?:go\s+to\s+locum|show\s+locum|locum\s+tenens|locum\s+doctors|locum\s+physio)\b/i.test(text)) {
    return {
      action: 'navigate',
      targetView: 'locum',
      actionSummary: 'Switch to Locum Tenens Manager',
    };
  }
  if (/(?:show\s+all\s+patients|all\s+patients|patient\s+directory|go\s+to\s+patients)\b/i.test(text)) {
    return {
      action: 'navigate',
      targetView: 'patients',
      actionSummary: 'Open Patient Directory',
    };
  }

  // 3. Download PDF or Create Receipt
  if (/(?:download\s+(?:case\s*sheet|pdf)|export\s+pdf|save\s+(?:case\s*sheet|pdf))\b/i.test(text)) {
    return {
      action: 'download_pdf',
      actionSummary: 'Download Case Sheet PDF',
    };
  }
  if (/(?:create\s+receipt|generate\s+(?:receipt|bill)|open\s+receipt|billing)\b/i.test(text)) {
    return {
      action: 'create_receipt',
      actionSummary: 'Open Official Clinical Receipt Modal',
    };
  }

  // 4. Check for Open / Find patient
  const openMatch = text.match(/(?:open\s+patient|find\s+patient|view\s+patient|go\s+to\s+patient)\s+([A-Za-z\s.'’]+)/i);
  if (openMatch && openMatch[1]) {
    const pName = openMatch[1].trim();
    return {
      action: 'find_patient',
      targetPatientName: pName,
      actionSummary: `Open Patient Chart: ${pName}`,
    };
  }

  // 5. Check for Search
  const searchMatch = text.match(/(?:search\s+for|search\s+patient|search)\s+([A-Za-z0-9\s]+)/i);
  if (searchMatch && searchMatch[1] && !/(?:patient|new|fee|diagnosis|pain|follow)/i.test(searchMatch[1].trim())) {
    const q = searchMatch[1].trim();
    return {
      action: 'search',
      searchQuery: q,
      actionSummary: `Search Directory for "${q}"`,
    };
  }

  // 6. Check for Create New Patient (only when explicitly requested to add a new patient)
  const isExplicitCreate =
    /(?:add\s+new\s+patient|register\s+new\s+patient|register\s+patient|create\s+new\s+patient|create\s+patient)\b/i.test(text) ||
    (!existingData?.name && /^add\s+patient\b/i.test(text));
  if (isExplicitCreate) {
    return {
      action: 'create_patient',
      actionSummary: 'Register New Patient Record',
    };
  }

  // 7. Check for Edit named patient (e.g., "for patient Ramesh update diagnosis..." or "edit patient Suresh")
  const editMatch = text.match(/(?:edit\s+patient|update\s+patient|for\s+patient|in\s+patient)\s+([A-Za-z\s.'’]+?)(?=\s*(?:,|\.|\b(?:diagnosis|fee|age|pain|history|contact|phone|address)\b|$))/i);
  if (editMatch && editMatch[1]) {
    const target = editMatch[1].trim();
    return {
      action: 'update_patient',
      targetPatientName: target,
      actionSummary: `Update Patient Chart: ${target}`,
    };
  }

  // 8. Default: Update Active Patient
  return {
    action: 'update_patient',
    targetPatientName: existingData?.name || null,
    actionSummary: existingData?.name
      ? `Update Active Patient: ${existingData.name}`
      : 'Update Clinical Case Sheet Fields',
  };
}

/**
 * Executes Unified Voice AI extraction:
 * 1. Calls backend `/api/voice-fill` which uses Gemini 3.8 Flash to return structured intent + fields.
 * 2. Falls back to local fast regex NLP if backend is offline.
 */
export async function executeUnifiedVoiceCommandWithAI(
  transcript: string,
  existingData?: Partial<Patient>
): Promise<UnifiedVoiceCommandResult> {
  const text = transcript.trim();
  try {
    const res = await fetch('/api/voice-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: text, currentData: existingData }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.fields) {
        return {
          action: data.action || (detectVoiceIntent(text, existingData).action),
          targetPatientName: data.targetPatientName || null,
          targetView: data.targetView || null,
          searchQuery: data.searchQuery || null,
          actionSummary: data.actionSummary || detectVoiceIntent(text, existingData).actionSummary,
          fields: data.fields,
          source: 'gemini',
        };
      }
    }
  } catch (err) {
    // Fallback to client parser
  }

  const clientIntent = detectVoiceIntent(text, existingData);
  const clientFields = parseVoiceClinicalTranscript(text, existingData);
  return {
    ...clientIntent,
    fields: clientFields,
    source: 'client-nlp',
  };
}

/**
 * Executes Voice AI extraction:
 * 1. Tries the backend `/api/voice-fill` route with Gemini 3.8 Flash.
 * 2. If backend is offline or no GEMINI_API_KEY is configured, falls back to the client-side NLP parser.
 */
export async function extractClinicalFieldsWithAI(
  transcript: string,
  existingData?: Partial<Patient>
): Promise<{ fields: RecognizedClinicalFields; source: 'gemini' | 'client-nlp' }> {
  const unified = await executeUnifiedVoiceCommandWithAI(transcript, existingData);
  return { fields: unified.fields, source: unified.source };
}
