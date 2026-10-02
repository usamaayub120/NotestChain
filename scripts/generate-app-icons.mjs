/**
 * Generates the PWA / home-screen raster icons from the Kept Stamp.
 *
 *   node scripts/generate-app-icons.mjs
 *
 * apps/web/public/ held exactly one icon -  favicon.svg -  so index.html
 * pointed `apple-touch-icon` at an SVG (which iOS cannot render, falling back
 * to a screenshot of the page) and the web manifest shipped no 192, no 512
 * and no maskable entry, which is the minimum Chrome requires before an app
 * is installable at all. The TODO in index.html blamed the missing icons on
 * the missing mark; DESIGN_SYSTEM.md §6's stamp now exists, so this draws it.
 *
 * Rendered analytically rather than by rasterising the SVG: the repo has no
 * image toolchain (no sharp, no ImageMagick, no sips), and the mark is two
 * rings and a tick, which is a few lines of distance-field maths. 4x
 * supersampling gives clean edges at every size. The PNG is encoded with
 * nothing but node:zlib, so this script adds no dependency to install.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Minimal 8-bit truecolour (RGB, no alpha) PNG encoder. */
function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  // Each scanline is prefixed with its filter byte; 0 means "none", which
  // costs a little size and keeps this encoder honest and short.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "apps", "web", "public", "icons");

// DESIGN_SYSTEM.md §3.1. Paper ground, ember mark: the stamp uses --verified
// in-product to mean "this one is kept", but an app icon is the brand, not a
// verification state, so it takes the primary accent.
const PAPER = [246, 241, 232];
const EMBER = [185, 66, 43];

const SS = 4; // supersample factor

/** Distance from p to the outline of an ellipse, in stamp units. */
function ellipseEdgeDistance(px, py, cx, cy, rx, ry, rotationDeg) {
  const a = (rotationDeg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const x = dx * Math.cos(a) + dy * Math.sin(a);
  const y = -dx * Math.sin(a) + dy * Math.cos(a);
  const k = Math.hypot(x / rx, y / ry);
  return (k - 1) * Math.min(rx, ry);
}

/** Distance from p to a line segment, in stamp units. */
function segmentDistance(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(wx - t * vx, wy - t * vy);
}

/**
 * Ink coverage at a point in the 24-unit stamp space, 0..1.
 *
 * The rings are ellipses rotated a few degrees off each other rather than
 * concentric circles, which is what gives §6's "hand-drawn-feel" at size -
 * two perfect circles read as an icon from a set, not as a pressed seal.
 */
function stampCoverage(x, y, aa) {
  const cover = (d, halfWidth) => {
    const e = Math.abs(d) - halfWidth;
    return Math.max(0, Math.min(1, 0.5 - e / aa));
  };

  const outer = cover(ellipseEdgeDistance(x, y, 12, 12, 10.45, 10.3, 4), 0.45);
  const inner = cover(ellipseEdgeDistance(x, y, 12.05, 12, 6.95, 7.05, -6), 0.85);
  const tick = cover(segmentDistance(x, y, 10.45, 13.25, 13.6, 10.1) - 0, 1.0);

  return Math.max(outer, inner, tick);
}

function renderIcon(size, { markScale }) {
  const rgb = Buffer.alloc(size * size * 3);
  // The mark occupies `markScale` of the canvas, centred. A maskable icon
  // needs its content inside the inner 80%, because the launcher crops the
  // rest to whatever shape the device uses.
  const unit = (size * markScale) / 24;
  const offset = (size - 24 * unit) / 2;
  // Anti-aliasing width, expressed in stamp units, for one supersample step.
  const aa = 1 / (unit * SS);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let acc = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = (px + (sx + 0.5) / SS - offset) / unit;
          const fy = (py + (sy + 0.5) / SS - offset) / unit;
          acc += stampCoverage(fx, fy, aa);
        }
      }
      const a = acc / (SS * SS);
      const idx = (size * py + px) * 3;
      // Composited onto the paper ground rather than left transparent -
      // a transparent app icon renders as a black square on some launchers.
      rgb[idx] = Math.round(PAPER[0] + (EMBER[0] - PAPER[0]) * a);
      rgb[idx + 1] = Math.round(PAPER[1] + (EMBER[1] - PAPER[1]) * a);
      rgb[idx + 2] = Math.round(PAPER[2] + (EMBER[2] - PAPER[2]) * a);
    }
  }
  return encodePng(size, size, rgb);
}

const TARGETS = [
  { file: "icon-192.png", size: 192, markScale: 0.74 },
  { file: "icon-512.png", size: 512, markScale: 0.74 },
  // Safe zone: the mark stays well inside the inner 80% the mask may keep.
  { file: "icon-maskable-512.png", size: 512, markScale: 0.56 },
  { file: "apple-touch-icon.png", size: 180, markScale: 0.72 },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size, markScale } of TARGETS) {
  const buffer = renderIcon(size, { markScale });
  writeFileSync(join(OUT_DIR, file), buffer);
  console.log(`${file.padEnd(26)} ${size}x${size}  ${(buffer.length / 1024).toFixed(1)} KB`);
}
