// Draws Mindle's logo and app icons and saves them in icons/. No dependencies.
// Run from the mindle folder:  node tools/make-icons.mjs
//
// The logo: the owl of Minerva (the Roman goddess of wisdom's owl, a symbol of
// philosophy) at dusk. Its eyes are the game's feedback tiles, green and amber,
// glancing up at an amber crescent moon. Its beak is the grey tile colour.
//
// The logo is a list of simple shapes on a 100 x 100 grid (see logo() below).
// The same list is drawn two ways: as an SVG (sharp at any size, used for the
// browser tab and the page header) and as PNG pictures for phones' home screens.
// Change a colour or a number and run this again to redraw everything.

import fs from 'node:fs';
import zlib from 'node:zlib';

const OUT = new URL('../icons/', import.meta.url);

const C = {
  indigo: '#4b3fc4', // Mindle's accent colour
  night: '#2c2580', // darker indigo for the branch
  cream: '#f6f5f1', // the page background colour, used for the owl
  wing: '#dedaf5',
  feather: '#b5aeea',
  green: '#2f7a43', // the feedback colours
  amber: '#f0b429',
  grey: '#6b7079',
  ink: '#1d1f23',
  white: '#ffffff',
};

// ---------- the design ----------

// Shapes are drawn in order, so later ones sit on top.
function logo({ rounded }) {
  return [
    { type: 'rect', x: 0, y: 0, w: 100, h: 100, r: rounded ? 22 : 0, fill: C.indigo },

    // Dusk sky: a crescent moon (one circle with another cut out of it) and two stars.
    { type: 'crescent', cx: 76, cy: 24, r: 10.5, cutX: 80.5, cutY: 20, cutR: 9, fill: C.amber },
    { type: 'circle', cx: 19, cy: 22, r: 1.7, fill: C.cream },
    { type: 'circle', cx: 27, cy: 13, r: 1.1, fill: C.cream },

    // The branch the owl sits on.
    { type: 'line', points: [[16, 86], [84, 86]], width: 3.4, fill: C.night },

    // Body: two feathery ear tufts that flick outwards, a dip across the top of
    // the head, then round sides and a round bottom.
    { type: 'path', fill: C.cream, d: 'M 29.5 17.5 Q 33 26 39.5 30.5 Q 50 27 60.5 30.5 Q 67 26 70.5 17.5 Q 77.5 32 77 52 C 77 72 65 84.5 50 84.5 C 35 84.5 23 72 23 52 Q 22.5 32 29.5 17.5 Z' },

    // Folded wings: a rounded shoulder that tapers down each side.
    { type: 'path', fill: C.wing, d: 'M 24.3 58 Q 30.5 54.5 33.6 60 Q 36 71 40.5 82.8 Q 29.5 78.5 25.6 69 Q 23.8 63 24.3 58 Z' },
    { type: 'path', fill: C.wing, d: 'M 75.7 58 Q 69.5 54.5 66.4 60 Q 64 71 59.5 82.8 Q 70.5 78.5 74.4 69 Q 76.2 63 75.7 58 Z' },

    // Chest feathers: small separate V marks in staggered rows.
    ...[[45, 66.5], [55, 66.5], [50, 71.5], [45, 76.5], [55, 76.5]].map(([x, y]) => (
      { type: 'line', points: [[x - 2.1, y], [x, y + 2], [x + 2.1, y]], width: 1.6, fill: C.feather })),

    // Eyes: two feedback tiles, green and amber.
    { type: 'rect', x: 31, y: 37.5, w: 17.5, h: 17.5, r: 5, fill: C.green },
    { type: 'rect', x: 51.5, y: 37.5, w: 17.5, h: 17.5, r: 5, fill: C.amber },
    // Pupils, glancing up towards the moon, with a small shine on each.
    { type: 'circle', cx: 41.4, cy: 45, r: 4.3, fill: C.ink },
    { type: 'circle', cx: 61.9, cy: 45, r: 4.3, fill: C.ink },
    { type: 'circle', cx: 40.1, cy: 43.6, r: 1.4, fill: C.white },
    { type: 'circle', cx: 60.6, cy: 43.6, r: 1.4, fill: C.white },

    // Beak, in the grey tile colour.
    { type: 'path', fill: C.grey, d: 'M 46 57.3 Q 50 56 54 57.3 L 50 64.3 Z' },

    // Feet gripping the branch.
    { type: 'circle', cx: 44.5, cy: 85.2, r: 2.5, fill: C.amber },
    { type: 'circle', cx: 55.5, cy: 85.2, r: 2.5, fill: C.amber },
  ];
}

const icons = [
  { file: 'icon-192.png', size: 192, rounded: true },
  { file: 'icon-512.png', size: 512, rounded: true },
  // "Maskable" icons and Apple's icon fill the whole square: the phone cuts its own shape.
  { file: 'maskable-512.png', size: 512, rounded: false },
  { file: 'apple-touch-icon.png', size: 180, rounded: false },
];

fs.mkdirSync(OUT, { recursive: true });
for (const icon of icons) {
  const shapes = prepare(logo({ rounded: icon.rounded }));
  fs.writeFileSync(new URL(icon.file, OUT), drawPng(shapes, icon.size));
  console.log(`icons/${icon.file}  ${icon.size}x${icon.size}`);
}
fs.writeFileSync(new URL('icon.svg', OUT), drawSvg(logo({ rounded: true })));
console.log('icons/icon.svg');

// ---------- turning shapes into SVG ----------

function drawSvg(shapes) {
  const parts = shapes.map((s, i) => {
    switch (s.type) {
      case 'rect': return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${s.fill}"/>`;
      case 'circle': return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${s.fill}"/>`;
      case 'path': return `<path d="${s.d}" fill="${s.fill}"/>`;
      case 'line': return `<polyline points="${s.points.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${s.fill}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
      case 'crescent': return [
        `<mask id="cut${i}"><rect width="100" height="100" fill="#fff"/><circle cx="${s.cutX}" cy="${s.cutY}" r="${s.cutR}" fill="#000"/></mask>`,
        `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${s.fill}" mask="url(#cut${i})"/>`,
      ].join('\n  ');
      default: throw new Error(`unknown shape ${s.type}`);
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n  ${parts.join('\n  ')}\n</svg>\n`;
}

// ---------- turning shapes into pixels ----------

// Work out each shape's outline and bounding box once, before drawing.
function prepare(shapes) {
  return shapes.map((s) => {
    const shape = { ...s, rgb: hexToRgb(s.fill) };
    if (s.type === 'path') shape.polygon = flattenPath(s.d);
    const pts = s.type === 'path' ? shape.polygon : s.type === 'line' ? s.points : null;
    if (pts) {
      const pad = s.type === 'line' ? s.width / 2 : 0;
      shape.box = [
        Math.min(...pts.map((p) => p[0])) - pad, Math.min(...pts.map((p) => p[1])) - pad,
        Math.max(...pts.map((p) => p[0])) + pad, Math.max(...pts.map((p) => p[1])) + pad,
      ];
    } else if (s.type === 'rect') {
      shape.box = [s.x, s.y, s.x + s.w, s.y + s.h];
    } else {
      shape.box = [s.cx - s.r, s.cy - s.r, s.cx + s.r, s.cy + s.r];
    }
    return shape;
  });
}

// Is the point (x, y), in 0-100 units, inside this shape?
function inside(s, x, y) {
  const [x0, y0, x1, y1] = s.box;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  switch (s.type) {
    case 'rect': {
      const dx = Math.max(s.x + s.r - x, 0, x - (s.x + s.w - s.r));
      const dy = Math.max(s.y + s.r - y, 0, y - (s.y + s.h - s.r));
      return dx * dx + dy * dy <= s.r * s.r;
    }
    case 'circle': return (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r;
    case 'crescent': return (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r
      && (x - s.cutX) ** 2 + (y - s.cutY) ** 2 > s.cutR * s.cutR;
    case 'path': return insidePolygon(s.polygon, x, y);
    case 'line':
      for (let i = 1; i < s.points.length; i++) {
        if (distanceToSegment(x, y, s.points[i - 1], s.points[i]) <= s.width / 2) return true;
      }
      return false;
    default: return false;
  }
}

// Each pixel is sampled 4 x 4 times and averaged, which smooths the edges.
function drawPng(shapes, size) {
  const SAMPLES = 4;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = ((px + (sx + 0.5) / SAMPLES) / size) * 100;
          const y = ((py + (sy + 0.5) / SAMPLES) / size) * 100;
          // Check from the top shape down: the first one that covers the point wins.
          let colour = null;
          for (let k = shapes.length - 1; k >= 0; k--) {
            if (inside(shapes[k], x, y)) { colour = shapes[k].rgb; break; }
          }
          if (!colour) continue;
          r += colour[0]; g += colour[1]; b += colour[2]; a += 1;
        }
      }
      const i = (py * size + px) * 4;
      if (a) {
        pixels[i] = Math.round(r / a);
        pixels[i + 1] = Math.round(g / a);
        pixels[i + 2] = Math.round(b / a);
      }
      pixels[i + 3] = Math.round((a / (SAMPLES * SAMPLES)) * 255);
    }
  }
  return encodePng(size, size, pixels);
}

// Turns SVG path commands (M, L, Q, C, Z with absolute numbers) into a list of
// points, by splitting each curve into many short straight steps.
function flattenPath(d) {
  const tokens = d.match(/[MLQCZ]|-?\d*\.?\d+/g);
  const points = [];
  let i = 0;
  let current = [0, 0];
  const num = () => Number(tokens[i++]);
  const STEPS = 24;
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M' || command === 'L') {
      current = [num(), num()];
      points.push(current);
    } else if (command === 'Q') {
      const c = [num(), num()], end = [num(), num()], start = current;
      for (let t = 1; t <= STEPS; t++) {
        const u = t / STEPS, v = 1 - u;
        points.push([v * v * start[0] + 2 * v * u * c[0] + u * u * end[0], v * v * start[1] + 2 * v * u * c[1] + u * u * end[1]]);
      }
      current = end;
    } else if (command === 'C') {
      const c1 = [num(), num()], c2 = [num(), num()], end = [num(), num()], start = current;
      for (let t = 1; t <= STEPS; t++) {
        const u = t / STEPS, v = 1 - u;
        points.push([
          v ** 3 * start[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u ** 3 * end[0],
          v ** 3 * start[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u ** 3 * end[1],
        ]);
      }
      current = end;
    }
    // Z (close the shape) needs nothing: the polygon test joins the last point to the first.
  }
  return points;
}

// Classic "ray casting": count how many edges a line to the right of the point crosses.
function insidePolygon(poly, x, y) {
  let crossings = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) crossings = !crossings;
  }
  return crossings;
}

function distanceToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255];
}

// ---------- the PNG file format ----------
// A PNG is a signature followed by "chunks": IHDR (size and colour type),
// IDAT (the pixels, zlib-compressed, each row starting with a 0 byte) and IEND.
function encodePng(width, height, rgba) {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // 8 bits per channel
  header[9] = 6; // red, green, blue and alpha (see-through)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([length, body, crc]);
}
