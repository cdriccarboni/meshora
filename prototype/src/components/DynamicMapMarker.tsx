/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React from 'react';
import { OfflineMapPoint, ResilienceMarkerType } from '../types';

export interface DynamicSvgMarkerProps {
  point: OfflineMapPoint;
  markerType: ResilienceMarkerType;
  isSelected: boolean;
  zoom: number;
  onClick: (e: React.MouseEvent) => void;
}

/**
 * Maps an offline map point to one of the 3 canonical resilience marker types:
 * - 'node' : Mesh relays, gateways, mobile peer stations
 * - 'emergency-service' : Drinking water, medical/first aid, solar power, radio beacons
 * - 'safe-zone' : Shelters, evacuation areas, community safe houses
 */
export function getMarkerTypeForPoint(point: OfflineMapPoint): ResilienceMarkerType {
  if (point.markerType) {
    return point.markerType;
  }
  if (point.category === 'mesh_node') {
    return 'node';
  }
  if (point.category === 'shelter') {
    return 'safe-zone';
  }
  return 'emergency-service';
}

/**
 * Renders a dynamic, accessible SVG marker element on the Resilience vector map
 * tailored for point types: 'node', 'emergency-service', and 'safe-zone'.
 */
export function renderDynamicSvgMarker({
  point,
  markerType,
  isSelected,
  zoom,
  onClick
}: DynamicSvgMarkerProps): React.ReactElement {
  const isNode = markerType === 'node';
  const isService = markerType === 'emergency-service';
  const isSafeZone = markerType === 'safe-zone';

  // Base transform group centered at (point.x, point.y)
  const scale = isSelected ? 1.25 : 1.0;

  return (
    <g
      key={point.id}
      id={`marker-${point.id}`}
      transform={`translate(${point.x}, ${point.y})`}
      onClick={onClick}
      className="cursor-pointer group select-none"
    >
      <title>{`${point.name} (${markerType})`}</title>

      {/* ========================================================================= */}
      {/* 1. TYPE: 'safe-zone' — Translucent Protected Perimeter Aura & Sanctuary Shield */}
      {/* ========================================================================= */}
      {isSafeZone && (
        <g className="transition-all duration-200">
          {/* Safe zone perimeter radius circle on the sector map */}
          <circle
            cx="0"
            cy="0"
            r={isSelected ? 64 : 52}
            fill="#10b981"
            fillOpacity={isSelected ? 0.16 : 0.09}
            stroke="#10b981"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="transition-all duration-300"
          />
          {isSelected && (
            <circle
              cx="0"
              cy="0"
              r="76"
              fill="none"
              stroke="#34d399"
              strokeWidth="1"
              strokeDasharray="2 6"
              className="animate-spin origin-center"
              style={{ animationDuration: '30s' }}
            />
          )}

          {/* Central Sanctuary Shield Badge */}
          <g transform={`scale(${scale})`}>
            {/* Halo pulse when selected */}
            {isSelected && (
              <circle cx="0" cy="0" r="22" fill="#10b981" fillOpacity="0.25" className="animate-ping" />
            )}

            {/* Protective Shield Geometry */}
            <path
              d="M 0,-15 L 13,-8 L 13,4 C 13,11 0,17 0,17 C 0,17 -13,11 -13,4 L -13,-8 Z"
              fill="#0f1915"
              stroke="#10b981"
              strokeWidth={isSelected ? 2.8 : 2}
              className="drop-shadow-lg transition-transform group-hover:scale-110"
            />

            {/* Inner Sanctuary / Refuge Roof & Door Symbol */}
            <path
              d="M -6,-2 L 0,-8 L 6,-2 L 6,6 L -6,6 Z"
              fill="none"
              stroke="#34d399"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Doorway */}
            <path d="M -1.5,6 L -1.5,2 L 1.5,2 L 1.5,6" fill="none" stroke="#34d399" strokeWidth="1.4" />
          </g>
        </g>
      )}

      {/* ========================================================================= */}
      {/* 2. TYPE: 'node' — Hexagonal Mesh Relay Antenna with Radio Waves */}
      {/* ========================================================================= */}
      {isNode && (
        <g className="transition-all duration-200">
          {/* Animated concentric radio transmission arcs */}
          <g className="opacity-70 group-hover:opacity-100 transition-opacity">
            <path
              d="M -22,-14 A 26 26 0 0 1 22,-14"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
              strokeDasharray="2 3"
              className={isSelected ? 'animate-pulse' : ''}
            />
            <path
              d="M -16,-9 A 18 18 0 0 1 16,-9"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="1.2"
              className={isSelected ? 'animate-pulse' : ''}
            />
          </g>

          {/* Hexagonal / Diamond Housing */}
          <g transform={`scale(${scale})`}>
            {isSelected && (
              <circle cx="0" cy="0" r="22" fill="#3b82f6" fillOpacity="0.25" className="animate-ping" />
            )}

            {/* Hexagonal Node Body */}
            <polygon
              points="0,-15 13,-7.5 13,7.5 0,15 -13,7.5 -13,-7.5"
              fill="#10141d"
              stroke="#3b82f6"
              strokeWidth={isSelected ? 2.8 : 2}
              className="drop-shadow-md transition-transform group-hover:scale-110"
            />

            {/* Central Mast & Radio Wave Symbol */}
            <line x1="0" y1="8" x2="0" y2="-6" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
            <circle cx="0" cy="-6" r="3" fill="#60a5fa" />
            <circle cx="0" cy="-6" r="1.2" fill="#ffffff" />

            {/* Orbital Satellite Node */}
            <circle cx="7" cy="-7" r="1.6" fill="#93c5fd" className="animate-pulse" />
          </g>
        </g>
      )}

      {/* ========================================================================= */}
      {/* 3. TYPE: 'emergency-service' — Octagonal High-Visibility Service Badge */}
      {/* ========================================================================= */}
      {isService && (
        <g className="transition-all duration-200" transform={`scale(${scale})`}>
          {/* Active Ping if selected */}
          {isSelected && (
            <circle
              cx="0"
              cy="0"
              r="22"
              fill={getServiceTheme(point.category).primary}
              fillOpacity="0.25"
              className="animate-ping"
            />
          )}

          {/* Octagonal Diamond Base */}
          <polygon
            points="0,-16 12,-12 16,0 12,12 0,16 -12,12 -16,0 -12,-12"
            fill="#14151b"
            stroke={getServiceTheme(point.category).primary}
            strokeWidth={isSelected ? 2.8 : 2}
            className="drop-shadow-md transition-transform group-hover:scale-110"
          />

          {/* Sub-Category Specific High-Contrast Symbol */}
          {renderServiceGlyph(point.category)}

          {/* Operational Status Dot (Bottom Right) */}
          <circle
            cx="10"
            cy="10"
            r="3.5"
            fill={point.status === 'active' ? '#10b981' : '#f59e0b'}
            stroke="#14151b"
            strokeWidth="1.2"
          />
        </g>
      )}

      {/* ========================================================================= */}
      {/* Universal Label with Readability Badge */}
      {/* ========================================================================= */}
      <g transform={`translate(0, ${isSafeZone ? 24 : 22})`} className="pointer-events-none">
        {/* Soft background scrim behind text for legibility over map roads */}
        <rect
          x={-(point.name.length * 3.1) - 4}
          y="-9"
          width={point.name.length * 6.2 + 8}
          height="14"
          rx="4"
          fill="#0c0e12"
          fillOpacity="0.82"
          stroke="#262a33"
          strokeWidth="0.75"
        />
        <text
          x="0"
          y="1"
          textAnchor="middle"
          className={`text-[9.5px] font-sans transition-colors ${
            isSelected
              ? 'fill-white font-bold'
              : 'fill-neutral-200 group-hover:fill-white font-medium'
          }`}
        >
          {point.name}
        </text>
      </g>
    </g>
  );
}

/**
 * Returns color theme based on emergency service sub-category
 */
function getServiceTheme(cat: string): { primary: string; secondary: string } {
  switch (cat) {
    case 'medical':
      return { primary: '#f43f5e', secondary: '#fda4af' };
    case 'water':
      return { primary: '#06b6d4', secondary: '#67e8f9' };
    case 'power':
      return { primary: '#f59e0b', secondary: '#fcd34d' };
    case 'radio':
      return { primary: '#8b5cf6', secondary: '#c4b5fd' };
    default:
      return { primary: '#3b82f6', secondary: '#93c5fd' };
  }
}

/**
 * Renders appropriate vector glyph inside the emergency-service badge
 */
function renderServiceGlyph(cat: string): React.ReactElement {
  switch (cat) {
    case 'medical':
      // First Aid Medical Cross
      return (
        <path
          d="M -2,-7 H 2 V -2 H 7 V 2 H 2 V 7 H -2 V 2 H -7 V -2 H -2 Z"
          fill="#f43f5e"
        />
      );
    case 'water':
      // Drinking Water Teardrop
      return (
        <path
          d="M 0,-7 C 2,-4 5,-1 5,2 C 5,5 2.5,7 0,7 C -2.5,7 -5,5 -5,2 C -5,-1 -2,-4 0,-7 Z"
          fill="#06b6d4"
        />
      );
    case 'power':
      // Energy Zap Bolt
      return (
        <path
          d="M 1,-7 L -5,0 L 0,0 L -1,7 L 5,0 L 0,0 Z"
          fill="#f59e0b"
          stroke="#f59e0b"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      );
    case 'radio':
      // Radio / Broadcast Beacon
      return (
        <g stroke="#8b5cf6" strokeWidth="1.2" strokeLinecap="round">
          <line x1="0" y1="5" x2="0" y2="-4" strokeWidth="1.8" />
          <circle cx="0" cy="-4" r="2" fill="#8b5cf6" />
          <path d="M -4,-2 A 5 5 0 0 1 -4,-6" fill="none" />
          <path d="M 4,-2 A 5 5 0 0 0 4,-6" fill="none" />
        </g>
      );
    default:
      return <circle cx="0" cy="0" r="4" fill="#3b82f6" />;
  }
}

/**
 * React Component Wrapper around renderDynamicSvgMarker
 */
export const DynamicMapMarker: React.FC<DynamicSvgMarkerProps> = (props) => {
  return renderDynamicSvgMarker(props);
};
