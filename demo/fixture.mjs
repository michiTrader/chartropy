import {readRecording} from '../src/recording.mjs';

export function exampleRecording() {
  const candles = [];
  const length = 12_000;
  const start = Date.UTC(2026, 10, 17, 8);
  let close = 1.0845;
  let seed = 28174;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };

  for (let index = 0; index < length; index++) {
    const open = close;
    close = open + (random() - 0.5) * .00055 + (1.0845 - open) * .04;
    candles.push({time: start + index * 60_000, open, close,
      high: Math.max(open, close) + random() * .00015,
      low: Math.min(open, close) - random() * .00015});
  }

  const signal = length - 81;
  const entry = signal + 1;
  const exit = entry + 18;
  const entryPrice = candles[entry].open;
  const entryWindow = candles.slice(entry, exit + 1);
  const stopPrice = Math.min(...entryWindow.map(candle => candle.low)) - .0002;
  const targetPrice = Math.max(...entryWindow.map(candle => candle.high)) + .0002;
  const event = (index, kind, price, label, detail) => ({time: candles[index].time, kind, price, label, detail});

  return readRecording({version: 1, symbol: 'EUR/USD', timeframe: 'M1', priceDigits: 5, candles, events: [
    event(signal, 'signal', candles[signal].close, 'Señal de entrada', 'El cierre confirmó las reglas del escenario de ejemplo.'),
    event(entry, 'entry', entryPrice, 'Apertura simulada', 'La estrategia abrió al inicio de la vela siguiente.'),
    event(entry, 'stop', stopPrice, 'Stop loss', 'Nivel de protección de la operación de ejemplo.'),
    event(entry, 'target', targetPrice, 'Take profit', 'Objetivo de la operación de ejemplo.'),
    event(exit, 'exit', candles[exit].close, 'Cierre por tiempo', 'Se cerró al terminar la ventana de 18 velas.')
  ]});
}
