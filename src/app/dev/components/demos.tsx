"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { SelectField, TextArea, TextField, Toggle } from "@/components/ui/field";
import { Drawer, Modal } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

const filters = ["All", "Outloud", "TVS", "BRICKR", "QuidQuo"] as const;

export function InteractiveDemos() {
  const [tab, setTab] = useState<"events" | "content" | "blog">("events");
  const [chip, setChip] = useState<(typeof filters)[number]>("All");
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const toast = useToast();

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        label="Outloud sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: "events", label: "Shows & events", count: 3 },
          { value: "content", label: "Digital content", count: 12 },
          { value: "blog", label: "Blog", count: 6 },
        ]}
      />
      <ChipGroup label="Filter by space" options={filters} value={chip} onChange={setChip} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setModal(true)}>Open modal</Button>
        <Button variant="secondary" onClick={() => setDrawer(true)}>Open editor drawer</Button>
        <Button variant="ghost" onClick={() => toast("Saved")}>Show toast</Button>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        eyebrow="BRICKR"
        title="Request a meeting"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={() => { setModal(false); toast("Request sent"); }}>Send request</Button>
          </>
        }
      >
        <TextField label="Company" placeholder="Your company" />
        <TextArea label="What do you need help with?" />
      </Modal>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        eyebrow="Outloud · Events"
        title="Edit event"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawer(false)}>Cancel</Button>
            <Button onClick={() => { setDrawer(false); toast("Saved as draft"); }}>Save</Button>
          </>
        }
      >
        <TextField label="Title" defaultValue="Open Floor #4" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date" type="date" />
          <TextField label="Seats" type="number" defaultValue={60} />
        </div>
        <SelectField label="Status" options={["Draft", "Published"]} />
        <Toggle label="Allow private sessions" defaultChecked />
      </Drawer>
    </div>
  );
}
