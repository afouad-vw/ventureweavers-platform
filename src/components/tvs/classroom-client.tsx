"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Download, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteMyPost, finishSubmission, openCohortFile, openSubmission, postToCohort, startSubmission, toggleStep } from "@/app/(member)/tvs/classroom/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { putSigned } from "@/lib/upload-client";
import { checkUpload } from "@/lib/uploads";

/** A step in a module that the learner ticks off. */
export function StepButton({ id, title, meta, done: initial, disabled }: { id: string; title: string; meta: string; done: boolean; disabled: boolean }) {
  const [done, setDone] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      aria-pressed={done}
      disabled={disabled || pending}
      onClick={() => {
        const next = !done;
        setDone(next);
        start(async () => {
          const r = await toggleStep(id, next);
          if (!r.ok) {
            setDone(!next);
            toast(r.error);
          }
        });
      }}
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-left text-[13.5px] hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60",
        done && "bg-soft",
      )}
    >
      <span className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2", done ? "border-primary bg-primary text-white" : "border-line2")}>
        {done ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
      </span>
      <span className={cn("flex-1 font-semibold", done && "line-through decoration-faint")}>{title}</span>
      {meta ? <span className="text-[12.5px] text-faint">{meta}</span> : null}
    </button>
  );
}

/** Hand in or replace work: the file goes straight to private storage, then the server checks it. */
export function SubmitWork({ assignmentId, replace }: { assignmentId: string; replace: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size="sm" variant={replace ? "secondary" : "primary"} disabled={pending} onClick={() => input.current?.click()}>
        <Upload size={13} aria-hidden="true" />
        {pending ? "Uploading…" : replace ? "Replace" : "Submit"}
      </Button>
      <input
        ref={input}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const bad = checkUpload("cohort-files", file.name, file.size);
          if (bad) return toast(bad);
          start(async () => {
            const s = await startSubmission(assignmentId, file.name, file.size);
            if (!s.ok) return toast(s.error);
            if (!(await putSigned(s.url, s.contentType, file))) return toast("The upload didn't go through. Check your connection and try again.");
            const r = await finishSubmission(assignmentId, s.path, file.name);
            toast(r.ok ? r.message ?? "Handed in" : r.error);
            if (r.ok) router.refresh();
          });
          if (input.current) input.current.value = "";
        }}
      />
    </>
  );
}

/** Download a cohort document or the learner's own hand-in through a 5-minute link. */
export function DownloadButton({ kind, id, label = "Download" }: { kind: "file" | "submission"; id: string; label?: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        const tab = window.open("about:blank", "_blank");
        start(async () => {
          const r = kind === "file" ? await openCohortFile(id) : await openSubmission(id);
          if (r.ok && tab) {
            tab.opener = null;
            tab.location.href = r.url;
          } else {
            tab?.close();
            if (!r.ok) toast(r.error);
          }
        });
      }}
    >
      <Download size={13} aria-hidden="true" />
      {label}
    </Button>
  );
}

export function PostForm({ cohortId }: { cohortId: string }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await postToCohort(cohortId, text);
          if (r.ok) {
            setText("");
            router.refresh();
          } else toast(r.error);
        });
      }}
    >
      <label htmlFor="reply" className="sr-only">Reply</label>
      <textarea
        id="reply"
        rows={2}
        required
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add to the thread"
        className="w-full resize-y rounded-lg border border-line2 bg-card px-2.5 py-2 text-[13.5px] placeholder:text-faint focus:border-primary focus:outline-none"
      />
      <Button size="sm" type="submit" className="self-start" disabled={pending}>{pending ? "Posting…" : "Post"}</Button>
    </form>
  );
}

export function DeletePostButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Delete my post"
      title="Delete my post"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await deleteMyPost(id);
          toast(r.ok ? r.message ?? "Deleted" : r.error);
          if (r.ok) router.refresh();
        })
      }
      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-faint hover:bg-hover hover:text-fg"
    >
      <Trash2 size={13} aria-hidden="true" />
    </button>
  );
}
