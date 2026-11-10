"use client";

import { Archive, Check, RotateCcw, Trash2 } from "lucide-react";
import { IconBtn, useRunner } from "@/components/admin/crud";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/tag";
import type { AdminTopic } from "@/lib/content/admin-queries";
import { relativeWhen } from "@/lib/content/format";
import { deleteTopic, setTopicStatus } from "../content-actions";

/** Topic suggestions from members (Outloud › Suggest a topic). */
export function TopicsList({ topics }: { topics: AdminTopic[] }) {
  const { run } = useRunner();
  const open = topics.filter((t) => t.status !== "archived");
  const archived = topics.filter((t) => t.status === "archived");
  return (
    <Card>
      <CardHeader title="Topic suggestions" action={<span className="font-normal text-faint">{topics.filter((t) => t.status === "new").length} new</span>} />
      {!topics.length ? <EmptyState>No suggestions yet. Members send them from Outloud › Suggest a topic.</EmptyState> : null}
      <ul className="flex flex-col">
        {[...open, ...archived].map((t) => (
          <li key={t.id} className={`flex items-start gap-3 border-b border-line py-2.5 last:border-b-0 ${t.status === "archived" ? "opacity-60" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold">{t.text}</p>
              <span className="text-[12.5px] text-faint">{t.member} · {relativeWhen(t.created_at)}</span>
            </div>
            <StatusPill tone={t.status === "picked" ? "ok" : t.status === "new" ? "blue" : "draft"}>{t.status === "picked" ? "Picked" : t.status === "new" ? "New" : "Archived"}</StatusPill>
            <div className="flex gap-1">
              {t.status !== "picked" ? <IconBtn label="Mark as picked" onClick={() => run(() => setTopicStatus(t.id, "picked"))}><Check size={15} aria-hidden="true" /></IconBtn> : null}
              {t.status !== "archived" ? (
                <IconBtn label="Archive" onClick={() => run(() => setTopicStatus(t.id, "archived"))}><Archive size={15} aria-hidden="true" /></IconBtn>
              ) : (
                <IconBtn label="Move back to new" onClick={() => run(() => setTopicStatus(t.id, "new"))}><RotateCcw size={15} aria-hidden="true" /></IconBtn>
              )}
              <IconBtn label="Delete" onClick={() => run(() => deleteTopic(t.id))}><Trash2 size={15} aria-hidden="true" /></IconBtn>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
