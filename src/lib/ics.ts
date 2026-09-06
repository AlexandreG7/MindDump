export interface ICSEvent {
  uid: string;
  title: string;
  description: string | null;
  date: Date;
  endDate: Date | null;
  allDay: boolean;
}

function parseICSDate(value: string, params: string): { date: Date; allDay: boolean } {
  const allDay = params.includes("VALUE=DATE") && !params.includes("VALUE=DATE-TIME");
  const clean = value.replace(/[Z\-:]/g, "");

  if (allDay) {
    const y = parseInt(clean.slice(0, 4));
    const m = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    return { date: new Date(Date.UTC(y, m, d)), allDay: true };
  }

  const y = parseInt(clean.slice(0, 4));
  const m = parseInt(clean.slice(4, 6)) - 1;
  const d = parseInt(clean.slice(6, 8));
  const h = parseInt(clean.slice(9, 11)) || 0;
  const min = parseInt(clean.slice(11, 13)) || 0;
  const s = parseInt(clean.slice(13, 15)) || 0;

  if (value.endsWith("Z")) {
    return { date: new Date(Date.UTC(y, m, d, h, min, s)), allDay: false };
  }
  return { date: new Date(y, m, d, h, min, s), allDay: false };
}

function unfoldLines(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

function unescapeICS(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export function parseICS(icsText: string): ICSEvent[] {
  const lines = unfoldLines(icsText);
  const events: ICSEvent[] = [];
  let inEvent = false;
  let current: Partial<ICSEvent> & { dtStartParams?: string } = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current.title && current.date) {
        events.push({
          uid: current.uid || crypto.randomUUID(),
          title: current.title,
          description: current.description ?? null,
          date: current.date,
          endDate: current.endDate ?? null,
          allDay: current.allDay ?? false,
        });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx);
    const value = trimmed.slice(colonIdx + 1);
    const baseProp = key.split(";")[0].toUpperCase();
    const params = key.toUpperCase();

    switch (baseProp) {
      case "UID":
        current.uid = value;
        break;
      case "SUMMARY":
        current.title = unescapeICS(value);
        break;
      case "DESCRIPTION":
        current.description = unescapeICS(value);
        break;
      case "DTSTART": {
        const parsed = parseICSDate(value, params);
        current.date = parsed.date;
        current.allDay = parsed.allDay;
        break;
      }
      case "DTEND": {
        const parsed = parseICSDate(value, params);
        current.endDate = parsed.date;
        break;
      }
    }
  }

  return events;
}

export async function fetchICSEvents(url: string): Promise<ICSEvent[]> {
  const fetchUrl = url.replace(/^webcal:\/\//, "https://");
  const res = await fetch(fetchUrl, {
    headers: { "User-Agent": "MindDump/1.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Failed to fetch ICS: ${res.status}`);
  const text = await res.text();
  return parseICS(text);
}
