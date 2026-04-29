import type { LatLng } from "./geo.js";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

export interface HourlyForecast {
  time: string;
  temperature_c: number;
  precipitation_mm: number;
  precipitation_probability: number;
  wind_kmh: number;
  cloud_cover_percent: number;
  weather_code: number;
}

export interface WeatherSummary {
  provider: string;
  lat: number;
  lng: number;
  date: string;
  hourly: HourlyForecast[];
  best_window: {
    start_hour: number;
    end_hour: number;
    avg_temp_c: number;
    total_precip_mm: number;
    score: number;
    rationale: string;
  };
  headline: string;
}

export interface WeatherProvider {
  readonly id: string;
  forecast(lat: number, lng: number, date: string): Promise<WeatherSummary>;
}

function pickBestWindow(hourly: HourlyForecast[]): WeatherSummary["best_window"] {
  // Score each contiguous 3-hour window. Lower precip, higher temp (capped), fewer clouds = better.
  let best = {
    start_hour: 10,
    end_hour: 13,
    avg_temp_c: 0,
    total_precip_mm: 0,
    score: -Infinity,
    rationale: "",
  };
  for (let i = 0; i <= hourly.length - 3; i++) {
    const slice = hourly.slice(i, i + 3);
    const avgTemp = slice.reduce((s, h) => s + h.temperature_c, 0) / 3;
    const precip = slice.reduce((s, h) => s + h.precipitation_mm, 0);
    const probs = slice.reduce((s, h) => s + h.precipitation_probability, 0) / 3;
    const clouds = slice.reduce((s, h) => s + h.cloud_cover_percent, 0) / 3;
    const wind = slice.reduce((s, h) => s + h.wind_kmh, 0) / 3;
    // Favour mid-teens -> low twenties; penalise rain, wind, cloud.
    const tempScore = -Math.abs(18 - avgTemp) * 0.6;
    const score = tempScore - precip * 4 - probs * 0.05 - clouds * 0.02 - wind * 0.05;
    if (score > best.score) {
      const startHour = Number(slice[0].time.slice(11, 13));
      const endHour = (startHour + 3) % 24;
      best = {
        start_hour: startHour,
        end_hour: endHour,
        avg_temp_c: Number(avgTemp.toFixed(1)),
        total_precip_mm: Number(precip.toFixed(1)),
        score: Number(score.toFixed(2)),
        rationale: `avg ${avgTemp.toFixed(1)}°C · ${precip.toFixed(1)}mm rain · ${clouds.toFixed(0)}% cloud · ${wind.toFixed(0)} km/h wind`,
      };
    }
  }
  return best;
}

function headline(hourly: HourlyForecast[]): string {
  if (hourly.length === 0) return "No forecast available.";
  const maxTemp = Math.max(...hourly.map((h) => h.temperature_c));
  const minTemp = Math.min(...hourly.map((h) => h.temperature_c));
  const totalPrecip = hourly.reduce((s, h) => s + h.precipitation_mm, 0);
  const maxWind = Math.max(...hourly.map((h) => h.wind_kmh));
  const dryish = totalPrecip < 0.5;
  const band = dryish
    ? totalPrecip === 0
      ? "dry"
      : "mostly dry"
    : totalPrecip < 3
      ? "some showers"
      : "wet";
  return `${minTemp.toFixed(0)}–${maxTemp.toFixed(0)}°C, ${band}, wind up to ${maxWind.toFixed(0)} km/h.`;
}

/**
 * Open-Meteo free, keyless provider. Public endpoint, no auth.
 * Docs: https://open-meteo.com/en/docs
 */
export class OpenMeteoProvider implements WeatherProvider {
  readonly id = "open-meteo";

  async forecast(lat: number, lng: number, date: string): Promise<WeatherSummary> {
    const url = new URL(OPEN_METEO_URL);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("start_date", date);
    url.searchParams.set("end_date", date);
    url.searchParams.set("timezone", "auto");
    url.searchParams.set(
      "hourly",
      [
        "temperature_2m",
        "precipitation",
        "precipitation_probability",
        "wind_speed_10m",
        "cloud_cover",
        "weather_code",
      ].join(",")
    );
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as {
      hourly: {
        time: string[];
        temperature_2m: number[];
        precipitation: number[];
        precipitation_probability: number[];
        wind_speed_10m: number[];
        cloud_cover: number[];
        weather_code: number[];
      };
    };
    const hourly: HourlyForecast[] = data.hourly.time.map((t, i) => ({
      time: t,
      temperature_c: data.hourly.temperature_2m[i],
      precipitation_mm: data.hourly.precipitation[i],
      precipitation_probability: data.hourly.precipitation_probability[i] ?? 0,
      wind_kmh: data.hourly.wind_speed_10m[i],
      cloud_cover_percent: data.hourly.cloud_cover[i] ?? 0,
      weather_code: data.hourly.weather_code[i] ?? 0,
    }));
    return {
      provider: this.id,
      lat,
      lng,
      date,
      hourly,
      best_window: pickBestWindow(hourly),
      headline: headline(hourly),
    };
  }
}

/**
 * Fully offline fallback — synthesises a plausible April forecast for the given
 * coordinate so the server runs end-to-end without network access. Handy for local
 * demos and CI. Not realistic weather, clearly labelled.
 */
export class FixtureWeatherProvider implements WeatherProvider {
  readonly id = "fixture";

  async forecast(lat: number, lng: number, date: string): Promise<WeatherSummary> {
    const hourly: HourlyForecast[] = Array.from({ length: 24 }, (_, h) => {
      const diurnal = Math.sin(((h - 6) / 24) * Math.PI * 2);
      const temp = 11 + diurnal * 5;
      const precip = h > 15 && h < 18 ? 0.4 : 0;
      return {
        time: `${date}T${String(h).padStart(2, "0")}:00`,
        temperature_c: Number(temp.toFixed(1)),
        precipitation_mm: precip,
        precipitation_probability: precip > 0 ? 45 : 10,
        wind_kmh: 12 + Math.abs(diurnal) * 8,
        cloud_cover_percent: 40 + Math.abs(diurnal) * 20,
        weather_code: precip > 0 ? 61 : 3,
      };
    });
    return {
      provider: this.id,
      lat,
      lng,
      date,
      hourly,
      best_window: pickBestWindow(hourly),
      headline: headline(hourly),
    };
  }
}

export function selectWeatherProvider(): WeatherProvider {
  const id = (process.env.NOMAD_WEATHER_PROVIDER ?? "open-meteo").toLowerCase();
  switch (id) {
    case "open-meteo":
      return new OpenMeteoProvider();
    case "fixture":
      return new FixtureWeatherProvider();
    default:
      throw new Error(`Unknown NOMAD_WEATHER_PROVIDER "${id}"`);
  }
}
