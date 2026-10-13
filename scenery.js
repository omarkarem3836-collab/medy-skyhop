import { MEDSKY as B } from './palette.js';

const W = 420;
const TAU = Math.PI * 2;
const wrap = (n, length) => ((n % length) + length) % length;
const blend = (a, b, t) => {
  const from = parseInt(a.slice(1), 16), to = parseInt(b.slice(1), 16);
  return `rgb(${[16, 8, 0].map(s => Math.round(((from >> s) & 255) * (1 - t) + ((to >> s) & 255) * t)).join(',')})`;
};
const P = Object.freeze({
  haze: blend(B.elegance, B.pearl, .42),
  hill: blend(B.blue, B.elegance, .84),
  hillLight: blend(B.blue, B.elegance, .93),
  far: blend(B.blue, B.elegance, .76),
  face: blend(B.elegance, B.white, .38),
  side: blend(B.blue, B.elegance, .58),
  shade: blend(B.navy, B.elegance, .45),
  ink: blend(B.navy, B.elegance, .26),
  roof: blend(B.blue, B.elegance, .39),
  water: blend(B.blue, B.elegance, .42),
  waterLight: blend(B.blue, B.elegance, .63),
});
const CITIES = Object.freeze({ malta: 1, rome: 2, milan: 3, athens: 4, madrid: 5, dusseldorf: 6, paris: 7 });
const isWater = id => ['malta', 'rome', 'dusseldorf', 'paris'].includes(id);

function rect(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function poly(ctx, points, fill) {
  ctx.fillStyle = fill; ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath(); ctx.fill();
}
function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
}
function round(ctx, x, y, w, h, r, fill) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
function arch(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, TAU); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
}

function building(ctx, x, base, width, height, city, index, detailed = true) {
  const y = base - height;
  const side = Math.max(3, width * .15);
  const front = index % 3 === 0 ? B.elegance : P.face;
  rect(ctx, x, y, width, height, detailed ? front : P.hillLight);
  rect(ctx, x + width - side, y, side, height, detailed ? P.side : P.far);
  rect(ctx, x, y, width - side, 2, detailed ? B.white : B.elegance);
  if (['paris', 'milan'].includes(city)) {
    poly(ctx, [[x - 2, y], [x + 4, y - 9], [x + width - 6, y - 9], [x + width + 1, y]], detailed ? P.roof : P.far);
    rect(ctx, x + width * .68, y - 14, 3, 8, P.side);
    if (detailed) { arch(ctx, x + 8, y - 8, 5, 7, B.pearl); rect(ctx, x + 10, y - 6, 1.5, 4, P.ink); }
  } else if (city === 'madrid' || city === 'rome') {
    poly(ctx, [[x - 2, y], [x + width * .5, y - 7], [x + width + 2, y]], detailed ? P.roof : P.far);
    line(ctx, x - 2, y, x + width + 2, y, detailed ? B.gold : B.elegance, 1.3);
  } else {
    rect(ctx, x - 1, y - 3, width + 2, 3, detailed ? P.side : P.far);
    rect(ctx, x + 3, y - 4, width - 6, 1, B.pearl);
  }
  const rows = Math.max(1, Math.floor((height - 10) / 12));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < Math.max(1, Math.floor((width - side - 5) / 10)); col++) {
      const wx = x + 5 + col * 10, wy = y + 8 + row * 12;
      rect(ctx, wx, wy, 4, 6, detailed ? P.shade : `${B.blue}30`);
      if (detailed) {
        rect(ctx, wx, wy, 1, 6, B.elegance);
        rect(ctx, wx - 1, wy + 6, 6, 1, B.white);
        if (city === 'malta' && row % 2 === 0) {
          rect(ctx, wx - 2, wy + 2, 8, 5, index % 2 ? P.roof : B.blue);
          line(ctx, wx - 1, wy + 3, wx + 5, wy + 3, B.elegance, .6);
          line(ctx, wx + 2, wy + 2, wx + 2, wy + 7, B.elegance, .6);
        } else if (city === 'paris' || city === 'madrid') {
          line(ctx, wx - 2, wy + 5, wx + 6, wy + 5, P.ink, .65);
          for (let rail = 0; rail < 3; rail++) line(ctx, wx - 1 + rail * 3, wy + 4, wx - 1 + rail * 3, wy + 7, P.ink, .5);
        }
      }
    }
    if (detailed) line(ctx, x + 1, y + 17 + row * 12, x + width - side, y + 17 + row * 12, `${B.blue}14`, .6);
  }
  if (detailed) {
    arch(ctx, x + width * .45 - 3, base - 12, 7, 12, P.ink);
    rect(ctx, x - 1, base - 2, width + 2, 3, B.pearl);
    if (index % 2 === 0) {
      rect(ctx, x + 3, base - 13, 13, 3, B.gold);
      for (let stripe = 0; stripe < 4; stripe++) rect(ctx, x + 3 + stripe * 4, base - 13, 2, 3, B.white);
    }
  }
}

function tree(ctx, x, y, scale, palm = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ellipse(ctx, 5, 1, 14, 2.4, `${B.navy}18`);
  if (palm) {
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(1, 0); ctx.quadraticCurveTo(4, -15, 0, -30); ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const angle = i * .49 + Math.PI;
      const endX = Math.cos(angle) * 20, endY = Math.sin(angle) * 10 - 23;
      ctx.strokeStyle = i % 2 ? P.roof : P.side; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.quadraticCurveTo(endX * .7, -39 - i % 2 * 2, endX, endY); ctx.stroke();
    }
  } else {
    line(ctx, 0, 0, 0, -23, P.ink, 2);
    ellipse(ctx, 0, -24, 10, 14, P.roof);
    ellipse(ctx, 5, -23, 9, 12, P.side);
    ellipse(ctx, 3, -30, 6, 7, P.far);
    line(ctx, 0, -9, 4, -20, P.ink, .7);
  }
  ctx.restore();
}

function lamp(ctx, x, y, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  line(ctx, 0, 0, 0, -25, P.ink, 1.2);
  round(ctx, -3, -29, 6, 6, 1.5, B.gold);
  rect(ctx, -4, -30, 8, 1.4, P.ink); rect(ctx, -2, -28, 2, 4, B.pearl);
  rect(ctx, -2, -1, 4, 2, P.ink); ctx.restore();
}

function paintHills(ctx, travel, city) {
  const seed = CITIES[city];
  for (let layer = 0; layer < 2; layer++) {
    const shift = wrap(travel * (.012 + layer * .011), 600);
    ctx.fillStyle = layer ? P.hill : P.haze;
    for (let tile = -1; tile < 2; tile++) {
      const x = tile * 600 - shift;
      ctx.beginPath(); ctx.moveTo(x, 623); ctx.lineTo(x, 560 + layer * 13);
      ctx.bezierCurveTo(x + 75, 520 - seed * 3 + layer * 12, x + 115, 564, x + 199, 542 + layer * 14);
      ctx.bezierCurveTo(x + 279, 509 + layer * 21, x + 330, 563, x + 402, 547 + layer * 13);
      ctx.bezierCurveTo(x + 483, 519 - seed * 2 + layer * 14, x + 545, 548, x + 600, 560 + layer * 13);
      ctx.lineTo(x + 600, 630); ctx.closePath(); ctx.fill();
    }
  }
}

function drawWater(ctx, travel, city, artwork, landmarkX) {
  const sea = ctx.createLinearGradient(0, 630, 0, 696);
  sea.addColorStop(0, P.waterLight); sea.addColorStop(1, P.water);
  rect(ctx, 0, 630, W, 66, sea);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 634, W, 49); ctx.clip();
  ctx.globalAlpha *= .22;
  ctx.translate(0, 632 * 1.26); ctx.scale(1, -.26);
  ctx.drawImage(artwork, landmarkX, 410, 420, 260);
  ctx.restore();
  for (let i = 0; i < 34; i++) {
    const x = wrap(i * 71 - travel * .11, 500) - 38;
    const y = 637 + (i * 17) % 48;
    line(ctx, x, y, x + 9 + i % 5 * 8, y, i % 5 === 0 ? `${B.gold}60` : `${B.white}${i % 3 ? '45' : '85'}`, i % 3 ? .7 : 1.2);
  }
  line(ctx, 0, 633, W, 633, `${B.white}B3`, 2);
  if (city === 'malta') {
    const bx = wrap(77 - travel * .058, 530) - 20;
    ellipse(ctx, bx + 13, 667, 23, 2.2, `${B.white}65`);
    poly(ctx, [[bx, 659], [bx + 33, 659], [bx + 26, 667], [bx + 7, 665]], B.white);
    poly(ctx, [[bx + 6, 663], [bx + 29, 663], [bx + 26, 667], [bx + 8, 665]], B.blue);
    line(ctx, bx + 15, 637, bx + 15, 660, P.ink, 1);
    poly(ctx, [[bx + 14, 638], [bx + 14, 656], [bx + 1, 656]], B.white);
    poly(ctx, [[bx + 17, 642], [bx + 29, 657], [bx + 17, 657]], B.elegance);
    poly(ctx, [[bx + 16, 637], [bx + 23, 639], [bx + 16, 641]], B.gold);
  } else {
    // A sculpted bridge gives the riverside cities depth below their landmarks.
    const bx = city === 'paris' ? 14 : 8, by = 646;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = P.face; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(bx + 24 + i * 42, by + 24, 21, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = P.side; ctx.lineWidth = 1.4; ctx.stroke();
    }
    rect(ctx, bx, by, 133, 7, B.elegance);
    line(ctx, bx, by, bx + 133, by, B.white, 2);
    line(ctx, bx, by - 5, bx + 133, by - 5, P.shade, 1);
    for (let i = 0; i < 17; i++) line(ctx, bx + i * 8, by - 5, bx + i * 8, by, P.shade, .7);
    lamp(ctx, bx + 7, by - 1, .7); lamp(ctx, bx + 124, by - 1, .7);
  }
}

function drawPark(ctx, travel, city) {
  rect(ctx, 0, 630, W, 66, P.hillLight);
  ctx.strokeStyle = B.pearl; ctx.lineWidth = 19;
  ctx.beginPath(); ctx.moveTo(-20, 644); ctx.bezierCurveTo(110, 625, 222, 684, 440, 646); ctx.stroke();
  ctx.strokeStyle = B.white; ctx.lineWidth = 1.5; ctx.stroke();
  if (city === 'milan' || city === 'madrid') {
    ellipse(ctx, 312, 659, 39, 10, `${B.navy}16`);
    ellipse(ctx, 310, 654, 37, 10, P.side);
    ellipse(ctx, 310, 651, 34, 8, B.pearl);
    ellipse(ctx, 310, 650, 28, 5.5, P.waterLight);
    if (city === 'milan') {
      ctx.strokeStyle = `${B.white}D9`; ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(310, 650); ctx.quadraticCurveTo(310 + i * 3, 631 - Math.abs(i) * 3, 310 + i * 8, 650); ctx.stroke();
      }
    } else {
      rect(ctx, 308, 638, 4, 11, P.side); ellipse(ctx, 310, 637, 13, 3, B.pearl);
      ellipse(ctx, 310, 636, 11, 2, P.waterLight); ellipse(ctx, 310, 631, 3, 5, B.gold);
    }
  }
  for (let i = 0; i < 7; i++) {
    const x = wrap(21 + i * 78 - travel * .058, 546) - 30;
    tree(ctx, x, 663 + i % 2 * 6, .66 + i % 3 * .09, city === 'athens' && i % 3 === 0);
  }
}

/** Compact 2x artwork crops are retained for only the current and nearby cities. */
export function createScenery(document, paintLandmark) {
  const cache = new Map();
  function artworkFor(city) {
    if (cache.has(city.id)) return cache.get(city.id);
    const artwork = document.createElement('canvas');
    artwork.width = 840; artwork.height = 520;
    const ctx = artwork.getContext('2d');
    ctx.scale(2, 2); ctx.translate(0, -410);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // A grounded shadow keeps the pale architecture crisp against the bright sky.
    ellipse(ctx, 265, 627, 147, 5, `${B.navy}17`);
    paintLandmark(ctx, city);
    const seed = CITIES[city.id];
    for (let i = 0; i < 3; i++) {
      const x = -11 + i * 34;
      building(ctx, x, 627, 31 + i % 2 * 5, 33 + (i * 13 + seed * 7) % 30, city.id, i);
    }
    building(ctx, 377, 627, 40, 43 + seed % 3 * 10, city.id, 4);
    building(ctx, 414, 627, 32, 55, city.id, 5);
    rect(ctx, 0, 627, W, 6, P.side);
    rect(ctx, 0, 627, W, 2, B.pearl);
    for (let i = 0; i < 30; i++) line(ctx, i * 15, 629, i * 15, 633, `${B.navy}25`, .65);
    line(ctx, 0, 633, W, 633, B.gold, .7);
    for (let i = 0; i < 5; i++) lamp(ctx, 18 + i * 94, 627, .54);
    cache.set(city.id, artwork);
    if (cache.size > 3) cache.delete(cache.keys().next().value);
    return artwork;
  }
  return {
    draw(ctx, travel, city, alpha = 1) {
      if (alpha <= 0) return;
      ctx.save(); ctx.globalAlpha *= alpha;
      paintHills(ctx, travel, city.id);
      const seed = CITIES[city.id];
      for (let i = 0; i < 25; i++) {
        const x = wrap(i * 30 - travel * .034, 750) - 35;
        if (x > W || x < -40) continue;
        building(ctx, x, 608, 24 + i % 3 * 3, 21 + (i * 17 + seed * 11) % 42, city.id, i, false);
      }
      const artwork = artworkFor(city);
      const landmarkX = -Math.sin(travel * .00065) * 6;
      ctx.drawImage(artwork, landmarkX, 410, 420, 260);
      if (isWater(city.id)) drawWater(ctx, travel, city.id, artwork, landmarkX);
      else drawPark(ctx, travel, city.id);
      // Near promenade: paving, planting and gold accents move on their own plane.
      poly(ctx, [[0, 686], [89, 681], [205, 689], [330, 678], [420, 682], [420, 696], [0, 696]], B.pearl);
      line(ctx, 0, 693, W, 693, P.side, .7);
      for (let i = 0; i < 16; i++) {
        const x = wrap(i * 35 - travel * .16, 560) - 25;
        line(ctx, x, 690, x + 6, 696, `${B.blue}22`, .65);
      }
      for (let i = 0; i < 4; i++) {
        const x = wrap(25 + i * 157 - travel * .12, 628) - 30;
        if (x < -20 || x > 440) continue;
        tree(ctx, x, 692, .78, city.id === 'malta' || city.id === 'athens');
        round(ctx, x + 23, 686, 16, 3, 1, P.roof);
        line(ctx, x + 25, 689, x + 25, 693, P.ink, 1);
        line(ctx, x + 37, 689, x + 37, 693, P.ink, 1);
        line(ctx, x + 23, 686, x + 39, 686, B.gold, .7);
      }
      ctx.restore();
    },
  };
}
