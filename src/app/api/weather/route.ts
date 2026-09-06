import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat") || "48.8566";
  const lon = req.nextUrl.searchParams.get("lon") || "2.3522";

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", lat);
  weatherUrl.searchParams.set("longitude", lon);
  weatherUrl.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m");
  weatherUrl.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
  weatherUrl.searchParams.set("timezone", "auto");
  weatherUrl.searchParams.set("forecast_days", "4");

  const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&accept-language=fr`;

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
