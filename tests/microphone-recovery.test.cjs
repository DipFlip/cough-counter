const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');

function setup() {
  const slots = [];
  const effects = [];
  const listeners = new Map();
  const engines = [];
  let cursor = 0;
  let defer = false;
  let fail = false;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) {
      const i = cursor++;
      return slots[i] ??= { current: initial };
    },
    useCallback(fn) { return fn; },
    useEffect(fn) {
      const i = cursor++;
      if (!(i in slots)) { slots[i] = true; effects.push(fn); }
    },
  };
  class Engine {
    level = 0;
    constructor(callbacks) { this.callbacks = callbacks; engines.push(this); }
    start() { if (fail) return Promise.reject(new Error('Capture interrupted')); return defer ? new Promise(resolve => { this.finish = resolve; }) : Promise.resolve(); }
    stop() { this.stopped = true; }
  }
  const document = {
    visibilityState: 'visible',
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  const context = {
    exports: {},
    require: name => name === 'react' ? react : { CoughEngine: Engine },
    document, Date, DOMException, console,
    setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval() {},
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('hooks/useCoughDetector.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  const render = () => { cursor = 0; return context.exports.useCoughDetector(); };
  render();
  effects.forEach(fn => fn());
  return {
    render, engines,
    fail: value => { fail = value; },
    defer: () => { defer = true; },
    visibility(value) { document.visibilityState = value; listeners.get('visibilitychange')(); },
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('returning reconnects and retains cough count; duplicate visible events do not restart', async () => {
  const app = setup();
  await app.render().start();
  app.engines[0].callbacks.onCough();
  app.visibility('hidden');
  app.visibility('visible');
  app.visibility('visible');
  await flush();
  assert.equal(app.engines.length, 2);
  assert.equal(app.engines[0].stopped, true);
  assert.equal(app.render().state, 'counting');
  assert.equal(app.render().coughCount, 1);
  assert.equal(app.render().recovering, false);
  app.render().reset();
});

test('stopping during reconnect cannot reactivate the session', async () => {
  const app = setup();
  await app.render().start();
  app.defer();
  app.visibility('hidden');
  app.visibility('visible');
  assert.equal(app.render().recovering, true);
  app.render().reset();
  app.engines[1].finish();
  await flush();
  assert.equal(app.render().state, 'idle');
  assert.equal(app.engines[1].stopped, true);
  app.visibility('hidden');
  app.visibility('visible');
  assert.equal(app.engines.length, 2);
});


test('failed recovery keeps the session and supports an explicit retry', async () => {
  const app = setup();
  await app.render().start();
  app.engines[0].callbacks.onCough();
  app.fail(true);
  app.visibility('hidden');
  app.visibility('visible');
  await flush();
  assert.equal(app.render().state, 'counting');
  assert.match(app.render().error, /Resume Listening/);
  assert.equal(app.engines[1].stopped, true);
  app.fail(false);
  await app.render().resume();
  assert.equal(app.render().error, null);
  assert.equal(app.render().coughCount, 1);
  app.render().reset();
});
