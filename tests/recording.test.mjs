import assert from 'node:assert/strict';
import test from 'node:test';
import {exampleRecording} from '../demo/fixture.mjs';
import {readRecording, visibleEventCount} from '../src/recording.mjs';

test('el replay muestra cada evento a partir de su propia vela', () => {
  const {eventBars, eventsByBar, levelsByBar} = exampleRecording();
  const [signal, entry, exit] = eventBars;
  assert.equal(visibleEventCount(eventBars, signal - 1), 0);
  assert.equal(visibleEventCount(eventBars, entry - 1), 1);
  assert.equal(visibleEventCount(eventBars, exit - 1), 2);
  assert.equal(visibleEventCount(eventBars, exit), 3);
  assert.equal(eventsByBar.get(signal)[0].kind, 'signal');
  assert.deepEqual(levelsByBar.get(entry).map(event => event.kind), ['stop', 'target']);
  assert.deepEqual(levelsByBar.get(exit), []);
});

test('una grabación rechaza velas duplicadas y eventos sin vela', () => {
  const recording = exampleRecording();
  const [first] = recording.candles;
  assert.throws(() => readRecording({...recording, candles: [first, first], events: []}), /Vela inválida/);
  assert.throws(() => readRecording({...recording, candles: [first]}), /corresponder a una vela/);
});
