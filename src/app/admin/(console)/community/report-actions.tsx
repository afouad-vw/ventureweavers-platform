"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { handleReport, setCommunityStatusAdmin, setDiscussionStatusAdmin } from "./actions";

export function ReportActions({ id, status }: { id: string; status: "open" | "handled" | "dismissed" }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const act = (next: "open" | "handled" | "dismissed") =>
    start(async () => {
      const r = await handleReport(id, next, note);
      toast(r.ok ? (next === "open" ? "Reopened" : next === "handled" ? "Marked handled" : "Dismissed") : r.error);
    });
  if (status !== "open") return <Button size="sm" variant="secondary" className="self-start" disabled={pending} onClick={() => act("open")}>Reopen</Button>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`note-${id}`}>Team note</label>
      <input id={`note-${id}`} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Note for the team (optional)" className="h-9 min-w-[220px] flex-1 rounded-lg border border-line2 bg-card px-2.5 text-[13px]" />
      <Button size="sm" disabled={pending} onClick={() => act("handled")}>Mark handled</Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => act("dismissed")}>Dismiss</Button>
    </div>
  );
}

export function CommunityStatusButton({ id, status }: { id: string; status: "active" | "archived" }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
      const r = await setCommunityStatusAdmin(id, status === "active" ? "archived" : "active");
      toast(r.ok ? (status === "active" ? "Archived" : "Restored") : r.error);
    })}>{status === "active" ? "Archive" : "Restore"}</Button>
  );
}

export function DiscussionStatusButton({ id, archived }: { id: string; archived: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
      const r = await setDiscussionStatusAdmin(id, archived ? "open" : "archived");
      toast(r.ok ? (archived ? "Restored" : "Archived") : r.error);
    })}>{archived ? "Restore" : "Archive"}</Button>
  );
}
