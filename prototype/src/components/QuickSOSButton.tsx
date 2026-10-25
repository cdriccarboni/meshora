/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Bouton Flottant Quick SOS (Appui Long d'Urgence)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Language, i18nData } from '../core/i18n';
import { AppIdentity, EmergencyBroadcast } from '../types';
import { ResilienceEngine } from '../core/resilienceEngine';
import { 
  Radio, 
  AlertOctagon, 
  Check, 
  X, 
  MapPin, 
  ShieldAlert, 
  Volume2,
  Navigation
} from 'lucide-react';

interface QuickSOSButtonProps {
  lang: Language;
  identity: AppIdentity;
  onAlertTriggered?: (alert: EmergencyBroadcast) => void;
  onNavigateToMap?: (x: number, y: number, name: string) => void;
}

const HOLD_DURATION_MS = 1500; // 1.5 seconds required hold to prevent accidental triggers

export const QuickSOSButton: React.FC<QuickSOSButtonProps> = ({
  lang,
  identity,
  onAlertTriggered,
  onNavigateToMap
}) => {
  const t = i18nData[lang];
  const engine = ResilienceEngine.getInstance();

  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [lastSentBroadcast, setLastSentBroadcast] = useState<EmergencyBroadcast | null>(null);
  const [justTriggered, setJustTriggered] = useState(false);
  const [showNotificationToast, setShowNotificationToast] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isTriggeredRef = useRef<boolean>(false);

  // Cancel hold state cleanly
  const cancelHold = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    startTimeRef.current = null;
    setIsHolding(false);
    setProgress(0);
  }, []);

  // Dispatch emergency SOS distress beacon
  const executeDistressBroadcast = useCallback(async () => {
    isTriggeredRef.current = true;
    cancelHold();

    // Query user's current coordinates or use cached resilience sector position
    let coords = engine.getLastCoordinates();

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const geoPromise = new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 800,
            maximumAge: 60000,
            enableHighAccuracy: false
          });
        });
        const pos = await Promise.race([
          geoPromise,
          new Promise<null>((r) => setTimeout(() => r(null), 850))
        ]);
        if (pos && 'coords' in pos) {
          coords = {
            lat: Number(pos.coords.latitude.toFixed(5)),
            lng: Number(pos.coords.longitude.toFixed(5)),
            gridX: Math.round(((pos.coords.longitude - 2.34) / 0.03) * 1000) % 1000,
            gridY: Math.round(((48.865 - pos.coords.latitude) / 0.02) * 600) % 600,
            label: `GPS (${pos.coords.latitude.toFixed(4)}°, ${pos.coords.longitude.toFixed(4)}°)`
          };
          engine.updateCoordinates(coords);
        }
      } catch {
        // Fallback to cached sector coordinates without blocking
      }
    }

    // Battery percentage estimation if supported
    let batteryLevel: number | undefined = undefined;
    try {
      const nav = navigator as unknown as { getBattery?: () => Promise<{ level: number }> };
      if (typeof nav.getBattery === 'function') {
        const batt = await nav.getBattery();
        batteryLevel = Math.round(batt.level * 100);
      }
    } catch {}

    const broadcast = await engine.triggerQuickSOS({
      senderAlias: identity.alias,
      senderId: identity.id,
      title: t.resilience.quickSosTitle,
      message: t.resilience.quickSosMessage,
      coordsOverride: coords,
      batteryPercent: batteryLevel
    });

    setLastSentBroadcast(broadcast);
    setJustTriggered(true);
    setShowNotificationToast(true);

    if (onAlertTriggered) {
      onAlertTriggered(broadcast);
    }

    // Reset button success visual state after 4 seconds
    setTimeout(() => {
      setJustTriggered(false);
      isTriggeredRef.current = false;
    }, 4000);
  }, [cancelHold, engine, identity, onAlertTriggered, t]);

  // Frame loop for tactile fill animation
  const step = useCallback(() => {
    if (!startTimeRef.current) return;
    const elapsed = Date.now() - startTimeRef.current;
    const currentProgress = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
    setProgress(currentProgress);

    if (elapsed >= HOLD_DURATION_MS) {
      executeDistressBroadcast();
    } else {
      animationFrameRef.current = requestAnimationFrame(step);
    }
  }, [executeDistressBroadcast]);

  // Pointer / Touch Start
  const handlePointerDown = (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    // Prevent default touch gestures or right-clicks
    if ('button' in e && e.button !== 0) return;
    if (justTriggered || isTriggeredRef.current) return;

    setIsHolding(true);
    startTimeRef.current = Date.now();
    animationFrameRef.current = requestAnimationFrame(step);

    // Initial soft tactile tick
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(40);
      }
    } catch {}
  };

  // Keyboard accessibility: hold Space or Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === ' ' || e.key === 'Enter') && !isHolding && !justTriggered) {
      e.preventDefault();
      setIsHolding(true);
      startTimeRef.current = Date.now();
      animationFrameRef.current = requestAnimationFrame(step);
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      cancelHold();
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // SVG circle geometry (radius 29, center 32, perimeter ~182.2)
  const radius = 29;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <>
      {/* Floating Action Button Container */}
      <div 
        className="fixed bottom-24 right-4 sm:right-6 z-40 flex flex-col items-end select-none pointer-events-auto"
        role="region"
        aria-label="Quick SOS Action"
      >
        {/* Tooltip / Hold Progress Status Indicator */}
        {isHolding && (
          <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-neutral-900/95 dark:bg-neutral-950/95 text-white border border-rose-500/50 shadow-xl backdrop-blur-md flex items-center gap-2 animate-bounce-subtle">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <div className="text-[11px] font-semibold text-rose-300">
              {t.resilience.quickSosHolding} {Math.max(0, (HOLD_DURATION_MS - (progress / 100) * HOLD_DURATION_MS) / 1000).toFixed(1)}s
            </div>
            <span className="text-[10px] text-neutral-400">
              ({t.resilience.quickSosCancelHint})
            </span>
          </div>
        )}

        {/* SOS Floating Action Button */}
        <div className="relative group">
          {/* Subtle radar pulse effect when idle */}
          {!isHolding && !justTriggered && (
            <div className="absolute -inset-1 rounded-full bg-rose-500/20 blur-sm group-hover:bg-rose-500/35 transition-all animate-pulse" />
          )}

          {/* Glowing ring while holding */}
          {isHolding && (
            <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 opacity-60 blur-md animate-spin-slow" />
          )}

          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            onTouchStart={handlePointerDown}
            onTouchEnd={cancelHold}
            onTouchCancel={cancelHold}
            onMouseDown={handlePointerDown}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            title={t.resilience.quickSosHold}
            aria-label={`${t.resilience.quickSosBtn} - ${t.resilience.quickSosHold}`}
            className={`relative w-16 h-16 rounded-full flex flex-col items-center justify-center font-bold text-white shadow-2xl transition-all duration-150 cursor-pointer focus:outline-none focus:ring-4 focus:ring-rose-500/50 active:scale-90 ${
              justTriggered
                ? 'bg-emerald-600 ring-4 ring-emerald-400/50 scale-105'
                : isHolding
                ? 'bg-gradient-to-br from-rose-700 to-red-800 scale-95 shadow-rose-900/50'
                : 'bg-gradient-to-br from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 shadow-rose-950/40'
            }`}
          >
            {/* Circular SVG Progress Ring */}
            <svg 
              className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" 
              viewBox="0 0 64 64"
            >
              {/* Background trace track */}
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="stroke-black/25 fill-none"
                strokeWidth="3.5"
              />
              {/* Active progress fill ring */}
              <circle
                cx="32"
                cy="32"
                r={radius}
                className={`fill-none transition-[stroke-dashoffset] duration-75 ${
                  justTriggered ? 'stroke-emerald-300' : 'stroke-white'
                }`}
                strokeWidth="4"
                strokeLinecap="round"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: isHolding ? strokeDashoffset : justTriggered ? 0 : circumference
                }}
              />
            </svg>

            {/* Inner Content Icon & Text */}
            {justTriggered ? (
              <div className="flex flex-col items-center justify-center text-white animate-scale-in">
                <Check className="w-6 h-6 stroke-[3]" />
                <span className="text-[9px] uppercase tracking-wider font-extrabold mt-0.5">ÉMIS</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-white leading-none">
                <AlertOctagon className="w-5 h-5 mb-0.5 fill-white/20 stroke-[2.2]" />
                <span className="text-[12px] font-black tracking-tight drop-shadow-sm">SOS</span>
              </div>
            )}
          </button>

          {/* Quick Info Badge on Hover for Desktop */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-2.5 py-1.5 rounded-lg bg-neutral-900/90 text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:flex items-center gap-1.5 shadow-lg border border-neutral-700">
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span>{t.resilience.quickSosBtn}</span>
            <span className="text-neutral-400 text-[10px]">({t.resilience.quickSosHold})</span>
          </div>
        </div>
      </div>

      {/* Immediate Confirmation Notification Toast / Banner */}
      {showNotificationToast && lastSentBroadcast && (
        <div 
          className="fixed top-16 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-4 rounded-2xl bg-neutral-900/95 dark:bg-neutral-950/95 text-white border-2 border-rose-500 shadow-2xl backdrop-blur-xl animate-slide-in-down"
          role="alert"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                    {t.resilience.quickSosTitle}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    BLE / LoRa
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-white mt-0.5">
                  {t.resilience.quickSosSent}
                </h4>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNotificationToast(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              aria-label={t.actions.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Coordinates and Broadcast details */}
          <div className="mt-3 p-2.5 rounded-xl bg-neutral-800/60 border border-neutral-700/60 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                {t.resilience.quickSosCoordsLabel} :
              </span>
              <span className="font-mono font-medium text-amber-300">
                {lastSentBroadcast.coordinates 
                  ? `${lastSentBroadcast.coordinates.lat}°N, ${lastSentBroadcast.coordinates.lng}°E`
                  : 'Secteur Local (Par défaut)'}
              </span>
            </div>

            {lastSentBroadcast.coordinates?.label && (
              <div className="text-[10px] text-neutral-400 pl-4">
                {lastSentBroadcast.coordinates.label}
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1 border-t border-neutral-700/40">
              <span className="flex items-center gap-1 text-emerald-400">
                <Volume2 className="w-3 h-3" /> Chime sonore & Vibreur activés
              </span>
              <span className="font-mono text-neutral-400">
                {new Date(lastSentBroadcast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            <div className="pt-1 text-[10px] text-amber-300/90 leading-tight">
              ⚠️ {lang === 'fr' 
                ? 'Diffusé sur le réseau civil local uniquement. Ne contacte pas les services d’urgence officiels (112).' 
                : 'Broadcasted to civil local mesh only. Does not contact official emergency services (112/911).'}
            </div>
          </div>

          {/* Interactive footer action: View on map */}
          {onNavigateToMap && lastSentBroadcast.coordinates?.gridX !== undefined && lastSentBroadcast.coordinates?.gridY !== undefined && (
            <div className="mt-2.5 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  if (lastSentBroadcast.coordinates?.gridX !== undefined && lastSentBroadcast.coordinates?.gridY !== undefined) {
                    onNavigateToMap(
                      lastSentBroadcast.coordinates.gridX,
                      lastSentBroadcast.coordinates.gridY,
                      'Ma Balise SOS Déclenchée'
                    );
                    setShowNotificationToast(false);
                  }
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors"
              >
                <Navigation className="w-3 h-3" />
                <span>Localiser sur la carte locale</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
