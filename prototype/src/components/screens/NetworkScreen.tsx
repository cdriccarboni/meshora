/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React, { useState } from 'react';
import { Language, i18nData } from '../../core/i18n';
import { AppIdentity } from '../../types';
import { Network, Info, Radio, Globe, Shield, Activity, Layers } from 'lucide-react';

interface NetworkScreenProps {
  lang: Language;
  identity: AppIdentity;
}

interface TopoNode {
  id: string;
  alias: string;
  x: number;
  y: number;
  type: 'local' | 'relay' | 'gateway' | 'lora';
  transport: string;
  hops: number;
  rssi: number;
}

export const NetworkScreen: React.FC<NetworkScreenProps> = ({ lang, identity }) => {
  const t = i18nData[lang];
  const [selectedNode, setSelectedNode] = useState<TopoNode | null>(null);

  const nodes: TopoNode[] = [
    {
      id: identity.id,
      alias: `${identity.alias} (${lang === 'fr' ? 'Vous' : 'You'})`,
      x: 180,
      y: 150,
      type: 'local',
      transport: 'BroadcastChannel / LAN',
      hops: 0,
      rssi: -30
    },
    {
      id: 'node_relais_nord',
      alias: 'Relais-Nord-84',
      x: 310,
      y: 90,
      type: 'relay',
      transport: 'Wi-Fi Local (LAN Direct)',
      hops: 1,
      rssi: -45
    },
    {
      id: 'node_gateway_wan',
      alias: 'Passerelle-Fibre-Tetaneutral',
      x: 440,
      y: 160,
      type: 'gateway',
      transport: 'Uplink Internet',
      hops: 2,
      rssi: -50
    },
    {
      id: 'node_lora_colline',
      alias: 'Balise-Colline-LoRa',
      x: 230,
      y: 240,
      type: 'lora',
      transport: 'Meshtastic 868MHz (Simulé)',
      hops: 2,
      rssi: -82
    },
    {
      id: 'node_voisin_sud',
      alias: 'Voisin-Sud-BLE',
      x: 90,
      y: 220,
      type: 'relay',
      transport: 'Bluetooth LE (Stub)',
      hops: 1,
      rssi: -65
    }
  ];

  return (
    <div className="space-y-4 pb-20 animate-fade-in">
      {/* Simulation Banner Notice */}
      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 flex items-start gap-2.5 text-xs">
        <Info className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
        <div>
          <span className="font-semibold block">{t.status.simulationNotice}</span>
          <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">
            {t.network.simulatedNotice}
          </p>
        </div>
      </div>

      {/* Interactive Topology Canvas */}
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {t.network.title}
            </h2>
          </div>
          <span className="text-[11px] text-neutral-500 font-mono">
            {nodes.length} nœuds cartographiés
          </span>
        </div>

        {/* SVG Graph Viewport */}
        <div className="relative w-full aspect-[16/10] bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex items-center justify-center">
          <svg
            viewBox="0 0 540 320"
            className="w-full h-full select-none"
          >
            {/* Background Grid Pattern */}
            <defs>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-neutral-200 dark:text-neutral-850" />
              </pattern>
            </defs>
            <rect width="540" height="320" fill="url(#grid)" />

            {/* Connecting Links */}
            {/* Link You -> Relais-Nord */}
            <line x1="180" y1="150" x2="310" y2="90" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_15s_linear_infinite]" />
            {/* Link Relais-Nord -> Gateway */}
            <line x1="310" y1="90" x2="440" y2="160" stroke="#10b981" strokeWidth="2" />
            {/* Link You -> LoRa Colline */}
            <line x1="180" y1="150" x2="230" y2="240" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" />
            {/* Link You -> Voisin-Sud */}
            <line x1="180" y1="150" x2="90" y2="220" stroke="#60a5fa" strokeWidth="1.5" />

            {/* Render Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isLocal = node.type === 'local';
              const isGateway = node.type === 'gateway';

              let fill = '#3b82f6';
              if (isLocal) fill = '#ffffff';
              if (isGateway) fill = '#10b981';

              return (
                <g
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className="cursor-pointer group"
                >
                  {/* Pulse halo if selected or local */}
                  {(isSelected || isLocal) && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isSelected ? 18 : 14}
                      fill={fill}
                      opacity={0.2}
                      className="animate-pulse"
                    />
                  )}

                  {/* Outer circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isSelected ? 11 : 9}
                    fill={isLocal ? '#121316' : '#1e293b'}
                    stroke={fill}
                    strokeWidth={isSelected ? 3 : 2}
                    className="transition-all"
                  />

                  {/* Inner dot */}
                  <circle cx={node.x} cy={node.y} r="3.5" fill={fill} />

                  {/* Node label */}
                  <text
                    x={node.x}
                    y={node.y + 20}
                    textAnchor="middle"
                    className="text-[10px] font-medium fill-neutral-700 dark:fill-neutral-300 pointer-events-none"
                  >
                    {node.alias.split(' ')[0]}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Node detail floating overlay */}
          {selectedNode && (
            <div className="absolute bottom-3 left-3 right-3 p-3 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-lg text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {selectedNode.alias}
                </span>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-3 text-neutral-500 dark:text-neutral-400 text-[11px] pt-1 border-t border-neutral-100 dark:border-neutral-800">
                <span>Liaison: <strong className="text-neutral-700 dark:text-neutral-200">{selectedNode.transport}</strong></span>
                <span>Sauts: <strong className="text-neutral-700 dark:text-neutral-200">{selectedNode.hops}</strong></span>
                <span>Signal: <strong className="text-neutral-700 dark:text-neutral-200">{selectedNode.rssi} dBm</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-500" />
            <span>{t.network.localNode}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>{t.network.relayNode}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>{t.network.gatewayNode}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
