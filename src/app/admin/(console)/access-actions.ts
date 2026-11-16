"use server";

import type { PersonOption } from "@/lib/access";
import { personOptions } from "@/lib/access-server";
import { requireAdmin } from "@/lib/auth/guards";

/** Members and contacts to pick from when making an item private (anyone who manages some kind of item). */
export async function loadPersonOptions(): Promise<PersonOption[]> {
  await requireAdmin(["events.manage", "tvs.manage", "brickr.manage", "content.manage", "library.manage"]);
  return personOptions();
}
