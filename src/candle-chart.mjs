import {visibleEventCount} from './recording.mjs';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const axisFont = '12px system-ui, sans-serif';
const labelFont = '600 12px system-ui, sans-serif';
const axisTime = new Intl.DateTimeFormat('es-CO', {timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});

export class CandleChart {
  constructor(canvas, {onSelect, onPaint}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', {alpha: false});
    this.onSelect = onSelect;
    this.onPaint = onPaint;
    this.pointers = new Map();
    this.span = 70;
    this.offset = 0;
    this.count = 0;
    this.navigation = 'smooth';
    this.colors = {};
    this.refreshTheme();
    new ResizeObserver(() => this.schedule()).observe(canvas);
    canvas.addEventListener('wheel', event => this.onWheel(event), {passive: false});
    canvas.addEventListener('pointerdown', event => this.onPointerDown(event));
    canvas.addEventListener('pointermove', event => this.onPointerMove(event));
    canvas.addEventListener('pointerup', event => this.onPointerUp(event));
    canvas.addEventListener('pointercancel', event => this.onPointerUp(event, false));
    canvas.addEventListener('lostpointercapture', event => this.onPointerUp(event, false));
    canvas.addEventListener('keydown', event => this.onKeyDown(event));
  }

  setRecording(recording, count) {
    this.recording = recording;
    this.priceFormat = new Intl.NumberFormat('es-CO', {minimumFractionDigits: recording.priceDigits, maximumFractionDigits: recording.priceDigits});
    this.span = 70;
    this.setCount(count, true);
  }

  setCount(count, follow = this.offset >= this.maxOffset - .01) {
    this.count = clamp(count, 1, this.recording.candles.length);
    this.setOffset(follow ? this.maxOffset : this.offset);
  }

  get maxOffset() { return Math.max(0, this.count - this.span); }

  setOffset(offset) {
    const value = clamp(offset, 0, this.maxOffset);
    this.offset = this.navigation === 'bars' ? clamp(Math.round(value), 0, Math.floor(this.maxOffset)) : value;
    this.schedule();
  }

  setNavigation(mode) {
    this.navigation = mode;
    if (mode === 'bars') this.span = Math.round(this.span);
    this.setOffset(this.offset);
  }

  setSelection(index) {
    this.selected = index;
    this.schedule();
  }

  refreshTheme() {
    const styles = getComputedStyle(this.canvas);
    for (const key of ['paper', 'ink', 'muted', 'line', 'up', 'down', 'signal', 'selection']) {
      this.colors[key] = styles.getPropertyValue(`--chart-${key}`).trim();
    }
    this.schedule();
  }

  schedule() {
    if (this.queued) return;
    this.queued = requestAnimationFrame(() => {
      this.queued = 0;
      if (!this.recording || !this.ctx || this.canvas.clientWidth < 160 || !this.canvas.clientHeight) return;
      const start = performance.now();
      this.draw();
      this.onPaint?.(performance.now() - start);
    });
  }

  zoom(factor, fraction = .5, initialSpan = this.span, anchor = this.offset + fraction * this.span) {
    const span = clamp(initialSpan * factor, 10, Math.max(160, Math.min(this.count, 800)));
    this.span = this.navigation === 'bars' ? Math.round(span) : span;
    this.setOffset(anchor - fraction * this.span);
  }

  position(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {x: event.clientX - rect.left, y: event.clientY - rect.top};
  }

  onWheel(event) {
    if (!this.frame || event.ctrlKey || event.metaKey) return;
    const {x} = this.position(event);
    if (x < this.frame.left || x > this.frame.right || (!event.shiftKey && !event.deltaX)) return;
    event.preventDefault();
    if (event.shiftKey) this.zoom(Math.exp(clamp(event.deltaY, -120, 120) * .003), clamp((x - this.frame.left) / this.frame.width, 0, 1));
    else this.setOffset(this.offset + event.deltaX / this.frame.cell);
  }

  onPointerDown(event) {
    if (!this.frame || event.button !== 0 || this.pointers.size >= 2) return;
    const point = this.position(event);
    if (point.x < this.frame.left || point.x > this.frame.right || point.y > this.frame.bottom) return;
    this.pointers.set(event.pointerId, point);
    this.canvas.setPointerCapture(event.pointerId);
    this.anchorGesture();
  }

  anchorGesture() {
    const [first, second] = this.pointers.values();
    if (!first) return;
    const {left, width} = this.frame;
    const center = second ? (first.x + second.x) / 2 : first.x;
    this.gesture = {x: center, offset: this.offset, span: this.span,
      anchor: this.offset + clamp((center - left) / width, 0, 1) * this.span,
      distance: second ? Math.max(5, Math.hypot(first.x - second.x, first.y - second.y)) : null,
      moved: Boolean(second)};
  }

  onPointerMove(event) {
    if (!this.pointers.has(event.pointerId) || !this.frame) return;
    const point = this.position(event);
    this.pointers.set(event.pointerId, point);
    const gesture = this.gesture;
    if (gesture.distance) {
      const [first, second] = this.pointers.values();
      const distance = Math.max(5, Math.hypot(first.x - second.x, first.y - second.y));
      const center = (first.x + second.x) / 2;
      const fraction = clamp((center - this.frame.left) / this.frame.width, 0, 1);
      this.zoom(gesture.distance / distance, fraction, gesture.span, gesture.anchor);
    } else {
      const delta = point.x - gesture.x;
      if (Math.abs(delta) >= 4) gesture.moved = true;
      if (gesture.moved) this.setOffset(gesture.offset - delta * gesture.span / this.frame.width);
    }
  }

  onPointerUp(event, allowSelect = true) {
    if (!this.pointers.has(event.pointerId)) return;
    const point = this.position(event);
    const select = allowSelect && this.pointers.size === 1 && !this.gesture.moved &&
      Math.abs(point.x - this.gesture.x) < 4;
    this.pointers.delete(event.pointerId);
    if (this.pointers.size) {
      this.anchorGesture();
      this.gesture.moved = true;
    } else if (select && this.frame && point.x >= this.frame.left && point.x <= this.frame.right) {
      const index = Math.floor(this.offset + (point.x - this.frame.left) / this.frame.cell);
      if (index >= 0 && index < this.count) this.onSelect?.(index);
    }
  }

  onKeyDown(event) {
    if (event.key === 'ArrowLeft') this.setOffset(this.offset - 1);
    else if (event.key === 'ArrowRight') this.setOffset(this.offset + 1);
    else if (event.key === '+' || event.key === '=') this.zoom(.8);
    else if (event.key === '-') this.zoom(1.25);
    else if (event.key === 'End') this.setOffset(this.maxOffset);
    else return;
    event.preventDefault();
  }

  draw() {
    const {canvas, ctx, colors} = this;
    const {candles, eventsByBar} = this.recording;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpi = window.devicePixelRatio || 1;
    const bitmapWidth = Math.round(width * dpi);
    const bitmapHeight = Math.round(height * dpi);
    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
    }
    ctx.setTransform(bitmapWidth / width, 0, 0, bitmapHeight / height, 0, 0);
    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, 0, width, height);
    ctx.font = labelFont;
    ctx.textBaseline = 'middle';

    const first = Math.floor(this.offset);
    const last = Math.min(this.count - 1, Math.ceil(this.offset + this.span) - 1);
    let low = Infinity;
    let high = -Infinity;
    for (let index = first; index <= last; index++) {
      low = Math.min(low, candles[index].low);
      high = Math.max(high, candles[index].high);
    }
    const levels = this.levels();
    for (const event of levels) {
      low = Math.min(low, event.price);
      high = Math.max(high, event.price);
    }
    const padding = (high - low) * .12 || Math.max(Math.abs(low) * .0001, 10 ** -this.recording.priceDigits);
    low -= padding;
    high += padding;
    const labelWidth = Math.ceil(Math.max(ctx.measureText(this.priceFormat.format(low)).width,
      ctx.measureText(this.priceFormat.format(high)).width));
    const left = 9, right = width - labelWidth - 23, top = 12, bottom = height - 31;
    const cell = (right - left) / this.span;
    this.frame = {left, right, bottom, width: right - left, cell};
    const x = index => left + (index + .5 - this.offset) * cell;
    const y = price => top + (high - price) * (bottom - top) / (high - low);
    const levelLabels = levels.map(event => ({event, priceY: y(event.price), labelY: y(event.price)}))
      .sort((a, b) => a.priceY - b.priceY);
    if (levelLabels.length === 2 && levelLabels[1].priceY - levelLabels[0].priceY < 22) {
      const middle = clamp((levelLabels[0].priceY + levelLabels[1].priceY) / 2, top + 11, bottom - 11);
      levelLabels[0].labelY = middle - 11;
      levelLabels[1].labelY = middle + 11;
    }
    this.axes({left, right, top, bottom, height, first, last, x, y, low, high}, candles, levelLabels);

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();
    if (this.selected >= first && this.selected <= last) {
      ctx.fillStyle = colors.selection;
      ctx.fillRect(x(this.selected) - cell / 2, top, cell, bottom - top);
    }
    const body = Math.max(1, cell * .69);
    for (let index = first; index <= last; index++) {
      const {open, high, low, close} = candles[index];
      const center = x(index);
      const color = close >= open ? colors.up : colors.down;
      this.line(center, y(high), center, y(low), color);
      ctx.fillStyle = color;
      ctx.fillRect(center - body / 2, y(Math.max(open, close)), body, Math.max(1, Math.abs(y(open) - y(close))));
      for (const event of eventsByBar.get(index) ?? []) {
        if (event.kind === 'stop' || event.kind === 'target') continue;
        const markerY = y(event.price);
        this.marker(center, markerY, event.kind === 'exit' || event.kind === 'cancel' ? colors.down : colors.signal, event.kind);
      }
    }
    for (const event of levels) {
      ctx.setLineDash([4, 4]);
      this.line(left, y(event.price), right, y(event.price), event.kind === 'stop' ? colors.down : colors.up);
      ctx.setLineDash([]);
    }
    ctx.restore();
    for (const {event, priceY, labelY} of levelLabels) {
      const color = event.kind === 'stop' ? colors.down : colors.up;
      if (labelY !== priceY) this.line(right - 3, priceY, right + 2, labelY, color);
      this.priceLabel(right + 2, labelY, this.priceFormat.format(event.price), color);
    }
  }

  levels() {
    const {eventBars, eventsByBar, levelsByBar} = this.recording;
    if (this.selected < this.count) {
      const marked = eventsByBar.get(this.selected)?.filter(event => event.kind === 'stop' || event.kind === 'target');
      if (marked?.length) return marked.slice(0, 2);
    }
    const cursor = this.selected >= 0 && this.selected < this.count ? this.selected : this.count - 1;
    const previous = eventBars[visibleEventCount(eventBars, cursor) - 1];
    return levelsByBar.get(previous) ?? [];
  }

  axes({left, right, top, bottom, height, first, last, x, y, low, high}, candles, levelLabels) {
    const {ctx, colors} = this;
    ctx.font = axisFont;
    ctx.fillStyle = colors.muted;
    ctx.textAlign = 'left';
    for (let row = 0; row <= 5; row++) {
      const price = high - (high - low) * row / 5;
      const position = y(price);
      this.line(left, position, right, position, colors.line);
      if (levelLabels.every(label => Math.abs(label.labelY - position) >= 16)) {
        ctx.fillText(this.priceFormat.format(price), right + 7, position);
      }
    }
    this.line(right, top, right, bottom, colors.line);
    ctx.textAlign = 'center';
    const tickCount = Math.max(1, Math.min(6, Math.floor((right - left) / 112)));
    for (let tick = 0; tick < tickCount; tick++) {
      const index = Math.round(first + (last - first) * (tick + .5) / tickCount);
      const center = x(index);
      this.line(center, top, center, bottom, colors.line);
      ctx.fillText(axisTime.format(candles[index].time), clamp(center, left + 46, right - 46), height - 14);
    }
  }

  line(x1, y1, x2, y2, color) {
    const {ctx} = this;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  marker(x, y, color, kind) {
    const {ctx} = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (kind === 'entry') {
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x - 5, y + 4);
      ctx.lineTo(x + 5, y + 4);
    } else ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  priceLabel(x, y, text, color) {
    const {ctx} = this;
    ctx.font = labelFont;
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 10, ctx.measureText(text).width + 10, 20);
    ctx.fillStyle = this.colors.paper;
    ctx.fillText(text, x + 5, y);
  }
}
