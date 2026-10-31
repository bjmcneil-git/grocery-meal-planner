// Draws the app icon and writes every size the app needs.
// Usage: node scripts/generate-icons.mjs [previewDir]
// With previewDir, all files go there instead of public/ and app/.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const previewDir = process.argv[2];

const CANVAS = 1024;
const ART_CENTER = { x: 515, y: 486 };
const CORNER_RADIUS = 230;

// Art is drawn at 1024 units, then scaled around its center for each output.
const SCALE_ROUNDED = 1.06;
const SCALE_MASKABLE = 0.84; // keeps the art inside Android's safe circle (80% of the width)

function leaf(x, y, length, width, angle) {
  const w = width / 2;
  const l = length;
  return `<g transform="translate(${x} ${y}) rotate(${angle})">
    <path d="M0 0 C${w * 1.3} ${-l * 0.2} ${w * 1.2} ${-l * 0.75} 0 ${-l} C${-w * 1.2} ${-l * 0.75} ${-w * 1.3} ${-l * 0.2} 0 0Z" fill="url(#leaf)"/>
    <path d="M0 0 L0 ${-l * 0.88}" stroke="#14701f" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M0 ${-l * 0.3} L${w * 0.55} ${-l * 0.48} M0 ${-l * 0.3} L${-w * 0.55} ${-l * 0.48} M0 ${-l * 0.55} L${w * 0.45} ${-l * 0.72} M0 ${-l * 0.55} L${-w * 0.45} ${-l * 0.72}" stroke="#14701f" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.75"/>
  </g>`;
}

function grape(x, y, r = 46) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#grape)"/>
    <ellipse cx="${x - r * 0.32}" cy="${y - r * 0.38}" rx="${r * 0.24}" ry="${r * 0.16}" fill="#fff" opacity="0.7" transform="rotate(-30 ${x - r * 0.32} ${y - r * 0.38})"/>`;
}

const defs = `<defs>
  <radialGradient id="bg" cx="50%" cy="44%" r="72%">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.6" stop-color="#fff0f6"/>
    <stop offset="1" stop-color="#fbcfe2"/>
  </radialGradient>
  <linearGradient id="front" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f973b0"/>
    <stop offset="0.5" stop-color="#e73a8a"/>
    <stop offset="1" stop-color="#db2777"/>
  </linearGradient>
  <linearGradient id="side" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#be185d"/>
    <stop offset="1" stop-color="#8f1450"/>
  </linearGradient>
  <linearGradient id="gusset" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#a81660"/>
    <stop offset="1" stop-color="#e0408a"/>
  </linearGradient>
  <linearGradient id="bread" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#f6d596"/>
    <stop offset="1" stop-color="#c98a3c"/>
  </linearGradient>
  <radialGradient id="apple" cx="50%" cy="50%" r="62%" fx="32%" fy="26%">
    <stop offset="0" stop-color="#ff7a66"/>
    <stop offset="0.42" stop-color="#e8212b"/>
    <stop offset="1" stop-color="#9c0b1b"/>
  </radialGradient>
  <radialGradient id="grape" cx="50%" cy="50%" r="60%" fx="34%" fy="28%">
    <stop offset="0" stop-color="#ad84e6"/>
    <stop offset="0.55" stop-color="#5c2ba0"/>
    <stop offset="1" stop-color="#2c0f5c"/>
  </radialGradient>
  <linearGradient id="banana" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff07a"/>
    <stop offset="0.55" stop-color="#fbcb1a"/>
    <stop offset="1" stop-color="#e79c08"/>
  </linearGradient>
  <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#8fe040"/>
    <stop offset="1" stop-color="#2c9a2a"/>
  </linearGradient>
  <linearGradient id="handle" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ec4899"/>
    <stop offset="1" stop-color="#a81660"/>
  </linearGradient>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="20"/>
  </filter>
  <filter id="softer" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="9"/>
  </filter>
</defs>`;

const art = `
  <ellipse cx="530" cy="868" rx="350" ry="40" fill="#831843" opacity="0.4" filter="url(#soft)"/>

  <!-- Behind the bag -->
  <g transform="translate(275 280) rotate(-18)">
    <rect x="-44" y="-170" width="88" height="360" rx="44" fill="url(#bread)"/>
    <path d="M-14 -125 L16 -95 M-14 -70 L16 -40 M-14 -15 L16 15" stroke="#fdeecb" stroke-width="11" stroke-linecap="round"/>
  </g>
  <path d="M410 400 C410 -10 715 -10 715 470" fill="none" stroke="url(#handle)" stroke-width="32" stroke-linecap="round"/>

  <path d="M640 520 C760 520 872 400 838 190 L806 190 C800 300 740 390 640 440Z" fill="url(#banana)"/>
  <path d="M672 478 C755 455 822 365 824 215" fill="none" stroke="#c98a06" stroke-width="7" stroke-linecap="round" opacity="0.65"/>
  <path d="M806 193 L811 138 L842 144 L838 193Z" fill="#8a6d1c"/>

  ${grape(525, 250)}
  ${grape(590, 232)}
  ${grape(625, 295)}
  ${grape(500, 325)}
  ${grape(565, 312)}
  ${grape(625, 365)}

  <!-- Apple -->
  <ellipse cx="395" cy="400" rx="150" ry="135" fill="#4a0a2a" opacity="0.3" filter="url(#softer)" transform="translate(16 12)"/>
  <path d="M370 268 C320 228 215 245 205 355 C197 450 270 525 330 525 C350 525 360 515 372 515 C384 515 400 525 420 525 C490 525 540 445 530 355 C520 245 420 232 370 268Z" fill="url(#apple)"/>
  <path d="M372 275 C368 245 356 220 332 200" fill="none" stroke="#7a4a1e" stroke-width="20" stroke-linecap="round"/>
  <ellipse cx="282" cy="330" rx="34" ry="52" fill="#fff" opacity="0.45" transform="rotate(26 282 330)"/>
  ${leaf(362, 238, 105, 60, 68)}

  <!-- Grapes spilling over the apple -->
  ${grape(535, 415, 44)}
  ${grape(600, 400, 44)}
  ${grape(662, 438, 44)}
  ${grape(570, 468, 44)}
  ${grape(635, 490, 44)}

  <!-- Bag -->
  <path d="M720 470 L786 494 L850 430 L850 790 L715 872Z" fill="url(#side)"/>
  <path d="M715 872 L786 690 L850 790Z" fill="url(#gusset)"/>
  <path d="M786 494 L786 690" stroke="#5e0c35" stroke-width="5" opacity="0.45"/>
  <path d="M190 440 Q430 525 720 470 L715 872 L198 822Z" fill="url(#front)"/>
  <path d="M190 440 Q430 525 720 470" fill="none" stroke="#ffd3e6" stroke-width="9" stroke-linecap="round" opacity="0.9"/>

  <!-- Leaf emblem -->
  <path d="M618 545 C480 548 340 590 322 708 C316 748 330 772 345 788 C362 804 432 804 492 773 C578 732 618 645 618 545Z" fill="#fff"/>
  <path d="M350 786 C392 716 452 664 560 625 C470 680 420 730 382 794Z" fill="#e73a8a"/>
  <path d="M345 788 L330 828" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
`;

function iconSvg({ scale, rounded }) {
  const clip = rounded
    ? `<clipPath id="corners"><rect width="${CANVAS}" height="${CANVAS}" rx="${CORNER_RADIUS}"/></clipPath>`
    : "";
  const rim = rounded
    ? `<rect x="6" y="6" width="${CANVAS - 12}" height="${CANVAS - 12}" rx="${CORNER_RADIUS - 6}" fill="none" stroke="#f472b6" stroke-width="12" opacity="0.9"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
    ${defs}${clip}
    <g ${rounded ? 'clip-path="url(#corners)"' : ""}>
      <rect width="${CANVAS}" height="${CANVAS}" fill="url(#bg)"/>
      <g transform="translate(${CANVAS / 2} ${CANVAS / 2}) scale(${scale}) translate(${-ART_CENTER.x} ${-ART_CENTER.y})">${art}</g>
      ${rim}
    </g>
  </svg>`;
}

async function renderPng(options, size) {
  return sharp(Buffer.from(iconSvg(options)), { density: 144 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// An .ico is a small header followed by the PNG for each size.
function buildIco(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

function save(relativePath, data) {
  const path = previewDir
    ? join(previewDir, relativePath.split("/").pop())
    : join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(path, data.length);
}

const rounded = { scale: SCALE_ROUNDED, rounded: true };
const maskable = { scale: SCALE_MASKABLE, rounded: false };
const apple = { scale: SCALE_ROUNDED, rounded: false }; // iOS rounds the corners itself

save("public/icon-192.png", await renderPng(rounded, 192));
save("public/icon-512.png", await renderPng(rounded, 512));
save("public/icon-maskable-512.png", await renderPng(maskable, 512));
save("app/apple-icon.png", await renderPng(apple, 180));

const faviconSizes = [16, 32, 48];
const favicons = await Promise.all(
  faviconSizes.map(async (size) => ({ size, data: await renderPng(rounded, size) }))
);
save("app/favicon.ico", buildIco(favicons));
