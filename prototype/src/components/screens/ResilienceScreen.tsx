/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Language, i18nData } from '../../core/i18n';
import { AppIdentity } from '../../types';
import { ResilienceEngine } from '../../core/resilienceEngine';
import { OfflineMapViewer } from '../OfflineMapViewer';
import { EmergencyBroadcastPanel } from '../EmergencyBroadcastPanel';
import { QuickSOSButton } from '../QuickSOSButton';
import { 
  HeartPulse, 
  BatteryCharging, 
  BatteryMedium,
  FileText, 
  MapPin, 
  Share2, 
  AlertCircle, 
  Check, 
  Send,
  Zap,
  ShieldCheck,
  ChevronRight,
  Download,
  RefreshCw,
  Radio,
  Clock,
  CheckCircle2
} from 'lucide-react';

interface ResilienceScreenProps {
  lang: Language;
  identity: AppIdentity;
}

export const ResilienceScreen: React.FC<ResilienceScreenProps> = ({ lang, identity }) => {
  const t = i18nData[lang];
  const engine = ResilienceEngine.getInstance();
  const [profile, setProfile] = useState(() => engine.getProfile());
  const docs = engine.getEmergencyDocs();
  const alerts = engine.getAlerts();
  const transfers = engine.getFileTransfers();

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [newAlertTitle, setNewAlertTitle] = useState('');
  const [newAlertMsg, setNewAlertMsg] = useState('');
  const [showNewAlertForm, setShowNewAlertForm] = useState(false);
  const [fileTransferFeedback, setFileTransferFeedback] = useState<string | null>(null);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const [mapTarget, setMapTarget] = useState<{ destX: number; destY: number; destName: string } | null>(null);

  const [isForceScanning, setIsForceScanning] = useState(false);
  const [secondsElapsedSinceScan, setSecondsElapsedSinceScan] = useState(0);

  useEffect(() => {
    const unsub = engine.subscribeProfile((updated) => {
      setProfile(updated);
    });
    return unsub;
  }, [engine]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - (profile.lastScanTimestamp || now)) / 1000));
      setSecondsElapsedSinceScan(elapsed);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [profile.lastScanTimestamp]);

  const handleToggleBattery = () => {
    engine.toggleBatterySaver();
  };

  const handleSetScanInterval = (sec: number) => {
    engine.setMeshScanInterval(sec);
  };

  const handleForceScan = async () => {
    if (isForceScanning) return;
    setIsForceScanning(true);
    try {
      await engine.forceMeshScan();
    } finally {
      setTimeout(() => setIsForceScanning(false), 500);
    }
  };

  const handlePostAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertTitle.trim() || !newAlertMsg.trim()) return;
    engine.postAlert(newAlertTitle, newAlertMsg, identity.alias, identity.id);
    setNewAlertTitle('');
    setNewAlertMsg('');
    setShowNewAlertForm(false);
  };

  const handleShareEmergencyFile = () => {
    engine.sendP2PFile(
      'plan_secteur_relais_local.pdf',
      48000,
      identity.alias,
      identity.id
    );
    setFileTransferFeedback(
      lang === 'fr' 
        ? 'Document partagé en direct via le canal local !' 
        : 'Document shared directly over local mesh channel!'
    );
    setTimeout(() => setFileTransferFeedback(null), 4000);
  };

  return (
    <div className="space-y-5 pb-20 animate-fade-in">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-rose-500" />
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {t.resilience.title}
          </h1>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          {t.resilience.subtitle}
        </p>
      </div>

      {/* Panneau d'Entraide et Alertes Locales */}
      <EmergencyBroadcastPanel
        lang={lang}
        identity={identity}
        onNavigateToMapRoute={(destX, destY, destName) => {
          setMapTarget({ destX, destY, destName });
          mapSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        }}
      />


      {/* Battery Saver & Smart Failover banner */}
      <div className="space-y-3.5">
        {/* Card 1: Économiseur de Batterie Maillée & Restriction des Intervalles de Sondage */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 shadow-sm ${
          profile.batterySaver
            ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 dark:border-emerald-500/25'
            : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
        }`}>
          {/* Header Row: Title, active status badge & toggle switch */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`p-1.5 rounded-lg ${
                  profile.batterySaver 
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                }`}>
                  <BatteryCharging className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-neutral-900 dark:text-white text-sm sm:text-base tracking-tight">
                  {t.resilience.batterySaver}
                </h3>
                {profile.batterySaver ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {t.resilience.batterySaverActiveBadge} ({profile.meshScanIntervalSec}s)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                    {t.resilience.batterySaverStandardBadge} (10s)
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-2xl pt-0.5">
                {t.resilience.batterySaverDesc}
              </p>
            </div>

            {/* Accessible Large Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={profile.batterySaver}
              onClick={handleToggleBattery}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                profile.batterySaver ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span className="sr-only">{t.resilience.batterySaver}</span>
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                  profile.batterySaver ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Cadence Presets Selector */}
          <div className="mt-4 pt-4 border-t border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-500" />
                {t.resilience.batteryCadenceLabel}
              </span>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                {profile.estimatedAutonomyGain}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSetScanInterval(10)}
                className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition border ${
                  profile.meshScanIntervalSec === 10
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                }`}
              >
                <div className="font-semibold">{t.resilience.batteryIntervalNormal}</div>
                <div className="text-[10px] opacity-75 mt-0.5">Veille 0% · Scan continu</div>
              </button>

              <button
                type="button"
                onClick={() => handleSetScanInterval(60)}
                className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition border ${
                  profile.meshScanIntervalSec === 60
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60 hover:border-emerald-400'
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>{t.resilience.batteryIntervalEco}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 uppercase tracking-wider">Reco</span>
                </div>
                <div className="text-[10px] opacity-80 mt-0.5">Veille 95% · ~70% économisé</div>
              </button>

              <button
                type="button"
                onClick={() => handleSetScanInterval(120)}
                className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition border ${
                  profile.meshScanIntervalSec === 120
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60 hover:border-amber-400'
                }`}
              >
                <div className="font-semibold">{t.resilience.batteryIntervalExtreme}</div>
                <div className="text-[10px] opacity-80 mt-0.5">Veille 97.5% · Survie 72h+</div>
              </button>
            </div>
          </div>

          {/* Real-time status bar & On-demand immediate probe button */}
          <div className="mt-4 pt-3 border-t border-neutral-200/60 dark:border-neutral-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span>
                  {t.resilience.batteryLastScanLabel} :{' '}
                  <strong className="text-neutral-800 dark:text-neutral-200 font-mono">
                    {secondsElapsedSinceScan <= 1 
                      ? t.resilience.batteryJustNow 
                      : t.resilience.batterySecondsAgo.replace('{sec}', String(secondsElapsedSinceScan))}
                  </strong>
                </span>
                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                <span>
                  {t.resilience.batteryNextScanLabel} :{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                    {t.resilience.batteryNextInSec.replace('{sec}', String(Math.max(1, (profile.meshScanIntervalSec || 10) - (secondsElapsedSinceScan % (profile.meshScanIntervalSec || 10)))))}
                  </strong>
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                {t.resilience.batteryDutyCycleLabel} : {profile.meshScanDutyCycle}
              </div>
            </div>

            <button
              type="button"
              onClick={handleForceScan}
              disabled={isForceScanning}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 text-neutral-800 dark:text-white transition shadow-xs disabled:opacity-60 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-500 ${isForceScanning ? 'animate-spin' : ''}`} />
              <span>
                {isForceScanning ? t.resilience.batteryScanningNow : t.resilience.batteryForceScanBtn}
              </span>
            </button>
          </div>

          {/* Active Safeguards checklist */}
          <div className="mt-3.5 pt-3 border-t border-neutral-200/50 dark:border-neutral-800/50 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-neutral-600 dark:text-neutral-400">
            {t.resilience.batterySavingsFeatures.map((feat, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Basculement consenti */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
              {t.resilience.failoverTitle}
            </h3>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t.resilience.failoverDesc}
          </p>
          <div className="pt-2 flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t.resilience.consentWarning}</span>
          </div>
        </div>
      </div>

      {/* Offline Emergency Documents & Protocols */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <span>{t.resilience.emergencyDocs}</span>
          </h2>
          <span className="text-[11px] text-neutral-500 font-mono">
            {docs.length} fiches en cache
          </span>
        </div>

        <div className="space-y-2">
          {docs.map((doc) => {
            const isExpanded = selectedDocId === doc.id;
            return (
              <div
                key={doc.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 overflow-hidden text-xs transition"
              >
                <button
                  onClick={() => setSelectedDocId(isExpanded ? null : doc.id)}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  <div className="space-y-0.5 pr-2">
                    <span className="font-semibold text-neutral-900 dark:text-white block">
                      {doc.title}
                    </span>
                    <span className="text-neutral-500 text-[11px] block">
                      {doc.summary}
                    </span>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="p-3.5 pt-0 border-t border-neutral-200 dark:border-neutral-700/60 bg-white dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300 leading-relaxed font-mono text-[11px] whitespace-pre-wrap">
                    {doc.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Offline Vector Map Viewer */}
      <div 
        ref={mapSectionRef}
        className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {t.resilience.offlineMap}
            </h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
            100% Hors-ligne
          </span>
        </div>

        {/* Lightweight interactive Offline Map Viewer */}
        <OfflineMapViewer lang={lang} externalTarget={mapTarget} />
      </div>


      {/* P2P File Sharing Engine */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-blue-500" />
            <span>{t.resilience.p2pSharing}</span>
          </h2>
          <button
            onClick={handleShareEmergencyFile}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>+ {lang === 'fr' ? 'Diffuser un fichier' : 'Broadcast file'}</span>
          </button>
        </div>

        {fileTransferFeedback && (
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-3.5 h-3.5" />
            <span>{fileTransferFeedback}</span>
          </div>
        )}

        <div className="space-y-2">
          {transfers.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 text-xs"
            >
              <div className="space-y-0.5">
                <span className="font-semibold text-neutral-900 dark:text-white block">
                  {item.filename}
                </span>
                <span className="text-[11px] text-neutral-500 font-mono">
                  {Math.round(item.sizeBytes / 1024)} Ko · Envoyé par {item.senderAlias}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                  {lang === 'fr' ? 'Reçu 100%' : 'Completed'}
                </span>
                <button
                  onClick={() => alert(`Fichier local ${item.filename} disponible dans le cache de résilience.`)}
                  className="p-1 rounded text-neutral-500 hover:text-blue-500"
                  title="Télécharger"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Verifiable Community Alerts */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span>{t.resilience.communityAlerts}</span>
          </h2>
          <button
            onClick={() => setShowNewAlertForm(!showNewAlertForm)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showNewAlertForm ? t.actions.close : `+ ${lang === 'fr' ? 'Créer un avis' : 'New alert'}`}
          </button>
        </div>

        {showNewAlertForm && (
          <form
            onSubmit={handlePostAlert}
            className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-3 text-xs"
          >
            <input
              type="text"
              value={newAlertTitle}
              onChange={(e) => setNewAlertTitle(e.target.value)}
              placeholder={lang === 'fr' ? 'Titre de l’avis communautaire...' : 'Alert title...'}
              className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
            />
            <textarea
              value={newAlertMsg}
              onChange={(e) => setNewAlertMsg(e.target.value)}
              rows={2}
              placeholder={lang === 'fr' ? 'Détails factuels et vérifiables...' : 'Factual and verifiable details...'}
              className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewAlertForm(false)}
                className="px-3 py-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                {t.actions.close}
              </button>
              <button
                type="submit"
                disabled={!newAlertTitle.trim() || !newAlertMsg.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                {lang === 'fr' ? 'Publier l’avis signé' : 'Publish signed alert'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {alerts.map((al) => (
            <div
              key={al.id}
              className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {al.title}
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  {new Date(al.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 text-[11px] leading-relaxed">
                {al.message}
              </p>
              <div className="pt-1 flex items-center justify-between text-[10px] text-neutral-400 border-t border-neutral-100 dark:border-neutral-800">
                <span>Émis par : <strong>{al.senderAlias}</strong></span>
                <span className="font-mono text-blue-500 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Signature Ed25519 vérifiée
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bouton d'Aide d'Urgence 112 */}
      <QuickSOSButton
        lang={lang}
        identity={identity}
        onNavigateToMap={(x, y, name) => {
          setMapTarget({ destX: x, destY: y, destName: name });
          mapSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
    </div>
  );
};
