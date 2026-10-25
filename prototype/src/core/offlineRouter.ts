/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import { WalkingRoute, RouteWaypoint, RouteInstruction } from '../types';

export interface SectorNode {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface SectorEdge {
  from: string;
  to: string;
  type: 'path' | 'road' | 'bridge' | 'stairs';
  descriptionFr: string;
  descriptionEn: string;
}

// Walkable sector road & path network
export const SECTOR_JUNCTIONS: SectorNode[] = [
  { id: 'j_balise', name: 'Carrefour Balise Radio', x: 190, y: 140 },
  { id: 'j_nord_ouest', name: 'Carrefour Nord-Ouest', x: 200, y: 80 },
  { id: 'j_ouest_haut', name: 'Allée Ouest Haute', x: 200, y: 200 },
  { id: 'j_collines', name: 'Sentier des Collines', x: 350, y: 100 },
  { id: 'j_relais_boreal', name: 'Pylône Relais Boréal', x: 380, y: 220 },
  { id: 'j_fontaine', name: 'Place de la Fontaine d’Eau', x: 260, y: 310 },
  { id: 'j_ouest_bas', name: 'Sentier Ouest Bas', x: 200, y: 310 },
  { id: 'j_sud_ouest', name: 'Carrefour Sud-Ouest', x: 260, y: 440 },
  { id: 'j_centre_nord', name: 'Avenue du Centre-Nord', x: 450, y: 140 },
  { id: 'j_medical', name: 'Parvis Poste Médical', x: 510, y: 160 },
  { id: 'j_centre', name: 'Place Centrale (Nœud Local)', x: 450, y: 280 },
  { id: 'j_passerelle_nord', name: 'Tête Nord Passerelle du Fleuve', x: 450, y: 330 },
  { id: 'j_passerelle_sud', name: 'Tête Sud Passerelle du Fleuve', x: 450, y: 375 },
  { id: 'j_refuge', name: 'Esplanade Gymnase Refuge', x: 440, y: 440 },
  { id: 'j_sud_parc', name: 'Parc Sud', x: 450, y: 530 },
  { id: 'j_est_centre', name: 'Carrefour Est-Centre', x: 620, y: 280 },
  { id: 'j_passerelle_wan', name: 'Pont Passerelle Sud (WAN)', x: 620, y: 380 },
  { id: 'j_solaire', name: 'Station Solaire de Recharge', x: 730, y: 250 },
  { id: 'j_est_haut', name: 'Chemin de Ronde Est', x: 620, y: 140 },
  { id: 'j_est_bas', name: 'Allée Est du Marais', x: 740, y: 400 }
];

export const SECTOR_EDGES: SectorEdge[] = [
  // Western sector
  { from: 'j_nord_ouest', to: 'j_balise', type: 'path', descriptionFr: 'Sentier Ouest vers la balise', descriptionEn: 'West path to radio beacon' },
  { from: 'j_balise', to: 'j_ouest_haut', type: 'path', descriptionFr: 'Allée ombragée', descriptionEn: 'Shaded avenue' },
  { from: 'j_nord_ouest', to: 'j_collines', type: 'path', descriptionFr: 'Montée des collines', descriptionEn: 'Hill climb path' },
  { from: 'j_collines', to: 'j_centre_nord', type: 'road', descriptionFr: 'Route des crêtes', descriptionEn: 'Ridge road' },
  { from: 'j_collines', to: 'j_relais_boreal', type: 'path', descriptionFr: 'Accès au pylône relais', descriptionEn: 'Relay tower access' },
  { from: 'j_ouest_haut', to: 'j_ouest_bas', type: 'road', descriptionFr: 'Avenue Principale Ouest', descriptionEn: 'Main West Avenue' },
  { from: 'j_ouest_bas', to: 'j_fontaine', type: 'road', descriptionFr: 'Allée de la Fontaine', descriptionEn: 'Fountain Alley' },
  { from: 'j_fontaine', to: 'j_centre', type: 'road', descriptionFr: 'Rue Traversière Centrale', descriptionEn: 'Central Cross street' },
  { from: 'j_fontaine', to: 'j_sud_ouest', type: 'path', descriptionFr: 'Sentier des berges', descriptionEn: 'Riverbank path' },
  { from: 'j_sud_ouest', to: 'j_refuge', type: 'path', descriptionFr: 'Allée des Refuges', descriptionEn: 'Shelter Avenue' },

  // Center sector
  { from: 'j_centre_nord', to: 'j_medical', type: 'road', descriptionFr: 'Allée Médicale', descriptionEn: 'Medical Lane' },
  { from: 'j_centre_nord', to: 'j_centre', type: 'road', descriptionFr: 'Avenue Centrale', descriptionEn: 'Central Avenue' },
  { from: 'j_relais_boreal', to: 'j_centre', type: 'path', descriptionFr: 'Sentier Boréal', descriptionEn: 'Boreal Trail' },
  { from: 'j_medical', to: 'j_centre', type: 'road', descriptionFr: 'Voie d’Urgence Médicale', descriptionEn: 'Emergency Medical Road' },
  { from: 'j_medical', to: 'j_est_haut', type: 'path', descriptionFr: 'Chemin Haut', descriptionEn: 'High Way' },
  { from: 'j_centre', to: 'j_passerelle_nord', type: 'road', descriptionFr: 'Descente vers le cours d’eau', descriptionEn: 'Descent to river' },

  // Bridge over the river
  { from: 'j_passerelle_nord', to: 'j_passerelle_sud', type: 'bridge', descriptionFr: 'Passerelle Piétonne Sécurisée au-dessus du Fleuve', descriptionEn: 'Secured Footbridge over River' },
  { from: 'j_passerelle_sud', to: 'j_refuge', type: 'road', descriptionFr: 'Parvis du Gymnase Refuge', descriptionEn: 'Shelter gym esplanade' },
  { from: 'j_refuge', to: 'j_sud_parc', type: 'path', descriptionFr: 'Traversée du Parc Sud', descriptionEn: 'South park crossing' },

  // Eastern sector
  { from: 'j_centre', to: 'j_est_centre', type: 'road', descriptionFr: 'Boulevard de l’Est', descriptionEn: 'East Boulevard' },
  { from: 'j_est_haut', to: 'j_solaire', type: 'path', descriptionFr: 'Chemin vers le Parc Solaire', descriptionEn: 'Path to Solar Park' },
  { from: 'j_est_centre', to: 'j_solaire', type: 'road', descriptionFr: 'Allée de l’Énergie Solaire', descriptionEn: 'Solar Energy Avenue' },
  { from: 'j_est_centre', to: 'j_passerelle_wan', type: 'road', descriptionFr: 'Route de la Passerelle Réseau', descriptionEn: 'Gateway Road' },
  { from: 'j_passerelle_sud', to: 'j_passerelle_wan', type: 'path', descriptionFr: 'Sentier de digue Sud', descriptionEn: 'South dyke path' },
  { from: 'j_passerelle_wan', to: 'j_est_bas', type: 'path', descriptionFr: 'Allée du Marais', descriptionEn: 'Marsh path' }
];

/**
 * Calculates Euclidean distance in approximated real-world meters
 * (Scale factor: 1 SVG unit ~ 2.2 meters in the sector grid)
 */
export function getDistanceMeters(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.round(Math.hypot(dx, dy) * 2.2);
}

/**
 * Finds the nearest sector network junction for any arbitrary coordinates
 */
export function findNearestJunction(x: number, y: number): SectorNode {
  let nearest = SECTOR_JUNCTIONS[0];
  let minDistance = Infinity;

  for (const j of SECTOR_JUNCTIONS) {
    const dist = Math.hypot(j.x - x, j.y - y);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = j;
    }
  }

  return nearest;
}

/**
 * Adjacency Graph representation for Dijkstra algorithm
 */
interface GraphNeighbor {
  nodeId: string;
  weight: number;
  edge: SectorEdge;
}

function buildAdjacencyGraph(): Map<string, GraphNeighbor[]> {
  const graph = new Map<string, GraphNeighbor[]>();

  SECTOR_JUNCTIONS.forEach((j) => graph.set(j.id, []));

  SECTOR_EDGES.forEach((edge) => {
    const fromNode = SECTOR_JUNCTIONS.find((j) => j.id === edge.from);
    const toNode = SECTOR_JUNCTIONS.find((j) => j.id === edge.to);

    if (fromNode && toNode) {
      const weight = getDistanceMeters(fromNode.x, fromNode.y, toNode.x, toNode.y);

      // Bidirectional walkable graph
      graph.get(edge.from)?.push({ nodeId: edge.to, weight, edge });
      graph.get(edge.to)?.push({ nodeId: edge.from, weight, edge });
    }
  });

  return graph;
}

/**
 * Offline Dijkstra Shortest-Path Calculator
 * Computes shortest walking route between any starting coordinates and destination
 * with zero server calls.
 */
export function calculateDijkstraRoute({
  startX,
  startY,
  startName,
  destX,
  destY,
  destName,
  lang = 'fr'
}: {
  startX: number;
  startY: number;
  startName: string;
  destX: number;
  destY: number;
  destName: string;
  lang?: 'fr' | 'en';
}): WalkingRoute | null {
  const startJunction = findNearestJunction(startX, startY);
  const destJunction = findNearestJunction(destX, destY);

  const graph = buildAdjacencyGraph();

  const distances = new Map<string, number>();
  const previous = new Map<string, { nodeId: string; edge?: SectorEdge } | null>();
  const unvisited = new Set<string>();

  SECTOR_JUNCTIONS.forEach((j) => {
    distances.set(j.id, Infinity);
    previous.set(j.id, null);
    unvisited.add(j.id);
  });

  distances.set(startJunction.id, 0);

  while (unvisited.size > 0) {
    // Pick unvisited node with lowest distance
    let currentId: string | null = null;
    let lowestDist = Infinity;

    unvisited.forEach((id) => {
      const dist = distances.get(id) ?? Infinity;
      if (dist < lowestDist) {
        lowestDist = dist;
        currentId = id;
      }
    });

    if (currentId === null || lowestDist === Infinity) {
      break; // All remaining nodes are unreachable
    }

    if (currentId === destJunction.id) {
      break; // Destination reached!
    }

    unvisited.delete(currentId);

    const neighbors = graph.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (!unvisited.has(neighbor.nodeId)) continue;

      const alt = lowestDist + neighbor.weight;
      if (alt < (distances.get(neighbor.nodeId) ?? Infinity)) {
        distances.set(neighbor.nodeId, alt);
        previous.set(neighbor.nodeId, { nodeId: currentId, edge: neighbor.edge });
      }
    }
  }

  // Reconstruct path
  const junctionPath: SectorNode[] = [];
  const traversedEdges: SectorEdge[] = [];

  let curr: string | null = destJunction.id;
  while (curr !== null) {
    const nodeObj = SECTOR_JUNCTIONS.find((j) => j.id === curr);
    if (nodeObj) junctionPath.unshift(nodeObj);

    const prevObj = previous.get(curr);
    if (prevObj?.edge) {
      traversedEdges.unshift(prevObj.edge);
    }
    curr = prevObj ? prevObj.nodeId : null;
  }

  if (junctionPath.length === 0 || junctionPath[0].id !== startJunction.id) {
    return null; // No route found
  }

  // Construct complete waypoints sequence:
  // [Exact Start] -> [Start Junction] -> [intermediate junctions] -> [Dest Junction] -> [Exact Dest]
  const waypoints: RouteWaypoint[] = [];

  // Start point
  waypoints.push({ x: startX, y: startY, name: startName, isStep: true });

  // Connect start to nearest junction if distance > 10m
  const startToJuncDist = getDistanceMeters(startX, startY, startJunction.x, startJunction.y);
  if (startToJuncDist > 15) {
    waypoints.push({ x: startJunction.x, y: startJunction.y, name: startJunction.name });
  }

  // Middle junctions
  junctionPath.forEach((j) => {
    // Avoid duplicate point
    const last = waypoints[waypoints.length - 1];
    if (!last || last.x !== j.x || last.y !== j.y) {
      waypoints.push({ x: j.x, y: j.y, name: j.name, isStep: true });
    }
  });

  // Connect dest junction to exact dest point if distance > 15m
  const juncToDestDist = getDistanceMeters(destJunction.x, destJunction.y, destX, destY);
  if (juncToDestDist > 15) {
    waypoints.push({ x: destX, y: destY, name: destName, isStep: true });
  }

  // Calculate total distance & SVG path string
  let totalDistanceMeters = 0;
  let svgPathD = '';

  for (let i = 0; i < waypoints.length; i++) {
    const pt = waypoints[i];
    if (i === 0) {
      svgPathD = `M ${pt.x} ${pt.y}`;
    } else {
      const prev = waypoints[i - 1];
      totalDistanceMeters += getDistanceMeters(prev.x, prev.y, pt.x, pt.y);
      svgPathD += ` L ${pt.x} ${pt.y}`;
    }
  }

  // Estimate walking time: 75 meters / minute (~4.5 km/h standard pedestrian pace)
  const estimatedMinutes = Math.max(1, Math.round(totalDistanceMeters / 75));

  // Build step-by-step human instructions
  const instructions: RouteInstruction[] = [];

  instructions.push({
    instruction: lang === 'fr'
      ? `Départ depuis « ${startName} » en direction de ${startJunction.name}.`
      : `Depart from "${startName}" heading toward ${startJunction.name}.`,
    distanceMeters: startToJuncDist,
    type: 'depart'
  });

  traversedEdges.forEach((edge) => {
    const desc = lang === 'fr' ? edge.descriptionFr : edge.descriptionEn;
    const isBridge = edge.type === 'bridge';
    const edgeLength = getDistanceMeters(
      SECTOR_JUNCTIONS.find((j) => j.id === edge.from)?.x || 0,
      SECTOR_JUNCTIONS.find((j) => j.id === edge.from)?.y || 0,
      SECTOR_JUNCTIONS.find((j) => j.id === edge.to)?.x || 0,
      SECTOR_JUNCTIONS.find((j) => j.id === edge.to)?.y || 0
    );

    instructions.push({
      instruction: desc,
      distanceMeters: edgeLength,
      type: isBridge ? 'bridge' : 'straight'
    });
  });

  instructions.push({
    instruction: lang === 'fr'
      ? `Arrivée à destination : « ${destName} ».`
      : `Arrival at destination: "${destName}".`,
    distanceMeters: juncToDestDist,
    type: 'arrive'
  });

  return {
    id: `route_${Date.now()}`,
    fromName: startName,
    toName: destName,
    totalDistanceMeters,
    estimatedMinutes,
    waypoints,
    instructions,
    svgPathD
  };
}
