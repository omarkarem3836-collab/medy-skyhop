import { getDestination } from './destinations.js';
import { CLASSIC_SETTINGS } from './engine.js';
import { MEDSKY } from './palette.js';
import { createScenery } from './scenery.js';

// Physics and artwork share fixed logical coordinates on every phone.
const W = 420;
const H = 760;
const GROUND = 696;
const TAU = Math.PI * 2;
const clouds = [
  { x: -65, y: 174, s: 1.24, a: .78, speed: .12 },
  { x: 315, y: 105, s: .86, a: .62, speed: .09 },
  { x: 140, y: 462, s: 1.65, a: .47, speed: .07 },
  { x: 415, y: 364, s: 1.28, a: .64, speed: .15 },
  { x: -30, y: 551, s: 1.3, a: .78, speed: .18 },
  { x: 256, y: 541, s: .74, a: .55, speed: .11 },
];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, length) => ((value % length) + length) % length;
const mixColor = (from, to, amount) => {
  const a = Number.parseInt(from.slice(1), 16);
  const b = Number.parseInt(to.slice(1), 16);
  const channels = [16, 8, 0].map(shift => Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount));
  return `rgb(${channels.join(',')})`;
};
// Tonal depth comes from the brand's blue, lavender and pearl, never city-specific hues.
const CITY = Object.freeze({
  light: MEDSKY.white,
  face: mixColor(MEDSKY.elegance, MEDSKY.pearl, .2),
  edge: mixColor(MEDSKY.blue, MEDSKY.elegance, .8),
  side: mixColor(MEDSKY.blue, MEDSKY.elegance, .55),
  shadow: mixColor(MEDSKY.navy, MEDSKY.elegance, .35),
});

export async function createRenderer(canvas) {
  let ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Your browser does not support the game canvas.');
  const transitionCanvas = canvas.ownerDocument.createElement('canvas');
  const transitionContext = transitionCanvas.getContext('2d', { alpha: false });
  const sceneryRenderer = createScenery(canvas.ownerDocument, (artContext, city) => {
    const mainContext = ctx;
    try { ctx = artContext; landmark(city, 1); }
    finally { ctx = mainContext; }
  });
  const medy = new Image();
  await new Promise((resolve, reject) => {
    medy.onload = resolve;
    medy.onerror = () => reject(new Error('Medy could not load. Please refresh and try again.'));
    medy.src = new URL('./assets/medy-flying-right.png', import.meta.url).href;
  });
  let clock = 0;
  let readyTravel = 0;
  let pixelWidth = 0;
  let pixelHeight = 0;
  let particles = [];
  let lastState = 'ready';
  let lastReducedMotion = false;
  let destination = getDestination(0);
  let previousDestination = destination;
  let destinationBlend = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round((rect.width || W) * ratio));
    const height = Math.max(1, Math.round((rect.height || H) * ratio));
    if (width !== pixelWidth || height !== pixelHeight) {
      canvas.width = pixelWidth = width;
      canvas.height = pixelHeight = height;
      transitionCanvas.width = width;
      transitionCanvas.height = height;
    }
    ctx.setTransform(pixelWidth / W, 0, 0, pixelHeight / H, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  function roundedRect(x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2));
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function cloud(x, y, scale, opacity) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = opacity;
    const gradient = ctx.createLinearGradient(0, -39, 0, 21);
    gradient.addColorStop(0, MEDSKY.white);
    gradient.addColorStop(.68, MEDSKY.white);
    gradient.addColorStop(1, MEDSKY.pearl);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-71, 15);
    ctx.bezierCurveTo(-97, 13, -94, -15, -65, -16);
    ctx.bezierCurveTo(-63, -43, -21, -49, -7, -25);
    ctx.bezierCurveTo(12, -54, 51, -41, 51, -14);
    ctx.bezierCurveTo(80, -23, 97, -4, 82, 13);
    ctx.bezierCurveTo(58, 24, -50, 25, -71, 15);
    ctx.fill();
    ctx.restore();
  }

  function sparkle(x, y, radius, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.quadraticCurveTo(x + radius * .16, y - radius * .16, x + radius, y);
    ctx.quadraticCurveTo(x + radius * .16, y + radius * .16, x, y + radius);
    ctx.quadraticCurveTo(x - radius * .16, y + radius * .16, x - radius, y);
    ctx.quadraticCurveTo(x - radius * .16, y - radius * .16, x, y - radius);
    ctx.fill();
    ctx.restore();
  }

  function sky(travel, reducedMotion) {
    const gradient = ctx.createLinearGradient(0, 0, 0, GROUND);
    gradient.addColorStop(0, mixColor(previousDestination.skyTop, destination.skyTop, destinationBlend));
    // Use the brand's light supporting colors for a visibly daytime sky.
    gradient.addColorStop(.55, mixColor(MEDSKY.elegance, MEDSKY.pearl, .6));
    gradient.addColorStop(1, mixColor(previousDestination.skyBottom, destination.skyBottom, destinationBlend));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const sunX = 352;
    const sunY = 65;
    const sun = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 92);
    sun.addColorStop(0, `${MEDSKY.gold}55`);
    sun.addColorStop(.4, `${MEDSKY.gold}20`);
    sun.addColorStop(1, `${MEDSKY.gold}00`);
    ctx.fillStyle = sun;
    ctx.fillRect(sunX - 92, sunY - 92, 184, 184);
    ctx.save();
    ctx.strokeStyle = `${MEDSKY.gold}99`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let ray = 0; ray < 12; ray++) {
      const angle = ray * TAU / 12;
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(angle) * 36, sunY + Math.sin(angle) * 36);
      ctx.lineTo(sunX + Math.cos(angle) * 43, sunY + Math.sin(angle) * 43);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = MEDSKY.gold;
    ctx.beginPath(); ctx.arc(sunX, sunY, 25, 0, TAU); ctx.fill();

    // Distant flight trail.
    ctx.save();
    ctx.strokeStyle = `${MEDSKY.airforce}30`;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 8]);
    ctx.lineDashOffset = reducedMotion ? 0 : -clock * 7;
    ctx.beginPath();
    ctx.moveTo(-12, 391);
    ctx.bezierCurveTo(103, 431, 251, 427, 348, 289);
    ctx.bezierCurveTo(414, 193, 431, 254, 445, 251);
    ctx.stroke();
    ctx.restore();

    for (const c of clouds) {
      const x = wrap(c.x - travel * c.speed + 140, 720) - 140;
      if (x + 100 * c.s < 0 || x - 100 * c.s > W) continue;
      cloud(x, c.y, c.s, c.a);
    }

    // Distant, tiny seabirds.
    ctx.strokeStyle = `${MEDSKY.airforce}55`;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x = wrap(66 + i * 22 - travel * .025, 520) - 30;
      const y = 280 + i * 7;
      const wing = reducedMotion ? 2 : Math.sin(clock * 1.8 + i) * 2 + 2;
      ctx.beginPath(); ctx.moveTo(x - 5, y - wing); ctx.quadraticCurveTo(x - 2, y - 3, x, y);
      ctx.quadraticCurveTo(x + 2, y - 3, x + 5, y - wing); ctx.stroke();
    }
  }

  function polygon(points, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fill();
  }

  function arch(x, y, width, height, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(x, y + height); ctx.lineTo(x, y + width / 2);
    ctx.arc(x + width / 2, y + width / 2, width / 2, Math.PI, 0);
    ctx.lineTo(x + width, y + height); ctx.closePath(); ctx.fill();
  }

  function landmark(city, alpha) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha;
    // Sunlit landmarks are painted once into a compact, high-resolution city layer.
    const light = CITY.light;
    const shade = CITY.shadow;
    const proportions = {
      malta: [1.09, 1.68], rome: [1.18, 2.06], milan: [1.25, 1.48],
      athens: [1.17, 1.79], madrid: [1.2, 1.84], dusseldorf: [1.24, 1.36], paris: [1.42, 1.36],
    };
    ctx.translate(city.id === 'paris' ? 278 : 254, 626);
    ctx.scale(...proportions[city.id]);
    if (city.id === 'malta') {
      // Valletta: the great dome, slender cathedral bell tower and sea bastions.
      ctx.fillStyle = CITY.face; ctx.fillRect(-122, -25, 226, 27);
      polygon([[-130, -4], [-119, -27], [-34, -27], [-18, -12], [84, -15], [115, 7]], CITY.side);
      const facade = ctx.createLinearGradient(-46, 0, 18, 0);
      facade.addColorStop(0, CITY.light); facade.addColorStop(.62, CITY.face); facade.addColorStop(1, CITY.side);
      ctx.fillStyle = facade; ctx.fillRect(-46, -57, 64, 47);
      ctx.fillStyle = CITY.side; ctx.fillRect(-42, -67, 56, 13);
      const dome = ctx.createLinearGradient(-46, -70, 18, -70);
      dome.addColorStop(0, CITY.edge); dome.addColorStop(.38, CITY.light); dome.addColorStop(1, CITY.side);
      ctx.fillStyle = dome; ctx.beginPath(); ctx.ellipse(-14, -67, 32, 28, 0, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = CITY.light; ctx.lineWidth = 1.8;
      for (const offset of [-17, 0, 17]) { ctx.beginPath(); ctx.moveTo(-14, -94); ctx.quadraticCurveTo(-14 + offset, -88, -14 + offset * 1.5, -66); ctx.stroke(); }
      ctx.fillStyle = CITY.edge; ctx.fillRect(-19, -101, 10, 9);
      polygon([[-21, -101], [-14, -109], [-7, -101]], CITY.shadow);
      ctx.strokeStyle = shade; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-14, -113); ctx.lineTo(-14, -106); ctx.moveTo(-17, -111); ctx.lineTo(-11, -111); ctx.stroke();
      for (let i = 0; i < 5; i++) arch(-40 + i * 12, -51, 5, 21, CITY.shadow);
      ctx.fillStyle = CITY.face; ctx.fillRect(45, -86, 20, 69);
      ctx.fillStyle = CITY.side; ctx.fillRect(60, -85, 5, 68);
      ctx.fillStyle = CITY.side; ctx.fillRect(43, -90, 24, 5);
      arch(50, -80, 10, 17, CITY.shadow);
      polygon([[44, -91], [55, -112], [66, -91]], CITY.side);
      ctx.fillStyle = CITY.light; ctx.fillRect(40, -59, 30, 4);
      for (let i = 0; i < 7; i++) ctx.fillRect(-116 + i * 32, -29, 16, 8);
      // Cut-stone bastions, balconies and cornices in Valletta's harbour skyline.
      ctx.strokeStyle = `${MEDSKY.navy}35`; ctx.lineWidth = .5;
      for (let row = 0; row < 4; row++) {
        const sy = -20 + row * 6;
        ctx.beginPath(); ctx.moveTo(-117, sy); ctx.lineTo(95, sy); ctx.stroke();
        for (let block = 0; block < 13; block++) {
          const sx = -118 + block * 18 + row % 2 * 9;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + 5); ctx.stroke();
        }
      }
      ctx.fillStyle = MEDSKY.gold; ctx.fillRect(-44, -60, 59, 1); ctx.fillRect(43, -90, 24, 1);
      ctx.fillStyle = CITY.shadow; ctx.fillRect(51, -50, 8, 11);
      ctx.fillStyle = CITY.light; ctx.fillRect(51, -50, 1, 11); ctx.fillRect(50, -38, 10, 1);
      for (const x of [-96, -74]) {
        ctx.fillStyle = CITY.face; ctx.fillRect(x, -47, 18, 21);
        ctx.fillStyle = CITY.side; ctx.fillRect(x + 14, -47, 4, 21);
        ctx.fillStyle = CITY.shadow; ctx.fillRect(x + 4, -40, 7, 8);
        ctx.fillStyle = MEDSKY.blue; ctx.fillRect(x + 2, -36, 11, 5);
        ctx.fillStyle = CITY.light; ctx.fillRect(x + 2, -36, 11, 1);
      }
    } else if (city.id === 'rome') {
      // Three sweeping arcades and the broken upper ring of the Colosseum.
      ctx.fillStyle = CITY.edge; ctx.beginPath(); ctx.ellipse(0, -4, 110, 15, 0, 0, TAU); ctx.fill();
      polygon([[-105, -54], [-91, -70], [-59, -82], [-7, -89], [47, -85], [63, -70], [84, -68], [106, -50], [106, -4], [-105, -4]], CITY.face);
      polygon([[62, -70], [84, -68], [106, -50], [106, -4], [78, 0]], CITY.edge);
      ctx.strokeStyle = CITY.side; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-99, -55); ctx.quadraticCurveTo(-42, -91, 42, -83); ctx.stroke();
      ctx.strokeStyle = CITY.light; ctx.lineWidth = 1.2; ctx.stroke();
      for (let row = 0; row < 3; row++) {
        const y = -68 + row * 23;
        for (let col = 0; col < 12; col++) {
          const x = -97 + col * 17;
          const curve = Math.abs(x + 7) / 100;
          if (row === 0 && col > 8) continue;
          arch(x, y + curve * 12, 9, 16, CITY.shadow);
          ctx.fillStyle = CITY.light; ctx.fillRect(x - 3, y + curve * 12, 2, 18);
        }
        ctx.strokeStyle = CITY.light; ctx.lineWidth = 2.3;
        ctx.beginPath(); ctx.moveTo(-105, y + 21); ctx.quadraticCurveTo(0, y + 42, 106, y + 21); ctx.stroke();
      }
      ctx.strokeStyle = CITY.shadow; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-101, -55); ctx.quadraticCurveTo(-66, -84, 36, -82); ctx.stroke();
      ctx.strokeStyle = `${MEDSKY.blue}33`; ctx.lineWidth = .5;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 11; col++) {
          const x = -91 + col * 17, y = -53 + row * 23 + Math.abs(x + 7) / 100 * 12;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5, y); ctx.stroke();
        }
      }
      ctx.fillStyle = CITY.side; ctx.fillRect(-106, -3, 214, 4);
      ctx.fillStyle = CITY.light; ctx.fillRect(-109, 1, 220, 2);
    } else if (city.id === 'milan') {
      // Milan Cathedral: layered Gothic pinnacles and a soaring central spire.
      ctx.fillStyle = CITY.face; ctx.fillRect(-93, -37, 186, 39);
      polygon([[-95, -35], [-66, -62], [-49, -47], [-24, -80], [0, -104], [24, -80], [49, -47], [66, -62], [95, -35]], light);
      polygon([[0, -104], [24, -80], [49, -47], [66, -62], [95, -35], [95, 0], [73, 0], [61, -50], [43, -36], [19, -72]], CITY.edge);
      const pinnacles = [[-90, -61], [-68, -79], [-47, -65], [-24, -94], [0, -127], [24, -94], [47, -65], [68, -79], [90, -61]];
      for (const [x, y] of pinnacles) {
        ctx.fillStyle = CITY.edge; ctx.fillRect(x - 2, y + 13, 4, -y - 7);
        polygon([[x - 5, y + 15], [x, y], [x + 5, y + 15]], CITY.side);
        ctx.fillStyle = CITY.light; ctx.fillRect(x - 1, y + 12, 1, 25);
      }
      ctx.fillStyle = CITY.edge; ctx.fillRect(-98, -5, 196, 6);
      arch(-10, -28, 20, 27, shade);
      for (const x of [-65, -37, 31, 59]) arch(x, -33, 8, 25, CITY.side);
      ctx.fillStyle = CITY.side; ctx.beginPath(); ctx.arc(0, -52, 12, 0, TAU); ctx.fill();
      ctx.strokeStyle = CITY.light; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -52, 8, 0, TAU); ctx.moveTo(-10, -52); ctx.lineTo(10, -52); ctx.moveTo(0, -62); ctx.lineTo(0, -42); ctx.stroke();
      ctx.fillStyle = MEDSKY.gold; ctx.beginPath(); ctx.arc(0, -129, 2, 0, TAU); ctx.fill();
      // Tracery windows, stone buttresses and a stepped cathedral square.
      for (const x of [-78, -56, -35, 27, 48, 70]) {
        arch(x, -49 + Math.abs(x) * .12, 7, 19, CITY.shadow);
        ctx.strokeStyle = CITY.light; ctx.lineWidth = .6;
        ctx.beginPath(); ctx.moveTo(x + 3.5, -42 + Math.abs(x) * .12); ctx.lineTo(x + 3.5, -27 + Math.abs(x) * .12); ctx.stroke();
      }
      for (const x of [-86, -63, -42, -19, 19, 42, 63, 86]) {
        ctx.fillStyle = CITY.edge; ctx.fillRect(x, -26, 2, 24);
        ctx.fillStyle = CITY.light; ctx.fillRect(x + 1, -26, .8, 24);
      }
      ctx.fillStyle = CITY.side; ctx.fillRect(-100, 1, 200, 3);
      ctx.fillStyle = CITY.light; ctx.fillRect(-104, 4, 208, 2);
      ctx.fillStyle = CITY.edge; ctx.fillRect(-108, 6, 216, 2);
    } else if (city.id === 'athens') {
      // The Parthenon on its limestone rise: pediment, Doric columns, steps.
      polygon([[-132, 8], [-106, -11], [-77, -17], [-47, -16], [35, -23], [91, -10], [120, 8]], CITY.edge);
      polygon([[-129, 8], [-90, -2], [-55, 0], [7, -9], [76, -7], [120, 8]], CITY.side);
      ctx.strokeStyle = CITY.light; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-101, -9); ctx.lineTo(-64, -12); ctx.lineTo(-43, -9); ctx.moveTo(35, -18); ctx.lineTo(77, -10); ctx.stroke();
      ctx.fillStyle = CITY.face; ctx.fillRect(-94, -14, 188, 8);
      ctx.fillStyle = CITY.light; ctx.fillRect(-89, -20, 178, 6);
      ctx.fillStyle = CITY.shadow; ctx.fillRect(-80, -66, 160, 46);
      for (let i = 0; i < 8; i++) {
        const x = -81 + i * 22;
        polygon([[x, -65], [x + 10, -65], [x + 12, -22], [x - 2, -22]], CITY.face);
        ctx.fillStyle = CITY.light; ctx.fillRect(x + 2, -64, 2, 39);
        ctx.strokeStyle = CITY.side; ctx.lineWidth = .45;
        for (let flute = 0; flute < 3; flute++) { ctx.beginPath(); ctx.moveTo(x + 4 + flute * 2, -61); ctx.lineTo(x + 4 + flute * 2, -25); ctx.stroke(); }
        ctx.fillStyle = CITY.edge; ctx.fillRect(x - 3, -69, 16, 5);
      }
      ctx.fillStyle = CITY.face; ctx.fillRect(-92, -75, 184, 8);
      polygon([[-98, -76], [0, -106], [98, -76]], CITY.face);
      polygon([[-73, -80], [0, -100], [73, -80]], CITY.side);
      ctx.fillStyle = CITY.light; ctx.fillRect(-97, -79, 194, 3);
      ctx.fillStyle = MEDSKY.gold; ctx.fillRect(-92, -76, 184, .75);
      ctx.strokeStyle = CITY.light; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(-71, -80); ctx.lineTo(0, -99); ctx.lineTo(71, -80); ctx.stroke();
      for (let i = 0; i < 13; i++) { ctx.fillStyle = CITY.shadow; ctx.fillRect(-79 + i * 13, -73, 3, 4); }
    } else if (city.id === 'madrid') {
      // Puerta de Alcalá: five openings beneath the sculpted central crown.
      ctx.fillStyle = CITY.face; ctx.fillRect(-98, -65, 196, 64);
      ctx.fillStyle = CITY.side; ctx.fillRect(86, -65, 12, 64);
      ctx.fillStyle = CITY.light; ctx.fillRect(-104, -69, 208, 7);
      ctx.fillStyle = CITY.edge; ctx.fillRect(-103, -6, 206, 8);
      for (const x of [-50, -12, 26]) arch(x, -47, 24, 46, CITY.shadow);
      ctx.fillStyle = CITY.shadow; ctx.fillRect(-85, -39, 18, 38); ctx.fillRect(67, -39, 18, 38);
      for (const x of [-96, -62, -20, 20, 60, 92]) {
        ctx.fillStyle = CITY.light; ctx.fillRect(x - 3, -57, 6, 51);
        ctx.fillStyle = CITY.edge; ctx.fillRect(x - 5, -60, 10, 4);
      }
      ctx.fillStyle = CITY.face; ctx.fillRect(-54, -84, 108, 15);
      polygon([[-57, -84], [0, -102], [57, -84]], CITY.face);
      ctx.fillStyle = CITY.light; ctx.fillRect(-22, -84, 44, 4);
      for (const x of [-88, -61, -27, 27, 61, 88]) {
        ctx.fillStyle = CITY.edge; ctx.beginPath(); ctx.arc(x, -80, 3, 0, TAU); ctx.fill();
        polygon([[x, -80], [x - 5, -70], [x + 5, -70]], CITY.edge);
      }
      ctx.fillStyle = CITY.side; ctx.beginPath(); ctx.ellipse(0, -88, 7, 9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = CITY.light; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(0, -88, 5, 7, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = MEDSKY.gold; ctx.fillRect(-2, -90, 4, 4);
      ctx.fillStyle = CITY.edge; ctx.fillRect(-22, -73, 44, 12);
      ctx.fillStyle = CITY.light; ctx.fillRect(-19, -71, 38, 1);
      for (let i = 0; i < 7; i++) { ctx.fillStyle = CITY.shadow; ctx.fillRect(-15 + i * 4.5, -67, 2, 1); }
      ctx.strokeStyle = `${MEDSKY.navy}26`; ctx.lineWidth = .5;
      for (let row = 0; row < 6; row++) {
        const y = -55 + row * 9;
        ctx.beginPath(); ctx.moveTo(-96, y); ctx.lineTo(-87, y); ctx.moveTo(85, y); ctx.lineTo(96, y); ctx.stroke();
      }
      ctx.fillStyle = MEDSKY.gold; ctx.fillRect(-104, -69, 208, .7);
      ctx.fillStyle = CITY.light; ctx.fillRect(-106, 2, 212, 2);
    } else if (city.id === 'dusseldorf') {
      // Rheinturm with its antenna, broad observation deck and tapered mast.
      polygon([[-8, 1], [-4, -74], [3, -74], [8, 1]], CITY.side);
      ctx.fillStyle = CITY.face; ctx.fillRect(-2, -73, 2, 72);
      polygon([[-20, -85], [-15, -72], [15, -72], [20, -85]], CITY.edge);
      ctx.fillStyle = CITY.shadow; ctx.fillRect(-20, -91, 40, 8);
      ctx.fillStyle = MEDSKY.elegance;
      for (let i = 0; i < 8; i++) ctx.fillRect(-17 + i * 4.5, -90, 2.5, 5);
      ctx.fillStyle = CITY.light; ctx.fillRect(-21, -93, 42, 3);
      ctx.fillStyle = CITY.edge; ctx.fillRect(-13, -98, 26, 5);
      polygon([[-5, -99], [-2, -122], [2, -122], [5, -99]], CITY.side);
      ctx.strokeStyle = CITY.shadow; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(0, -143); ctx.lineTo(0, -121); ctx.stroke();
      // Angular harbour architecture at the foot of the Rhine tower.
      polygon([[-105, 0], [-101, -27], [-78, -33], [-72, -4], [-51, 0]], CITY.edge);
      polygon([[36, 0], [40, -39], [66, -30], [72, 0]], CITY.edge);
      polygon([[71, 0], [77, -26], [97, -33], [106, 0]], CITY.face);
      ctx.strokeStyle = CITY.light; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(41, -6 - i * 7); ctx.lineTo(65, -3 - i * 7); ctx.stroke(); }
      // Glazed Media Harbour facades and their distinctive offset floors.
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? CITY.face : CITY.edge;
        ctx.fillRect(-102 + i % 2 * 2, -29 + i * 7, 26, 6);
        ctx.fillStyle = CITY.shadow;
        for (let window = 0; window < 5; window++) ctx.fillRect(-99 + window * 4.5 + i % 2 * 2, -27 + i * 7, 2, 3);
      }
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = CITY.shadow; ctx.lineWidth = .8;
        ctx.beginPath(); ctx.moveTo(78, -23 + i * 6); ctx.lineTo(99, -29 + i * 6); ctx.stroke();
      }
      ctx.fillStyle = MEDSKY.gold; ctx.fillRect(-20, -94, 40, .8);
      ctx.fillStyle = CITY.light; ctx.fillRect(0, -71, 1, 66);
      ctx.fillStyle = MEDSKY.gold; ctx.beginPath(); ctx.arc(0, -143, 1.3, 0, TAU); ctx.fill();
    } else if (city.id === 'paris') {
      // Open iron lattice keeps the unmistakable Eiffel arch light and airy.
      const iron = CITY.shadow;
      polygon([[-48, 1], [-22, -45], [-9, -91], [-2, -125], [2, -125], [9, -91], [22, -45], [48, 1], [32, 1], [16, -35], [5, -84], [0, -107], [-5, -84], [-16, -35], [-32, 1]], iron);
      ctx.strokeStyle = iron; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-32, 0); ctx.bezierCurveTo(-24, -41, 24, -41, 32, 0); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-25, -40); ctx.lineTo(25, -40); ctx.moveTo(-12, -85); ctx.lineTo(12, -85); ctx.stroke();
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const y = -45 - i * 9;
        const half = 16 - i * 2;
        ctx.beginPath(); ctx.moveTo(-half, y); ctx.lineTo(half - 2, y - 9); ctx.moveTo(half, y); ctx.lineTo(-half + 2, y - 9); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(0, -141); ctx.lineTo(0, -122); ctx.stroke();
      ctx.fillStyle = CITY.face; ctx.fillRect(-14, -87, 28, 3); ctx.fillRect(-28, -42, 56, 4);
      ctx.fillStyle = CITY.edge; ctx.fillRect(-50, 0, 100, 4);
      // Cross-bracing reaches all the way down the four splayed iron legs.
      ctx.strokeStyle = CITY.side; ctx.lineWidth = .9;
      for (let i = 0; i < 4; i++) {
        const y = -5 - i * 8, outer = 43 - i * 4.7, inner = 30 - i * 3.3;
        ctx.beginPath(); ctx.moveTo(-outer, y); ctx.lineTo(-inner + 3, y - 8);
        ctx.moveTo(outer, y); ctx.lineTo(inner - 3, y - 8); ctx.stroke();
      }
      ctx.strokeStyle = CITY.light; ctx.lineWidth = .65;
      ctx.beginPath(); ctx.moveTo(2, -122); ctx.lineTo(10, -88); ctx.lineTo(24, -43); ctx.lineTo(46, 0); ctx.stroke();
      ctx.fillStyle = MEDSKY.gold; ctx.fillRect(-13, -88, 26, .8); ctx.fillRect(-26, -43, 52, .8);
      ctx.beginPath(); ctx.arc(0, -141, 1.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function scenery(travel, city, alpha = 1) {
    sceneryRenderer.draw(ctx, travel, city, alpha);
  }

  function tower(x, start, end, width, top, index, destinationName) {
    const height = end - start;
    if (height < 1) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, start, width, height); ctx.clip();
    const body = ctx.createLinearGradient(x, 0, x + width, 0);
    body.addColorStop(0, MEDSKY.navy); body.addColorStop(.25, MEDSKY.blue);
    body.addColorStop(.76, MEDSKY.navy); body.addColorStop(1, MEDSKY.navy);
    ctx.fillStyle = body; ctx.fillRect(x, start, width, height);
    ctx.fillStyle = '#FFFFFF0D'; ctx.fillRect(x + 3, start, 4, height);
    ctx.fillStyle = `${MEDSKY.navy}66`; ctx.fillRect(x + width - 10, start, 10, height);
    ctx.fillStyle = MEDSKY.pearl; ctx.fillRect(x, start, 1, height); ctx.fillRect(x + width - 1, start, 1, height);
    ctx.fillStyle = MEDSKY.gold; ctx.fillRect(x + 1, start, 3, height); ctx.fillRect(x + width - 4, start, 3, height);

    // Blue glass panes.
    const windowStart = top ? Math.max(18, end - 274) : start + 68;
    for (let y = windowStart; y < (top ? end - 67 : end - 8); y += 27) {
      roundedRect(x + 13, y, width - 26, 17, 2, MEDSKY.navy);
      const glass = ctx.createLinearGradient(x, y, x, y + 17);
      glass.addColorStop(0, MEDSKY.elegance); glass.addColorStop(1, MEDSKY.blue);
      roundedRect(x + 15, y + 1, width - 30, 13, 1, glass);
      ctx.fillStyle = `${MEDSKY.pearl}63`; ctx.fillRect(x + 17, y + 2, width - 34, 2);
      ctx.fillStyle = MEDSKY.navy; ctx.fillRect(x + width / 2 - 1, y + 1, 2, 14);
      ctx.fillStyle = '#FFFFFF14'; ctx.fillRect(x + 9, y + 21, width - 18, 1);
    }

    const signY = top ? end - 61 : start + 28;
    roundedRect(x + 10, signY, width - 20, 25, 4, MEDSKY.navy, MEDSKY.elegance);
    ctx.fillStyle = MEDSKY.gold;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${destinationName.length > 8 ? 5.6 : 6.7}px system-ui, sans-serif`;
    ctx.fillText(destinationName.toUpperCase(), x + width / 2, signY + 7, width - 24);
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText(String(((Number(index) || 1) - 1) % 99 + 1).padStart(2, '0'), x + width / 2, signY + 17);

    // Safety caps remain inside the collision rectangle.
    const capY = top ? end - 22 : start;
    const cap = ctx.createLinearGradient(x, capY, x, capY + 22);
    cap.addColorStop(0, mixColor(MEDSKY.gold, MEDSKY.white, .45)); cap.addColorStop(.19, MEDSKY.gold);
    cap.addColorStop(.79, MEDSKY.gold); cap.addColorStop(1, mixColor(MEDSKY.gold, MEDSKY.navy, .15));
    roundedRect(x, capY, width, 22, 5, cap);
    ctx.fillStyle = `${MEDSKY.white}B3`; ctx.fillRect(x + 5, capY + 3, width - 10, 2);
    ctx.fillStyle = `${MEDSKY.navy}55`; ctx.fillRect(x + 5, capY + 18, width - 10, 1);
    ctx.fillStyle = MEDSKY.navy;
    for (let i = 0; i < 3; i++) {
      const cx = x + width / 2 + (i - 1) * 12;
      ctx.beginPath();
      ctx.moveTo(cx - 3, capY + (top ? 8 : 13));
      ctx.lineTo(cx, capY + (top ? 12 : 9));
      ctx.lineTo(cx + 3, capY + (top ? 8 : 13));
      ctx.lineTo(cx + 3, capY + (top ? 11 : 16));
      ctx.lineTo(cx, capY + (top ? 15 : 12));
      ctx.lineTo(cx - 3, capY + (top ? 11 : 16));
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function coin(x, y, phase) {
    const turn = .76 + Math.sin(clock * 3 + phase) * .16;
    ctx.save(); ctx.translate(x, y);
    ctx.shadowColor = '#F7BE004D'; ctx.shadowBlur = 13;
    ctx.fillStyle = mixColor(MEDSKY.gold, MEDSKY.white, .45); ctx.beginPath(); ctx.ellipse(0, 0, 13, 13, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0; ctx.scale(lastReducedMotion ? 1 : turn, 1);
    const gold = ctx.createLinearGradient(-9, -10, 9, 10);
    gold.addColorStop(0, mixColor(MEDSKY.gold, MEDSKY.white, .65)); gold.addColorStop(.45, MEDSKY.gold); gold.addColorStop(1, MEDSKY.gold);
    ctx.fillStyle = gold; ctx.strokeStyle = MEDSKY.gold; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = `${MEDSKY.white}B3`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 7.4, 0, TAU); ctx.stroke();
    sparkle(0, 0, 5, MEDSKY.navy);
    ctx.restore();
    sparkle(x + 14, y - 13, 3.8, '#FFFFFF', .55 + Math.sin(clock * 4 + phase) * .3);
  }

  function runway(travel) {
    ctx.fillStyle = MEDSKY.gold; ctx.fillRect(0, GROUND, W, 3);
    const track = ctx.createLinearGradient(0, GROUND + 3, 0, H);
    track.addColorStop(0, MEDSKY.blue); track.addColorStop(1, MEDSKY.navy);
    ctx.fillStyle = track; ctx.fillRect(0, GROUND + 3, W, H - GROUND);
    ctx.fillStyle = MEDSKY.elegance; ctx.fillRect(0, GROUND + 8, W, 1);
    ctx.fillStyle = `${MEDSKY.elegance}57`; ctx.fillRect(0, H - 10, W, 1);
    for (let i = 0; i < 10; i++) {
      const x = wrap(i * 64 - travel, 640) - 64;
      if (x + 31 < 0 || x > W) continue;
      ctx.fillStyle = `${MEDSKY.pearl}B8`; roundedRect(x, GROUND + 34, 30, 3, 1.5, ctx.fillStyle);
      ctx.fillStyle = MEDSKY.gold; roundedRect(x + 22, GROUND + 5, 5, 2, 1, ctx.fillStyle);
      ctx.fillStyle = `${MEDSKY.gold}20`; roundedRect(x + 19, GROUND + 4, 11, 4, 2, ctx.fillStyle);
    }
  }

  function bird(game, reducedMotion) {
    const ready = game.state === 'ready';
    const b = game.bird || {};
    const width = ready ? 190 : (b.width || 78);
    const naturalHeight = width * medy.naturalHeight / medy.naturalWidth;
    const height = ready ? naturalHeight : (b.height || naturalHeight);
    const x = ready ? 210 : (b.x ?? 114);
    const y = ready ? 378 + (reducedMotion ? 0 : Math.sin(clock * 2.25) * 7) : (b.y ?? 315);
    const rotation = ready ? (reducedMotion ? 0 : Math.sin(clock * 1.7) * .035) : (b.rotation || 0);
    if (ready) {
      // Hero halo and accompanying sparkles.
      const halo = ctx.createRadialGradient(x, y, 5, x, y, 131);
      halo.addColorStop(0, '#FFFFFF70'); halo.addColorStop(.72, '#FFFFFF25'); halo.addColorStop(1, '#FFFFFF00');
      ctx.fillStyle = halo; ctx.fillRect(x - 136, y - 136, 272, 272);
      sparkle(x - 113, y - 28, 7, '#FFFFFF', .9);
      sparkle(x + 94, y + 42, 6, '#F7BE00', .85);
      sparkle(x + 60, y - 91, 4, '#FFFFFF', .8);
      ctx.strokeStyle = '#FFFFFF87'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 112, y + 30); ctx.lineTo(x - 88, y + 30); ctx.moveTo(x - 122, y + 40); ctx.lineTo(x - 96, y + 40); ctx.stroke();
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
    ctx.shadowColor = `${MEDSKY.navy}40`; ctx.shadowBlur = ready ? 14 : 4; ctx.shadowOffsetY = ready ? 10 : 3;
    ctx.drawImage(medy, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  function burst(x, y, type = 'coin') {
    if (lastReducedMotion && type === 'flap') return;
    const count = type === 'crash' ? 17 : type === 'coin' ? 13 : 3;
    for (let i = 0; i < count; i++) {
      const angle = type === 'flap' ? Math.PI + (Math.random() - .5) * 1.1 : Math.random() * TAU;
      const speed = type === 'flap' ? 28 + Math.random() * 20 : 27 + Math.random() * 105;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0,
        life: type === 'flap' ? .28 : .5 + Math.random() * .35,
        radius: type === 'flap' ? 2.6 : 2 + Math.random() * 3,
        color: type === 'crash' ? [MEDSKY.white, MEDSKY.gold, MEDSKY.elegance][i % 3] : type === 'coin' ? [MEDSKY.white, MEDSKY.gold, MEDSKY.pearl][i % 3] : MEDSKY.white,
        star: type !== 'flap' && i % 2 === 0,
      });
    }
    if (particles.length > 100) particles = particles.slice(-100);
  }

  function drawParticles(dt) {
    for (const p of particles) {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt;
      if (p.age >= p.life || p.x < -8 || p.x > W + 8 || p.y < -8 || p.y > H + 8) continue;
      const alpha = Math.max(0, 1 - p.age / p.life);
      if (p.star) sparkle(p.x, p.y, p.radius, p.color, alpha);
      else { ctx.globalAlpha = alpha; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * (.5 + alpha * .5), 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    particles = particles.filter(p => p.age < p.life);
  }

  function draw(game, dt = 0, options = {}) {
    const reducedMotion = !!options.reducedMotion;
    lastReducedMotion = reducedMotion;
    const paused = game.state === 'paused';
    const over = ['over', 'gameover', 'ended'].includes(game.state);
    const step = clamp(Number(dt) || 0, 0, .05);
    if (!paused && !over) clock += step;
    if (game.state === 'ready' && !reducedMotion) readyTravel += step * 13;
    if (lastState !== 'ready' && game.state === 'ready') particles = [];
    lastState = game.state;
    const travel = game.state === 'ready' ? readyTravel : (Number(game.distance) || 0);
    const nextDestination = getDestination(game.score, game.startDestination);
    if (nextDestination.id !== destination.id) {
      previousDestination = destination;
      destination = nextDestination;
      destinationBlend = reducedMotion ? 1 : 0;
    }
    if (!paused) destinationBlend = Math.min(1, destinationBlend + step * 2);
    // The host calls resize from its ResizeObserver.
    ctx.setTransform(pixelWidth / W, 0, 0, pixelHeight / H, 0, 0);
    ctx.save();
    const sceneTravel = reducedMotion ? 0 : travel;
    sky(sceneTravel, reducedMotion);
    if (destinationBlend < 1 && transitionContext) {
      scenery(sceneTravel, previousDestination);
      // Composite two complete scenes so the departing landmark fades out
      // as the arriving one fades in, without a flash or ghosted silhouette.
      const mainContext = ctx;
      try {
        ctx = transitionContext;
        ctx.setTransform(pixelWidth / W, 0, 0, pixelHeight / H, 0, 0);
        sky(sceneTravel, reducedMotion);
        scenery(sceneTravel, destination);
      } finally {
        ctx = mainContext;
      }
      ctx.save(); ctx.globalAlpha = destinationBlend;
      ctx.drawImage(transitionCanvas, 0, 0, W, H);
      ctx.restore();
    } else scenery(sceneTravel, destination);
    for (const gate of game.obstacles || []) {
      const width = gate.width || 70;
      if (gate.x > W + 10 || gate.x + width < -10) continue;
      const gap = gate.gap ?? CLASSIC_SETTINGS.gap;
      const gapY = gate.gapY ?? 330;
      const gateDestination = getDestination((Number(gate.id) || 1) - 1, game.startDestination);
      tower(gate.x, 0, gapY - gap / 2, width, true, gate.id, gateDestination.name);
      tower(gate.x, gapY + gap / 2, GROUND, width, false, gate.id, gateDestination.name);
      if (gate.coin && !gate.coin.collected) coin(gate.coin.x, gate.coin.y, Number(gate.id) || 0);
    }
    runway(reducedMotion ? 0 : travel);
    bird(game, reducedMotion);
    drawParticles(paused ? 0 : step);
    ctx.restore();
  }

  resize();
  return { draw, resize, burst, ready: true };
}
