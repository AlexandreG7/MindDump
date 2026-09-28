"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2Off, RefreshCw, Rss } from "lucide-react";

/** Flux .ics personnel à ajouter dans Apple Calendar, Google Agenda ou Outlook. */
export function FeedExportButton() {
  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedCopied, setFeedCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/calendar/feed")
      .then((r) => r.json())
      .then((data) => {
        if (data?.token) setFeedToken(data.token);
      })
      .catch(() => {});
  }, []);

  const generateFeedToken = async () => {
    setFeedLoading(true);
    const res = await fetch("/api/calendar/feed", { method: "POST" });
    const data = await res.json();
    setFeedToken(data.token);
    setFeedLoading(false);
  };

  const revokeFeedToken = async () => {
    await fetch("/api/calendar/feed", { method: "DELETE" });
    setFeedToken(null);
    setMenuOpen(false);
  };

  const feedUrl = feedToken && typeof window !== "undefined" ? `${window.location.origin}/api/calendar/feed/${feedToken}` : "";

  const copyFeedUrl = () => {
    navigator.clipboard.writeText(feedUrl);
    setFeedCopied(true);
    setTimeout(() => setFeedCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={() => (feedToken ? setMenuOpen((v) => !v) : generateFeedToken())}
        disabled={feedLoading}
        className={`p-2 rounded-lg transition-colors ${
          feedToken ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-secondary"
        }`}
        title="Exporter vers Apple Calendar"
      >
        <Rss className="h-4 w-4" />
      </button>
      {menuOpen && feedToken && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-popover border border-border rounded-xl shadow-lg p-4 space-y-3">
            <p className="text-sm font-medium">Exporter le calendrier</p>
            <p className="text-xs text-muted-foreground">
              Exporte tes événements MindDump vers Apple Calendar, Google Calendar ou Outlook.
            </p>
            <button
              onClick={() => {
                window.open(feedUrl.replace(/^https?:\/\//, "webcal://"), "_self");
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Rss className="h-3.5 w-3.5" />
              Ouvrir dans Apple Calendar
            </button>
            <div className="flex gap-2">
              <input
                readOnly
                value={feedUrl}
                className="flex-1 text-xs bg-secondary/50 border border-border rounded-lg px-2 py-1.5 font-mono truncate"
              />
              <button
                aria-label={feedCopied ? "Lien copié" : "Copier le lien"}
                onClick={copyFeedUrl}
                className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                  feedCopied ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                }`}
              >
                {feedCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="flex gap-2 pt-1 border-t border-border">
              <button
                onClick={() => generateFeedToken()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Régénérer
              </button>
              <button
                onClick={revokeFeedToken}
                className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
              >
                <Link2Off className="h-3 w-3" />
                Révoquer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
