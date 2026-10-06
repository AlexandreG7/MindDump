"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Mail, Send, Smartphone } from "lucide-react";
import {
  currentSubscription,
  pushSupport,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSupport,
} from "@/lib/pushClient";
import { isNativeApp, nativePlatform } from "@/lib/native";
import {
  cancelAllLocalReminders,
  localRemindersAvailable,
  reminderPermissionStatus,
  requestReminderPermission,
  syncLocalReminders,
} from "@/lib/localReminders";

type Prefs = { notifyEmail: boolean; notifyReminders: boolean; pushPublicKey: string | null };

function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function Row({
  icon: Icon,
  active,
  label,
  description,
  action,
  children,
}: {
  icon: typeof Bell;
  active: boolean;
  label: string;
  description: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 px-1">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            active ? "bg-primary/10" : "bg-secondary"
          }`}
        >
          <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-medium ${!active ? "text-muted-foreground" : ""}`}>{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          {action}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">{children}</div>
    </div>
  );
}

/** Section « Rappels » du profil : e-mail, et notifications sur cet appareil. */
export function NotificationSettings() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [denied, setDenied] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Dans l'app native, le Web Push n'est pas disponible : les rappels passent
  // par des notifications locales programmées depuis l'app
  // (docs/app-mobile.md, étape 3.3).
  const [native, setNative] = useState(false);
  const [remindersAvailable, setRemindersAvailable] = useState(false);
  const [remindersPermission, setRemindersPermission] = useState<string | null>(null);
  const [remindersBusy, setRemindersBusy] = useState(false);

  const refreshDevice = useCallback(async () => {
    const s = pushSupport();
    setSupport(s);
    if (s !== "supported") return;
    setDenied(Notification.permission === "denied");
    setSubscribed(!!(await currentSubscription().catch(() => null)));
  }, []);

  const refreshRemindersPermission = useCallback(async () => {
    if (!localRemindersAvailable()) return;
    setRemindersPermission(await reminderPermissionStatus());
  }, []);

  useEffect(() => {
    fetch("/api/users/me/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then(setPrefs)
      .catch(() => {});
    setNative(isNativeApp());
    setRemindersAvailable(localRemindersAvailable());
    refreshDevice();
    refreshRemindersPermission();
  }, [refreshDevice, refreshRemindersPermission]);

  const setNotifyEmail = async (notifyEmail: boolean) => {
    setPrefs((p) => (p ? { ...p, notifyEmail } : p));
    const res = await fetch("/api/users/me/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyEmail }),
    }).catch(() => null);
    if (!res?.ok) setPrefs((p) => (p ? { ...p, notifyEmail: !notifyEmail } : p));
  };

  // Interrupteur « Rappels sur ce téléphone » : notifications locales de
  // l'app, gardées derrière `User.notifyReminders`. L'activer est le bon
  // moment pour demander l'autorisation (explicitement ici). Elle peut aussi
  // être demandée par `schedule()` à la première synchronisation après
  // connexion, s'il existe des rappels et que le statut est encore indéterminé.
  const setNotifyReminders = async (notifyReminders: boolean) => {
    setPrefs((p) => (p ? { ...p, notifyReminders } : p));
    setRemindersBusy(true);
    const res = await fetch("/api/users/me/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyReminders }),
    }).catch(() => null);
    if (!res?.ok) {
      setPrefs((p) => (p ? { ...p, notifyReminders: !notifyReminders } : p));
      setRemindersBusy(false);
      return;
    }
    if (notifyReminders) {
      await requestReminderPermission();
      await refreshRemindersPermission();
      await syncLocalReminders();
    } else {
      await cancelAllLocalReminders();
    }
    setRemindersBusy(false);
  };

  const setDevicePush = async (enabled: boolean) => {
    if (!prefs?.pushPublicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      if (enabled) await subscribeToPush(prefs.pushPublicKey);
      else await unsubscribeFromPush();
    } catch (error) {
      setMessage(
        (error as Error).message === "permission"
          ? "Notifications refusées : autorise-les dans les réglages du navigateur."
          : "Impossible d'activer les notifications sur cet appareil."
      );
    }
    await refreshDevice();
    setBusy(false);
  };

  const sendTest = async () => {
    setMessage(null);
    const res = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
    const result = res?.ok ? await res.json() : null;
    if (!result?.delivered) setMessage("La notification d'essai n'a pas pu être envoyée.");
  };

  if (!prefs) return null;

  const deviceDescription =
    support === "ios-install"
      ? "Sur iPhone, ajoute d'abord MindDump à l'écran d'accueil (Partager → Sur l'écran d'accueil)."
      : support === "unsupported"
        ? "Ce navigateur ne gère pas les notifications."
        : denied
          ? "Notifications bloquées : autorise-les dans les réglages du navigateur."
          : "Rappels des tâches et événements, même app fermée.";

  const remindersDenied = remindersPermission === "denied";
  const isAndroid = nativePlatform() === "android";
  // Lien vers les réglages de l'app : schéma iOS `app-settings:`, ouvert hors
  // de la page par la coque. Sur Android, un lien `intent:` n'est pas suivi par
  // la WebView de Capacitor (testé) : seul le chemin est indiqué.
  const remindersDescription = remindersDenied
    ? isAndroid
      ? "Rappels bloqués : autorise-les dans Paramètres → Applications → MindDump → Notifications."
      : "Rappels bloqués : autorise-les dans Réglages → MindDump → Notifications."
    : "Rappels des tâches et événements, même app fermée.";

  return (
    <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Rappels</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-1">
        Comment recevoir les rappels des tâches et événements qui en ont un.
      </p>

      <div className="space-y-1">
        <Row
          icon={Mail}
          active={prefs.notifyEmail}
          label="Par e-mail"
          description="Un e-mail à chaque rappel."
        >
          <Switch checked={prefs.notifyEmail} onChange={setNotifyEmail} label="Rappels par e-mail" />
        </Row>

        {prefs.pushPublicKey && !native && (
          <Row
            icon={Smartphone}
            active={subscribed}
            label="Sur cet appareil"
            description={deviceDescription}
          >
            {subscribed && (
              <button
                onClick={sendTest}
                title="Envoyer une notification d'essai"
                aria-label="Envoyer une notification d'essai"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
            <Switch
              checked={subscribed}
              disabled={busy || support !== "supported" || (denied && !subscribed)}
              onChange={setDevicePush}
              label="Notifications sur cet appareil"
            />
          </Row>
        )}

        {native && remindersAvailable && (
          <Row
            icon={BellRing}
            active={prefs.notifyReminders}
            label="Sur ce téléphone"
            description={remindersDescription}
            action={
              remindersDenied && !isAndroid ? (
                <a href="app-settings:" className="inline-block py-2 text-xs font-medium text-primary underline">
                  Ouvrir les réglages
                </a>
              ) : undefined
            }
          >
            <Switch
              checked={prefs.notifyReminders}
              disabled={remindersBusy}
              onChange={setNotifyReminders}
              label="Rappels sur ce téléphone"
            />
          </Row>
        )}
      </div>

      {message && <p className="text-xs text-destructive">{message}</p>}
    </section>
  );
}
