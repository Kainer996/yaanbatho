import { computeDaylight } from "./daylight.js";
import {
  estimateDriveMinutes,
  haversineKm,
  mapsDirectionsLink,
  mapsSearchLink,
  type LatLng,
} from "./geo.js";
import type { Parkup, ParkupProvider } from "./parkups.js";
import type { WeatherProvider, WeatherSummary } from "./weather.js";

export interface PlanDayTripInput {
  origin: LatLng;
  max_drive_minutes: number;
  vibe?: string;
  date: string;
  overnight?: boolean;
  limit?: number;
}

export interface TripCandidate {
  destination: Parkup;
  distance_km: number;
  drive_minutes: number;
  fits_time_budget: boolean;
  weather: WeatherSummary;
  daylight: ReturnType<typeof computeDaylight>;
  maps_search: string;
  maps_directions: string;
  why_it_fits: string[];
  score: number;
}

export interface PlanDayTripResult {
  input: PlanDayTripInput;
  generated_at: string;
  candidates: TripCandidate[];
  top_pick_id: string | null;
}

const ANCHOR_RADIUS_KM_PER_MIN = 1.0; // rough: 60 km/h -> 1 km per min, then halved for meander

export async function planDayTrip(
  input: PlanDayTripInput,
  deps: { parkups: ParkupProvider; weather: WeatherProvider }
): Promise<PlanDayTripResult> {
  const radiusKm = Math.max(8, input.max_drive_minutes * ANCHOR_RADIUS_KM_PER_MIN);
  const nearby = await deps.parkups.findNearby({
    near: input.origin,
    radius_km: radiusKm,
    overnight: input.overnight,
    vibe: input.vibe,
  });

  // If the vibe filter returned nothing, fall back to unfiltered within radius.
  const pool = nearby.length > 0 ? nearby : await deps.parkups.findNearby({
    near: input.origin,
    radius_km: radiusKm,
  });

  // Rank by drive-time fit first, then grab the top-N for weather lookup.
  const shortlisted = pool
    .map((p) => {
      const dest = { lat: p.lat, lng: p.lng };
      return {
        parkup: p,
        distance_km: haversineKm(input.origin, dest),
        drive_minutes: estimateDriveMinutes(input.origin, dest),
      };
    })
    .filter((c) => c.drive_minutes <= input.max_drive_minutes * 1.15) // small over-budget tolerance
    .sort((a, b) => a.drive_minutes - b.drive_minutes)
    .slice(0, Math.max(1, input.limit ?? 3));

  const candidates: TripCandidate[] = [];
  for (const c of shortlisted) {
    const [weather, daylight] = await Promise.all([
      deps.weather.forecast(c.parkup.lat, c.parkup.lng, input.date),
      Promise.resolve(computeDaylight(c.parkup.lat, c.parkup.lng, input.date)),
    ]);
    const fits = c.drive_minutes <= input.max_drive_minutes;
    const reasons: string[] = [
      `${c.drive_minutes} min drive (${c.distance_km.toFixed(1)} km great-circle)`,
      `Weather: ${weather.headline}`,
      `Best 3-hour window: ${weather.best_window.start_hour.toString().padStart(2, "0")}:00–${weather.best_window.end_hour.toString().padStart(2, "0")}:00 — ${weather.best_window.rationale}`,
      `Sunset ${weather.date} at ${daylight.sunset_utc.slice(11, 16)} UTC`,
      `Parkup: ${c.parkup.notes}`,
    ];
    if (input.vibe && c.parkup.vibe.includes(input.vibe)) {
      reasons.unshift(`Matches your '${input.vibe}' vibe`);
    }
    // Score: lower drive + better weather window + vibe match.
    const vibeBonus = input.vibe && c.parkup.vibe.includes(input.vibe) ? 15 : 0;
    const overnightBonus = input.overnight && c.parkup.overnight ? 10 : 0;
    const score =
      weather.best_window.score * 2 -
      c.drive_minutes * 0.2 +
      vibeBonus +
      overnightBonus -
      (fits ? 0 : 25);
    candidates.push({
      destination: c.parkup,
      distance_km: Number(c.distance_km.toFixed(2)),
      drive_minutes: c.drive_minutes,
      fits_time_budget: fits,
      weather,
      daylight,
      maps_search: mapsSearchLink(
        { lat: c.parkup.lat, lng: c.parkup.lng },
        c.parkup.name
      ),
      maps_directions: mapsDirectionsLink(input.origin, {
        lat: c.parkup.lat,
        lng: c.parkup.lng,
      }),
      why_it_fits: reasons,
      score: Number(score.toFixed(2)),
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  return {
    input,
    generated_at: new Date().toISOString(),
    candidates,
    top_pick_id: candidates[0]?.destination.id ?? null,
  };
}

export function renderQuickBrief(candidate: TripCandidate): string {
  const sunsetLocal = candidate.daylight.sunset_utc.slice(11, 16);
  const w = candidate.weather;
  const p = candidate.destination;
  const vibe = p.vibe.slice(0, 2).join(" and ");
  return [
    `Here's the plan. ${p.name} in ${p.region}.`,
    `About ${candidate.drive_minutes} minutes from where you are.`,
    `Weather today is ${w.headline.toLowerCase()} The best window looks like ${w.best_window.start_hour}:00 to ${w.best_window.end_hour}:00, averaging ${w.best_window.avg_temp_c} degrees.`,
    `Sunset is around ${sunsetLocal} UTC so you've got daylight.`,
    `Parkup notes: ${p.notes}`,
    `Best for ${p.best_for}. It's a ${vibe} spot. Directions are in your Maps app.`,
  ].join(" ");
}
