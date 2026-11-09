"use client";

import { ArrowLeft } from "lucide-react";
import { useActionState, useState } from "react";
import { FormNote } from "@/components/auth/form-note";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextField, Toggle } from "@/components/ui/field";
import { threadDot, type TagTone } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { GOALS, ROLES, STAGES, TOPICS } from "@/lib/profile/options";
import { saveOnboarding } from "./actions";

const TOTAL = 4;

function Option({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-left text-[13.5px] font-semibold",
        pressed ? "border-primary bg-soft text-fg" : "border-line2 bg-card hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}

/** Four short steps after sign-up: contact, role, stage, goals and topics, reminders. */
export function WelcomeSteps({ name: initialName, next }: { name: string; next: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [stage, setStage] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [state, action, pending] = useActionState(saveOnboarding, null);
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="stage" value={stage} />
      {goals.map((g) => <input key={g} type="hidden" name="goals" value={g} />)}
      {topics.map((t) => <input key={t} type="hidden" name="topics" value={t} />)}

      <div className="flex min-h-9 items-center justify-between">
        {step > 0 ? (
          <button type="button" onClick={() => setStep(step - 1)} aria-label="Back" className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-line2 bg-card hover:bg-hover">
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
        ) : <span />}
        <span className="text-[12.5px] font-bold text-faint">Step {step + 1} of {TOTAL + 1}</span>
      </div>
      <div className="grid grid-cols-5 gap-1" aria-hidden="true">
        {Array.from({ length: TOTAL + 1 }, (_, i) => <span key={i} className={cn("h-1 rounded-sm", i <= step ? "bg-teal" : "bg-line")} />)}
      </div>

      {step === 0 ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Welcome to the house</h1>
          <p className="text-[13.5px] text-muted">A few questions so we can shape your feed. It takes a minute.</p>
          <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} required />
          <TextField label="Mobile (WhatsApp)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+20 1XX XXX XXXX" autoComplete="tel" />
        </>
      ) : step === 1 ? (
        <>
          <h1 className="font-display text-2xl font-semibold">What describes you best?</h1>
          <div className="flex flex-col gap-1.5">
            {ROLES.map((r) => <Option key={r} pressed={role === r} onClick={() => setRole(r)}>{r}</Option>)}
          </div>
        </>
      ) : step === 2 ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Where is your venture today?</h1>
          <div className="flex flex-col gap-1.5">
            {STAGES.map(([l, d]) => (
              <Option key={l} pressed={stage === l} onClick={() => setStage(l)}>
                <span className="flex flex-col"><b>{l}</b><span className="text-xs font-normal text-muted">{d}</span></span>
              </Option>
            ))}
          </div>
        </>
      ) : step === 3 ? (
        <>
          <h1 className="font-display text-2xl font-semibold">What do you want from us?</h1>
          <span className="text-[12.5px] font-bold text-muted">Goals</span>
          <div className="grid grid-cols-2 gap-1.5">
            {GOALS.map(([l, s]) => (
              <Option key={l} pressed={goals.includes(l)} onClick={() => toggle(goals, setGoals, l)}>
                <i className={cn("h-2 w-2 shrink-0 rounded-full", threadDot[s as TagTone])} aria-hidden="true" />
                <span className="flex flex-col"><b>{l}</b><span className="text-xs font-normal text-muted">{s}</span></span>
              </Option>
            ))}
          </div>
          <span className="text-[12.5px] font-bold text-muted">Topics</span>
          <div className="flex flex-wrap gap-1.5">
            {TOPICS.map((t) => <Chip key={t} pressed={topics.includes(t)} onClick={() => toggle(topics, setTopics, t)}>{t}</Chip>)}
          </div>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl font-semibold">How should we reach you?</h1>
          <div className="flex flex-col gap-2">
            <Toggle label="WhatsApp reminders" name="whatsapp" defaultChecked={Boolean(phone)} disabled={!phone} />
            <Toggle label="Push notifications" name="push" />
            <Toggle label="The Floor Notes newsletter" name="newsletter" defaultChecked />
          </div>
          {!phone ? <p className="text-xs text-faint">Add a mobile number in step 1 to get WhatsApp reminders.</p> : null}
        </>
      )}

      <FormNote state={state} />
      {step < TOTAL ? (
        <Button size="lg" className="w-full" onClick={() => setStep(step + 1)} disabled={step === 0 && !name.trim()}>
          Continue
        </Button>
      ) : (
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Finish"}
        </Button>
      )}
    </form>
  );
}
