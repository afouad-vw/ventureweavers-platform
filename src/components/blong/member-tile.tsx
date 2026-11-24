import Link from "next/link";
import { Globe, Lock } from "lucide-react";
import { memberLine, type MemberLite } from "@/lib/blong/format";
import { MemberAvatar } from "./member-avatar";
import { FollowButton, RemoveFollowerButton, RequestButtons } from "./member-actions";

/** A member in the Networking lists: photo, name, roles and the right button for the list. */
export function MemberTile({ m, mode = "follow" }: { m: MemberLite; mode?: "follow" | "request" | "follower" }) {
  return (
    <div className="bl-tile glass flex min-w-0 flex-col items-center gap-2 rounded-[20px] border p-4 text-center">
      <Link href={`/blong/members/${m.id}`} scroll={false} className="flex flex-col items-center gap-2 rounded-xl">
        <MemberAvatar id={m.id} name={m.name} src={m.avatar_url} size={72} className="ring-2 ring-white/10" />
        <b className="text-[15px] leading-tight">{m.name}</b>
      </Link>
      <span className="line-clamp-2 min-h-[2.4em] text-[12.5px] text-faint">{memberLine(m) || "VentureWeavers member"}</span>
      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-faint">
        {m.visibility === "private" ? <Lock size={11} aria-hidden="true" /> : <Globe size={11} aria-hidden="true" />}
        {m.visibility === "private" ? "Private" : "Public"}
        {m.follows_me ? " · Follows you" : ""}
      </span>
      <span className="mt-auto flex flex-wrap justify-center gap-1.5">
        {mode === "request" ? <RequestButtons id={m.id} /> : <FollowButton id={m.id} state={m.follow_state} visibility={m.visibility} followsMe={m.follows_me} size="sm" />}
        {mode === "follower" ? <RemoveFollowerButton id={m.id} name={m.name} /> : null}
      </span>
    </div>
  );
}
