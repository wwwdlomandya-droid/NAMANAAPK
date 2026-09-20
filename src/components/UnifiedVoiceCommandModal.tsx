import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  Check,
  AlertCircle,
  UserPlus,
  Edit3,
  Search,
  Navigation,
  FileDown,
  Receipt,
  RotateCcw,
  Loader2,
  Stethoscope,
  Phone,
  User,
  IndianRupee,
  Activity,
  ArrowRight,
  HelpCircle,
  Volume2,
} from 'lucide-react';
import { Patient, PaymentMethod, VisitType } from '../types';
import { MainView } from './Header';
import {
  RecognizedClinicalFields,
  UnifiedVoiceCommandResult,
  VoiceActionType,
  executeUnifiedVoiceCommandWithAI,
  detectVoiceIntent,
} from '../utils/voiceFieldParser';
import { COMMON_DIAGNOSES, MODALITIES_LIST } from '../constants';

interface UnifiedVoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  activePatient: Patient | null;
  currentView: MainView;
  onAddPatient: (data: Partial<Patient>) => void;
  onUpdatePatientFields: (patientId: string, fields: RecognizedClinicalFields) => void;
  onNavigate: (view: MainView) => void;
  onSearchPatients: (query: string) => void;
  onDownloadPdf: () => void;
  onCreateReceipt: () => void;
  onSelectActivePatient: (patientId: string) => void;
}

// Audio chime using Web Audio API
function playChime(type: 'success' | 'start' | 'click' = 'success') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'success') {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'start') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.21);
    }
  } catch {
    // Ignore audio autoplay restrictions
  }
}

export const UnifiedVoiceCommandModal: React.FC<UnifiedVoiceCommandModalProps> = ({
  isOpen,
  onClose,
  patients,
  activePatient,
  currentView,
  onAddPatient,
  onUpdatePatientFields,
  onNavigate,
  onSearchPatients,
  onDownloadPdf,
  onCreateReceipt,
  onSelectActivePatient,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(activePatient?.id || null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [commandResult, setCommandResult] = useState<UnifiedVoiceCommandResult | null>(null);
  const [editableFields, setEditableFields] = useState<RecognizedClinicalFields>({});
  const [hasSpeechSupport, setHasSpeechSupport] = useState(true);
  const [executedToast, setExecutedToast] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Sync active patient on open or activePatient change
  useEffect(() => {
    if (activePatient?.id) {
      setSelectedPatientId(activePatient.id);
    }
  }, [activePatient, isOpen]);

  // Initialize Speech Recognition API
  useEffect(() => {
    if (!isOpen) return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setHasSpeechSupport(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Optimized for Indian clinical English (Mysuru / Karnataka context)

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg(null);
        playChime('start');
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentFinal += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        if (currentFinal) {
          setTranscript((prev) => (prev ? `${prev} ${currentFinal}` : currentFinal).trim());
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone access denied. Please allow microphone permissions in your browser.');
        } else {
          setErrorMsg(`Voice input error: ${event.error}. You can also type your command below.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;

      // Auto-start listening on modal open for immediate, seamless dictation
      try {
        recognition.start();
      } catch {
        // May already be active
      }
    } catch (e) {
      console.warn('Speech recognition init failed:', e);
      setHasSpeechSupport(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen]);

  // Toggle listening
  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      setErrorMsg(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Error starting speech:', err);
      }
    }
  };

  // Process the spoken or typed command
  const handleProcessCommand = async (textToProcess?: string) => {
    const rawText = (textToProcess ?? transcript).trim();
    if (!rawText) {
      setErrorMsg('Please speak or type a command first.');
      return;
    }

    // Stop listening during processing
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // Find patient context if relevant
      const contextPatient =
        (selectedPatientId ? patients.find((p) => p.id === selectedPatientId) : null) ||
        activePatient ||
        undefined;
      const result = await executeUnifiedVoiceCommandWithAI(rawText, contextPatient);

      setCommandResult(result);
      setEditableFields({ ...result.fields });

      // Auto-select matched patient if identified
      if (result.targetPatientName) {
        const q = result.targetPatientName.toLowerCase().trim();
        const match = patients.find(
          (p) => p.name.toLowerCase().includes(q) || (p.regNo && p.regNo.toLowerCase().includes(q))
        );
        if (match) {
          setSelectedPatientId(match.id);
        }
      }
      playChime('success');
    } catch (err: any) {
      console.error('Failed to parse command:', err);
      // Fallback to client intent
      const fallback = detectVoiceIntent(rawText, activePatient || undefined);
      setCommandResult({
        ...fallback,
        fields: {},
        source: 'client-nlp',
      });
      setEditableFields({});
    } finally {
      setIsProcessing(false);
    }
  };

  // Resolve target patient for update action
  const resolveTargetPatient = (): Patient | null => {
    if (selectedPatientId) {
      const found = patients.find((p) => p.id === selectedPatientId);
      if (found) return found;
    }
    if (commandResult?.targetPatientName) {
      const q = commandResult.targetPatientName.toLowerCase().trim();
      const match = patients.find(
        (p) => p.name.toLowerCase().includes(q) || (p.regNo && p.regNo.toLowerCase().includes(q))
      );
      if (match) return match;
    }
    return activePatient;
  };

  // Execute the confirmed action
  const handleConfirmAndExecute = () => {
    if (!commandResult) return;

    playChime('success');

    switch (commandResult.action) {
      case 'create_patient': {
        const newPatientData: Partial<Patient> = {
          name: editableFields.name || 'New Patient',
          age: editableFields.age ? String(editableFields.age) : '',
          sex: editableFields.sex || 'Male',
          contact: editableFields.contact || '',
          address: editableFields.address || 'Mysuru, Karnataka',
          height: editableFields.height || "5'6\"",
          weight: editableFields.weight || '65',
          bloodGroup: editableFields.bloodGroup || 'O+',
          diagnosis: editableFields.diagnosis || '',
          history: editableFields.history || '',
          referredBy: editableFields.referredBy || '',
          seenBy: editableFields.seenBy || '',
          treatmentFee: editableFields.treatmentFee ? String(editableFields.treatmentFee) : '500',
          paymentMethod: editableFields.paymentMethod || 'UPI',
          visitType: editableFields.visitType || 'Clinic',
          painScaleBefore: editableFields.painScaleBefore,
          painScaleAfter: editableFields.painScaleAfter,
        };

        // Treatment modalities
        if (editableFields.modalities && editableFields.modalities.length > 0) {
          const treat: any = {};
          editableFields.modalities.forEach((m) => {
            const match = MODALITIES_LIST.find(
              (item) => item.label.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(item.label.toLowerCase())
            );
            if (match) treat[match.key] = true;
          });
          newPatientData.treatment = treat;
        }

        onAddPatient(newPatientData);
        setExecutedToast(`Successfully registered new patient: ${newPatientData.name}!`);
        setTimeout(() => {
          onClose();
        }, 1200);
        break;
      }

      case 'update_patient':
      case 'add_followup':
      case 'update_followup': {
        const target = resolveTargetPatient();
        if (!target) {
          setErrorMsg('No target patient found. Please select a patient or specify patient name in your command.');
          return;
        }

        const payload: RecognizedClinicalFields = { ...editableFields };
        if (commandResult.action === 'add_followup') {
          payload.followUp = {
            ...(payload.followUp || {}),
            action: 'add',
          };
        } else if (commandResult.action === 'update_followup') {
          payload.followUp = {
            ...(payload.followUp || {}),
            action: 'update',
          };
        }

        onUpdatePatientFields(target.id, payload);
        if (commandResult.action === 'add_followup' || payload.followUp?.action === 'add') {
          setExecutedToast(`Added new follow-up session for ${target.name || 'patient'}!`);
        } else if (commandResult.action === 'update_followup' || payload.followUp?.action === 'update') {
          setExecutedToast(`Updated follow-up visit for ${target.name || 'patient'}!`);
        } else {
          setExecutedToast(`Updated clinical record for ${target.name || 'patient'}!`);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
        break;
      }

      case 'navigate': {
        if (commandResult.targetView) {
          onNavigate(commandResult.targetView);
          setExecutedToast(`Navigated to ${commandResult.targetView.toUpperCase()}!`);
          setTimeout(() => {
            onClose();
          }, 800);
        }
        break;
      }

      case 'search': {
        const q = commandResult.searchQuery || commandResult.targetPatientName || '';
        if (q) {
          onNavigate('patients');
          onSearchPatients(q);
          setExecutedToast(`Searching for "${q}" in Patient Directory...`);
          setTimeout(() => {
            onClose();
          }, 800);
        }
        break;
      }

      case 'download_pdf': {
        onDownloadPdf();
        setExecutedToast('Downloading Case Sheet PDF...');
        setTimeout(() => {
          onClose();
        }, 800);
        break;
      }

      case 'create_receipt': {
        onCreateReceipt();
        setExecutedToast('Opening Official Receipt Generator...');
        setTimeout(() => {
          onClose();
        }, 800);
        break;
      }

      default:
        onClose();
        break;
    }
  };

  // Quick preset voice commands
  const quickCommands = [
    {
      label: 'Add New Patient',
      text: 'Add patient Ramesh age 45 male phone 9880517715 diagnosis Frozen Shoulder fee 500 payment UPI',
      icon: UserPlus,
      color: 'text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100',
    },
    {
      label: 'Add Follow-up Session',
      text: 'Add follow up session today pain scale before 6 after 2 IFT notes patient showed progressive relief fee 500 UPI',
      icon: Activity,
      color: 'text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100',
    },
    {
      label: 'Update Diagnosis & Pain',
      text: 'Update diagnosis to Cervical Spondylosis and pain scale before 7 and after 3',
      icon: Edit3,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    },
    {
      label: 'Edit Phone & Address',
      text: 'Update phone to 9880517715 and address Kuvempunagar Mysuru',
      icon: Phone,
      color: 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100',
    },
    {
      label: 'Set Modalities & Fee',
      text: 'Set treatment modalities to IFT and Ultrasound and treatment fee 600 payment Cash',
      icon: Stethoscope,
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
    },
    {
      label: 'Go to Monthly Data',
      text: 'Go to monthly data',
      icon: Navigation,
      color: 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100',
    },
    {
      label: 'Download Case Sheet PDF',
      text: 'Download patient case sheet PDF',
      icon: FileDown,
      color: 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100',
    },
  ];

  if (!isOpen) return null;

  const targetPatient = resolveTargetPatient();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-sky-100 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unified-voice-title"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-sky-700 via-sky-800 to-indigo-800 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="unified-voice-title" className="text-base font-extrabold tracking-tight">
                  Voice Command AI
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                  Gemini Flash AI
                </span>
              </div>
              <p className="text-xs text-sky-200/90 font-medium">
                {activePatient ? (
                  <span>
                    Current Chart: <strong className="text-white">{activePatient.name || 'Unnamed'}</strong> • Speak to add, edit, or navigate
                  </span>
                ) : (
                  <span>System-wide control • Dictate to add patient, edit fields, search, navigate</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Success Toast */}
          {executedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{executedToast}</span>
            </div>
          )}

          {/* Target Patient Selector Bar */}
          <div className="p-2.5 bg-sky-50/80 border border-sky-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-sky-950 min-w-0">
              <User className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="font-semibold text-slate-700 shrink-0">Target Patient:</span>
              <select
                value={selectedPatientId || ''}
                onChange={(e) => setSelectedPatientId(e.target.value || null)}
                className="bg-white border border-sky-300 rounded-lg px-2.5 py-1 text-xs font-bold text-sky-950 focus:ring-1 focus:ring-sky-500 outline-none max-w-full sm:max-w-[240px] truncate"
              >
                <option value="">-- Auto-detect from Voice --</option>
                {patients
                  .filter((p) => !p.deleted)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.regNo || p.contact || 'No Reg'})
                    </option>
                  ))}
              </select>
            </div>
            {targetPatient && (
              <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-sky-800 font-medium">
                <span className="bg-white px-2 py-0.5 rounded-md border border-sky-200">
                  {targetPatient.diagnosis || 'Clinical Chart'}
                </span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                  {targetPatient.followUps?.length || 0} Follow-up(s)
                </span>
              </div>
            )}
          </div>

          {/* Dictation Box with Visualizer */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isListening ? 'bg-rose-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                <span className="text-xs font-bold text-slate-700">
                  {isListening ? 'Listening... Speak your command now' : 'Microphone Ready'}
                </span>
              </div>

              <button
                type="button"
                onClick={toggleListening}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-200'
                    : 'bg-sky-600 hover:bg-sky-700 text-white'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-3.5 h-3.5 animate-bounce" />
                    <span>Stop Listening</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    <span>Start Dictation</span>
                  </>
                )}
              </button>
            </div>

            {/* Spoken Text Box */}
            <div className="relative">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={
                  hasSpeechSupport
                    ? 'Say "Add patient Ramesh age 45 male diagnosis frozen shoulder" or "Update diagnosis to cervical spondylosis"...'
                    : 'Type your clinical command here...'
                }
                rows={3}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm font-medium focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-none resize-none leading-relaxed"
              />

              {interimTranscript && (
                <div className="absolute bottom-2 left-3 right-3 text-xs text-slate-400 italic truncate pointer-events-none">
                  Hearing: {interimTranscript}
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Bar for Command */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setTranscript('');
                  setInterimTranscript('');
                  setCommandResult(null);
                  setEditableFields({});
                }}
                disabled={!transcript && !commandResult}
                className="text-slate-500 hover:text-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>

              <button
                type="button"
                id="btn-process-voice-ai-command"
                onClick={() => handleProcessCommand()}
                disabled={!transcript.trim() || isProcessing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-extrabold cursor-pointer shadow-xs disabled:opacity-50 transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Command...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Process Command</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Result Action Card */}
          {commandResult && (
            <div className="bg-white rounded-2xl border-2 border-sky-300 p-4 space-y-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between pb-2 border-b border-sky-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-100 text-sky-800">
                    {commandResult.action === 'create_patient' && <UserPlus className="w-4 h-4" />}
                    {commandResult.action === 'update_patient' && <Edit3 className="w-4 h-4" />}
                    {(commandResult.action === 'add_followup' || commandResult.action === 'update_followup') && <Activity className="w-4 h-4" />}
                    {commandResult.action === 'navigate' && <Navigation className="w-4 h-4" />}
                    {commandResult.action === 'search' && <Search className="w-4 h-4" />}
                    {commandResult.action === 'download_pdf' && <FileDown className="w-4 h-4" />}
                    {commandResult.action === 'create_receipt' && <Receipt className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                      Detected Action: {commandResult.action.replace('_', ' ')}
                    </h3>
                    <p className="text-xs text-sky-800 font-medium">{commandResult.actionSummary}</p>
                  </div>
                </div>

                <span className="text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                  {commandResult.source === 'gemini' ? 'Gemini 3.8 Flash' : 'Fast Local NLP'}
                </span>
              </div>

              {/* ACTION SPECIFIC EDITING / PREVIEWS */}
              {commandResult.action === 'create_patient' && (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-slate-700">
                    Review Extracted Demographics & Clinical Assessment (edit if needed):
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Patient Name</label>
                      <input
                        type="text"
                        value={editableFields.name || ''}
                        onChange={(e) => setEditableFields((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:border-sky-500 outline-none"
                        placeholder="e.g. Ramesh Kumar"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Age</label>
                        <input
                          type="number"
                          value={editableFields.age || ''}
                          onChange={(e) => setEditableFields((prev) => ({ ...prev, age: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:border-sky-500 outline-none"
                          placeholder="e.g. 45"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Gender</label>
                        <select
                          value={editableFields.sex || 'Male'}
                          onChange={(e) => setEditableFields((prev) => ({ ...prev, sex: e.target.value as any }))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:border-sky-500 outline-none"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Contact Phone</label>
                      <input
                        type="text"
                        value={editableFields.contact || ''}
                        onChange={(e) => setEditableFields((prev) => ({ ...prev, contact: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:border-sky-500 outline-none"
                        placeholder="10-digit mobile number"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Clinical Diagnosis</label>
                      <input
                        type="text"
                        value={editableFields.diagnosis || ''}
                        onChange={(e) => setEditableFields((prev) => ({ ...prev, diagnosis: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:border-sky-500 outline-none"
                        placeholder="e.g. Frozen Shoulder"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Treatment Fee (₹)</label>
                      <input
                        type="number"
                        value={editableFields.treatmentFee || '500'}
                        onChange={(e) => setEditableFields((prev) => ({ ...prev, treatmentFee: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-700 focus:border-sky-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Payment Method</label>
                      <select
                        value={editableFields.paymentMethod || 'UPI'}
                        onChange={(e) => setEditableFields((prev) => ({ ...prev, paymentMethod: e.target.value as any }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:border-sky-500 outline-none"
                      >
                        <option value="UPI">UPI / GPay / PhonePe</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Due">Due / Pending</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Follow-up Session Review Block (for add_followup, update_followup, or when followUp is present) */}
              {(commandResult.action === 'add_followup' || commandResult.action === 'update_followup' || editableFields.followUp) && (
                <div className="space-y-3 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-600 text-white text-[10px] font-extrabold uppercase tracking-wide">
                        {commandResult.action === 'update_followup' ? 'Edit Follow-up Session' : 'New Follow-up Session'}
                      </span>
                      <span className="font-bold text-amber-950">
                        Session #
                        {editableFields.followUp?.sessionNumber ||
                          (targetPatient?.followUps?.length ? targetPatient.followUps.length + 1 : 1)}
                        {' for '}
                        <strong className="text-amber-900">{targetPatient?.name || 'Selected Patient'}</strong>
                      </span>
                    </div>
                    {targetPatient?.regNo && (
                      <span className="font-mono text-[10px] text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200">
                        {targetPatient.regNo}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Session Date</label>
                      <input
                        type="date"
                        value={editableFields.followUp?.date || editableFields.date || new Date().toISOString().split('T')[0]}
                        onChange={(e) =>
                          setEditableFields((prev) => ({
                            ...prev,
                            date: e.target.value,
                            followUp: { ...(prev.followUp || {}), date: e.target.value },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:border-amber-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Pain Before (0-10)</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={editableFields.followUp?.painScaleBefore ?? editableFields.painScaleBefore ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            setEditableFields((prev) => ({
                              ...prev,
                              painScaleBefore: val,
                              followUp: { ...(prev.followUp || {}), painScaleBefore: val },
                            }));
                          }}
                          placeholder="e.g. 7"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-rose-700 focus:border-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Pain After (0-10)</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={editableFields.followUp?.painScaleAfter ?? editableFields.painScaleAfter ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            setEditableFields((prev) => ({
                              ...prev,
                              painScaleAfter: val,
                              followUp: { ...(prev.followUp || {}), painScaleAfter: val },
                            }));
                          }}
                          placeholder="e.g. 3"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-700 focus:border-amber-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Session Fee (₹)</label>
                      <input
                        type="number"
                        value={editableFields.followUp?.fee ?? editableFields.treatmentFee ?? targetPatient?.treatmentFee ?? '500'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditableFields((prev) => ({
                            ...prev,
                            treatmentFee: val,
                            followUp: { ...(prev.followUp || {}), fee: val },
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-800 focus:border-amber-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Payment Mode</label>
                      <select
                        value={editableFields.followUp?.paymentMethod || editableFields.paymentMethod || targetPatient?.paymentMethod || 'UPI'}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setEditableFields((prev) => ({
                            ...prev,
                            paymentMethod: val,
                            followUp: { ...(prev.followUp || {}), paymentMethod: val },
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:border-amber-500 outline-none"
                      >
                        <option value="UPI">UPI / GPay / PhonePe</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Due">Due / Pending</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Progress & Clinical Notes</label>
                      <textarea
                        rows={2}
                        value={editableFields.followUp?.notes || editableFields.history || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditableFields((prev) => ({
                            ...prev,
                            followUp: { ...(prev.followUp || {}), notes: val },
                          }));
                        }}
                        placeholder="e.g. Patient showed progressive relief in lumbar mobility. Advised core strengthening exercises."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:border-amber-500 outline-none resize-none"
                      />
                    </div>

                    {editableFields.modalities && editableFields.modalities.length > 0 && (
                      <div className="sm:col-span-2 flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Treatments Given:</span>
                        <span className="text-xs font-bold text-sky-800 truncate">{editableFields.modalities.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Patient Fields Update Block */}
              {commandResult.action === 'update_patient' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      Applying Updates to: <strong>{targetPatient?.name || 'Active Chart'}</strong>
                    </span>
                    {targetPatient?.regNo && (
                      <span className="font-mono text-[10px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        {targetPatient.regNo}
                      </span>
                    )}
                  </div>

                  {/* Comprehensive list of recognized fields with editable inputs */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                    {/* Name */}
                    {editableFields.name && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Patient Name:</span>
                        <input
                          type="text"
                          value={editableFields.name}
                          onChange={(e) => setEditableFields((p) => ({ ...p, name: e.target.value }))}
                          className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-semibold text-xs text-right w-2/3"
                        />
                      </div>
                    )}

                    {/* Age & Sex */}
                    {(editableFields.age !== undefined || editableFields.sex) && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Age / Gender:</span>
                        <div className="flex items-center gap-2 justify-end">
                          {editableFields.age !== undefined && (
                            <input
                              type="number"
                              value={editableFields.age}
                              onChange={(e) => setEditableFields((p) => ({ ...p, age: e.target.value }))}
                              className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-semibold text-xs text-right w-20"
                              placeholder="Age"
                            />
                          )}
                          {editableFields.sex && (
                            <select
                              value={editableFields.sex}
                              onChange={(e) => setEditableFields((p) => ({ ...p, sex: e.target.value as any }))}
                              className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-semibold text-xs text-right"
                            >
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Contact & Address */}
                    {editableFields.contact && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Contact Phone:</span>
                        <input
                          type="text"
                          value={editableFields.contact}
                          onChange={(e) => setEditableFields((p) => ({ ...p, contact: e.target.value }))}
                          className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-semibold text-xs text-right w-2/3"
                        />
                      </div>
                    )}

                    {editableFields.address && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Address:</span>
                        <input
                          type="text"
                          value={editableFields.address}
                          onChange={(e) => setEditableFields((p) => ({ ...p, address: e.target.value }))}
                          className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-semibold text-xs text-right w-2/3"
                        />
                      </div>
                    )}

                    {/* Diagnosis */}
                    {editableFields.diagnosis && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Diagnosis:</span>
                        <input
                          type="text"
                          value={editableFields.diagnosis}
                          onChange={(e) => setEditableFields((p) => ({ ...p, diagnosis: e.target.value }))}
                          className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-semibold text-xs text-right w-2/3"
                        />
                      </div>
                    )}

                    {/* Pain Scales */}
                    {editableFields.painScaleBefore !== undefined && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Pain Scale (Before):</span>
                        <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {editableFields.painScaleBefore} / 10
                        </span>
                      </div>
                    )}
                    {editableFields.painScaleAfter !== undefined && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Pain Scale (After):</span>
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {editableFields.painScaleAfter} / 10
                        </span>
                      </div>
                    )}

                    {/* Treatment Fee & Payment */}
                    {editableFields.treatmentFee !== undefined && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Treatment Fee:</span>
                        <span className="font-bold text-emerald-700">₹{editableFields.treatmentFee}</span>
                      </div>
                    )}
                    {editableFields.paymentMethod && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Payment Method:</span>
                        <span className="font-bold text-sky-700">{editableFields.paymentMethod}</span>
                      </div>
                    )}

                    {/* Modalities */}
                    {editableFields.modalities && editableFields.modalities.length > 0 && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Modalities:</span>
                        <span className="font-semibold text-slate-800">{editableFields.modalities.join(', ')}</span>
                      </div>
                    )}

                    {/* Comorbidities */}
                    {editableFields.comorbid && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Comorbidities:</span>
                        <span className="font-semibold text-purple-700">
                          {[
                            editableFields.comorbid.diabetes && 'Diabetes',
                            editableFields.comorbid.bp && 'Hypertension/BP',
                            editableFields.comorbid.thyroid && 'Thyroid',
                            editableFields.comorbid.other && (editableFields.comorbid.otherText || 'Other'),
                          ]
                            .filter(Boolean)
                            .join(', ') || 'None noted'}
                        </span>
                      </div>
                    )}

                    {/* History Notes */}
                    {editableFields.history && (
                      <div className="pt-1">
                        <span className="font-bold text-slate-600 block mb-1">Clinical Assessment / History:</span>
                        <p className="text-slate-800 bg-white p-2 rounded border border-slate-200 italic text-[11px]">
                          {editableFields.history}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Confirmation Button */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCommandResult(null)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  id="btn-confirm-unified-voice-action"
                  onClick={handleConfirmAndExecute}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold cursor-pointer shadow-xs transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {commandResult.action === 'create_patient' && 'Register Patient Now'}
                    {commandResult.action === 'add_followup' && 'Add Follow-up Session to Record'}
                    {commandResult.action === 'update_followup' && 'Update Follow-up Session'}
                    {commandResult.action === 'update_patient' && (editableFields.followUp ? 'Save Follow-up & Record' : 'Save Updates to Chart')}
                    {commandResult.action === 'navigate' && `Go to ${commandResult.targetView}`}
                    {commandResult.action === 'search' && 'Search Directory'}
                    {commandResult.action === 'download_pdf' && 'Download PDF'}
                    {commandResult.action === 'create_receipt' && 'Generate Receipt'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Command Suggestions */}
          <div className="pt-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-2">
              <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
              <span>Try these Voice Commands (click any to load):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickCommands.map((cmd, idx) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTranscript(cmd.text);
                      handleProcessCommand(cmd.text);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all text-left ${cmd.color}`}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span>{cmd.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px]">Powered by Google Gemini 3.8 Flash • Unified Voice Recognition</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
