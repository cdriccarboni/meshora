/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React, { useState, useRef, useEffect } from 'react';
import { OfflineMapPoint, OfflinePointCategory, WalkingRoute, ResilienceMarkerType } from '../types';
import { ResilienceEngine } from '../core/resilienceEngine';
import { TransportManager } from '../transports/TransportManager';
import { Language } from '../core/i18n';
import { renderDynamicSvgMarker, getMarkerTypeForPoint } from './DynamicMapMarker';
import { calculateDijkstraRoute } from '../core/offlineRouter';
import { 
  MapPin, 
  Plus, 
  Minus, 
  RotateCcw, 
  Droplet, 
  Heart, 
  Zap, 
  Home, 
  Radio, 
  RadioTower, 
  CheckCircle2, 
  Navigation, 
  Share2, 
  Info, 
  X,
  Compass,
  Crosshair,
  LocateFixed,
  Route,
  Footprints,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Milestone
} from 'lucide-react';

interface OfflineMapViewerProps {
  lang: Language;
  externalTarget?: { destX: number; destY: number; destName: string } | null;
}

export const OfflineMapViewer: React.FC<OfflineMapViewerProps> = ({ lang, externalTarget }) => {
  const engine = ResilienceEngine.getInstance();
  const [points, setPoints] = useState<OfflineMapPoint[]>([]);

  const [selectedPoint, setSelectedPoint] = useState<OfflineMapPoint | null>(null);
  const [activeCategory, setActiveCategory] = useState<OfflinePointCategory | 'all'>('all');
  
  // Transform & pan/zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartRef = useRef<{ dist: number; zoom: number; x: number; y: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Re-centering & feedback state
  const [isRecentering, setIsRecentering] = useState(false);
  const [recenteredToast, setRecenteredToast] = useState<string | null>(null);
  const [lastKnownTime, setLastKnownTime] = useState<number>(Date.now() - 120000);

  // New point modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPointPos, setNewPointPos] = useState<{ x: number; y: number }>({ x: 500, y: 300 });
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<OfflinePointCategory>('water');
  const [newDesc, setNewDesc] = useState('');
  const [newFreq, setNewFreq] = useState('');
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // User last-known position on sector grid (x: 450, y: 280)
  const [userPosition, setUserPosition] = useState({ x: 450, y: 280 });

  useEffect(() => {
    setPoints(engine.getMapPoints());
    const unsub = engine.subscribeMapPoints((updated) => {
      setPoints(updated);
    });
    return unsub;
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(Number((z + 0.25).toFixed(2)), 2.8));
  const handleZoomOut = () => setZoom((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.75));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  /**
   * Re-center on the user's current last-known location
   */
  const handleRecenterOnUser = () => {
    setIsRecentering(true);
    const targetZoom = 1.35;

    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      // Map center in SVG coordinates is (500, 300)
      // Calculate offset so (userPosition.x, userPosition.y) is positioned at viewport center
      const offsetX = (500 - userPosition.x) * (width / 1000) * targetZoom;
      const offsetY = (300 - userPosition.y) * (height / 600) * targetZoom;

      setZoom(targetZoom);
      setPan({ x: Math.round(offsetX), y: Math.round(offsetY) });
    } else {
      setZoom(targetZoom);
      setPan({ x: 0, y: 0 });
    }

    setLastKnownTime(Date.now());
    setRecenteredToast(
      lang === 'fr'
        ? 'Vue recentrée sur votre position locale'
        : 'View re-centered on your local position'
    );

    setTimeout(() => setRecenteredToast(null), 3000);
    setTimeout(() => setIsRecentering(false), 1400);
  };

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch gesture handlers (Pinch-to-zoom + 1-finger drag)
  const handleTouchStart = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300 && e.touches.length === 1) {
      // Double tap to zoom in
      handleZoomIn();
    }
    lastTapRef.current = now;

    if (e.touches.length === 2) {
      // Pinch to zoom gesture
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartRef.current = { dist, zoom, x: pan.x, y: pan.y };
    } else if (e.touches.length === 1) {
      // 1-finger drag pan
      const t = e.touches[0];
      dragStartRef.current = { x: t.clientX - pan.x, y: t.clientY - pan.y };
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current) {
      // Pinch zoom in action
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scaleFactor = newDist / touchStartRef.current.dist;
      const newZoom = Math.min(2.8, Math.max(0.75, Number((touchStartRef.current.zoom * scaleFactor).toFixed(2))));
      setZoom(newZoom);
    } else if (e.touches.length === 1 && isDragging) {
      const t = e.touches[0];
      setPan({
        x: t.clientX - dragStartRef.current.x,
        y: t.clientY - dragStartRef.current.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartRef.current = null;
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).tagName === 'rect' || (e.target as HTMLElement).tagName === 'path') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left - pan.x) / zoom) * (1000 / rect.width);
      const clickY = ((e.clientY - rect.top - pan.y) / zoom) * (600 / rect.height);
      setNewPointPos({
        x: Math.max(50, Math.min(950, Math.round(clickX))),
        y: Math.max(50, Math.min(550, Math.round(clickY)))
      });
    }
  };

  const handleSaveNewPoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const dx = newPointPos.x - userPosition.x;
    const dy = newPointPos.y - userPosition.y;
    const distanceMeters = Math.round(Math.sqrt(dx * dx + dy * dy) * 2.2);
    const markerType = getMarkerTypeForPoint({ category: newCategory } as OfflineMapPoint);

    const created = engine.addMapPoint({
      name: newName.trim(),
      category: newCategory,
      markerType,
      x: newPointPos.x,
      y: newPointPos.y,
      latApprox: 48.854 + (300 - newPointPos.y) * 0.00004,
      lngApprox: 2.350 + (newPointPos.x - 500) * 0.00005,
      description: newDesc.trim() || (lang === 'fr' ? 'Point d’urgence ajouté manuellement' : 'Manually added emergency point'),
      status: 'active',
      verified: false,
      frequencyOrBand: newFreq.trim() || undefined,
      distanceMeters,
      contactAlias: 'Local Device'
    });

    setSelectedPoint(created);
    setIsAddModalOpen(false);
    setNewName('');
    setNewDesc('');
    setNewFreq('');
  };

  const handleSharePointViaMesh = async (point: OfflineMapPoint) => {
    const tm = TransportManager.getInstance();
    const content = lang === 'fr'
      ? `[REPERE HORS-LIGNE] ${point.name} (${point.category.toUpperCase()}) · Dist: ~${point.distanceMeters}m · Info: ${point.description}`
      : `[OFFLINE POINT] ${point.name} (${point.category.toUpperCase()}) · Dist: ~${point.distanceMeters}m · Info: ${point.description}`;

    await tm.broadcast({
      id: 'map_broadcast_' + Date.now(),
      senderId: 'msh_map_engine',
      senderAlias: 'Carte Résilience',
      recipientId: 'broadcast',
      channelId: 'emergency',
      content,
      timestamp: Date.now(),
      status: 'delivered',
      transport: 'broadcast',
      hops: 0,
      encrypted: true
    });

    setShareFeedback(lang === 'fr' ? 'Point partagé sur le canal d’urgence !' : 'Point shared on emergency channel!');
    setTimeout(() => setShareFeedback(null), 3000);
  };

  // Dijkstra offline routing methods
  const [activeRoute, setActiveRoute] = useState<WalkingRoute | null>(null);
  const [showRouteDetails, setShowRouteDetails] = useState<boolean>(true);
  const [isRouteModalOpen, setIsRouteModalOpen] = useState<boolean>(false);
  const [selectedOriginId, setSelectedOriginId] = useState<string>('user');
  const [selectedDestId, setSelectedDestId] = useState<string>('');
  const [routeShareFeedback, setRouteShareFeedback] = useState<string | null>(null);

  const calculateRouteToPoint = (point: OfflineMapPoint) => {
    const route = calculateDijkstraRoute({
      startX: userPosition.x,
      startY: userPosition.y,
      startName: lang === 'fr' ? 'Nœud Local (Vous)' : 'Local Node (You)',
      destX: point.x,
      destY: point.y,
      destName: point.name,
      lang: lang === 'fr' ? 'fr' : 'en'
    });

    if (route) {
      setActiveRoute(route);
      setShowRouteDetails(true);
      const midX = (userPosition.x + point.x) / 2;
      const midY = (userPosition.y + point.y) / 2;
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const offsetX = (500 - midX) * (width / 1000) * 1.2;
        const offsetY = (300 - midY) * (height / 600) * 1.2;
        setZoom(1.2);
        setPan({ x: Math.round(offsetX), y: Math.round(offsetY) });
      }
    }
  };

  const calculateRouteBetween = (origId: string, destId: string) => {
    let startX = userPosition.x;
    let startY = userPosition.y;
    let startName = lang === 'fr' ? 'Nœud Local (Vous)' : 'Local Node (You)';

    if (origId !== 'user') {
      const origPoint = points.find((p) => p.id === origId);
      if (origPoint) {
        startX = origPoint.x;
        startY = origPoint.y;
        startName = origPoint.name;
      }
    }

    const destPoint = points.find((p) => p.id === destId);
    if (!destPoint) return;

    const route = calculateDijkstraRoute({
      startX,
      startY,
      startName,
      destX: destPoint.x,
      destY: destPoint.y,
      destName: destPoint.name,
      lang: lang === 'fr' ? 'fr' : 'en'
    });

    if (route) {
      setActiveRoute(route);
      setShowRouteDetails(true);
      setIsRouteModalOpen(false);
      const midX = (startX + destPoint.x) / 2;
      const midY = (startY + destPoint.y) / 2;
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const offsetX = (500 - midX) * (width / 1000) * 1.15;
        const offsetY = (300 - midY) * (height / 600) * 1.15;
        setZoom(1.15);
        setPan({ x: Math.round(offsetX), y: Math.round(offsetY) });
      }
    }
  };

  const handleClearRoute = () => {
    setActiveRoute(null);
  };

  useEffect(() => {
    if (externalTarget) {
      const route = calculateDijkstraRoute({
        startX: userPosition.x,
        startY: userPosition.y,
        startName: lang === 'fr' ? 'Nœud Local (Vous)' : 'Local Node (You)',
        destX: externalTarget.destX,
        destY: externalTarget.destY,
        destName: externalTarget.destName,
        lang: lang === 'fr' ? 'fr' : 'en'
      });
      if (route) {
        setActiveRoute(route);
        setShowRouteDetails(true);
        const midX = (userPosition.x + externalTarget.destX) / 2;
        const midY = (userPosition.y + externalTarget.destY) / 2;
        if (containerRef.current) {
          const width = containerRef.current.clientWidth;
          const height = containerRef.current.clientHeight;
          const offsetX = (500 - midX) * (width / 1000) * 1.2;
          const offsetY = (300 - midY) * (height / 600) * 1.2;
          setZoom(1.2);
          setPan({ x: Math.round(offsetX), y: Math.round(offsetY) });
        }
      }
    }
  }, [externalTarget, lang, userPosition.x, userPosition.y]);


  const handleShareRouteViaMesh = async (route: WalkingRoute) => {
    const tm = TransportManager.getInstance();
    const instructionsText = route.instructions
      .map((ins, i) => `${i + 1}. ${ins.instruction} (~${ins.distanceMeters}m)`)
      .join(' | ');
    const content = lang === 'fr'
      ? `[ITINÉRAIRE PIÉTON DIJKSTRA] De « ${route.fromName} » vers « ${route.toName} » · Dist: ~${route.totalDistanceMeters}m (~${route.estimatedMinutes} min) · Étapes: ${instructionsText}`
      : `[OFFLINE WALKING ROUTE] From "${route.fromName}" to "${route.toName}" · Dist: ~${route.totalDistanceMeters}m (~${route.estimatedMinutes} min) · Steps: ${instructionsText}`;

    await tm.broadcast({
      id: 'route_broadcast_' + Date.now(),
      senderId: 'msh_router_engine',
      senderAlias: 'Routeur Dijkstra MESHORA',
      recipientId: 'broadcast',
      channelId: 'emergency',
      content,
      timestamp: Date.now(),
      status: 'delivered',
      transport: 'broadcast',
      hops: 0,
      encrypted: true
    });

    setRouteShareFeedback(
      lang === 'fr'
        ? 'Itinéraire complet relayé sur le Mesh local !'
        : 'Full walking route relayed on local Mesh!'
    );
    setTimeout(() => setRouteShareFeedback(null), 3500);
  };

  const filteredPoints = points.filter(
    (p) => activeCategory === 'all' || p.category === activeCategory
  );

  const getCategoryMeta = (cat: OfflinePointCategory) => {
    switch (cat) {
      case 'mesh_node':
        return {
          label: lang === 'fr' ? 'Nœud Mesh' : 'Mesh Node',
          color: '#3b82f6',
          icon: RadioTower
        };
      case 'water':
        return {
          label: lang === 'fr' ? 'Eau Potable' : 'Drinking Water',
          color: '#06b6d4',
          icon: Droplet
        };
      case 'medical':
        return {
          label: lang === 'fr' ? 'Poste Médical' : 'Medical Post',
          color: '#f43f5e',
          icon: Heart
        };
      case 'power':
        return {
          label: lang === 'fr' ? 'Énergie / Solaire' : 'Power / Solar',
          color: '#f59e0b',
          icon: Zap
        };
      case 'shelter':
        return {
          label: lang === 'fr' ? 'Refuge / Accueil' : 'Shelter / Camp',
          color: '#10b981',
          icon: Home
        };
      case 'radio':
        return {
          label: lang === 'fr' ? 'Balise Radio' : 'Radio Beacon',
          color: '#8b5cf6',
          icon: Radio
        };
    }
  };

  return (
    <div className="space-y-3">
      {/* Caching Status Bar */}
      <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </span>
          <span className="font-medium">
            {lang === 'fr'
              ? `Cache local hors-ligne actif · ${points.length} repères cartographiés`
              : `Offline local cache active · ${points.length} mapped points`}
          </span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => {
              if (points.length > 0 && !selectedDestId) {
                setSelectedDestId(points[0].id);
              }
              setIsRouteModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-medium text-xs transition active:scale-95"
            title={lang === 'fr' ? 'Planificateur d’itinéraire piéton hors-ligne' : 'Offline walking route planner'}
          >
            <Route className="w-3.5 h-3.5" />
            <span>{lang === 'fr' ? 'Itinéraire' : 'Route'}</span>
          </button>
          <button
            onClick={handleRecenterOnUser}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-xs transition"
            title={lang === 'fr' ? 'Recentrer sur votre position' : 'Re-center on user position'}
          >
            <LocateFixed className="w-3.5 h-3.5 text-blue-500" />
            <span>{lang === 'fr' ? 'Recentrer' : 'Re-center'}</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'fr' ? 'Ajouter repère' : 'Add point'}</span>
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium min-h-[36px] flex items-center ${
            activeCategory === 'all'
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-xs'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          {lang === 'fr' ? `Tous (${points.length})` : `All (${points.length})`}
        </button>

        {(['mesh_node', 'water', 'medical', 'power', 'shelter', 'radio'] as OfflinePointCategory[]).map((cat) => {
          const meta = getCategoryMeta(cat);
          const count = points.filter((p) => p.category === cat).length;
          const Icon = meta.icon;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-xs font-medium min-h-[36px] ${
                isActive
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: isActive ? undefined : meta.color }} />
              <span>{meta.label}</span>
              <span className="opacity-70 text-[10px]">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Interactive Map Box */}
      <div 
        ref={containerRef}
        className="relative w-full aspect-[16/10] sm:aspect-[16/9] bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-inner select-none cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* SVG Vector Map Canvas */}
        <svg
          viewBox="0 0 1000 600"
          className="w-full h-full transition-transform duration-100 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center'
          }}
          onClick={handleMapClick}
        >
          <defs>
            {/* Topography pattern grid */}
            <pattern id="sectorGrid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#262a33" strokeWidth="0.75" />
            </pattern>
            {/* Radar wave animation */}
            <radialGradient id="userRadar" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background landmass */}
          <rect width="1000" height="600" fill="#13151a" />
          <rect width="1000" height="600" fill="url(#sectorGrid)" />

          {/* Natural Topography & Relief Contours */}
          <g className="opacity-40">
            <path
              d="M 50 120 C 180 80, 240 180, 420 110 S 700 80, 950 140"
              fill="none"
              stroke="#2e3542"
              strokeWidth="2"
              strokeDasharray="4 6"
            />
            <path
              d="M 80 480 C 260 520, 440 380, 680 490 S 840 420, 980 520"
              fill="none"
              stroke="#2e3542"
              strokeWidth="2"
              strokeDasharray="4 6"
            />
          </g>

          {/* River / Water Course */}
          <path
            d="M -20 180 C 180 160, 320 340, 520 310 S 820 440, 1020 390"
            fill="none"
            stroke="#1e3a5f"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M -20 180 C 180 160, 320 340, 520 310 S 820 440, 1020 390"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeOpacity="0.4"
          />

          {/* Secondary Road / Path Network */}
          <g stroke="#374151" strokeWidth="2.5" strokeLinecap="round" opacity="0.6">
            <line x1="200" y1="50" x2="260" y2="550" />
            <line x1="100" y1="300" x2="900" y2="280" />
            <line x1="450" y1="60" x2="520" y2="540" />
            <line x1="750" y1="100" x2="720" y2="520" />
            <line x1="260" y1="310" x2="450" y2="280" strokeDasharray="3 3" />
            <line x1="450" y1="280" x2="620" y2="380" strokeDasharray="3 3" />
            <line x1="450" y1="280" x2="380" y2="220" strokeDasharray="3 3" />
          </g>

          {/* Distance radar circles from User Position */}
          <circle cx={userPosition.x} cy={userPosition.y} r="120" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
          <circle cx={userPosition.x} cy={userPosition.y} r="240" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />

          {/* Active Dijkstra Shortest Path Walking Route */}
          {activeRoute && (
            <g className="route-layer">
              {/* Outer soft halo */}
              <path
                d={activeRoute.svgPathD}
                fill="none"
                stroke="#0284c7"
                strokeWidth="10"
                strokeOpacity="0.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Animated high-contrast dashed route */}
              <path
                d={activeRoute.svgPathD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3.5"
                strokeDasharray="6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Waypoint junctions along route */}
              {activeRoute.waypoints.map((wp, idx) => (
                <circle
                  key={`wp_${idx}`}
                  cx={wp.x}
                  cy={wp.y}
                  r="3.5"
                  fill="#38bdf8"
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
              ))}

              {/* Start Pin ('A') */}
              {activeRoute.waypoints.length > 0 && (
                <g transform={`translate(${activeRoute.waypoints[0].x}, ${activeRoute.waypoints[0].y})`}>
                  <circle r="12" fill="#10b981" stroke="#ffffff" strokeWidth="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))" />
                  <text y="4" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                    A
                  </text>
                </g>
              )}

              {/* Destination Pin ('B') */}
              {activeRoute.waypoints.length > 1 && (
                <g transform={`translate(${activeRoute.waypoints[activeRoute.waypoints.length - 1].x}, ${activeRoute.waypoints[activeRoute.waypoints.length - 1].y})`}>
                  <circle r="12" fill="#0284c7" stroke="#ffffff" strokeWidth="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))" />
                  <text y="4" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                    B
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Current User Node Marker (with re-centering pulse halo) */}
          <g className="cursor-pointer">
            <title>{lang === 'fr' ? 'Votre position actuelle' : 'Your current position'}</title>
            {isRecentering && (
              <circle
                cx={userPosition.x}
                cy={userPosition.y}
                r="36"
                fill="#10b981"
                opacity="0.3"
                className="animate-ping"
              />
            )}
            <circle cx={userPosition.x} cy={userPosition.y} r="18" fill="url(#userRadar)" className="animate-pulse" />
            <circle cx={userPosition.x} cy={userPosition.y} r="6.5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
            <text
              x={userPosition.x}
              y={userPosition.y + 22}
              textAnchor="middle"
              className="text-[11px] font-semibold fill-emerald-400 font-sans pointer-events-none drop-shadow"
            >
              {lang === 'fr' ? 'Vous (Nœud Local)' : 'You (Local Node)'}
            </text>
          </g>

          {/* Render Mapped Offline POIs using dynamic SVG marker generator */}
          {filteredPoints.map((point) => {
            const isSelected = selectedPoint?.id === point.id;
            const markerType = getMarkerTypeForPoint(point);

            return renderDynamicSvgMarker({
              point,
              markerType,
              isSelected,
              zoom,
              onClick: (e) => {
                e.stopPropagation();
                setSelectedPoint(point);
              }
            });
          })}
        </svg>

        {/* Floating Re-centered Toast / Banner */}
        {recenteredToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-neutral-900/90 text-white border border-neutral-700/80 shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-medium animate-fade-in pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{recenteredToast}</span>
          </div>
        )}

        {/* Touch-Friendly Navigation & Zoom Control Cluster (Top Right, ≥ 44x44px hitbox) */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          {/* Prominent Re-center button */}
          <button
            onClick={handleRecenterOnUser}
            className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl flex items-center justify-center shadow-xl backdrop-blur-md transition-all active:scale-95 ${
              isRecentering
                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                : 'bg-neutral-900/90 hover:bg-neutral-800 text-neutral-100 border border-neutral-700/80 hover:text-white'
            }`}
            title={lang === 'fr' ? 'Recentrer sur ma position (Nœud local)' : 'Re-center on my position (Local node)'}
            aria-label="Re-center on user position"
          >
            <LocateFixed className={`w-5 h-5 ${isRecentering ? 'text-white animate-spin' : 'text-blue-400'}`} />
          </button>

          {/* Zoom controls container */}
          <div className="flex flex-col bg-neutral-900/90 border border-neutral-700/80 rounded-xl overflow-hidden shadow-xl backdrop-blur-md">
            <button
              onClick={handleZoomIn}
              className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center text-white hover:bg-neutral-800 transition active:scale-95 border-b border-neutral-700/80"
              title={lang === 'fr' ? 'Zoomer (+)' : 'Zoom In (+)'}
              aria-label="Zoom in"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Current Zoom badge */}
            <button
              onClick={handleResetView}
              className="py-1 px-1 text-[10px] font-mono font-semibold text-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              title={lang === 'fr' ? 'Cliquer pour réinitialiser le zoom à 100%' : 'Click to reset zoom to 100%'}
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              onClick={handleZoomOut}
              className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center text-white hover:bg-neutral-800 transition active:scale-95 border-t border-neutral-700/80"
              title={lang === 'fr' ? 'Dézoomer (-)' : 'Zoom Out (-)'}
              aria-label="Zoom out"
            >
              <Minus className="w-5 h-5" />
            </button>
          </div>

          {/* Reset View Button */}
          <button
            onClick={handleResetView}
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 flex items-center justify-center shadow-xl backdrop-blur-md transition active:scale-95"
            title={lang === 'fr' ? 'Vue d’ensemble' : 'Reset View'}
            aria-label="Reset view"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Sector Scale & Orientation (Bottom Left) */}
        <div className="absolute bottom-3 left-3 flex items-center gap-3 px-3 py-2 rounded-xl bg-neutral-950/85 border border-neutral-800 text-[11px] font-mono text-neutral-400 backdrop-blur-md pointer-events-none shadow-md">
          <div className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span>NORD</span>
          </div>
          <span className="text-neutral-600">|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1 bg-neutral-300 rounded-full" />
            <span>500 m</span>
          </div>
          <span className="text-neutral-600 hidden sm:inline">|</span>
          <span className="text-[10px] text-neutral-500 hidden sm:inline">
            Pincer pour zoomer
          </span>
        </div>
      </div>

      {/* Point Detail Drawer / Card */}
      {selectedPoint && (
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-md animate-fade-in space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${getCategoryMeta(selectedPoint.category).color}20` }}
              >
                {React.createElement(getCategoryMeta(selectedPoint.category).icon, {
                  className: 'w-5 h-5',
                  style: { color: getCategoryMeta(selectedPoint.category).color }
                })}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
                    {selectedPoint.name}
                  </h3>
                  {selectedPoint.verified && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-mono">
                      <CheckCircle2 className="w-3 h-3" /> Vérifié
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {getCategoryMeta(selectedPoint.category).label}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    <Navigation className="w-3 h-3" /> ~{selectedPoint.distanceMeters} m
                  </span>
                  <span>·</span>
                  <span>~{Math.max(1, Math.round(selectedPoint.distanceMeters / 80))} min à pied</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedPoint(null)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-850 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800">
            {selectedPoint.description}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
            {selectedPoint.frequencyOrBand && (
              <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60">
                <span className="text-[10px] text-neutral-400 block mb-0.5 font-sans">Canal / Fréquence</span>
                <span className="font-semibold text-blue-500">{selectedPoint.frequencyOrBand}</span>
              </div>
            )}
            <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60">
              <span className="text-[10px] text-neutral-400 block mb-0.5 font-sans">Coordonnées GPS Approx.</span>
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                {selectedPoint.latApprox.toFixed(4)}, {selectedPoint.lngApprox.toFixed(4)}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60">
              <span className="text-[10px] text-neutral-400 block mb-0.5 font-sans">Référent / Contact</span>
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">{selectedPoint.contactAlias || 'N/A'}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              {shareFeedback || ''}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => calculateRouteToPoint(selectedPoint)}
                className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition shadow-xs active:scale-95"
                title={lang === 'fr' ? 'Calculer l’itinéraire piéton avec l’algorithme Dijkstra hors-ligne' : 'Calculate walking route with offline Dijkstra'}
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>{lang === 'fr' ? 'Itinéraire piéton' : 'Walking route'}</span>
              </button>
              <button
                onClick={() => handleSharePointViaMesh(selectedPoint)}
                className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-xs transition active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{lang === 'fr' ? 'Partager via Mesh' : 'Share via Mesh'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Route Guidance Sheet (Dijkstra) */}
      {activeRoute && (
        <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-500/30 dark:border-sky-500/30 dark:bg-sky-950/40 shadow-lg animate-fade-in space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Route className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
                    {lang === 'fr' ? 'Itinéraire Piéton Hors-Ligne (Dijkstra)' : 'Offline Walking Route (Dijkstra)'}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 font-mono font-medium border border-sky-500/20">
                    100% Hors-Ligne
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{activeRoute.fromName}</span>
                  <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0" />
                  <span className="font-medium text-sky-500">{activeRoute.toName}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowRouteDetails(!showRouteDetails)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center"
                title={showRouteDetails ? 'Masquer les étapes' : 'Afficher les étapes'}
              >
                {showRouteDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={handleClearRoute}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center"
                title={lang === 'fr' ? 'Fermer l’itinéraire' : 'Close route'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Key metrics grid */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800">
              <span className="text-[10px] text-neutral-500 block mb-0.5">{lang === 'fr' ? 'Distance totale' : 'Total distance'}</span>
              <span className="text-sm font-semibold font-mono text-neutral-900 dark:text-white">~{activeRoute.totalDistanceMeters} m</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800">
              <span className="text-[10px] text-neutral-500 block mb-0.5">{lang === 'fr' ? 'Temps estimé' : 'Est. walking'}</span>
              <span className="text-sm font-semibold font-mono text-neutral-900 dark:text-white">~{activeRoute.estimatedMinutes} min</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800">
              <span className="text-[10px] text-neutral-500 block mb-0.5">{lang === 'fr' ? 'Passages clés' : 'Waypoints'}</span>
              <span className="text-sm font-semibold font-mono text-neutral-900 dark:text-white">{activeRoute.waypoints.length} repères</span>
            </div>
          </div>

          {/* Step by step directions */}
          {showRouteDetails && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider px-1">
                {lang === 'fr' ? 'Feuille de guidage pas-à-pas' : 'Step-by-step guidance'}
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {activeRoute.instructions.map((step, idx) => (
                  <div
                    key={`step_${idx}`}
                    className="flex items-start gap-2.5 p-2 rounded-xl bg-white/50 dark:bg-neutral-900/50 border border-neutral-200/50 dark:border-neutral-800/50 text-xs"
                  >
                    <span className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-neutral-800 dark:text-neutral-200 font-medium">
                        {step.instruction}
                      </p>
                      {step.distanceMeters > 0 && (
                        <span className="text-[10px] text-neutral-500 font-mono">
                          ~{step.distanceMeters} m
                        </span>
                      )}
                    </div>
                    {step.type === 'bridge' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-medium border border-sky-500/30 shrink-0">
                        Passerelle Fleuve
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Share & Feedback */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              {routeShareFeedback || ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleShareRouteViaMesh(activeRoute)}
                className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition shadow-xs active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{lang === 'fr' ? 'Diffuser l’itinéraire via Mesh' : 'Broadcast route via Mesh'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Point Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
                  {lang === 'fr' ? 'Ajouter un repère d’urgence en cache' : 'Add emergency point to cache'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPoint} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-600 dark:text-neutral-400 mb-1 font-medium">
                  {lang === 'fr' ? 'Nom du repère ou nœud' : 'Name of point or node'}
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ex. Réserve d'eau - École Pasteur"
                  className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-neutral-600 dark:text-neutral-400 mb-1 font-medium">
                  {lang === 'fr' ? 'Catégorie' : 'Category'}
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as OfflinePointCategory)}
                  className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white font-medium min-h-[44px]"
                >
                  <option value="mesh_node">Nœud Mesh (Relais / Répétiteur)</option>
                  <option value="water">Point d’Eau Potable</option>
                  <option value="medical">Poste Médical / Premiers Secours</option>
                  <option value="power">Énergie Solaire / Recharge</option>
                  <option value="shelter">Refuge d’Accueil / Gymnase</option>
                  <option value="radio">Balise Radio PMR446 / Fréquence</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-600 dark:text-neutral-400 mb-1 font-medium">
                  {lang === 'fr' ? 'Description & Disponibilité' : 'Description & Availability'}
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="ex. Robinet extérieur gravitaire, débit vérifié aujourd'hui."
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-600 dark:text-neutral-400 mb-1 font-medium">
                  {lang === 'fr' ? 'Canal / Fréquence radio (Facultatif)' : 'Channel / Radio frequency (Optional)'}
                </label>
                <input
                  type="text"
                  value={newFreq}
                  onChange={(e) => setNewFreq(e.target.value)}
                  placeholder="ex. PMR446 Canal 7 ou Slot 868MHz"
                  className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white font-mono min-h-[44px]"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-[11px] flex items-center gap-2">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {lang === 'fr'
                    ? 'Ce repère sera sauvegardé dans le stockage local permanent (IndexedDB/Cache) et restera disponible 100% hors-ligne.'
                    : 'This point will be saved into local permanent storage (IndexedDB/Cache) and remains accessible 100% offline.'}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {lang === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs"
                >
                  {lang === 'fr' ? 'Enregistrer le repère' : 'Save point'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Route Planner Modal */}
      {isRouteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-sky-500" />
                <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
                  {lang === 'fr' ? 'Planificateur d’itinéraire hors-ligne' : 'Offline Route Planner'}
                </h3>
              </div>
              <button
                onClick={() => setIsRouteModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-600 dark:text-neutral-400 mb-1 font-medium">
                  {lang === 'fr' ? 'Point de départ' : 'Origin / Departure'}
                </label>
                <select
                  value={selectedOriginId}
                  onChange={(e) => setSelectedOriginId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white font-medium min-h-[44px]"
                >
                  <option value="user">
                    {lang === 'fr' ? '📍 Votre position actuelle (Nœud local)' : '📍 Your current position (Local node)'}
                  </option>
                  {points.map((p) => (
                    <option key={`orig_${p.id}`} value={p.id}>
                      {p.name} ({getCategoryMeta(p.category).label})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-neutral-600 dark:text-neutral-400 mb-1 font-medium">
                  {lang === 'fr' ? 'Destination' : 'Destination'}
                </label>
                <select
                  value={selectedDestId}
                  onChange={(e) => setSelectedDestId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white font-medium min-h-[44px]"
                >
                  {points.map((p) => (
                    <option key={`dest_${p.id}`} value={p.id}>
                      {p.name} ({getCategoryMeta(p.category).label})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200">
                  <Milestone className="w-3.5 h-3.5 text-sky-500" />
                  <span>{lang === 'fr' ? 'Algorithme Dijkstra embarqué' : 'Embedded Dijkstra Algorithm'}</span>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {lang === 'fr'
                    ? 'Le calcul s’exécute instantanément en mémoire locale sur le graphe de voirie sans aucune requête serveur ni accès Internet requis.'
                    : 'Calculation executes instantaneously in local memory on the sector path graph with zero server requests or internet required.'}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRouteModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {lang === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedDestId) {
                      calculateRouteBetween(selectedOriginId, selectedDestId);
                    }
                  }}
                  disabled={!selectedDestId}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-xs flex items-center gap-2"
                >
                  <Footprints className="w-4 h-4" />
                  <span>{lang === 'fr' ? 'Calculer le trajet' : 'Calculate Route'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
