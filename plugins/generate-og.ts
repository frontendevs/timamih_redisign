/**
 * One-time script: generate OG image 1200×630 for timamih.com.
 * Run: vite-node plugins/generate-og.ts
 */

import sharp from "sharp";

const W = 1200;
const H = 630;

// timamih brand tokens (approximate hex from oklch/hsl)
const BG = "#363636"; // timamih dark bg  oklch(28% 0 90)
const CREAM = "#FFF5EC"; // surface-200    oklch(97% 0.022 71.2)
const CREAM_MUTED = "#C4B5AA"; // warm muted
const VIOLET = "#7454D8"; // brand-500      oklch(56.5% 0.231 295.6)
const VIOLET_DIM = "#7454D820"; // violet 12% opacity — decorative bg circle

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="clip"><rect width="${W}" height="${H}"/></clipPath>
  </defs>

  <!-- background -->
  <rect width="${W}" height="${H}" fill="${BG}"/>

  <!-- decorative circles -->
  <circle cx="1080" cy="80"  r="280" fill="${VIOLET_DIM}" clip-path="url(#clip)"/>
  <circle cx="1140" cy="590" r="180" fill="${VIOLET_DIM}" clip-path="url(#clip)"/>
  <circle cx="-20"  cy="560" r="120" fill="${VIOLET_DIM}" clip-path="url(#clip)"/>

  <!-- violet accent bar -->
  <rect x="80" y="200" width="6" height="200" rx="3" fill="${VIOLET}"/>

  <!-- wordmark -->
  <text x="112" y="316"
    font-family="system-ui, -apple-system, Helvetica Neue, sans-serif"
    font-size="108"
    font-weight="700"
    letter-spacing="-3"
    fill="${CREAM}">timamih</text>

  <!-- agency label -->
  <text x="114" y="376"
    font-family="system-ui, -apple-system, Helvetica Neue, sans-serif"
    font-size="34"
    font-weight="400"
    letter-spacing="1"
    fill="${VIOLET}">Creative HR Agency</text>

  <!-- location -->
  <text x="114" y="428"
    font-family="system-ui, -apple-system, Helvetica Neue, sans-serif"
    font-size="26"
    font-weight="400"
    fill="${CREAM_MUTED}">Helsinki, Finland</text>

  <!-- domain — bottom right -->
  <text x="${W - 80}" y="${H - 48}"
    font-family="system-ui, -apple-system, Helvetica Neue, sans-serif"
    font-size="24"
    font-weight="400"
    text-anchor="end"
    fill="${CREAM_MUTED}">timamih.com</text>
</svg>`;

await sharp(Buffer.from(svg)).webp({ quality: 90 }).toFile("public/assets/images/og/og-16x9.webp");

console.log("✓ public/assets/images/og/og-16x9.webp generated (1200×630)");
