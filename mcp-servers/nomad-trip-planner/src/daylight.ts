import { toDeg, toRad } from "./geo.js";

export interface DaylightSummary {
  date: string;
  sunrise_utc: string;
  sunset_utc: string;
  solar_noon_utc: string;
  day_length_minutes: number;
  golden_hour_evening_utc: { start: string; end: string };
  golden_hour_morning_utc: { start: string; end: string };
}

/**
 * NOAA solar position approximation. Accurate to within ~1 minute for most
 * mid-latitudes — good enough for "when is sunset" on a day trip. No deps.
 *
 * Reference: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 */
export function computeDaylight(lat: number, lng: number, date: string): DaylightSummary {
  const { year, month, day } = parseDate(date);
  const n = dayOfYear(year, month, day);

  // Fractional year in radians
  const gamma = ((2 * Math.PI) / 365) * (n - 1);

  // Equation of time in minutes
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Solar declination in radians
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latRad = toRad(lat);

  // Hour angle for sunrise/sunset (zenith = 90.833° accounts for refraction)
  const zenith = toRad(90.833);
  const cosH =
    (Math.cos(zenith) - Math.sin(latRad) * Math.sin(decl)) / (Math.cos(latRad) * Math.cos(decl));

  let sunriseMinutes: number;
  let sunsetMinutes: number;
  if (cosH > 1) {
    // Polar night — sun never rises
    sunriseMinutes = 0;
    sunsetMinutes = 0;
  } else if (cosH < -1) {
    // Midnight sun — sun never sets
    sunriseMinutes = 0;
    sunsetMinutes = 1440;
  } else {
    const ha = toDeg(Math.acos(cosH));
    sunriseMinutes = 720 - 4 * (lng + ha) - eqTime;
    sunsetMinutes = 720 - 4 * (lng - ha) - eqTime;
  }
  const noonMinutes = 720 - 4 * lng - eqTime;

  // Golden hour — civil definition uses sun at -4° to +6°, but for "nice light"
  // the common rule is the hour after sunrise and before sunset.
  const toIso = (mins: number) => minutesToIsoUtc(year, month, day, mins);
  return {
    date,
    sunrise_utc: toIso(sunriseMinutes),
    sunset_utc: toIso(sunsetMinutes),
    solar_noon_utc: toIso(noonMinutes),
    day_length_minutes: Math.round(sunsetMinutes - sunriseMinutes),
    golden_hour_morning_utc: {
      start: toIso(sunriseMinutes),
      end: toIso(sunriseMinutes + 60),
    },
    golden_hour_evening_utc: {
      start: toIso(sunsetMinutes - 60),
      end: toIso(sunsetMinutes),
    },
  };
}

function parseDate(iso: string): { year: number; month: number; day: number } {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Expected YYYY-MM-DD, got "${iso}"`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function dayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 0);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86_400_000);
}

function minutesToIsoUtc(year: number, month: number, day: number, minutes: number): string {
  const base = Date.UTC(year, month - 1, day);
  const ts = base + Math.round(minutes * 60_000);
  return new Date(ts).toISOString();
}
