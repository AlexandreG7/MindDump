import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat") || "48.8566";
  const lon = req.nextUrl.searchParams.get("lon") || "2.3522";

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "4");

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) {
    return NextResponse.json({ error: "weather fetch failed" }, { status: 502 });
  }

  return NextResponse.json(await res.json());
}
