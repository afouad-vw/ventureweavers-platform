import { COLOURS, type SpaceKey } from "@/lib/house";

type Pt = [number, number];
export type Scene = {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Teal threads traced on the render, in % of the image. */
  flows: Pt[][];
  /** Glass labels pinned to places in the scene, in %. */
  labels: { label: string; x: number; y: number }[];
  /** Clickable spaces on the house, in %. */
  spots?: { label: string; x: number; y: number; colour: string; to: SpaceKey }[];
  /** The full house is not faded at the edges. */
  plain?: boolean;
};

export const SCENES: Partial<Record<SpaceKey, Scene>> = {
  house: {
    src: "/landing/house-blong.webp", width: 2000, height: 1618, plain: true,
    alt: "The VentureWeavers house: a show stage, a classroom, a workshop and an AI lab, with members networking in the middle, joined by glowing teal threads",
    flows: [
      [[31.8, 45.3], [42, 39.5], [46, 35.6], [47.7, 33.6]],
      [[64.8, 45.5], [56, 40.2], [51.6, 35.6], [50.2, 34.4]],
      [[29.3, 86.2], [33, 87.9], [35.5, 87.6], [46, 79.5], [48.4, 78.2]],
      [[70.5, 83.9], [66, 87.4], [64, 87.6], [51, 79.3], [48.4, 78.2]],
      [[37.9, 71], [48.4, 78.2], [58.6, 84.8]],
      [[37.7, 84.7], [48.4, 78.2], [58.4, 70.7]],
    ],
    labels: [],
    spots: [
      { label: "Outloud", x: 21.4, y: 6, colour: COLOURS.outloud, to: "outloud" },
      { label: "The Venture School", x: 79.9, y: 6, colour: COLOURS.tvs, to: "tvs" },
      { label: "Eureka", x: 13.3, y: 53.5, colour: COLOURS.quidquo, to: "quidquo" },
      { label: "BRICKR", x: 82.7, y: 53.5, colour: COLOURS.brickr, to: "brickr" },
      { label: "BLong", x: 48, y: 47, colour: COLOURS.blong, to: "blong" },
    ],
  },
  outloud: {
    src: "/landing/stage.webp", width: 1800, height: 1525, alt: "Outloud: a round show stage under amber lights with an audience",
    flows: [[[6.3, 60.2], [45.8, 85.1]], [[6.6, 60.6], [13, 63.2], [16, 63.4], [27, 57.4]], [[27.2, 57.8], [18.5, 63], [17.6, 65.5], [19, 67], [37, 78.6]]],
    labels: [{ label: "Live", x: 42, y: 27 }, { label: "The room", x: 74, y: 46 }],
  },
  tvs: {
    src: "/landing/classroom.webp", width: 1800, height: 1397, alt: "The Venture School: a classroom with learners at a glowing screen",
    flows: [[[10, 55.3], [36.5, 73.3], [38.6, 74.2], [41, 73.7], [48.3, 70]]],
    labels: [{ label: "Programs", x: 76, y: 17 }, { label: "Masterclasses", x: 47, y: 45 }],
  },
  brickr: {
    src: "/landing/workshop.webp", width: 1425, height: 1397, alt: "BRICKR: partners building at a workshop table",
    flows: [[[9.6, 64.4], [33, 77.9]], [[31.1, 80.7], [48.8, 71]]],
    labels: [{ label: "Lead", x: 40.6, y: 38 }, { label: "Mentor", x: 76, y: 48 }],
  },
  quidquo: {
    src: "/landing/lab.webp", width: 1800, height: 1442, alt: "Eureka: our products lab, with glowing screens",
    flows: [[[0, 94.6], [36, 70], [37.6, 68.4], [48, 61.6]]],
    labels: [{ label: "QuidQuo", x: 72, y: 22 }, { label: "Handlr", x: 30, y: 30 }],
  },
  blong: {
    src: "/landing/blong.webp", width: 2000, height: 1750, alt: "BLong: members networking in a lounge under a green light, linked by teal threads",
    flows: [],
    labels: [{ label: "Meet", x: 20, y: 30 }, { label: "Talk", x: 50, y: 14 }, { label: "Connect", x: 82, y: 32 }],
  },
};

/** Rounds a traced path's corners (Chaikin) and turns % points into image pixels for an SVG path. */
export function flowPath(pts: Pt[], width: number, height: number) {
  let a = pts;
  for (let it = 0; it < 2 && a.length >= 3; it++) {
    const out: Pt[] = [a[0]];
    for (let i = 0; i < a.length - 1; i++) {
      const [x0, y0] = a[i], [x1, y1] = a[i + 1];
      if (i > 0) out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25]);
      if (i < a.length - 2) out.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    out.push(a[a.length - 1]);
    a = out;
  }
  return a.map(([x, y], i) => `${i ? "L" : "M"}${((x * width) / 100).toFixed(1)} ${((y * height) / 100).toFixed(1)}`).join(" ");
}
