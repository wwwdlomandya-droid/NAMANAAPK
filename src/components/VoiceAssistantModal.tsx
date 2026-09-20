import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  X,
  Volume2,
  AlertCircle,
  RotateCcw,
  Check,
  User,
  Activity,
  Phone,
  Calendar,
  CreditCard,
  FileText,
  Zap,
} from 'lucide-react';
import {
  RecognizedClinicalFields,
  extractClinicalFieldsWithAI,
} from '../utils/voiceFieldParser';
import {
  playVoiceListeningStart,
  playVoiceFillSuccess,
} from '../utils/audioNotification';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFields: (fields: RecognizedClinicalFields) => void;
  contextTitle?: string;
  currentData?: any;
}

export function VoiceAssistantModal({
  isOpen,
  onClose,
  onApplyFields,
  contextTitle = 'Patient Record',
  currentData,
}: VoiceAssistantModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedFields, setDetectedFields] = useState<RecognizedClinicalFields | null>(null);
  const [parsingSource, setParsingSource] = useState<'gemini' | 'client-nlp' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoApply, setAutoApply] = useState(true);

  const recognitionRef = useRef<any>(null);
  const transcriptAccumulatedRef = useRef('');

  useEffect(() => {
    if (!isOpen) {
      stopListening();
      setTranscript('');
      setInterimTranscript('');
      setDetectedFields(null);
      setErrorMsg(null);
      setIsProcessing(false);
    } else {
      // Auto-start listening when modal opens
      startListening();
    }
  }, [isOpen]);

  const startListening = () => {
    setErrorMsg(null);
    setDetectedFields(null);
    setTranscript('');
    setInterimTranscript('');
    transcriptAccumulatedRef.current = '';

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg(
        'Speech recognition is not supported in this browser. Please use Chrome, Edge, Safari, or an Android device.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Works well for Indian English and medical terms

      recognition.onstart = () => {
        setIsListening(true);
        playVoiceListeningStart();
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalStr = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalStr += trans + ' ';
          } else {
            interim += trans;
          }
        }

        if (finalStr) {
          transcriptAccumulatedRef.current += finalStr;
          setTranscript(transcriptAccumulatedRef.current);
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone access was denied. Please allow microphone permissions in your browser.');
        } else if (event.error !== 'no-speech') {
          setErrorMsg(`Voice input notice: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      setErrorMsg('Could not initialize speech recognition: ' + e.message);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const handleProcessSpeech = async () => {
    stopListening();
    const fullText = (transcriptAccumulatedRef.current + ' ' + interimTranscript).trim();

    if (!fullText) {
      setErrorMsg('No speech detected. Please speak clearly into your microphone.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const result = await extractClinicalFieldsWithAI(fullText, currentData);
      setDetectedFields(result.fields);
      setParsingSource(result.source);

      const fieldCount = Object.keys(result.fields).length;
      if (fieldCount > 0) {
        playVoiceFillSuccess();
        if (autoApply) {
          onApplyFields(result.fields);
          setTimeout(() => {
            onClose();
          }, 900);
        }
      } else {
        setErrorMsg('Could not match specific clinical fields. Try mentioning field names like "Name...", "Diagnosis...", "Fee...".');
      }
    } catch (err: any) {
      setErrorMsg('Error analyzing voice fields: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualApply = () => {
    if (detectedFields && Object.keys(detectedFields).length > 0) {
      onApplyFields(detectedFields);
      playVoiceFillSuccess();
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentDisplaySpeech = (transcript + ' ' + interimTranscript).trim();
  const fieldsCount = detectedFields ? Object.keys(detectedFields).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-sky-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-700 via-sky-600 to-teal-600 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                Voice AI Clinical Recognition
                <span className="text-[10px] uppercase font-bold bg-white/20 px-2 py-0.5 rounded-full">
                  Auto-Fill
                </span>
              </h3>
              <p className="text-[11px] text-sky-100 font-medium">
                Dictate clinical data for {contextTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-slate-800">
          {/* Microphone Interactive Stage */}
          <div className="flex flex-col items-center justify-center py-4 bg-gradient-to-b from-sky-50/70 to-slate-50 rounded-2xl border border-sky-100 relative">
            {/* Animated Pulse Rings when listening */}
            <div className="relative flex items-center justify-center">
              {isListening && (
                <>
                  <div className="absolute w-24 h-24 rounded-full bg-sky-400/20 animate-ping" />
                  <div className="absolute w-20 h-20 rounded-full bg-sky-500/30 animate-pulse" />
                </>
              )}
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/30 scale-105'
                    : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/30'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-7 h-7 animate-bounce" />
                ) : (
                  <Mic className="w-7 h-7" />
                )}
              </button>
            </div>

            <div className="mt-3 text-center">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
                  isListening
                    ? 'bg-rose-100 text-rose-700 animate-pulse'
                    : isProcessing
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {isListening ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                    Listening... Speak now
                  </>
                ) : isProcessing ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                    Analyzing with AI...
                  </>
                ) : (
                  'Click mic to start speaking'
                )}
              </span>
            </div>

            {/* Live speech audio bars */}
            {isListening && (
              <div className="flex items-center gap-1 mt-2.5 h-4">
                {[40, 70, 100, 60, 90, 45, 80, 50, 95, 60, 30].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-sky-500 rounded-full animate-pulse"
                    style={{
                      height: `${h}%`,
                      animationDelay: `${i * 0.08}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Transcript Display Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>Spoken Transcript:</span>
              {currentDisplaySpeech && (
                <button
                  type="button"
                  onClick={() => {
                    setTranscript('');
                    setInterimTranscript('');
                    transcriptAccumulatedRef.current = '';
                  }}
                  className="text-slate-400 hover:text-slate-600 font-normal flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[70px] max-h-[110px] overflow-y-auto text-xs leading-relaxed">
              {currentDisplaySpeech ? (
                <p className="text-slate-800 font-medium">
                  {transcript}
                  <span className="text-sky-600 font-semibold italic">
                    {interimTranscript}
                  </span>
                </p>
              ) : (
                <p className="text-slate-400 italic">
                  Say something like: "Patient Ramesh, age 45, male, diagnosis Frozen Shoulder, pain score 8, fee 500 cash..."
                </p>
              )}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Notice:</span> {errorMsg}
              </div>
            </div>
          )}

          {/* Detected Fields Preview Card */}
          {detectedFields && fieldsCount > 0 && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Recognized {fieldsCount} Field{fieldsCount > 1 ? 's' : ''}:</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {parsingSource === 'gemini' ? 'AI Extracted' : 'NLP Matched'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {detectedFields.name && (
                  <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Name</span>
                    <span className="font-bold text-slate-900">{detectedFields.name}</span>
                  </div>
                )}
                {detectedFields.age && (
                  <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Age / Sex</span>
                    <span className="font-bold text-slate-900">
                      {detectedFields.age} yrs {detectedFields.sex ? `• ${detectedFields.sex}` : ''}
                    </span>
                  </div>
                )}
                {detectedFields.contact && (
                  <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Phone</span>
                    <span className="font-bold text-slate-900">{detectedFields.contact}</span>
                  </div>
                )}
                {detectedFields.diagnosis && (
                  <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-2xs col-span-2">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Clinical Diagnosis</span>
                    <span className="font-bold text-sky-950">{detectedFields.diagnosis}</span>
                  </div>
                )}
                {detectedFields.history && (
                  <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-2xs col-span-2">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Chief Complaints / History</span>
                    <span className="font-medium text-slate-800 line-clamp-2">{detectedFields.history}</span>
                  </div>
                )}
                {detectedFields.painScaleBefore !== undefined && (
                  <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Pain Score</span>
                    <span className="font-bold text-rose-600">
                      {detectedFields.painScaleBefore}/10
                      {detectedFields.painScaleAfter !== undefined ? ` ➔ ${detectedFields.painScaleAfter}/10` : ''}
                    </span>
                  </div>
                )}
                {detectedFields.treatmentFee !== undefined && (
                  <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Fee & Payment</span>
                    <span className="font-bold text-emerald-700">
                      ₹{detectedFields.treatmentFee} {detectedFields.paymentMethod ? `(${detectedFields.paymentMethod})` : ''}
                    </span>
                  </div>
                )}
                {detectedFields.bloodGroup && (
                  <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Blood Group</span>
                    <span className="font-bold text-slate-900">{detectedFields.bloodGroup}</span>
                  </div>
                )}
                {detectedFields.referredBy && (
                  <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Referred By</span>
                    <span className="font-bold text-slate-900">{detectedFields.referredBy}</span>
                  </div>
                )}
              </div>

              {autoApply && (
                <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 pt-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Auto-fill applied directly to form!
                </div>
              )}
            </div>
          )}

          {/* Quick Voice Hints Pill */}
          <div className="p-3 bg-sky-50/50 rounded-xl border border-sky-100 text-[11px] text-slate-600 space-y-1">
            <span className="font-bold text-sky-950 block">💡 Tips you can say:</span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600">
              <li>"Patient name Ramesh, age 45, male, phone 9880123456"</li>
              <li>"Diagnosis Cervical Spondylosis plus Frozen Shoulder"</li>
              <li>"Chief complaint neck pain since 2 weeks, pain score 8"</li>
              <li>"Consultation fee 500 paid by UPI"</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 font-semibold">
            <input
              type="checkbox"
              checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
              className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
            />
            <span>Auto-fill form on recognition</span>
          </label>

          <div className="flex items-center gap-2">
            {isListening ? (
              <button
                type="button"
                onClick={handleProcessSpeech}
                disabled={!currentDisplaySpeech}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                Done & Auto-Fill
              </button>
            ) : (
              <>
                {detectedFields && !autoApply && (
                  <button
                    type="button"
                    onClick={handleManualApply}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Apply Fields
                  </button>
                )}
                <button
                  type="button"
                  onClick={startListening}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  Speak Again
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
