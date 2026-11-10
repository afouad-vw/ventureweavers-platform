"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { recordCalendlyBooking } from "@/app/(member)/calendly-actions";

type CalendlyApi = { initPopupWidget: (o: { url: string; prefill?: Record<string, unknown>; utm?: Record<string, string> }) => void };
declare global {
  interface Window {
    Calendly?: CalendlyApi;
  }
}

const JS = "https://assets.calendly.com/assets/external/widget.js";
const CSS = "https://assets.calendly.com/assets/external/widget.css";
let loading: Promise<void> | null = null;
function loadCalendly() {
  if (window.Calendly) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    if (!document.querySelector(`link[href="${CSS}"]`)) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = CSS;
      document.head.appendChild(l);
    }
    const s = document.createElement("script");
    s.src = JS;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Calendly didn't load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** "Request a meeting" that opens Karim's Calendly with the member's details filled in, and records the booking. */
export function CalendlyButton({
  url,
  serviceId,
  serviceSlug,
  name,
  email,
  label = "Request a meeting",
  variant = "primary",
  size = "sm",
  className,
}: {
  url: string;
  serviceId: string;
  serviceSlug: string;
  name: string;
  email: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const active = useRef(false);

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (!active.current || e.origin !== "https://calendly.com") return;
      const data = e.data as { event?: string; payload?: { event?: { uri?: string }; invitee?: { uri?: string } } };
      if (data?.event !== "calendly.event_scheduled") return;
      active.current = false;
      const r = await recordCalendlyBooking(serviceId, data.payload?.event?.uri ?? "", data.payload?.invitee?.uri ?? "");
      toast(r.ok ? r.message : r.error);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [serviceId, toast]);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await loadCalendly();
          active.current = true;
          window.Calendly?.initPopupWidget({ url, prefill: { name, email }, utm: { utmSource: "ventureweavers", utmContent: serviceSlug } });
        } catch {
          toast("Calendly didn't open. Check your connection and try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <CalendarCheck size={15} aria-hidden="true" />
      {label}
    </Button>
  );
}
