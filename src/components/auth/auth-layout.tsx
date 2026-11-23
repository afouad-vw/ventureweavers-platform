import Image from "next/image";
import Link from "next/link";
import { COLOURS } from "@/lib/house";
import "@/components/house/house.css";

const SPACES = [
  { name: "Outloud", colour: COLOURS.outloud },
  { name: "The Venture School", colour: COLOURS.tvs },
  { name: "BRICKR", colour: COLOURS.brickr },
  { name: "QuidQuo", colour: COLOURS.quidquo },
];

/** Sign in, Join and the other account pages: logo and a glass card centred on the dark backdrop. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vw-dark au">
      <div className="hs-bg" aria-hidden="true">
        <span className="hs-orb a" />
        <span className="hs-orb b" />
        <span className="hs-glow" style={{ backgroundColor: COLOURS.teal }} />
        <span className="hs-grain" />
      </div>
      <main className="au-wrap">
        <Link href="https://ventureweavers.com" className="au-logo" aria-label="VentureWeavers home">
          <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={200} height={14} priority />
        </Link>
        <div className="au-card">{children}</div>
        <div className="au-spaces" aria-label="Spaces">
          {SPACES.map((s) => <span key={s.name} style={{ "--c": s.colour } as React.CSSProperties}><i />{s.name}</span>)}
        </div>
      </main>
    </div>
  );
}
