import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZOOM_LEVELS,
  clampPercent,
  computeFocalPoint,
  cycleZoomLevel,
  formatZoomLabel,
  panFocalPoint,
  stepZoomLevel,
} from './imageZoom';

test('computeFocalPoint maps pointer coordinates to clamped percentages', () => {
  const rect = { left: 100, top: 200, width: 800, height: 600 };

  assert.deepEqual(computeFocalPoint(500, 500, rect), { x: 50, y: 50 });
  assert.deepEqual(computeFocalPoint(100, 200, rect), { x: 0, y: 0 });
  assert.deepEqual(computeFocalPoint(900, 800, rect), { x: 100, y: 100 });
  // Out-of-bounds pointer clamps cleanly to [0, 100]
  assert.deepEqual(computeFocalPoint(-50, 1200, rect), { x: 0, y: 100 });
  // Zero-area rect safely centers
  assert.deepEqual(computeFocalPoint(250, 250, { left: 0, top: 0, width: 0, height: 0 }), {
    x: 50,
    y: 50,
  });
});

test('panFocalPoint offsets focal coordinates while respecting bounds', () => {
  assert.deepEqual(panFocalPoint({ x: 50, y: 50 }, 15, -10), { x: 65, y: 40 });
  assert.deepEqual(panFocalPoint({ x: 95, y: 5 }, 20, -20), { x: 100, y: 0 });
  assert.equal(clampPercent(Number.NaN), 50);
});

test('stepZoomLevel and cycleZoomLevel transition across defined zoom presets', () => {
  assert.deepEqual([...ZOOM_LEVELS], [1, 2.25, 3.25]);
  assert.equal(stepZoomLevel(1, 'in'), 2.25);
  assert.equal(stepZoomLevel(2.25, 'in'), 3.25);
  assert.equal(stepZoomLevel(3.25, 'in'), 3.25);
  assert.equal(stepZoomLevel(3.25, 'out'), 2.25);
  assert.equal(stepZoomLevel(2.25, 'out'), 1);
  assert.equal(stepZoomLevel(1, 'out'), 1);

  assert.equal(cycleZoomLevel(1), 2.25);
  assert.equal(cycleZoomLevel(2.25), 3.25);
  assert.equal(cycleZoomLevel(3.25), 1);

  assert.equal(formatZoomLabel(1), '1.0×');
  assert.equal(formatZoomLabel(2.25), '2.25×');
});
