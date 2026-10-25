/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 * Panneau d'Entraide et d'Alertes Locales (Simulation)
 */

import React, { useState, useEffect } from 'react';
import { Language, i18nData } from '../core/i18n';
import { AppIdentity, EmergencyBroadcast, EmergencyBroadcastType, EmergencySeverity } from '../types';
import { ResilienceEngine } from '../core/resilienceEngine';
import { playEmergencyChime } from '../core/audioAlert';
import { 
  Radio, 
  AlertTriangle, 
  HeartPulse, 
  Flame, 
  Droplet, 
  ShieldAlert, 
  AlertOctagon, 
  MapPin, 
  Volume2, 
  VolumeX, 
  Send, 
  Repeat, 
  Check, 
  ShieldCheck, 
  Sparkles, 
  X, 
  Compass, 
  Battery, 
  Clock, 
  Navigation,
  Eye,
  Megaphone
} from 'lucide-react';

interface EmergencyBroadcastPanelProps {
  lang: Language;
  identity: AppIdentity;
  onNavigateToMapRoute?: (destX: number, destY: number, destName: string) => void;
}

export const EmergencyBroadcastPanel: React.FC<EmergencyBroadcastPanelProps> = ({
  lang,
  identity,
  onNavigateToMapRoute
}) => {
  const t = i18nData[lang];
  const engine = ResilienceEngine.getInstance();

  const [broadcasts, setBroadcasts] = useState<EmergencyBroadcast[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'resources'>('all');
  
  // Composer form state
  const [selectedType, setSelectedType] = useState<EmergencyBroadcastType>('medical');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<EmergencySeverity>('critical');
  const [attachCoords, setAttachCoords] = useState(true);
  const [enableSound, setEnableSound] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);

  // Strobe & Whistle survival tool modal
  const [showStrobeModal, setShowStrobeModal] = useState(false);
  const [strobeActive, setStrobeActive] = useState(false);
  const [whistleActive, setWhistleActive] = useState(false);
  const [strobeColor, setStrobeColor] = useState<'red' | 'white'>('red');

  // Load and subscribe to broadcasts
  useEffect(() => {
    const unsubscribe = engine.subscribeEmergencyBroadcasts((updated) => {
      setBroadcasts(updated);
    });
    return () => unsubscribe();
  }, []);

  // Presets definition
  const presets: Record<EmergencyBroadcastType, { 
    labelFr: string; 
    labelEn: string; 
    titleFr: string; 
    titleEn: string; 
    msgFr: string; 
    msgEn: string; 
    severity: EmergencySeverity; 
    icon: React.ReactNode; 
    color: string 
  }> = {
    priority: {
      labelFr: 'Alerte Prioritaire',
      labelEn: 'Priority Alert',
      titleFr: '[SIMULATION] Alerte civile locale',
      titleEn: '[SIMULATION] Local civil alert',
      msgFr: 'Message de vigilance et d’entraide locale. Ne remplace pas le 112.',
      msgEn: 'Proximity vigilance notice. Does not replace 112.',
      severity: 'critical',
      icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
      color: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
    },
    medical: {
      labelFr: 'Urgence Médicale',
      labelEn: 'Medical Emergency',
      titleFr: '[MÉDICAL] Blessé(e) / Soins d’urgence',
      titleEn: '[MEDICAL] Injured person / Urgent care',
      msgFr: 'Victime nécessitant pansements compressifs, trousse de secours ou assistance secouriste.',
      msgEn: 'Casualty requiring trauma dressings, first aid kit, or first responder assistance.',
      severity: 'critical',
      icon: <HeartPulse className="w-4 h-4 text-rose-500" />,
      color: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
    },
    evacuation: {
      labelFr: 'Évacuation',
      labelEn: 'Evacuation',
      titleFr: '[ÉVACUATION] Ordre de repli / Zone compromise',
      titleEn: '[EVACUATION] Fallback alert / Area compromised',
      msgFr: 'Zone à quitter sans délai. Repli recommandé vers le gymnase refuge ou les hauteurs.',
      msgEn: 'Evacuate area immediately. Recommended fallback toward refuge gymnasium or higher ground.',
      severity: 'urgent',
      icon: <Flame className="w-4 h-4 text-amber-500" />,
      color: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
    },
    water_food: {
      labelFr: 'Eau & Vivres',
      labelEn: 'Water & Supplies',
      titleFr: '[RESSOURCES] Point d’eau & Ravitaillement',
      titleEn: '[SUPPLIES] Drinking water point & Rations',
      msgFr: 'Point d’eau potable gravitaire ou distribution de rations alimentaires d’urgence ouvert.',
      msgEn: 'Potable water point or emergency food rations distribution active on site.',
      severity: 'advisory',
      icon: <Droplet className="w-4 h-4 text-blue-500" />,
      color: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
    },
    shelter: {
      labelFr: 'Refuge Sécurisé',
      labelEn: 'Safe Shelter',
      titleFr: '[REFUGE] Espace sécurisé & Énergie solaire',
      titleEn: '[SHELTER] Safe space & Solar power point',
      msgFr: 'Gymnase refuge ouvert : couchages d’urgence, électricité solaire et contact de quartier.',
      msgEn: 'Shelter gym open: emergency bedding, solar charging, and neighborhood liaison.',
      severity: 'advisory',
      icon: <ShieldAlert className="w-4 h-4 text-emerald-500" />,
      color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    },
    hazard: {
      labelFr: 'Danger Imminent',
      labelEn: 'Hazard / Road block',
      titleFr: '[DANGER] Axe coupé / Câbles au sol / Risque',
      titleEn: '[HAZARD] Blocked route / Power lines / Threat',
      msgFr: 'Passage impraticable ou risque sur le secteur. Contournement par voies secondaires conseillé.',
      msgEn: 'Impasse or hazard on sector. Bypass through secondary mesh paths recommended.',
      severity: 'urgent',
      icon: <AlertOctagon className="w-4 h-4 text-amber-500" />,
      color: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
    }
  };

  const handleSelectPreset = (typeKey: EmergencyBroadcastType) => {
    setSelectedType(typeKey);
    const p = presets[typeKey];
    setTitle(lang === 'fr' ? p.titleFr : p.titleEn);
    setMessage(lang === 'fr' ? p.msgFr : p.msgEn);
    setSeverity(p.severity);
  };

  const handleOpenComposer = (defaultType: EmergencyBroadcastType = 'priority') => {
    handleSelectPreset(defaultType);
    setShowComposer(true);
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setIsSubmitting(true);

    try {
      if (enableSound) {
        playEmergencyChime(severity);
      }

      await engine.sendEmergencyBroadcast({
        type: selectedType,
        title: title.trim(),
        message: message.trim(),
        severity,
        senderAlias: identity.alias || 'Vous (Nœud Local)',
        senderId: identity.id,
        coordinates: attachCoords ? {
          lat: 48.854,
          lng: 2.352,
          gridX: 450,
          gridY: 280,
          label: lang === 'fr' ? 'Votre Nœud Local (450, 280)' : 'Your Local Node (450, 280)'
        } : undefined,
        batteryPercent: 88
      });

      setBroadcastFeedback(
        lang === 'fr'
          ? 'Balise d’urgence diffusée sur le maillage local (BroadcastChannel + BLE Beacon) !'
          : 'Emergency beacon broadcasted on local mesh (BroadcastChannel + BLE Beacon)!'
      );
      setTimeout(() => setBroadcastFeedback(null), 5000);
      setShowComposer(false);
    } catch {
      // Broadcast resiliently stored in outbox
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRelay = async (broadcastId: string) => {
    const success = await engine.relayEmergencyBroadcast(broadcastId, identity.alias || 'Vous');
    if (success) {
      if (enableSound) {
        playEmergencyChime('urgent');
      }
      setBroadcastFeedback(
        lang === 'fr'
          ? 'Alerte relayée sur le maillage (+1 saut) ! Propagation amplifiée.'
          : 'Alert relayed through mesh (+1 hop)! Forwarding amplified.'
      );
      setTimeout(() => setBroadcastFeedback(null), 4000);
    }
  };

  const handleSimulateNeighbor = () => {
    const sim = engine.simulateNeighborBroadcast(selectedType);
    setBroadcastFeedback(
      lang === 'fr'
        ? `Balise reçue de ${sim.senderAlias} via liaison Bluetooth / LoRa de proximité !`
        : `Beacon received from ${sim.senderAlias} via proximity Bluetooth / LoRa!`
    );
    setTimeout(() => setBroadcastFeedback(null), 4500);
  };

  // Strobe effect logic
  useEffect(() => {
    if (!strobeActive) return;
    const interval = setInterval(() => {
      setStrobeColor((prev) => (prev === 'red' ? 'white' : 'red'));
    }, 280);
    return () => clearInterval(interval);
  }, [strobeActive]);

  // Audio whistle loop logic
  useEffect(() => {
    if (!whistleActive) return;
    if (typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      let isRunning = true;

      const playWhistleBurst = () => {
        if (!isRunning) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2950, now);
        osc.frequency.exponentialRampToValueAtTime(3200, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.38);

        setTimeout(() => {
          if (isRunning) playWhistleBurst();
        }, 800);
      };

      playWhistleBurst();

      return () => {
        isRunning = false;
        try {
          ctx.close();
        } catch {}
      };
    } catch {
      // Audio not permitted
    }
  }, [whistleActive]);

  // Filtered broadcast list
  const filteredBroadcasts = broadcasts.filter((b) => {
    if (filterType === 'critical') return b.severity === 'critical' || b.type === 'priority' || b.type === 'medical';
    if (filterType === 'resources') return b.type === 'water_food' || b.type === 'shelter';
    return true;
  });

  return (
    <div className="rounded-2xl p-5 bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-900 dark:to-neutral-900/60 border border-rose-500/20 dark:border-rose-500/30 shadow-md space-y-4">
      {/* Notice de sécurité impérative */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="leading-snug m-0">
          <p className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
            ⚠️ {lang === 'fr' ? 'Fonction expérimentale. Aucune réception d’alerte n’est garantie. Ne remplace pas les services d’urgence.' : 'Experimental feature. Alert delivery is not guaranteed. Does not replace emergency services.'}
          </p>
          <p className="text-[10px] text-amber-600 dark:text-amber-400 m-0">
            {lang === 'fr' 
              ? 'Ces avis sont échangés de pair-à-pair sur le maillage local civil. Ils ne contactent PAS le 112, le 15 ou les pompiers. Pour toute situation critique, composez le 112 dès qu’un réseau cellulaire est disponible.'
              : 'These notices are relayed peer-to-peer on the local civil mesh. They do NOT contact official 112/911 emergency services. In a life-threatening situation, call 112/911 when cellular service is available.'}
          </p>
        </div>
      </div>

      {/* Header with emergency beacon signal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-rose-500" />
              <span>{t.resilience.broadcastTitle}</span>
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              Canal Local (Broadcast / Relais)
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t.resilience.broadcastSubtitle}
          </p>
        </div>

        {/* Action Trigger Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setShowStrobeModal(true);
              setStrobeActive(true);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 transition flex items-center gap-1.5"
            title="Balise stroboscopique visuelle pour être repéré de nuit ou dans l'obscurité"
          >
            <Eye className="w-3.5 h-3.5 text-amber-500" />
            <span>{t.resilience.broadcastVisualSos}</span>
          </button>

          <button
            onClick={handleSimulateNeighbor}
            className="px-2.5 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 transition flex items-center gap-1.5"
            title="Simule la réception d'une alerte d'un nœud voisin pour tester le maillage"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>{t.resilience.broadcastSimulateNeighbor}</span>
          </button>

          <button
            onClick={() => handleOpenComposer('priority')}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition active:scale-95 flex items-center gap-1.5"
          >
            <Radio className="w-4 h-4 animate-pulse" />
            <span>{t.resilience.broadcastTriggerBtn}</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {broadcastFeedback && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-500" />
            <span className="font-medium">{broadcastFeedback}</span>
          </div>
          <button onClick={() => setBroadcastFeedback(null)} className="text-emerald-600 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Presets Grid */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
          {lang === 'fr' ? 'Modèles d’urgence prêts à l’émission :' : 'Emergency ready presets:'}
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {(Object.keys(presets) as EmergencyBroadcastType[]).map((key) => {
            const p = presets[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleOpenComposer(key)}
                className={`p-2 rounded-xl border text-left flex flex-col justify-between transition hover:scale-[1.02] active:scale-95 ${p.color}`}
              >
                <div className="flex items-center justify-between mb-1">
                  {p.icon}
                  <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">
                    {p.severity === 'critical' ? 'Critique' : p.severity === 'urgent' ? 'Urgent' : 'Avis'}
                  </span>
                </div>
                <span className="font-bold text-xs truncate">
                  {lang === 'fr' ? p.labelFr : p.labelEn}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Composer Modal / Expandable Form */}
      {showComposer && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-white dark:bg-neutral-800/90 shadow-lg space-y-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-rose-500" />
              <h3 className="font-bold text-sm text-neutral-900 dark:text-white">
                {lang === 'fr' ? 'Émettre une Alerte Mesh de Proximité' : 'Broadcast Proximity Mesh Alert'}
              </h3>
            </div>
            <button
              onClick={() => setShowComposer(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs">
            {/* Urgency severity selector */}
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 text-[11px] font-medium">Niveau d’urgence :</span>
              <div className="flex items-center gap-1.5">
                {(['critical', 'urgent', 'advisory'] as EmergencySeverity[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                      severity === s
                        ? s === 'critical'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : s === 'urgent'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-blue-600 text-white border-blue-600'
                        : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    {s === 'critical' ? '🔴 Critique (Alarme)' : s === 'urgent' ? '🟠 Urgent' : '🔵 Avis'}
                  </button>
                ))}
              </div>
            </div>

            {/* Title field */}
            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                {t.resilience.broadcastFormTitle}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={lang === 'fr' ? 'Ex: [SIMULATION] Route coupée secteur pont...' : 'Ex: [SIMULATION] Blocked road near bridge...'}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                required
              />
            </div>

            {/* Message field */}
            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                {t.resilience.broadcastFormMsg}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder={lang === 'fr' ? 'Détails factuels, nombre de personnes, besoins immédiats...' : 'Factual details, casualty count, immediate needs...'}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            {/* Options: Coordinates & Sound */}
            <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={attachCoords}
                  onChange={(e) => setAttachCoords(e.target.checked)}
                  className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
                />
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] text-neutral-700 dark:text-neutral-300">
                  {t.resilience.broadcastAttachCoords} (48.854°N, 2.352°E · Grille 450, 280)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableSound}
                  onChange={(e) => setEnableSound(e.target.checked)}
                  className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
                />
                <Volume2 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] text-neutral-700 dark:text-neutral-300">
                  {t.resilience.broadcastAcousticChime}
                </span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="px-3.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                {t.actions.close}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !message.trim()}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t.resilience.broadcastSendBtn}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Broadcasts Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              {t.resilience.broadcastActiveFeed}
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 font-mono text-neutral-700 dark:text-neutral-300">
              {filteredBroadcasts.length}
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition ${
                filterType === 'all'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {lang === 'fr' ? 'Toutes' : 'All'}
            </button>
            <button
              onClick={() => setFilterType('critical')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition ${
                filterType === 'critical'
                  ? 'bg-rose-600 text-white'
                  : 'text-neutral-500 hover:text-rose-500'
              }`}
            >
              {lang === 'fr' ? 'Priorité & Médical' : 'Priority & Medical'}
            </button>
            <button
              onClick={() => setFilterType('resources')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition ${
                filterType === 'resources'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-500 hover:text-blue-500'
              }`}
            >
              {lang === 'fr' ? 'Eau & Vivres' : 'Water & Food'}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2.5">
          {filteredBroadcasts.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-400 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700">
              {lang === 'fr'
                ? 'Aucune alerte d’urgence active dans ce secteur. Le maillage est calme.'
                : 'No active emergency alerts in this sector. The mesh is calm.'}
            </div>
          ) : (
            filteredBroadcasts.map((b) => {
              const isCritical = b.severity === 'critical';
              const isUrgent = b.severity === 'urgent';
              const p = presets[b.type] || presets.priority;

              return (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-xl border transition space-y-2 text-xs ${
                    isCritical
                      ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-500/30'
                      : isUrgent
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-500/30'
                      : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  {/* Top Bar: Title, Urgency Badge, Time */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-white dark:bg-neutral-800 shadow-xs border border-neutral-200 dark:border-neutral-700">
                        {p.icon}
                      </span>
                      <span className="font-bold text-neutral-900 dark:text-white text-xs">
                        {b.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded-full font-bold ${
                          isCritical
                            ? 'bg-rose-600 text-white animate-pulse'
                            : isUrgent
                            ? 'bg-amber-600 text-white'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {b.severity}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Message Content */}
                  <p className="text-neutral-700 dark:text-neutral-200 text-xs leading-relaxed pl-1">
                    {b.message}
                  </p>

                  {/* Attached Coordinates & Walking Route Trigger */}
                  {b.coordinates && (
                    <div className="flex flex-wrap items-center justify-between p-2 rounded-lg bg-white/80 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-700/60 gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                        <span>
                          {b.coordinates.lat}°N, {b.coordinates.lng}°E
                          {b.coordinates.label ? ` · ${b.coordinates.label}` : ''}
                        </span>
                      </div>

                      {onNavigateToMapRoute && (
                        <button
                          onClick={() => {
                            if (b.coordinates) {
                              onNavigateToMapRoute(
                                b.coordinates.gridX ?? 440,
                                b.coordinates.gridY ?? 440,
                                b.title
                              );
                            }
                          }}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] flex items-center gap-1 transition"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>{lang === 'fr' ? 'Itinéraire piéton d’urgence' : 'Emergency walking route'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Footer metadata: Hops, Sender, Relay button */}
                  <div className="pt-1.5 flex flex-wrap items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 border-t border-neutral-200/60 dark:border-neutral-700/50 gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span>
                        Émis par : <strong className="text-neutral-800 dark:text-neutral-200">{b.senderAlias}</strong>
                      </span>
                      <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Radio className="w-3 h-3" />
                        {b.hops === 0 ? 'Direct (0 saut)' : `${b.hops} saut(s) mesh`}
                      </span>
                      <span className="font-mono text-[10px] text-neutral-400">
                        {b.transportUsed}
                      </span>
                      <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-0.5">
                        {b.signature ? 'Signature présente (non vérifiée)' : 'Non signé · non vérifié'}
                      </span>
                    </div>

                    {/* Action buttons on broadcast item */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => playEmergencyChime(b.severity)}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                        title={lang === 'fr' ? 'Faire retentir le signal sonore' : 'Play alert tone'}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleRelay(b.id)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 transition flex items-center gap-1"
                        title={lang === 'fr' ? 'Re-diffuser pour propager l’alerte aux appareils plus éloignés' : 'Re-broadcast to propagate through mesh'}
                      >
                        <Repeat className="w-3 h-3 text-rose-500" />
                        <span>{t.resilience.broadcastRelayBtn}</span>
                        {b.relayCount > 0 && (
                          <span className="ml-0.5 px-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-[9px]">
                            {b.relayCount}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Visual Strobe & Whistle Survival Tool Modal */}
      {showStrobeModal && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 bg-black/95 backdrop-blur-md text-white animate-fade-in">
          {/* Strobe flasher surface */}
          <div
            className={`absolute inset-0 transition-colors duration-75 pointer-events-none opacity-90 ${
              strobeActive
                ? strobeColor === 'red'
                  ? 'bg-rose-600'
                  : 'bg-white'
                : 'bg-neutral-900'
            }`}
          />

          {/* Modal Overlay Controls */}
          <div className="relative z-10 w-full max-w-md flex items-center justify-between">
            <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-white/20">
              <Eye className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-xs font-bold tracking-wider">
                SIGNAL LUMINEUX DE VISIBILITÉ LOCALE
              </span>
            </div>
            <button
              onClick={() => {
                setShowStrobeModal(false);
                setStrobeActive(false);
                setWhistleActive(false);
              }}
              className="p-2 rounded-full bg-black/60 border border-white/20 hover:bg-white/20 text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Center Info Text */}
          <div className="relative z-10 text-center max-w-sm space-y-3 bg-black/75 p-5 rounded-2xl border border-white/20">
            <h3 className="text-lg font-black tracking-tight text-white">
              Signal d’Alerte de Visibilité
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Orientez l’écran vers les secours ou la fenêtre. Le stroboscope haute visibilité permet d’être localisé de nuit ou sous la fumée sans liaison radio.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStrobeActive(!strobeActive)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  strobeActive ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-white border border-neutral-700'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>{strobeActive ? 'Stroboscope ACTIF' : 'Activer Stroboscope'}</span>
              </button>

              <button
                type="button"
                onClick={() => setWhistleActive(!whistleActive)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  whistleActive ? 'bg-rose-600 text-white animate-pulse' : 'bg-neutral-800 text-white border border-neutral-700'
                }`}
              >
                {whistleActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{whistleActive ? 'Sifflet 3000Hz ACTIF' : 'Sifflet Acoustique'}</span>
              </button>
            </div>
          </div>

          {/* Bottom dismissal */}
          <div className="relative z-10">
            <button
              onClick={() => {
                setShowStrobeModal(false);
                setStrobeActive(false);
                setWhistleActive(false);
              }}
              className="px-6 py-2.5 rounded-full bg-white text-neutral-900 font-bold text-xs hover:bg-neutral-200 active:scale-95 transition"
            >
              Quitter la balise d’urgence
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
