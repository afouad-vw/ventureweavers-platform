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

/** Sign in, Join and the other account pages: dark backdrop, the house's way in (the Join scene) beside a glass card (phones: logo and card). */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vw-dark au">
      <div className="hs-bg" aria-hidden="true">
        <span className="hs-orb a" />
        <span className="hs-orb b" />
        <span className="hs-grain" />
      </div>
      <div className="au-grid">
        <aside className="au-photo">
          <Image src="/images/signup-join.webp" alt="People walk along a glowing teal thread towards an open door of light, the way into the VentureWeavers house" fill priority sizes="(min-width: 900px) 640px, 1px" className="object-cover object-[50%_35%]" />
          <div className="au-photo-shade" />
          <Link href="https://ventureweavers.com" className="au-photo-logo" aria-label="VentureWeavers home">
            <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={190} height={13} priority />
          </Link>
          <div className="au-photo-copy">
            <p className="au-tag">Experience, knowledge and access to MENA&apos;s venture ecosystem.</p>
            <div className="au-spaces">
              {SPACES.map((s) => <span key={s.name} style={{ "--c": s.colour } as React.CSSProperties}><i />{s.name}</span>)}
            </div>
          </div>
        </aside>
        <main className="au-main">
          <Link href="https://ventureweavers.com" className="au-logo-s" aria-label="VentureWeavers home">
            <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={170} height={12} priority />
          </Link>
          <div className="au-card">{children}</div>
        </main>
      </div>
    </div>
  );
}
