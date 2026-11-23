"use client";

import Image from "next/image";
import type { SpaceKey } from "@/lib/house";
import { flowPath, type Scene } from "./scenes";

/** A space's 3D scene: floats, lights travel along its teal threads, glass labels and clickable spots. */
export function SceneView({ scene, eager, onSpot, sizes = "(min-width: 900px) 70vw, 100vw" }: { scene: Scene; eager: boolean; onSpot?: (k: SpaceKey) => void; sizes?: string }) {
  return (
    <div className={`hs-scene ${scene.plain ? "plain" : ""}`} style={{ "--ar": (scene.width / scene.height).toFixed(4) } as React.CSSProperties}>
      <div className="hs-scene-in">
        <Image src={scene.src} alt={scene.alt} fill priority={eager} sizes={sizes} quality={88} draggable={false} />
        <svg className="hs-flows" viewBox={`0 0 ${scene.width} ${scene.height}`} preserveAspectRatio="none" aria-hidden="true">
          {scene.flows.map((pts, i) => {
            const d = flowPath(pts, scene.width, scene.height);
            const delay = { "--d": `${(-i * 0.9).toFixed(1)}s` } as React.CSSProperties;
            return (
              <g key={i}>
                <path className="glow" d={d} pathLength={100} style={delay} />
                <path className="core" d={d} pathLength={100} style={delay} />
              </g>
            );
          })}
        </svg>
        {scene.spots?.map((s, i) => (
          <button key={s.label} type="button" className="hs-spot" style={{ left: `${s.x}%`, top: `${s.y}%`, "--c": s.colour, "--i": i } as React.CSSProperties} onClick={() => onSpot?.(s.to)}>
            <b /><span>{s.label}</span>
          </button>
        ))}
        {scene.labels.map((l, i) => (
          <span key={l.label} className="hs-tag" style={{ left: `${l.x}%`, top: `${l.y}%`, "--i": i } as React.CSSProperties}>{l.label}</span>
        ))}
      </div>
    </div>
  );
}
