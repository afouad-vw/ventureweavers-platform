import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ContentCard } from "@/components/ui/content-card";
import { SelectField, TextArea, TextField, Toggle } from "@/components/ui/field";
import { DateBox, EmptyState, Eyebrow, PageHeader, TicketQR } from "@/components/ui/misc";
import { MiniTag, StatusPill, statusTone, TagRow, ThreadTag } from "@/components/ui/tag";
import { InteractiveDemos } from "./demos";

export const metadata: Metadata = { title: "Components", robots: { index: false } };

const swatches = [
  ["ink", "#071112", "bg-ink"],
  ["deep", "#02686F", "bg-deep"],
  ["teal", "#29BE9C", "bg-teal"],
  ["mint", "#DCF1DD", "bg-mint"],
  ["paper", "#F3F8F5", "bg-paper"],
  ["Outloud", "#E39B2D", "bg-out"],
  ["TVS", "#1F4FA3", "bg-tvs"],
  ["BRICKR", "#B5532F", "bg-brk"],
  ["QuidQuo", "#8DBF2E", "bg-qq"],
] as const;

export default function ComponentsPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-8 desk:px-6">
      <PageHeader
        title="Components"
        description="Every building block in the design system. Internal page for checking changes."
        actions={<LinkButton href="/" variant="secondary">Back to the app</LinkButton>}
      />

      <Card>
        <CardHeader title="Colours" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 desk:grid-cols-9">
          {swatches.map(([name, hex, cls]) => (
            <div key={name} className="flex flex-col gap-1 text-xs">
              <span className={`h-12 rounded-lg border border-line ${cls}`} />
              <b>{name}</b>
              <span className="text-faint">{hex}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Type" />
        <p className="font-display text-[28px] font-semibold">Chakra Petch for headings · 360</p>
        <p>Nunito Sans for everything else. Base text is 14px.</p>
        <Eyebrow>Eyebrow label</Eyebrow>
      </Card>

      <Card>
        <CardHeader title="Buttons" />
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="teal">Teal</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
          <Button size="sm"><Plus size={14} aria-hidden="true" /> Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Tags and status" />
        <div className="flex flex-wrap gap-2">
          <ThreadTag thread="House" />
          <ThreadTag thread="Outloud" />
          <ThreadTag thread="TVS" />
          <ThreadTag thread="BRICKR" />
          <ThreadTag thread="QuidQuo" />
        </div>
        <TagRow tags={["Fundraising", "Seed", "Cairo"]} />
        <div className="flex flex-wrap gap-2">
          {["Published", "Draft", "Pending", "Scheduled", "Refunded", "Declined"].map((s) => (
            <StatusPill key={s} tone={statusTone(s)}>{s}</StatusPill>
          ))}
          <MiniTag tone="tvs">Cohort 3</MiniTag>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 desk:grid-cols-3">
        <ContentCard
          thread="TVS"
          banner="Room"
          title="TVAC 360"
          subtitle="Program"
          description="The foundation for every 360 program: venture building in practice, with live sessions and assignments."
          tags={["12 weeks", "Hybrid", "[PRICE]"]}
          cta={<Button size="sm">Apply</Button>}
        />
        <ContentCard
          thread="BRICKR"
          banner="Pattern"
          title="Fractional COO"
          subtitle="Service"
          description="Hands-on operating support for founders scaling a team and a portfolio."
          tags={["Operations", "Growth"]}
          cta={<Button size="sm" variant="secondary">Request a meeting</Button>}
        />
        <ContentCard
          thread="Outloud"
          banner="Stage"
          title="What investors ask first"
          subtitle="Blog"
          description="Notes from the floor on the first five questions every founder hears."
          tags={["Fundraising", "Open Floor"]}
          cta={<Button size="sm" variant="ghost">Read</Button>}
        />
      </div>

      <Card>
        <CardHeader title="Fields" />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Full name" placeholder="Nour Hassan" />
          <SelectField label="Role" options={["Founder", "Investor", "Operator", "Student"]} />
          <TextArea label="Note" hint="Visible to the partners only." />
          <div className="flex flex-col gap-2">
            <Toggle label="Email" defaultChecked />
            <Toggle label="WhatsApp" />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Tabs, chips, modal, drawer, toast" />
        <InteractiveDemos />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader title="Ticket QR and date" />
          <div className="flex items-center gap-4">
            <TicketQR value="VW-OF4-0001" size={120} />
            <DateBox date="2026-12-03" />
            <DateBox date="2026-12-10" tone="tvs" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Empty state" />
          <EmptyState>No requests yet.</EmptyState>
        </Card>
      </div>
    </div>
  );
}
