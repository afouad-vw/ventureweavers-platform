"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/chip";
import { SelectField, Toggle } from "@/components/ui/field";
import { STAGES, TOPICS } from "@/lib/profile/options";
import { AboutForm, type AboutInitial } from "@/app/(auth)/welcome/about-form";
import { saveProfile } from "./actions";

export type ProfileValues = AboutInitial & { stage: string; topics: string[]; push: boolean };

/** My space › Profile: the "About you" details plus venture stage, topics and push notifications. */
export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const [topics, setTopics] = useState(initial.topics);
  return (
    <AboutForm initial={initial} returning inProfile save={saveProfile}>
      {topics.map((t) => <input key={t} type="hidden" name="topics" value={t} />)}
      <SelectField label="Where is your venture today" name="stage" defaultValue={initial.stage} options={[{ value: "", label: "Choose…" }, ...STAGES.map(([s]) => ({ value: s, label: s }))]} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[12.5px] font-bold text-muted">Topics you care about</legend>
        <div className="flex flex-wrap gap-1.5">
          {TOPICS.map((t) => <Chip key={t} pressed={topics.includes(t)} onClick={() => setTopics(topics.includes(t) ? topics.filter((x) => x !== t) : [...topics, t])}>{t}</Chip>)}
        </div>
      </fieldset>
      <Toggle label="Push notifications" name="push" defaultChecked={initial.push} />
    </AboutForm>
  );
}
