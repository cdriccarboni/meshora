/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React, { useState, useEffect } from 'react';
import { Language, i18nData } from '../../core/i18n';
import { MeshPeer } from '../../types';
import { TransportManager } from '../../transports/TransportManager';
import { Radio, RefreshCw, Smartphone, Wifi, Battery, ShieldCheck } from 'lucide-react';

interface DevicesScreenProps {
  lang: Language;
}

export const DevicesScreen: React.FC<DevicesScreenProps> = ({ lang }) => {
  const t = i18nData[lang];
  const [peers, setPeers] = useState<MeshPeer[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const fetchPeers = async () => {
    setIsScanning(true);
    const tm = TransportManager.getInstance();
    const discovered = await tm.aggregatePeers();
    setPeers(discovered);
    setTimeout(() => setIsScanning(false), 800);
  };

  useEffect(() => {
    fetchPeers();
  }, []);

  return (
    <div className="space-y-4 pb-20 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-blue-500" />
            <span>{t.devices.title}</span>
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {t.devices.subtitle}
          </p>
        </div>
        <button
          onClick={fetchPeers}
          disabled={isScanning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{t.actions.refresh}</span>
        </button>
      </div>

      {/* Radar scanning indicator */}
      {isScanning && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span>{t.devices.radarScanning}</span>
        </div>
      )}

      {/* Peer list or empty state */}
      <div className="space-y-2.5">
        {peers.length === 0 && !isScanning ? (
          <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-3">
            <Radio className="w-8 h-8 text-neutral-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {lang === 'fr' ? 'Aucun appareil à proximité détecté' : 'No nearby devices detected'}
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                {lang === 'fr'
                  ? 'Pour tester en direct : ouvrez un second onglet sur ce navigateur (découverte par BroadcastChannel) ou connectez un relais WebSocket.'
                  : 'To test live: open a second tab in this browser (discovered via BroadcastChannel) or connect a WebSocket relay.'}
              </p>
            </div>
            <div className="inline-block px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 font-mono">
              BLE & Radio physique : en attente de runtime natif
            </div>
          </div>
        ) : (
          peers.map((peer) => (
          <div
            key={peer.id}
            className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-blue-500">
                {peer.transport === 'bluetooth' ? (
                  <Smartphone className="w-4 h-4" />
                ) : peer.transport === 'websocket' || peer.transport === 'lan' ? (
                  <Wifi className="w-4 h-4" />
                ) : (
                  <Radio className="w-4 h-4" />
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    {peer.alias}
                  </span>
                  {peer.verified && (
                    <span title="Identité vérifiée">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    </span>
                  )}
                  {peer.isGateway && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-medium">
                      Passerelle
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 font-mono">
                  {peer.transport.toUpperCase()} · {peer.hops} {t.devices.hops} · {peer.rssi} dBm
                </div>
              </div>
            </div>

            <div className="text-right space-y-1">
              {peer.batteryPercent !== undefined && (
                <div className="inline-flex items-center gap-1 text-[11px] text-neutral-500 font-mono">
                  <Battery className="w-3 h-3 text-emerald-500" />
                  <span>{peer.batteryPercent}%</span>
                </div>
              )}
              <div className="text-[10px] text-neutral-400">
                Actif il y a {Math.round((Date.now() - peer.lastSeen) / 1000)}s
              </div>
            </div>
          </div>
        ))
        )}
      </div>
    </div>
  );
};
