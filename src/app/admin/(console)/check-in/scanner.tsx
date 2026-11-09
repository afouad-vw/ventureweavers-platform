"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Camera, CameraOff, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import jsQR from "jsqr";
import { checkIn, type CheckInResult } from "@/app/admin/(console)/outloud/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/events/format";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

const CODE_RE = /VW-[A-Z0-9]{4}-[A-Z0-9]{4}/i;

/** Door check-in: scan the ticket QR with the camera, or type the code. */
export function CheckInScanner() {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CheckInResult | { error: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = useCallback((raw: string) => {
    const m = raw.toUpperCase().match(CODE_RE);
    const c = m ? m[0] : raw.trim().toUpperCase();
    if (!c) return;
    start(async () => setResult(await checkIn(c)));
  }, []);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!cameraOn) return;
    let raf = 0;
    let stopped = false;
    const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    const tick = async () => {
      if (stopped) return;
      const v = video.current;
      const c = canvas.current;
      if (v && c && v.readyState >= 2) {
        let found: string | null = null;
        try {
          if (detector) {
            const r = await detector.detect(v);
            found = r[0]?.rawValue ?? null;
          } else {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const ctx = c.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(v, 0, 0);
              const img = ctx.getImageData(0, 0, c.width, c.height);
              found = jsQR(img.data, img.width, img.height)?.data ?? null;
            }
          }
        } catch {
          /* keep scanning */
        }
        const m = found?.toUpperCase().match(CODE_RE);
        if (m) {
          const now = Date.now();
          // Ignore the same code for 4 seconds so one ticket isn't scanned twice by accident.
          if (!lastCode.current || lastCode.current.code !== m[0] || now - lastCode.current.at > 4000) {
            lastCode.current = { code: m[0], at: now };
            setCode(m[0]);
            submit(m[0]);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [cameraOn, submit]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
      setCameraOn(true);
    } catch {
      setCameraError("The camera isn't available. Allow camera access, or type the code below.");
    }
  };

  const r = result && "result" in result ? result : null;
  const tone = r?.result === "ok" ? "ok" : r?.result === "already" || r?.result === "unpaid" ? "warn" : r ? "bad" : null;
  const headline: Record<string, string> = {
    ok: "Checked in",
    already: "Already checked in",
    unpaid: "Not paid yet",
    not_found: "Ticket not found",
    cancelled: "Booking cancelled",
    expired: "Reservation expired",
    refunded: "Booking refunded",
  };

  return (
    <div className="grid gap-4 desk:grid-cols-2">
      <Card>
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-ink">
          <video ref={video} playsInline muted className={cn("h-full w-full object-cover", !cameraOn && "hidden")} />
          <canvas ref={canvas} className="hidden" />
          {!cameraOn ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-fg">
              <Camera size={32} aria-hidden="true" />
              <span className="text-[13px]">Point the camera at the ticket QR</span>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-teal/80" aria-hidden="true" />
          )}
        </div>
        {cameraOn ? (
          <Button variant="secondary" onClick={stop}><CameraOff size={15} aria-hidden="true" />Stop camera</Button>
        ) : (
          <Button onClick={startCamera}><Camera size={15} aria-hidden="true" />Start camera</Button>
        )}
        {cameraError ? <p className="text-[13px] font-bold text-bad-fg">{cameraError}</p> : null}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(code);
          }}
        >
          <TextField label="Or type the ticket code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VW-XXXX-XXXX" autoCapitalize="characters" spellCheck={false} className="flex-1" />
          <Button type="submit" disabled={pending || !code.trim()}>Check in</Button>
        </form>
      </Card>

      <Card className={cn(tone === "ok" && "border-teal bg-soft", tone === "warn" && "bg-warn-bg", tone === "bad" && "bg-bad-bg")} aria-live="polite">
        {pending ? <p className="text-[14px] text-faint">Checking…</p> : null}
        {!pending && result && "error" in result ? <p className="font-bold text-bad-fg">{result.error}</p> : null}
        {!pending && r ? (
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 font-display text-[22px] font-semibold">
              {tone === "ok" ? <CheckCircle2 className="text-teal" aria-hidden="true" /> : tone === "warn" ? <AlertTriangle aria-hidden="true" /> : <XCircle aria-hidden="true" />}
              {headline[r.result] ?? r.result}
            </span>
            {r.name ? <b className="text-[16px]">{r.name}</b> : null}
            {r.seats ? <span className="text-[14px]">{r.seats} {r.seats === 1 ? "seat" : "seats"}</span> : null}
            {r.event ? <span className="text-[13px] text-muted">{r.event}</span> : null}
            {r.result === "already" && r.checked_in_at ? <span className="text-[13px]">First scanned at {formatTime(r.checked_in_at)}</span> : null}
            {r.result === "unpaid" ? <span className="text-[13px]">Ask for proof of transfer, then mark the booking paid and scan again.</span> : null}
            <span className="font-display text-[13px] tracking-wider text-faint">{r.code}</span>
          </div>
        ) : null}
        {!pending && !result ? <p className="text-[14px] text-faint">Scan a ticket to see who it belongs to.</p> : null}
      </Card>
    </div>
  );
}
