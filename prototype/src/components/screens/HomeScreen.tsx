/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React from 'react';
import { Language, i18nData } from '../../core/i18n';
import { ScreenId } from '../BottomNav';
import { NetworkStatusType, ShieldState } from '../../types';
import { 
  Globe2, 
  MessageSquare, 
  Compass, 
  HeartPulse, 
  ShieldCheck, 
  Radio, 
  Layers, 
  ArrowRight,
  Wifi,
  WifiOff,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { NetworkSentinel } from '../../core/networkSentinel';

interface HomeScreenProps {
  lang: Language;
  onNavigate: (screen: ScreenId) => void;
  networkStatus: NetworkStatusType;
  shieldState: ShieldState;
  outboxCount: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  lang,
  onNavigate,
  networkStatus,
  shieldState,
  outboxCount
}) => {
  const t = i18nData[lang];
  const isSimulated = NetworkSentinel.isSimulated();

  const handleToggleSimulation = () => {
    if (isSimulated) {
      NetworkSentinel.setSimulatedState(null);
    } else {
      NetworkSentinel.setSimulatedState('offline');
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Simulation Banner if active */}
      {isSimulated && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>
              {lang === 'fr'
                ? 'Simulation de coupure Internet active pour tester la continuité.'
                : 'Simulated Internet outage active to verify smart continuity.'}
            </span>
          </div>
          <button
            onClick={() => NetworkSentinel.setSimulatedState(null)}
            className="px-2.5 py-1 font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
          >
            {t.actions.restoreCut}
          </button>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative rounded-2xl p-6 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 text-white border border-neutral-800 shadow-xl overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-xl space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>{t.brand.tagline}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t.home.welcome}
          </h1>
          <p className="text-sm text-neutral-300 leading-relaxed">
            {t.home.overview}
          </p>
        </div>

        {/* Quick status bar inside hero */}
        <div className="mt-6 pt-4 border-t border-neutral-800/80 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-neutral-400 block text-[11px] mb-0.5">
              {lang === 'fr' ? 'État général' : 'System Status'}
            </span>
            <span className="font-semibold text-white flex items-center gap-1.5">
              {networkStatus === 'connected' && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
              {networkStatus === 'local_only' && <span className="w-2 h-2 rounded-full bg-blue-400" />}
              {networkStatus === 'offline' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
              {t.status[networkStatus]}
            </span>
          </div>
          <div>
            <span className="text-neutral-400 block text-[11px] mb-0.5">
              {t.home.outboxStatus}
            </span>
            <span className="font-semibold text-neutral-200">
              {outboxCount === 0 ? t.home.outboxEmpty : `${outboxCount} en attente`}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1 flex items-center justify-start sm:justify-end">
            <button
              onClick={handleToggleSimulation}
              className="text-xs font-medium text-neutral-300 hover:text-white underline decoration-neutral-600 hover:decoration-white transition"
            >
              {isSimulated ? t.actions.restoreCut : t.actions.simulateCut}
            </button>
          </div>
        </div>
      </div>

      {/* Les Trois Actions Prioritaires */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-1">
          {t.home.threeActionsTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Action 1: Se connecter */}
          <button
            onClick={() => onNavigate('gateways')}
            className="flex flex-col justify-between p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-md transition-all text-left group"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                <Globe2 className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-neutral-900 dark:text-white text-sm mb-1 group-hover:text-blue-500 transition-colors">
                {t.actions.connect}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-normal">
                {t.home.actionConnectDesc}
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-blue-600 dark:text-blue-400">
              <span>{lang === 'fr' ? 'Voir les passerelles' : 'View gateways'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>

          {/* Action 2: Communiquer */}
          <button
            onClick={() => onNavigate('messages')}
            className="flex flex-col justify-between p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-md transition-all text-left group"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white flex items-center justify-center mb-3">
                <MessageSquare className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="font-semibold text-neutral-900 dark:text-white text-sm mb-1 group-hover:text-blue-500 transition-colors">
                {t.actions.communicate}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-normal">
                {t.home.actionCommunicateDesc}
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-blue-600 dark:text-blue-400">
              <span>{lang === 'fr' ? 'Ouvrir les messages' : 'Open messages'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>

          {/* Action 3: Découvrir */}
          <button
            onClick={() => onNavigate('discover')}
            className="flex flex-col justify-between p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-md transition-all text-left group"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-neutral-900 dark:text-white text-sm mb-1 group-hover:text-blue-500 transition-colors">
                {t.actions.discover}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-normal">
                {t.home.actionDiscoverDesc}
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-blue-600 dark:text-blue-400">
              <span>{lang === 'fr' ? 'Comprendre & Installer' : 'Learn & Install'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        </div>
      </div>

      {/* Les Quatre Piliers Officiels */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-1">
          {lang === 'fr' ? 'Les Quatre Modules MESHORA' : 'The Four MESHORA Modules'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Module 1: Mesh */}
          <div
            onClick={() => onNavigate('network')}
            className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700 transition"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
                  {t.pillars.mesh.title}
                </h3>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t.pillars.mesh.subtitle}
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {t.pillars.mesh.description}
            </p>
          </div>

          {/* Module 2: Connect */}
          <div
            onClick={() => onNavigate('gateways')}
            className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700 transition"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-500 flex items-center justify-center">
                <Globe2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
                  {t.pillars.connect.title}
                </h3>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t.pillars.connect.subtitle}
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {t.pillars.connect.description}
            </p>
          </div>

          {/* Module 3: Shield */}
          <div
            onClick={() => onNavigate('shield')}
            className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700 transition"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
                  {t.pillars.shield.title}
                </h3>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t.pillars.shield.subtitle}
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {t.pillars.shield.description}
            </p>
          </div>

          {/* Module 4: Resilience */}
          <div
            onClick={() => onNavigate('resilience')}
            className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700 transition"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center">
                <HeartPulse className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
                  {t.pillars.resilience.title}
                </h3>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t.pillars.resilience.subtitle}
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {t.pillars.resilience.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
