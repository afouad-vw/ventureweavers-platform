"use client";

import { useActionState, useState } from "react";
import { FormNote } from "@/components/auth/form-note";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SelectField, TextField, Toggle } from "@/components/ui/field";
import { GOALS, ROLES, STAGES, TOPICS } from "@/lib/profile/options";
import { saveProfile } from "./actions";

export type ProfileValues = {
  full_name: string;
  phone: string;
  role: string;
  stage: string;
  goals: string[];
  interests: string[];
  consent_whatsapp: boolean;
  consent_push: boolean;
  consent_newsletter: boolean;
};

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const [state, action, pending] = useActionState(saveProfile, null);
  const [goals, setGoals] = useState(initial.goals);
  const [topics, setTopics] = useState(initial.interests);
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <form action={action} className="flex flex-col gap-3">
      {goals.map((g) => <input key={g} type="hidden" name="goals" value={g} />)}
      {topics.map((t) => <input key={t} type="hidden" name="topics" value={t} />)}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Full name" name="name" defaultValue={initial.full_name} autoComplete="name" maxLength={120} required />
        <TextField label="Mobile (WhatsApp)" name="phone" type="tel" defaultValue={initial.phone} autoComplete="tel" placeholder="+20 1XX XXX XXXX" />
        <SelectField label="What describes you best" name="role" defaultValue={initial.role} options={[{ value: "", label: "Choose…" }, ...ROLES.map((r) => ({ value: r, label: r }))]} />
        <SelectField label="Where is your venture today" name="stage" defaultValue={initial.stage} options={[{ value: "", label: "Choose…" }, ...STAGES.map(([s]) => ({ value: s, label: s }))]} />
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[12.5px] font-bold text-muted">Goals</legend>
        <div className="flex flex-wrap gap-1.5">
          {GOALS.map(([g]) => <Chip key={g} pressed={goals.includes(g)} onClick={() => toggle(goals, setGoals, g)}>{g}</Chip>)}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[12.5px] font-bold text-muted">Topics</legend>
        <div className="flex flex-wrap gap-1.5">
          {TOPICS.map((t) => <Chip key={t} pressed={topics.includes(t)} onClick={() => toggle(topics, setTopics, t)}>{t}</Chip>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-[12.5px] font-bold text-muted">How we reach you</legend>
        <Toggle label="WhatsApp reminders" name="whatsapp" defaultChecked={initial.consent_whatsapp} />
        <Toggle label="Push notifications" name="push" defaultChecked={initial.consent_push} />
        <Toggle label="The Floor Notes newsletter" name="newsletter" defaultChecked={initial.consent_newsletter} />
      </fieldset>
      <FormNote state={state} />
      <Button type="submit" className="self-start" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
