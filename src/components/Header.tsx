import React from 'react';
import { Users, Calendar, IndianRupee, FileSpreadsheet, UserCheck, Mic, Sparkles } from 'lucide-react';
import { ClinicLogo } from './ClinicLogo';
import { WaterBackupNavButton } from './WaterBackupNavButton';

export type MainView = 'patients' | 'monthly' | 'fees' | 'itreturn' | 'backup' | 'locum';

interface HeaderProps {
  currentView: MainView;
  onSelectView: (view: MainView) => void;
  clinicName?: string;
  totalPatientsCount?: number;
  activePatientsCount?: number;
  deletedPatientsCount?: number;
  onSelectPatientStatus?: (status: 'all' | 'active' | 'deleted') => void;
  onOpenVoiceCommand?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  clinicName = "Namana Physiotherapy Clinic",
  totalPatientsCount = 0,
  activePatientsCount = 0,
  deletedPatientsCount = 0,
  onSelectPatientStatus,
  onOpenVoiceCommand,
}) => {
  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-sky-100 px-2 sm:px-4 md:px-4 lg:px-6 xl:px-8 flex items-center justify-between flex-shrink-0 sticky top-0 z-30 shadow-xs text-slate-800 w-full">
      {/* Clinic Name & Logo Header Region - Guaranteed Home Return & Adaptive Mobile Size */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 z-20 mr-1 sm:mr-3">
        {/* Clinic Name Branding Button */}
        <button
          type="button"
          id="header-home-logo-btn"
          className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 cursor-pointer select-none py-1 text-left group focus:outline-none focus:ring-2 focus:ring-sky-400 rounded-xl transition-all min-w-0"
          onClick={() => {
            onSelectView('patients');
            onSelectPatientStatus?.('all');
          }}
          title={`${clinicName} - Click to Return to Home / Patient Directory`}
          aria-label="Return to Home Screen"
        >
          {/* Fluid Logo scaling perfectly on mobile, tablet, desktop */}
          <div className="w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 shrink-0 drop-shadow-xs flex items-center justify-center group-hover:scale-105 transition-transform">
            <ClinicLogo className="w-full h-full" />
          </div>

          {/* Adaptive Clinic Name & Tagline */}
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm md:text-base font-extrabold tracking-tight text-sky-950 leading-tight truncate group-hover:text-sky-700 transition-colors">
              <span className="hidden sm:inline">{clinicName}</span>
              <span className="sm:hidden">Namana Physio</span>
            </h1>
            <p className="hidden sm:block text-[8.5px] sm:text-[9.5px] md:text-[10px] font-bold tracking-wide uppercase whitespace-nowrap leading-tight mt-0.5 text-slate-500">
              <span className="text-rose-600">Remove pain, </span>
              <span className="text-emerald-600">Move Again</span>
            </p>
          </div>
        </button>

        {/* Single Unified Voice Command Button - Next to Logo Without Overlapping */}
        {onOpenVoiceCommand && (
          <button
            type="button"
            id="header-unified-voice-command-btn"
            onClick={onOpenVoiceCommand}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-600 hover:from-sky-700 hover:via-sky-800 hover:to-indigo-700 text-white font-extrabold text-[11px] sm:text-xs shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer border border-sky-400/40 whitespace-nowrap group shrink-0"
            title="Unified Voice Command AI • Start adding a patient, edit fields, search, navigate"
            aria-label="Unified Voice Command"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white group-hover:scale-110 transition-transform shrink-0" />
            <span className="hidden sm:inline">Voice Command</span>
            <span className="sm:hidden font-bold">Voice</span>
            <Sparkles className="w-3 h-3 text-amber-300 hidden lg:inline shrink-0" />
          </button>
        )}
      </div>

      {/* Desktop & Tablet Navigation Tabs - Responsive Spacing & Labels */}
      <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 shrink-0">
        <button
          id="nav-tab-patients"
          onClick={() => {
            onSelectView('patients');
            onSelectPatientStatus?.('all');
          }}
          className={`flex items-center gap-1.5 px-2 md:px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-xl text-[11px] lg:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            currentView === 'patients'
              ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-xs'
              : 'text-slate-600 hover:bg-sky-50/70 hover:text-sky-900 border border-transparent'
          }`}
          title="Patient Directory"
        >
          <Users className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span>Patients</span>
        </button>

        <button
          id="nav-tab-monthly"
          onClick={() => onSelectView('monthly')}
          className={`flex items-center gap-1.5 px-2 md:px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-xl text-[11px] lg:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            currentView === 'monthly'
              ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-xs'
              : 'text-slate-600 hover:bg-sky-50/70 hover:text-sky-900 border border-transparent'
          }`}
          title="Monthly Analytics & Reports"
        >
          <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span className="inline lg:hidden">Monthly</span>
          <span className="hidden lg:inline">Monthly Data</span>
        </button>

        <button
          id="nav-tab-fees"
          onClick={() => onSelectView('fees')}
          className={`flex items-center gap-1.5 px-2 md:px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-xl text-[11px] lg:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            currentView === 'fees'
              ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-xs'
              : 'text-slate-600 hover:bg-sky-50/70 hover:text-sky-900 border border-transparent'
          }`}
          title="Fee Collected Overview"
        >
          <IndianRupee className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="inline lg:hidden">Fees</span>
          <span className="hidden lg:inline">Fee Collected</span>
        </button>

        <button
          id="nav-tab-itreturn"
          onClick={() => onSelectView('itreturn')}
          className={`flex items-center justify-center gap-1.5 px-2 md:px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-xl text-[11px] lg:text-xs font-bold transition-all cursor-pointer whitespace-nowrap text-center ${
            currentView === 'itreturn'
              ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-xs'
              : 'text-slate-600 hover:bg-sky-50/70 hover:text-sky-900 border border-transparent'
          }`}
          title="Income Tax / Section 44ADA Return Audit"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-center">IT Return</span>
        </button>

        <button
          id="nav-tab-locum"
          onClick={() => onSelectView('locum')}
          className={`flex items-center justify-center gap-1.5 px-2 md:px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-xl text-[11px] lg:text-xs font-bold transition-all cursor-pointer whitespace-nowrap text-center ${
            currentView === 'locum'
              ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-xs'
              : 'text-slate-600 hover:bg-sky-50/70 hover:text-sky-900 border border-transparent'
          }`}
          title="Locum Tenens Physiotherapists"
        >
          <UserCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span className="inline lg:hidden text-center">Locum</span>
          <span className="hidden lg:inline text-center">Locum Tenens</span>
        </button>

        <WaterBackupNavButton
          isActive={currentView === 'backup'}
          onClick={() => onSelectView('backup')}
        />
      </nav>

      {/* Mobile Quick Navigation Bar - Locum Tenens in place of backup, and Backup placed at last */}
      <div className="flex md:hidden items-center gap-0.5 sm:gap-1 shrink-0 border-l border-sky-100 pl-1 sm:pl-2">
        <button
          id="nav-tab-patients-mobile"
          type="button"
          onClick={() => {
            onSelectView('patients');
            onSelectPatientStatus?.('all');
          }}
          className={`p-1.5 rounded-xl text-xs cursor-pointer transition-colors shrink-0 flex items-center justify-center text-center ${
            currentView === 'patients' ? 'bg-sky-100 text-sky-800 font-bold shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Patients Directory"
          aria-label="Patients Directory"
        >
          <Users className="w-4 h-4 text-sky-600" />
        </button>

        <button
          id="nav-tab-monthly-mobile"
          type="button"
          onClick={() => onSelectView('monthly')}
          className={`p-1.5 rounded-xl text-xs cursor-pointer transition-colors shrink-0 flex items-center justify-center text-center ${
            currentView === 'monthly' ? 'bg-sky-100 text-sky-800 font-bold shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Monthly Analytics"
          aria-label="Monthly Analytics"
        >
          <Calendar className="w-4 h-4 text-sky-600" />
        </button>

        <button
          id="nav-tab-fees-mobile"
          type="button"
          onClick={() => onSelectView('fees')}
          className={`p-1.5 rounded-xl text-xs cursor-pointer transition-colors shrink-0 flex items-center justify-center text-center ${
            currentView === 'fees' ? 'bg-sky-100 text-sky-800 font-bold shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Fee Collected"
          aria-label="Fee Collected"
        >
          <IndianRupee className="w-4 h-4 text-emerald-600" />
        </button>

        <button
          id="nav-tab-itreturn-mobile"
          type="button"
          onClick={() => onSelectView('itreturn')}
          className={`p-1.5 rounded-xl text-xs cursor-pointer transition-colors shrink-0 flex items-center justify-center text-center ${
            currentView === 'itreturn' ? 'bg-sky-100 text-sky-800 font-bold shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="IT Return"
          aria-label="IT Return"
        >
          <FileSpreadsheet className="w-4 h-4 text-amber-600" />
        </button>

        <button
          id="nav-tab-locum-mobile"
          type="button"
          onClick={() => onSelectView('locum')}
          className={`p-1.5 rounded-xl text-xs cursor-pointer transition-colors shrink-0 flex items-center justify-center text-center ${
            currentView === 'locum'
              ? 'bg-sky-100 text-sky-800 font-bold ring-1 ring-sky-300 shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Locum Tenens Physiotherapists"
          aria-label="Locum Tenens Physiotherapists"
        >
          <UserCheck className="w-4 h-4 text-sky-700" />
        </button>

        <WaterBackupNavButton
          isMobile
          isActive={currentView === 'backup'}
          onClick={() => onSelectView('backup')}
        />
      </div>
    </header>
  );
};

