const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = process.argv[2] || path.resolve(__dirname, '..');

function setup({ hidden = false, reduced = false } = {}) {
  const events = () => {
    const handlers = new Map();
    return {
      addEventListener(name, callback) {
        if (!handlers.has(name)) handlers.set(name, []);
        handlers.get(name).push(callback);
      },
      emit(name) { for (const callback of handlers.get(name) || []) callback(); }
    };
  };
  const classList = () => {
    const values = new Set();
    return {
      add: value => values.add(value), remove: value => values.delete(value),
      contains: value => values.has(value),
      toggle(value, on) { if (on) values.add(value); else values.delete(value); }
    };
  };
  let draws = 0, allocations = 0, nextId = 1, width = 300, height = 150;
  const rafs = new Map(), timers = new Map(), intersections = [], resizes = [];
  const context = new Proxy({ clearRect() { draws++; } }, { get: (object, key) => object[key] ?? (() => {}) });
  const canvas = {
    getContext: () => context,
    get width() { return width; }, set width(value) { width = value; allocations++; },
    get height() { return height; }, set height(value) { height = value; allocations++; },
    getBoundingClientRect() { throw new Error('Do not measure the transformed canvas while animating'); }
  };
  const cover = { ...events(), classList: classList() };
  const group = { classList: classList() };
  const document = {
    ...events(), hidden, body: { classList: classList() }, documentElement: { classList: classList() },
    querySelector: selector => selector === '.cover-canvas' ? canvas : cover,
    querySelectorAll: () => [group]
  };
  const preference = { ...events(), matches: reduced };
  const window = { ...events(), matchMedia: () => preference };
  const sandbox = {
    document, window,
    requestAnimationFrame(callback) { const id = nextId++; rafs.set(id, callback); return id; },
    cancelAnimationFrame: id => rafs.delete(id),
    setTimeout(callback) { const id = nextId++; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    IntersectionObserver: class { constructor(callback) { intersections.push(callback); } observe() {} },
    ResizeObserver: class { constructor(callback) { resizes.push(callback); } observe() {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'cover.js'), 'utf8'), sandbox);
  const flush = (queue, time) => { const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(fn => fn(time)); };
  return {
    document, window, preference, canvas, group, cover, sandbox, rafs, timers, intersections,
    draws: () => draws, allocations: () => allocations,
    pending: () => rafs.size + timers.size,
    frame: time => flush(rafs, time), timer: () => flush(timers),
    resize: (width = 290, height = 331) => resizes[0]([{ contentRect: { width, height } }]),
    visible: (visible, ratio = visible ? 1 : 0) => intersections[0]([{ isIntersecting: visible, intersectionRatio: ratio }]),
    hide(value) { document.hidden = value; document.emit('visibilitychange'); }
  };
}

test('offscreen/hidden pages have no animation work and resume without a time jump', () => {
  const h = setup();
  h.resize();
  assert.equal(h.pending(), 0);
  h.visible(true); h.frame(100);
  assert.equal(h.draws(), 1);
  assert.equal(h.rafs.size, 0, 'sleep between draws');
  assert.equal(h.timers.size, 1);
  h.timer(); h.frame(150);
  assert.equal(vm.runInContext('elapsedTime', h.sandbox), 50);
  h.visible(false);
  assert.equal(h.pending(), 0);
  h.resize(390, 405); h.frame(200); h.timer();
  assert.equal(h.draws(), 2);
  h.hide(true); h.visible(true);
  assert.equal(h.pending(), 0);
  h.hide(false); h.frame(100000);
  assert.equal(vm.runInContext('elapsedTime', h.sandbox), 50);
  assert.equal(h.draws(), 3);
  h.timer();
  const staleFrame = [...h.rafs.values()][0];
  h.hide(true); staleFrame(100050);
  assert.equal(h.draws(), 3, 'even a stale callback must not draw in a hidden tab');
  assert.equal(h.pending(), 0);
});

test('reduced motion renders a still scene and responds to preference changes', () => {
  const h = setup({ reduced: true });
  assert.equal(h.document.body.classList.contains('intro-active'), false);
  h.resize(); h.visible(true);
  assert.equal(h.draws(), 1);
  assert.equal(h.pending(), 0);
  h.resize(390, 405);
  assert.equal(h.draws(), 2);
  assert.equal(h.pending(), 0);
  h.preference.matches = false; h.preference.emit('change'); h.frame(100);
  assert.equal(h.draws(), 3);
  h.preference.matches = true; h.preference.emit('change');
  assert.equal(h.pending(), 0);
  h.hide(true); h.resize(290, 331);
  assert.equal(h.draws(), 4, 'hidden reduced-motion scenes are not redrawn');
});

test('canvas dimensions are stable during animation and only change with layout', () => {
  const h = setup();
  h.resize(); h.visible(true);
  for (let time = 0; time < 1000; time += 50) { h.frame(time); h.timer(); }
  assert.equal(h.draws(), 20);
  assert.equal(h.allocations(), 2, 'one backing buffer size assignment per dimension');
  h.resize(); assert.equal(h.allocations(), 2);
  h.resize(390, 405); assert.equal(h.allocations(), 4);
  assert.equal(h.canvas.width, 390); assert.equal(h.canvas.height, 405);
  assert.equal(h.pending(), 1, 'resize must not create duplicate loops');
  h.resize(0, 0); assert.equal(h.pending(), 0);
});

test('page navigation and initial hidden load cannot leave running animation loops', () => {
  const h = setup({ hidden: true });
  assert.equal(h.document.body.classList.contains('intro-active'), false);
  h.resize(); h.visible(true); assert.equal(h.pending(), 0);
  h.hide(false); h.frame(0);
  h.window.emit('pagehide'); assert.equal(h.pending(), 0);
  h.resize(390, 405); h.visible(true); assert.equal(h.pending(), 0);
  h.window.emit('pageshow'); h.frame(10000); assert.equal(h.draws(), 2);
  h.visible(true, 0); assert.equal(h.pending(), 0, 'touching the viewport edge is not visible');
});

test('CSS effects pause by page and viewport, and HTML has no legacy animated SVGs', () => {
  const h = setup();
  vm.runInContext(fs.readFileSync(path.join(root, 'motion.js'), 'utf8'), h.sandbox);
  assert(h.group.classList.contains('motion-paused'));
  h.intersections[1]([{ target: h.group, isIntersecting: true, intersectionRatio: 1 }]);
  assert(!h.group.classList.contains('motion-paused'));
  h.hide(true); assert(h.document.documentElement.classList.contains('motion-paused'));
  h.hide(false); assert(!h.document.documentElement.classList.contains('motion-paused'));
  h.intersections[1]([{ target: h.group, isIntersecting: false, intersectionRatio: 0 }]);
  assert(h.group.classList.contains('motion-paused'));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(!html.includes('<animate'));
  assert(html.includes('cover.js?v=1'));
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert(css.includes('animation-play-state: paused !important'));
  assert(css.includes('@media (prefers-reduced-motion: reduce)'));
});
