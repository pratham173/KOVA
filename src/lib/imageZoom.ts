export const ZOOM_LEVELS = [1, 2.25, 3.25] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export interface FocalPoint {
  /** Horizontal focal point percentage in [0, 100] */
  x: number;
  /** Vertical focal point percentage in [0, 100] */
  y: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

/**
 * Converts viewport pointer coordinates into a clamped [0..100]% focal point
 * relative to the image container bounds.
 */
export function computeFocalPoint(
  clientX: number,
  clientY: number,
  rect: RectLike
): FocalPoint {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 50, y: 50 };
  }
  const rawX = ((clientX - rect.left) / rect.width) * 100;
  const rawY = ((clientY - rect.top) / rect.height) * 100;
  return {
    x: clampPercent(rawX),
    y: clampPercent(rawY),
  };
}

/**
 * Moves the focal point by a percentage delta (used for keyboard arrow panning).
 */
export function panFocalPoint(
  current: FocalPoint,
  deltaX: number,
  deltaY: number
): FocalPoint {
  return {
    x: clampPercent(current.x + deltaX),
    y: clampPercent(current.y + deltaY),
  };
}

/**
 * Steps zoom up or down through ZOOM_LEVELS without wrapping.
 */
export function stepZoomLevel(current: ZoomLevel, direction: 'in' | 'out'): ZoomLevel {
  const idx = ZOOM_LEVELS.indexOf(current);
  const safeIdx = idx === -1 ? 0 : idx;
  if (direction === 'in') {
    return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, safeIdx + 1)];
  }
  return ZOOM_LEVELS[Math.max(0, safeIdx - 1)];
}

/**
 * Cycles zoom level on primary click: 1x -> 2.25x -> 3.25x -> 1x.
 */
export function cycleZoomLevel(current: ZoomLevel): ZoomLevel {
  const idx = ZOOM_LEVELS.indexOf(current);
  if (idx === -1) return ZOOM_LEVELS[1];
  return ZOOM_LEVELS[(idx + 1) % ZOOM_LEVELS.length];
}

export function formatZoomLabel(level: ZoomLevel): string {
  return level === 1 ? '1.0×' : `${level}×`;
}
