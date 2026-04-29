import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { haversineKm, type LatLng } from "./geo.js";

const here = dirname(fileURLToPath(import.meta.url));
const defaultFixturePath = resolve(here, "..", "fixtures", "parkups.sample.json");

export interface Parkup {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  vibe: string[];
  terrain: string;
  surface: string;
  height_limit_m: number | null;
  overnight: boolean;
  day_parking_free: boolean;
  facilities: string[];
  notes: string;
  best_for: string;
}

export interface ParkupQuery {
  near: LatLng;
  radius_km: number;
  overnight?: boolean;
  vibe?: string;
}

export interface ParkupProvider {
  readonly id: string;
  findNearby(query: ParkupQuery): Promise<Parkup[]>;
  all(): Promise<Parkup[]>;
}

/**
 * Offline-first fixture provider. Reads the bundled sample JSON and filters in-memory.
 * Guarantees the server always returns something real on first run — no API keys needed.
 */
export class FixtureParkupProvider implements ParkupProvider {
  readonly id = "fixture";
  private readonly parkups: Parkup[];

  constructor(path?: string) {
    const target = path ?? process.env.NOMAD_PARKUP_FIXTURE ?? defaultFixturePath;
    const raw = readFileSync(target, "utf8");
    const parsed = JSON.parse(raw) as { parkups: Parkup[] };
    this.parkups = parsed.parkups;
  }

  async all(): Promise<Parkup[]> {
    return this.parkups;
  }

  async findNearby(query: ParkupQuery): Promise<Parkup[]> {
    return this.parkups
      .filter((p) => haversineKm({ lat: p.lat, lng: p.lng }, query.near) <= query.radius_km)
      .filter((p) => (query.overnight ? p.overnight : true))
      .filter((p) => (query.vibe ? p.vibe.includes(query.vibe) : true))
      .sort(
        (a, b) =>
          haversineKm({ lat: a.lat, lng: a.lng }, query.near) -
          haversineKm({ lat: b.lat, lng: b.lng }, query.near)
      );
  }
}

/**
 * Placeholder for future live provider integrations. Each returns a real {@link ParkupProvider}
 * once implemented — for now they throw with a clear message so the MCP server surfaces a
 * helpful error to the caller rather than silently falling back.
 */
export function makeIOverlanderProvider(): ParkupProvider {
  throw new Error(
    "iOverlander provider not yet wired. Keep NOMAD_PARKUP_PROVIDER=fixture for now."
  );
}

export function makePark4NightProvider(): ParkupProvider {
  throw new Error(
    "Park4Night provider not yet wired. Keep NOMAD_PARKUP_PROVIDER=fixture for now."
  );
}

export function makeGooglePlacesProvider(): ParkupProvider {
  throw new Error(
    "Google Places provider not yet wired. Keep NOMAD_PARKUP_PROVIDER=fixture for now."
  );
}

export function selectProvider(): ParkupProvider {
  const id = (process.env.NOMAD_PARKUP_PROVIDER ?? "fixture").toLowerCase();
  switch (id) {
    case "fixture":
      return new FixtureParkupProvider();
    case "ioverlander":
      return makeIOverlanderProvider();
    case "park4night":
      return makePark4NightProvider();
    case "google-places":
    case "google":
      return makeGooglePlacesProvider();
    default:
      throw new Error(`Unknown NOMAD_PARKUP_PROVIDER "${id}"`);
  }
}
