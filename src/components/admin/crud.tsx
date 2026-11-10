"use client";

import { useRef, useState, useTransition } from "react";
import { Copy, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Runs a server action with a toast, keeping the last error for the open form. */
export function useRunner() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast(r.message ?? "Done");
        setError(null);
        after?.();
      } else {
        setError(r.error);
        toast(r.error);
      }
    });
  return { pending, error, setError, run };
}

export function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-fg hover:bg-hover">
      {children}
    </button>
  );
}

/** Edit, duplicate, publish or unpublish, delete. */
export function RowActions({
  name,
  published,
  onEdit,
  onDuplicate,
  onToggle,
  onDelete,
  extra,
}: {
  name: string;
  published: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex justify-end gap-1">
      {extra}
      <IconBtn label={`Edit ${name}`} onClick={onEdit}><Pencil size={15} aria-hidden="true" /></IconBtn>
      <IconBtn label={`Duplicate ${name}`} onClick={onDuplicate}><Copy size={15} aria-hidden="true" /></IconBtn>
      <IconBtn label={published ? `Unpublish ${name}` : `Publish ${name}`} onClick={onToggle}>
        {published ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
      </IconBtn>
      <IconBtn label={`Delete ${name}`} onClick={onDelete}><Trash2 size={15} aria-hidden="true" /></IconBtn>
    </div>
  );
}

export function ListBar({ count, noun, onNew, newLabel }: { count: number; noun: string; onNew: () => void; newLabel: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[13px] text-faint">{count} {noun}</span>
      <Button onClick={onNew}>
        <Plus size={15} aria-hidden="true" />
        {newLabel}
      </Button>
    </div>
  );
}

export function TableBox({ minWidth = 760, head, children, empty }: { minWidth?: number; head: string[]; children: React.ReactNode; empty?: string | false }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full text-left text-[13px]" style={{ minWidth }}>
        <thead className="border-b border-line text-[11.5px] font-extrabold tracking-wide text-faint uppercase">
          <tr>
            {head.map((h, i) => <th key={h || i} className={i === head.length - 1 ? "px-3 py-2.5 text-right" : "px-3 py-2.5"}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {children}
          {empty ? (
            <tr><td colSpan={head.length} className="px-3 py-8 text-center text-faint">{empty}</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export const td = "px-3 py-2.5 align-top";

/** The shared editor drawer: a form that saves through a server action. */
export function EditorDrawer({
  open,
  onClose,
  eyebrow,
  title,
  pending,
  error,
  onSubmit,
  children,
  formKey,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  pending: boolean;
  error: string | null;
  onSubmit: (fd: FormData) => void;
  children: React.ReactNode;
  formKey: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow={eyebrow}
      title={title}
      wide={wide}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => ref.current?.requestSubmit()}>{pending ? "Saving…" : "Save"}</Button>
        </>
      }
    >
      {open ? (
        <form
          key={formKey}
          ref={ref}
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(new FormData(e.currentTarget));
          }}
        >
          {children}
          {error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
        </form>
      ) : null}
    </Drawer>
  );
}

export function ConfirmDelete({ name, open, onClose, onConfirm, pending, note }: { name?: string; open: boolean; onClose: () => void; onConfirm: () => void; pending: boolean; note?: string }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete this?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Keep it</Button>
          <Button variant="danger" disabled={pending} onClick={onConfirm}>Delete</Button>
        </>
      }
    >
      <p className="text-[13.5px]"><b>{name}</b> will be removed for good. {note ?? "To hide it instead, set it to Draft."}</p>
    </Modal>
  );
}
