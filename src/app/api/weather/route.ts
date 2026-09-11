import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  let lat = req.nextUrl.searchParams.get("lat");
  let lon = req.nextUrl.searchParams.get("lon");

  if (!lat || !lon) {
    const user = await getSessionUser();
    if (user) {
      const saved = await prisma.user.findUnique({
        where: { id: user.id },
        select: { weatherLat: true, weatherLon: true },
      });
      if (saved?.weatherLat != null && saved?.weatherLon != null) {
        lat = String(saved.weatherLat);
        lon = String(saved.weatherLon);
      }
    }
  }

  // Valider/normaliser les coordonnées (empêche l'injection de paramètres dans
  // les URL en aval et les valeurs hors bornes).
  const nlat = Number(lat);
  const nlon = Number(lon);
  const latNum = Number.isFinite(nlat) && nlat >= -90 && nlat <= 90 ? nlat : 48.8566;
  const lonNum = Number.isFinite(nlon) && nlon >= -180 && nlon <= 180 ? nlon : 2.3522;

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", String(latNum));
  weatherUrl.searchParams.set("longitude", String(lonNum));
  weatherUrl.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m");
  weatherUrl.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
  weatherUrl.searchParams.set("timezone", "auto");
  weatherUrl.searchParams.set("forecast_days", "4");

  const geoUrlObj = new URL("https://nominatim.openstreetmap.org/reverse");
  geoUrlObj.searchParams.set("lat", String(latNum));
  geoUrlObj.searchParams.set("lon", String(lonNum));
  geoUrlObj.searchParams.set("format", "json");
  geoUrlObj.searchParams.set("zoom", "10");
  geoUrlObj.searchParams.set("accept-language", "fr");
  const geoUrl = geoUrlObj.toString();

  const [weatherRes, geoRes] = await Promise.all([
    fetch(weatherUrl.toString(), { next: { revalidate: 1800 } }),
    fetch(geoUrl, { next: { revalidate: 86400 }, headers: { "User-Agent": "MindDump/1.0" } }),
  ]);

  if (!weatherRes.ok) {
    return NextResponse.json({ error: "weather fetch failed" }, { status: 502 });
  }

  const weather = await weatherRes.json();

  let city: string | null = null;
  if (geoRes.ok) {
    const geo = await geoRes.json();
    city = geo.address?.city || geo.address?.town || geo.address?.village || geo.address?.municipality || null;
  }

  return NextResponse.json({ ...weather, city });
}
