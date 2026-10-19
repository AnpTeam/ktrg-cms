// What the API sends for GET /routes, /routes/{id} and /spots/{id} (see apps/api/src/content/content-service.ts).
// Declared here by hand because Eden types the JSON dates as Date; the times arrive as ISO text.

export interface PublicRoute {
  id: string;
  nameJa: string;
  nameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  difficulty: string | null;
  expectedTimeMin: number | null;
  prefecture: string | null;
  municipality: string | null;
  videoUrl: string | null;
  sortOrder: number;
  status: "ready" | "soon";
  publishedSpotCount: number;
  sketch: [number, number][] | null;
  line: { type: "LineString"; coordinates: [number, number, number?][] } | null;
  bounds: { west: number; south: number; east: number; north: number } | null;
}

export interface PublicSpot {
  id: string;
  routeId: string;
  nameJa: string;
  nameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  position: { lat: number; lng: number; verified: true } | null;
  radiusM: number;
  status: "open" | "caution" | "closed";
  statusNoteJa: string | null;
  statusNoteEn: string | null;
  statusUpdatedAt: string | null;
  sortOrder: number;
}
