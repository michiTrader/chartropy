export const eventKinds = new Set(['signal', 'entry', 'stop', 'target', 'exit', 'cancel']);

export function visibleEventCount(indices, cursor) {
  let first = 0;
  let last = indices.length;
  while (first < last) {
    const middle = (first + last) >>> 1;
    if (indices[middle] <= cursor) first = middle + 1;
    else last = middle;
  }
  return first;
}

export function readRecording(input) {
  if (input?.version !== 1 || typeof input.symbol !== 'string' || !input.symbol.trim() ||
      typeof input.timeframe !== 'string' || !input.timeframe.trim() ||
      !Number.isInteger(input.priceDigits) || input.priceDigits < 0 || input.priceDigits > 10 ||
      !Array.isArray(input.candles) || !input.candles.length || !Array.isArray(input.events)) {
    throw new Error('Se requiere una grabación v1 con símbolo, marco, precisión, velas y eventos.');
  }

  const indices = new Map();
  let previous = -1;
  for (const [index, candle] of input.candles.entries()) {
    const {time, open, high, low, close} = candle ?? {};
    if (!Number.isSafeInteger(time) || time <= previous || time > 8.64e15 ||
        ![open, high, low, close].every(Number.isFinite) ||
        low > Math.min(open, close) || high < Math.max(open, close)) {
      throw new Error(`Vela inválida en la fila ${index + 1}. Revisa la hora UTC, el orden y los precios OHLC.`);
    }
    indices.set(time, index);
    previous = time;
  }

  const eventsByBar = new Map();
  for (const event of input.events) {
    const {time, kind, price, label, detail} = event ?? {};
    const index = indices.get(time);
    if (index === undefined || !eventKinds.has(kind) || !Number.isFinite(price) ||
        typeof label !== 'string' || !label.trim() || typeof detail !== 'string') {
      throw new Error('Cada evento debe corresponder a una vela y tener tipo, precio, título y detalle.');
    }
    if (!eventsByBar.has(index)) eventsByBar.set(index, []);
    eventsByBar.get(index).push(event);
  }

  const eventBars = [...eventsByBar.keys()].sort((a, b) => a - b);
  const levelsByBar = new Map();
  const levels = new Map();
  for (const index of eventBars) {
    for (const event of eventsByBar.get(index)) {
      if (event.kind === 'entry' || event.kind === 'exit' || event.kind === 'cancel') levels.clear();
      if (event.kind === 'stop' || event.kind === 'target') levels.set(event.kind, event);
    }
    levelsByBar.set(index, [...levels.values()]);
  }
  return {...input, eventsByBar, eventBars, levelsByBar};
}
