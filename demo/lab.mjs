import {CandleChart} from '../src/candle-chart.mjs';
import {readRecording, visibleEventCount} from '../src/recording.mjs';
import {exampleRecording} from './fixture.mjs';

const element = id => document.getElementById(id);
const controls = Object.fromEntries(['chart', 'source', 'instrument', 'recording', 'error', 'navigation',
  'latest', 'transport', 'play', 'previous', 'next', 'cursor', 'position', 'progress', 'timing',
  'selected-time', 'ohlc', 'event-count', 'events', 'jump-event'].map(id => [id, element(id)]));
const buttons = [...document.querySelectorAll('[data-mode]')];
const date = new Intl.DateTimeFormat('es-CO', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC', hourCycle: 'h23'});
const integer = new Intl.NumberFormat('es-CO');
const milliseconds = new Intl.NumberFormat('es-CO', {maximumFractionDigits: 2});
const state = {mode: 'replay', timer: null};
const paintTimes = [];

const chart = new CandleChart(controls.chart, {
  onSelect: selectBar,
  onPaint(elapsed) {
    paintTimes.push(elapsed);
    if (paintTimes.length > 120) paintTimes.shift();
    const sorted = [...paintTimes].sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(sorted.length * .95) - 1];
    controls.timing.textContent = `Dibujo p95 · ${milliseconds.format(p95)} ms · ${sorted.length} muestras`;
  }
});

function put(id, value) { controls[id].textContent = value; }

function selectBar(index) {
  const candle = state.recording.candles[index];
  if (!candle || index > state.cursor) return;
  chart.setSelection(index);
  put('selected-time', `${date.format(candle.time)} UTC`);
  controls.ohlc.replaceChildren(...Object.entries({Apertura: candle.open, Máximo: candle.high,
    Mínimo: candle.low, Cierre: candle.close}).map(([label, price]) => {
    const row = document.createElement('div');
    const title = document.createElement('dt');
    const value = document.createElement('dd');
    title.textContent = label;
    value.textContent = state.price.format(price);
    row.append(title, value);
    return row;
  }));

  const events = state.recording.eventsByBar.get(index) ?? [];
  put('event-count', String(events.length));
  controls.events.replaceChildren(...(events.length ? events.map(event => {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    const detail = document.createElement('p');
    title.textContent = `${event.label} · ${state.price.format(event.price)}`;
    detail.textContent = event.detail;
    item.append(title, detail);
    return item;
  }) : [Object.assign(document.createElement('li'), {textContent: 'Sin eventos en esta vela.'})]));
}

function renderEvents() {
  const {eventBars, eventsByBar, candles} = state.recording;
  const count = visibleEventCount(eventBars, state.cursor);
  if (state.visibleEvents === count) return;
  state.visibleEvents = count;
  controls['jump-event'].replaceChildren(new Option('Elige un evento visible', ''),
    ...eventBars.slice(Math.max(0, count - 100), count).map(index => new Option(
      `${date.format(candles[index].time)} · ${eventsByBar.get(index)[0].label}`, String(index))));
}

function updateTransport() {
  const {candles} = state.recording;
  const atStart = state.cursor === 0;
  const atEnd = state.cursor === candles.length - 1;
  controls.cursor.value = String(state.cursor);
  controls.cursor.setAttribute('aria-valuetext', `${date.format(candles[state.cursor].time)} UTC`);
  put('position', `${integer.format(state.cursor + 1)} / ${integer.format(candles.length)}`);
  put('progress', state.mode === 'history' ? `${integer.format(candles.length)} velas` : `${date.format(candles[state.cursor].time)} UTC`);
  controls.previous.disabled = atStart;
  controls.next.disabled = atEnd;
  controls.play.disabled = atEnd;
}

function moveCursor(index, follow) {
  state.cursor = Math.max(0, Math.min(index, state.recording.candles.length - 1));
  if (state.mode === 'replay') state.replayCursor = state.cursor;
  chart.setCount(state.cursor + 1, follow);
  selectBar(state.cursor);
  renderEvents();
  updateTransport();
  if (controls.next.disabled) pause();
}

function pause() {
  clearInterval(state.timer);
  state.timer = null;
  put('play', 'Reproducir');
}

function play() {
  if (state.timer || controls.play.disabled) return;
  put('play', 'Pausar');
  state.timer = setInterval(() => moveCursor(state.cursor + 1), 450);
}

function setMode(mode) {
  pause();
  state.mode = mode;
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  controls.transport.hidden = mode === 'history';
  controls.cursor.closest('label').hidden = mode === 'feed';
  controls.previous.hidden = mode === 'feed';
  controls.next.hidden = mode === 'feed';
  const positions = {history: state.recording.candles.length - 1, replay: state.replayCursor, feed: state.start};
  moveCursor(positions[mode], true);
  if (mode === 'feed') play();
}

function load(recording, source) {
  element('launch').hidden = true;
  element('demo').hidden = false;
  state.recording = recording;
  state.price = new Intl.NumberFormat('es-CO', {minimumFractionDigits: recording.priceDigits, maximumFractionDigits: recording.priceDigits});
  const firstEntry = recording.eventBars.find(index => recording.eventsByBar.get(index).some(event => event.kind === 'entry'));
  state.start = Math.min(recording.candles.length - 1, firstEntry ?? recording.eventBars[0] ?? 69);
  state.replayCursor = state.start;
  state.visibleEvents = -1;
  controls.cursor.max = String(recording.candles.length - 1);
  put('source', source);
  put('instrument', `${recording.symbol} · ${recording.timeframe}`);
  paintTimes.length = 0;
  chart.setRecording(recording, state.replayCursor + 1);
  setMode('replay');
}

buttons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
controls.navigation.addEventListener('change', () => chart.setNavigation(controls.navigation.value));
controls.latest.addEventListener('click', () => chart.setOffset(chart.maxOffset));
element('zoom-in').addEventListener('click', () => chart.zoom(.8));
element('zoom-out').addEventListener('click', () => chart.zoom(1.25));
controls.previous.addEventListener('click', () => { pause(); moveCursor(state.cursor - 1, true); });
controls.next.addEventListener('click', () => { pause(); moveCursor(state.cursor + 1, true); });
controls.play.addEventListener('click', () => state.timer ? pause() : play());
controls.cursor.addEventListener('input', () => { pause(); moveCursor(Number(controls.cursor.value), true); });
controls['jump-event'].addEventListener('change', () => {
  if (!controls['jump-event'].value) return;
  const index = Number(controls['jump-event'].value);
  chart.setOffset(index - chart.span / 2);
  selectBar(index);
});
controls.recording.addEventListener('change', async () => {
  const [file] = controls.recording.files;
  if (!file) return;
  controls.recording.disabled = true;
  controls.error.hidden = true;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('La grabación supera los 20 MB.');
    load(readRecording(JSON.parse(await file.text())), `Archivo local · ${file.name}`);
  } catch (error) {
    put('error', error instanceof SyntaxError ? 'El archivo no contiene JSON válido.' : error.message);
    controls.error.hidden = false;
  } finally {
    controls.recording.value = '';
    controls.recording.disabled = false;
  }
});

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => chart.refreshTheme());
load(exampleRecording(), 'Grabación sintética');
