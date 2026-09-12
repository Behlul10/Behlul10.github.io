const canvas = document.querySelector('.cover-canvas');
const context = canvas.getContext('2d');
const coverElement = document.querySelector('.hero-cover');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let animationFrame = null;
let frameTimer = null;
let coverVisible = false;
let pageActive = true;
let width = 0;
let height = 0;
let previousTime = null;
let elapsedTime = 0;
const frameInterval = 1000 / 20;

const finishIntro = () => document.body.classList.remove('intro-active');
if (!document.hidden && !reducedMotion.matches) {
  document.body.classList.add('intro-active');
  coverElement.addEventListener('animationend', finishIntro, { once: true });
}

const line = (x1, y1, x2, y2) => {
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(182, 209, 242, .96)';
  context.lineWidth = 1.35;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  context.strokeStyle = 'rgba(255, 255, 255, .98)';
  context.lineWidth = .5;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
};

const blend = (from, to, amount) => from + (to - from) * amount;

const hash = (value) => {
  const result = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return result - Math.floor(result);
};

const wander = (time, seed, interval) => {
  const position = time / interval + seed;
  const step = Math.floor(position);
  const progress = position - step;
  const eased = progress * progress * (3 - 2 * progress);
  const from = hash(step + seed * 17) * 2 - 1;
  const to = hash(step + 1 + seed * 17) * 2 - 1;
  return blend(from, to, eased);
};

const chromeRect = (x, y, width, height) => {
  line(x, y, x + width, y);
  line(x + width, y, x + width, y + height);
  line(x + width, y + height, x, y + height);
  line(x, y + height, x, y);
};

const drawVoxel = (x, y, size, depth, angle = 0) => {
  const half = size / 2;
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  // Rotate around the center of both faces, not just the front face.
  context.translate(-depth / 2, depth / 2);
  chromeRect(-half, -half, size, size);
  chromeRect(-half + depth, -half - depth, size, size);
  line(-half, -half, -half + depth, -half - depth);
  line(half, -half, half + depth, -half - depth);
  line(half, half, half + depth, half - depth);
  line(-half, half, -half + depth, half - depth);
  context.restore();
};

const drawWireCylinder = (x, y, radius, height, angle = 0) => {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  const ellipse = (centerY, ringRadius = radius) => {
    context.beginPath();
    context.ellipse(0, centerY, ringRadius, ringRadius * .34, 0, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(182, 209, 242, .94)';
    context.lineWidth = 1.05;
    context.stroke();
    context.strokeStyle = 'rgba(255, 255, 255, .98)';
    context.lineWidth = .42;
    context.stroke();
  };
  const top = -height / 2;
  const bottom = height / 2;
  for (let ring = 0; ring <= 4; ring += 1) ellipse(blend(top, bottom, ring / 4));
  for (let meridian = 0; meridian < 12; meridian += 1) {
    const angle = (Math.PI * 2 * meridian) / 12;
    const offsetX = Math.cos(angle) * radius;
    const offsetY = Math.sin(angle) * radius * .34;
    line(offsetX, top + offsetY, offsetX, bottom + offsetY);
  }
  context.restore();
};

const drawWireOrb = (x, y, radius, angle = 0) => {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.beginPath();
  context.ellipse(0, 0, radius, radius * .56, 0, 0, Math.PI * 2);
  context.strokeStyle = 'rgba(182, 209, 242, .94)';
  context.lineWidth = 1.05;
  context.stroke();
  context.strokeStyle = 'rgba(255, 255, 255, .98)';
  context.lineWidth = .42;
  context.stroke();
  for (const scale of [.48, .78]) {
    context.beginPath();
    context.ellipse(0, 0, radius * scale, radius * .56, 0, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(182, 209, 242, .9)';
    context.lineWidth = .85;
    context.stroke();
    context.strokeStyle = 'rgba(255, 255, 255, .92)';
    context.lineWidth = .35;
    context.stroke();
  }
  line(-radius, 0, radius, 0);
  context.restore();
};

const drawCover = (time = 0) => {
  if (!width || !height) return;
  context.clearRect(0, 0, width, height);

  const frameX = width * .06;
  const frameY = height * .05;
  const frameWidth = width * .88;
  const frameHeight = height * .90;
  const frameBottom = frameY + frameHeight;
  const center = width / 2;
  const farWidth = frameWidth * .36;
  const farX = center - farWidth / 2;
  const farY = frameY + frameHeight * .22;
  const farHeight = frameHeight * .40;
  const farBottom = farY + farHeight;
  const segments = 10;

  context.save();
  context.beginPath();
  context.rect(frameX, frameY, frameWidth, frameHeight);
  context.clip();

  context.fillStyle = '#130002';
  context.fillRect(farX, farY, farWidth, farHeight);

  for (let index = 0; index <= segments; index += 1) {
    const point = index / segments;
    const outerX = blend(frameX, frameX + frameWidth, point);
    const innerX = blend(farX, farX + farWidth, point);
    line(outerX, frameY, innerX, farY);
    line(outerX, frameBottom, innerX, farBottom);
  }

  for (let index = 1; index < 8; index += 1) {
    const point = index / 8;
    const leftY = blend(frameY, frameBottom, point);
    const innerY = blend(farY, farBottom, point);
    line(frameX, leftY, farX, innerY);
    line(frameX + frameWidth, leftY, farX + farWidth, innerY);
  }

  const phase = (time / 13000) % 1;
  const depthBands = Array.from({ length: 18 }, (_, index) => {
    const point = (index / 18 + phase) % 1;
    return { depth: Math.pow(point, 1.55), alpha: Math.min(1, point * 9) };
  });

  const animatePlane = (drawBand) => {
    for (const { depth, alpha } of depthBands) {
      context.globalAlpha = alpha;
      drawBand(depth);
    }
    context.globalAlpha = 1;
  };

  animatePlane((depth) => {
    const y = blend(farY, frameY, depth);
    const left = blend(farX, frameX, depth);
    const right = blend(farX + farWidth, frameX + frameWidth, depth);
    line(left, y, right, y);
  });

  animatePlane((depth) => {
    const y = blend(farBottom, frameBottom, depth);
    const left = blend(farX, frameX, depth);
    const right = blend(farX + farWidth, frameX + frameWidth, depth);
    line(left, y, right, y);
  });

  animatePlane((depth) => {
    const leftX = blend(farX, frameX, depth);
    const rightX = blend(farX + farWidth, frameX + frameWidth, depth);
    const top = blend(farY, frameY, depth);
    const bottom = blend(farBottom, frameBottom, depth);
    line(leftX, top, leftX, bottom);
    line(rightX, top, rightX, bottom);
  });

  context.save();
  context.beginPath();
  context.rect(farX, farY, farWidth, farHeight);
  context.clip();
  context.globalAlpha = .62;
  const cubeSize = Math.min(farWidth, farHeight) * .13;
  const cubeScale = 1 + wander(time, 2.7, 11500) * .07;
  const cylinderScale = 1 + wander(time, 5.1, 13000) * .06;
  const orbScale = 1 + wander(time, 8.4, 12000) * .07;
  const cubeSide = cubeSize * 1.08 * cubeScale;
  const cubeDepth = cubeSize * .39 * cubeScale;
  // Keep every corner inside the window at every rotation, including the stroke.
  const cubeMargin = Math.hypot((cubeSide + cubeDepth) / 2, (cubeSide + cubeDepth) / 2) + 2;
  const cubeX = farX + farWidth * (.18 + wander(time, 1.2, 9200) * .065);
  const cubeY = farY + farHeight * (.35 + wander(time, 3.9, 10500) * .08);
  drawVoxel(
    Math.max(farX + cubeMargin, Math.min(farX + farWidth - cubeMargin, cubeX)),
    Math.max(farY + cubeMargin, Math.min(farBottom - cubeMargin, cubeY)),
    cubeSide,
    cubeDepth,
    time / 14500 + wander(time, 14.2, 18000) * .15
  );
  drawWireCylinder(
    farX + farWidth * (.78 + wander(time, 6.3, 12000) * .07),
    farY + farHeight * (.44 + wander(time, 8.7, 9800) * .085),
    cubeSize * .68 * cylinderScale,
    cubeSize * 1.7 * cylinderScale,
    -time / 16500 + wander(time, 16.8, 19500) * .12
  );
  drawWireOrb(
    farX + farWidth * (.49 + wander(time, 10.2, 10800) * .08),
    farY + farHeight * (.74 + wander(time, 12.6, 12500) * .075),
    cubeSize * .82 * orbScale,
    time / 15500 + wander(time, 18.4, 21000) * .17
  );
  context.globalAlpha = 1;
  context.restore();

  chromeRect(farX, farY, farWidth, farHeight);
  chromeRect(frameX, frameY, frameWidth, frameHeight);
  context.restore();
};

// Only schedule work while the graphic is on screen in an active page.
const canDraw = () => pageActive && coverVisible && !document.hidden && width > 0 && height > 0;
const canAnimate = () => canDraw() && !reducedMotion.matches;

const stopCover = () => {
  cancelAnimationFrame(animationFrame);
  clearTimeout(frameTimer);
  animationFrame = null;
  frameTimer = null;
  previousTime = null;
};

const animateCover = (time) => {
  animationFrame = null;
  if (!canAnimate()) return;
  // Preserve the scene's position across pauses instead of jumping ahead.
  if (previousTime !== null) elapsedTime += Math.min(time - previousTime, 250);
  previousTime = time;
  drawCover(elapsedTime);
  // Sleep between draws instead of waking on every display refresh.
  frameTimer = setTimeout(() => {
    frameTimer = null;
    if (canAnimate()) animationFrame = requestAnimationFrame(animateCover);
  }, frameInterval);
};

const updateCoverMotion = () => {
  stopCover();
  if (!canDraw()) return;
  if (reducedMotion.matches) drawCover(elapsedTime);
  else animationFrame = requestAnimationFrame(animateCover);
};

// Content dimensions ignore the startup CSS zoom. Resize only when layout changes.
new ResizeObserver(([entry]) => {
  const nextWidth = Math.round(entry.contentRect.width);
  const nextHeight = Math.round(entry.contentRect.height);
  if (nextWidth === width && nextHeight === height) return;
  width = nextWidth;
  height = nextHeight;
  canvas.width = width;
  canvas.height = height;
  updateCoverMotion();
}).observe(canvas);

new IntersectionObserver(([entry]) => {
  coverVisible = entry.isIntersecting && entry.intersectionRatio > 0;
  updateCoverMotion();
}, { threshold: 0 }).observe(coverElement);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) finishIntro();
  updateCoverMotion();
});
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) finishIntro();
  updateCoverMotion();
});
window.addEventListener('pagehide', () => {
  pageActive = false;
  finishIntro();
  stopCover();
});
window.addEventListener('pageshow', () => {
  pageActive = true;
  updateCoverMotion();
});
