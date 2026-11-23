import Image from "next/image";
import Link from "next/link";
import { SceneView } from "@/components/house/scene-view";
import { SCENES } from "@/components/house/scenes";
import { COLOURS } from "@/lib/house";
import "@/components/house/house.css";

// The house without its clickable spots (they lead to spaces inside the app).
const HOUSE = { ...SCENES.house!, spots: undefined };
const SPACES = [
  { name: "Outloud", colour: COLOURS.outloud },
  { name: "The Venture School", colour: COLOURS.tvs },
  { name: "BRICKR", colour: COLOURS.brickr },
  { name: "QuidQuo", colour: COLOURS.quidquo },
];

/** Sign in, Join and the other account pages in the house look: the floating house beside a glass card. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vw-dark au">
      <div className="hs-bg" aria-hidden="true">
        <span className="hs-orb a" />
        <span className="hs-orb b" />
        <span className="hs-glow" style={{ backgroundColor: COLOURS.teal }} />
        <span className="hs-grain" />
      </div>
      <div className="au-grid">
        <aside className="au-side">
          <Link href="https://ventureweavers.com" aria-label="VentureWeavers home">
            <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={220} height={15} priority />
          </Link>
          <div className="au-house"><SceneView scene={HOUSE} eager sizes="(min-width: 900px) 620px, 1px" /></div>
          <p className="au-tag">Experience, knowledge and access to MENA&apos;s venture ecosystem.</p>
          <div className="au-spaces">
            {SPACES.map((s) => <span key={s.name} style={{ "--c": s.colour } as React.CSSProperties}><i />{s.name}</span>)}
          </div>
        </aside>
        <main className="au-main">
          <Link href="https://ventureweavers.com" className="au-logo-s" aria-label="VentureWeavers home">
            <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={170} height={12} priority />
          </Link>
          <div className="au-mini"><SceneView scene={HOUSE} eager={false} sizes="(max-width: 899px) 300px, 1px" /></div>
          <div className="au-card">{children}</div>
        </main>
      </div>
    </div>
  );
}
