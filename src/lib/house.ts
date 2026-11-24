/**
 * The "house" member app: one screen with the animated house in the middle, a slide per space,
 * round icons for each space's sections, and every page opening in a pop-up panel over the house.
 * Shared by the shell (client) and the layout (server); no React here so it stays testable.
 */

/** The house look is the member app for everyone; this cookie set to "classic" brings back the old sidebar look (fallback). */
export const HOUSE_COOKIE = "vw_ui";
export const CLASSIC_VALUE = "classic";
export const isHouseLook = (cookie: string | undefined) => cookie !== CLASSIC_VALUE;

export type SpaceKey = "house" | "outloud" | "tvs" | "brickr" | "quidquo" | "blong" | "me";

export type DockItem = { label: string; href: string; icon: string; colour: string; signOut?: boolean };

export type Slide = {
  key: SpaceKey;
  /** Short name for the pager and Next button. */
  short: string;
  name: string;
  kicker: string;
  line: string;
  colour: string;
  tint: string;
  dock: DockItem[];
};

export const COLOURS = { teal: "#29BE9C", outloud: "#E39B2D", tvs: "#1F4FA3", brickr: "#B5532F", quidquo: "#8DBF2E", blong: "#7C5CE0" } as const;
export const TINTS = { teal: "#5fe0c0", outloud: "#F2B65A", tvs: "#8AAEF0", brickr: "#E8896A", quidquo: "#B4DD5E", blong: "#B4A2F5" } as const;

export const SLIDES: Slide[] = [
  {
    key: "house", short: "House", name: "VentureWeavers", kicker: "One house · five spaces",
    line: "Tap a space on the house, or use the arrow to walk through it.", colour: COLOURS.teal, tint: TINTS.teal,
    // No icons on the house itself: the top row and the house lead to each space.
    dock: [],
  },
  {
    key: "outloud", short: "Outloud", name: "Outloud", kicker: "Content · Live and digital", line: "Live in the room. Shared on screen.",
    colour: COLOURS.outloud, tint: TINTS.outloud,
    dock: [
      { label: "Live content", href: "/outloud", icon: "radio", colour: COLOURS.outloud },
      { label: "Digital content", href: "/outloud?tab=content", icon: "play", colour: COLOURS.outloud },
      { label: "Blogs", href: "/outloud?tab=blog", icon: "book", colour: COLOURS.outloud },
    ],
  },
  {
    key: "tvs", short: "TVS", name: "The Venture School", kicker: "Education · Practical and dynamic", line: "Learn it in practice. Lead it in motion.",
    colour: COLOURS.tvs, tint: TINTS.tvs,
    dock: [
      { label: "Programs", href: "/tvs", icon: "cap", colour: COLOURS.tvs },
      { label: "Masterclasses", href: "/tvs?tab=masterclasses", icon: "board", colour: COLOURS.tvs },
      { label: "Private programs", href: "/tvs?tab=private", icon: "users", colour: COLOURS.tvs },
    ],
  },
  {
    key: "brickr", short: "BRICKR", name: "BRICKR", kicker: "Services · Hands-on, not hands-off", line: "We don't consult and leave. We build together.",
    colour: COLOURS.brickr, tint: TINTS.brickr,
    dock: [
      { label: "Fractional services", href: "/brickr?kind=fractional", icon: "brief", colour: COLOURS.brickr },
      { label: "Mentorship", href: "/brickr?kind=mentorship", icon: "compass", colour: COLOURS.brickr },
    ],
  },
  {
    key: "quidquo", short: "QuidQuo", name: "QuidQuo", kicker: "Capital · In development", line: "Less friction between capital and the people who need it.",
    colour: COLOURS.quidquo, tint: TINTS.quidquo,
    dock: [
      { label: "Progress", href: "/quidquo", icon: "activity", colour: COLOURS.quidquo },
      { label: "Waiting list", href: "/quidquo?tab=waitlist", icon: "list", colour: COLOURS.quidquo },
    ],
  },
  {
    key: "blong", short: "BLong", name: "BLong", kicker: "Community · Engage and connect", line: "Where members meet, talk and grow together.",
    colour: COLOURS.blong, tint: TINTS.blong,
    dock: [
      { label: "Communities", href: "/blong/communities", icon: "users", colour: COLOURS.blong },
      { label: "Discussions", href: "/blong/discussions", icon: "chat", colour: COLOURS.blong },
      { label: "Networking", href: "/blong/networking", icon: "net", colour: COLOURS.blong },
    ],
  },
  {
    key: "me", short: "My space", name: "My space", kicker: "Your corner of the house", line: "Your tickets, learning, communities, discussions, requests and everything you have saved.",
    colour: COLOURS.teal, tint: TINTS.teal,
    dock: [
      { label: "Tickets", href: "/my-space?tab=tickets", icon: "ticket", colour: COLOURS.outloud },
      { label: "Learning", href: "/my-space?tab=learning", icon: "learn", colour: COLOURS.tvs },
      { label: "My communities", href: "/blong/communities?tab=joined", icon: "users", colour: COLOURS.blong },
      { label: "My discussions", href: "/blong/discussions?tab=joined", icon: "chat", colour: COLOURS.blong },
      { label: "Requests", href: "/my-space?tab=requests", icon: "inbox", colour: COLOURS.brickr },
      { label: "Payments", href: "/my-space?tab=payments", icon: "card", colour: COLOURS.teal },
      { label: "My news", href: "/my-space?tab=news", icon: "mega", colour: COLOURS.outloud },
      { label: "Saved", href: "/my-space?tab=saved", icon: "mark", colour: COLOURS.quidquo },
      { label: "Profile settings", href: "/my-space?tab=profile", icon: "sliders", colour: COLOURS.teal },
      { label: "Sign out", href: "#sign-out", icon: "out", colour: "#a9c9c1", signOut: true },
    ],
  },
];

export const slideIndex = (key: SpaceKey) => Math.max(0, SLIDES.findIndex((s) => s.key === key));

export type PanelMeta = { space: SpaceKey; spaceName: string; title: string; sub: string; icon: string; colour: string; tint: string; detail: boolean };

/** One line under each section's title in the panel. */
const SUBS: Record<string, string> = {
  "Live content": "Shows, events and private sessions. Book a seat, or get notified when one opens.",
  "Digital content": "Episodes from our YouTube channel and short reels from Instagram and TikTok.",
  Blogs: "VW Notes from the partners and news from members' businesses.",
  "Live mode": "Ask questions, vote in polls and follow the show from your phone.",
  Programs: "Practical, dynamic education for every seat at the table.",
  Masterclasses: "Short, practical sessions on one topic, taught from every stakeholder's side.",
  "Private programs": "A program shaped around your people: teams, portfolios, cohorts and organisations.",
  Classroom: "Your sessions, materials and assignments.",
  "Fractional services": "Experienced partners inside your venture or portfolio: in the decisions, in the work, measured by what it produces.",
  Mentorship: "Personal, output-oriented sessions that end in decisions and actions, tracked to completion.",
  "My projects": "Your work with the BRICKR partners.",
  Progress: "AI for raising capital, built in the open. Follow every stage.",
  "Waiting list": "Be first in when QuidQuo opens. We message you before each stage.",
  Tickets: "Your seats for shows and masterclasses.",
  Learning: "Programs and masterclasses you have applied to or joined.",
  Requests: "Meetings and requests you have sent to the team.",
  Payments: "Seats, program fees and payment requests, with their references.",
  "My news": "Stories you have shared about your business, and where they are in review.",
  Saved: "Shows, programs, services and posts you saved for later.",
  "Profile settings": "How you appear to the team, and how we reach you.",
  Library: "Guides, templates and resources from the team.",
  Messages: "Your conversations with the VentureWeavers team and with other members.",
  "Updates & Notifications": "What's new for you across the house, and everything that needs your attention.",
  Search: "Find shows, programs, services and posts.",
  "Share your news": "Tell us what happened at your business.",
  Communities: "Groups around a topic, an industry, a role or a place. Join one or start your own.",
  Discussions: "Rooms to talk one topic through. Join an open room, ask to join, or start one.",
  Networking: "Find members, follow them, and see what the people you follow are up to.",
};

const SPACE_NAMES: Record<SpaceKey, string> = { house: "VentureWeavers", outloud: "Outloud", tvs: "The Venture School", brickr: "BRICKR", quidquo: "QuidQuo", blong: "BLong", me: "My space" };

/** Which space and section a member page belongs to, for the panel header and the slide behind it. */
export function panelMeta(pathname: string, search: string | URLSearchParams = ""): PanelMeta {
  const q = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  const tab = q.get("tab") ?? "";
  const seg = pathname.split("/").filter(Boolean);
  const top = seg[0] ?? "";
  const deep = seg.length > 1;
  const make = (space: SpaceKey, title: string, icon: string, detail = deep): PanelMeta => {
    const colour = space === "house" || space === "me" ? COLOURS.teal : COLOURS[space];
    const tint = space === "house" || space === "me" ? TINTS.teal : TINTS[space];
    return { space, spaceName: SPACE_NAMES[space], title, sub: SUBS[title] ?? "", icon, colour, tint, detail };
  };
  switch (top) {
    case "outloud":
      if (seg[1] === "events") return make("outloud", "Live content", "radio");
      if (seg[1] === "blog") return make("outloud", "Blogs", "book");
      return tab === "content" ? make("outloud", "Digital content", "play") : tab === "blog" ? make("outloud", "Blogs", "book") : make("outloud", "Live content", "radio");
    case "live":
      return make("outloud", "Live mode", "radio", false);
    case "tvs":
      if (seg[1] === "programs") return make("tvs", "Programs", "cap");
      if (seg[1] === "masterclasses") return make("tvs", "Masterclasses", "board");
      if (seg[1] === "classroom") return make("tvs", "Classroom", "learn", false);
      return tab === "masterclasses" ? make("tvs", "Masterclasses", "board") : tab === "private" ? make("tvs", "Private programs", "users") : make("tvs", "Programs", "cap");
    case "brickr":
      if (seg[1] === "services") return make("brickr", "Services", "brief");
      return q.get("kind") === "mentorship" ? make("brickr", "Mentorship", "compass") : make("brickr", "Fractional services", "brief");
    case "projects":
      return make("brickr", seg[1] ? "Project" : "My projects", "brief");
    case "quidquo":
      return tab === "waitlist" ? make("quidquo", "Waiting list", "list") : make("quidquo", "Progress", "activity");
    case "blong":
      if (seg[1] === "members") return make("blong", "Member", "user");
      if (seg[1] === "communities") return make("blong", "Communities", "users", seg.length > 2);
      if (seg[1] === "discussions") return make("blong", "Discussions", "chat", seg.length > 2);
      return make("blong", "Networking", "net", false);
    case "my-space": {
      if (tab === "privacy") return make("me", "Profile settings", "sliders");
      const item = SLIDES[slideIndex("me")].dock.find((d) => d.href === `/my-space?tab=${tab}`);
      return item ? make("me", item.label, item.icon) : make("me", "Tickets", "ticket");
    }
    case "share-news":
      return make("me", "Share your news", "mega", false);
    case "library":
      return make("me", "Library", "book", false);
    case "updates":
      return make("house", "Updates & Notifications", "bell", false);
    case "messages":
      return make("house", "Messages", "msg", false);
    case "search":
      return make("house", "Search", "search", false);
    default:
      return make("house", "VentureWeavers", "house", false);
  }
}

/** BRICKR services split into Fractional services and Mentorship by their name, slug or tags. */
export function isMentorship(s: { name: string; slug?: string; tags?: string[] }) {
  const hay = [s.name, s.slug ?? "", ...(s.tags ?? [])].join(" ").toLowerCase();
  return hay.includes("mentor");
}
