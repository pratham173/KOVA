import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ZOOM_LEVELS,
  computeFocalPoint,
  cycleZoomLevel,
  formatZoomLabel,
  panFocalPoint,
  stepZoomLevel,
  type FocalPoint,
  type ZoomLevel,
} from '../lib/imageZoom';
import { ProductImage } from './ProductImage';

interface ZoomableProductImageProps {
  src: string;
  alt: string;
  gallery?: string[];
  activeIndex?: number;
  onSelectIndex?: (index: number) => void;
}

const CENTER: FocalPoint = { x: 50, y: 50 };

export function ZoomableProductImage({
  src,
  alt,
  gallery = [src],
  activeIndex = 0,
  onSelectIndex,
}: ZoomableProductImageProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const lightboxFrameRef = useRef<HTMLDivElement | null>(null);

  const [lockedZoom, setLockedZoom] = useState<ZoomLevel>(1);
  const [hoverInspecting, setHoverInspecting] = useState(false);
  const [focal, setFocal] = useState<FocalPoint>(CENTER);

  // Full-screen detail inspector lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState<ZoomLevel>(1);
  const [lightboxFocal, setLightboxFocal] = useState<FocalPoint>(CENTER);

  // Reset magnification whenever the active gallery photo changes
  useEffect(() => {
    setLockedZoom(1);
    setHoverInspecting(false);
    setFocal(CENTER);
    setLightboxZoom(1);
    setLightboxFocal(CENTER);
  }, [src]);

  // Keyboard shortcuts & scroll lock when lightbox is open
  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === '+' || e.key === '=') {
        setLightboxZoom((z) => stepZoomLevel(z, 'in'));
      } else if (e.key === '-' || e.key === '_') {
        setLightboxZoom((z) => stepZoomLevel(z, 'out'));
      } else if (e.key === 'ArrowRight' && gallery.length > 1 && onSelectIndex && lightboxZoom === 1) {
        onSelectIndex((activeIndex + 1) % gallery.length);
      } else if (e.key === 'ArrowLeft' && gallery.length > 1 && onSelectIndex && lightboxZoom === 1) {
        onSelectIndex((activeIndex - 1 + gallery.length) % gallery.length);
      } else if (lightboxZoom > 1) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setLightboxFocal((f) => panFocalPoint(f, 10, 0));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setLightboxFocal((f) => panFocalPoint(f, -10, 0));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setLightboxFocal((f) => panFocalPoint(f, 0, 10));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setLightboxFocal((f) => panFocalPoint(f, 0, -10));
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen, lightboxZoom, gallery.length, activeIndex, onSelectIndex]);

  const effectiveZoom: ZoomLevel =
    lockedZoom > 1 ? lockedZoom : hoverInspecting ? ZOOM_LEVELS[1] : 1;
  const isZoomed = effectiveZoom > 1;

  const updateFocalFromEvent = (
    e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>,
    container: HTMLDivElement | null,
    setter: React.Dispatch<React.SetStateAction<FocalPoint>>
  ) => {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setter(computeFocalPoint(e.clientX, e.clientY, rect));
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    updateFocalFromEvent(e, frameRef.current, setFocal);
    setHoverInspecting(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      updateFocalFromEvent(e, frameRef.current, setFocal);
      if (!hoverInspecting) setHoverInspecting(true);
    } else if (isZoomed) {
      updateFocalFromEvent(e, frameRef.current, setFocal);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    setHoverInspecting(false);
    if (lockedZoom === 1) {
      setFocal(CENTER);
    }
  };

  const handleFrameClick = (e: React.MouseEvent<HTMLDivElement>) => {
    updateFocalFromEvent(e, frameRef.current, setFocal);
    // If currently hover-zoomed at 2.25x (not locked), clicking locks deeper to 3.25x;
    // clicking again returns cleanly to 1x (and clears hover zoom until pointer moves).
    if (lockedZoom === 1 && hoverInspecting) {
      setLockedZoom(ZOOM_LEVELS[2]);
    } else {
      const next = cycleZoomLevel(lockedZoom);
      setLockedZoom(next);
      if (next === 1) {
        setHoverInspecting(false);
        setFocal(CENTER);
      }
    }
  };

  const handleFrameKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setLockedZoom((z) => {
        const next = cycleZoomLevel(z);
        if (next === 1) setFocal(CENTER);
        return next;
      });
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setLockedZoom((z) => stepZoomLevel(z, 'in'));
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setLockedZoom((z) => {
        const next = stepZoomLevel(z, 'out');
        if (next === 1) setFocal(CENTER);
        return next;
      });
    } else if (e.key === 'Escape' && lockedZoom > 1) {
      setLockedZoom(1);
      setHoverInspecting(false);
      setFocal(CENTER);
    } else if (isZoomed) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocal((f) => panFocalPoint(f, 10, 0));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocal((f) => panFocalPoint(f, -10, 0));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocal((f) => panFocalPoint(f, 0, 10));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocal((f) => panFocalPoint(f, 0, -10));
      }
    }
  };

  const handleZoomInBtn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const base = effectiveZoom;
    const next = stepZoomLevel(base, 'in');
    setLockedZoom(next);
  };

  const handleZoomOutBtn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const base = effectiveZoom;
    const next = stepZoomLevel(base, 'out');
    setLockedZoom(next);
    if (next === 1) {
      setHoverInspecting(false);
      setFocal(CENTER);
    }
  };

  const handleResetBtn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLockedZoom(1);
    setHoverInspecting(false);
    setFocal(CENTER);
  };

  const handleOpenLightbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxZoom(1);
    setLightboxFocal(CENTER);
    setLightboxOpen(true);
  };

  return (
    <>
      <div className="relative group">
        {/* Interactive Magnifiable Viewport */}
        <div
          ref={frameRef}
          data-testid="product-zoom-stage"
          data-zoom-active={isZoomed ? 'true' : 'false'}
          data-zoom-level={String(effectiveZoom)}
          data-focal-x={String(Math.round(focal.x))}
          data-focal-y={String(Math.round(focal.y))}
          tabIndex={0}
          role="application"
          aria-label={`${alt} — interactive detail zoom at ${formatZoomLabel(effectiveZoom)}. Hover or click to magnify, use arrow keys to pan when zoomed.`}
          onPointerEnter={handlePointerEnter}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onClick={handleFrameClick}
          onKeyDown={handleFrameKeyDown}
          className={`aspect-[4/3] rounded-sm overflow-hidden bg-[#DFD9CE] dark:bg-[#1C1C20] border border-[#171716]/10 dark:border-white/10 relative select-none touch-pan-y ${
            effectiveZoom >= ZOOM_LEVELS[2]
              ? 'cursor-zoom-out'
              : 'cursor-zoom-in'
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={src}
              initial={{ opacity: 0.45 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0.45 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full"
            >
              <ProductImage
                src={src}
                alt={alt}
                draggable={false}
                className="w-full h-full object-cover will-change-transform transition-transform duration-200 ease-out"
                style={{
                  transform: `scale(${effectiveZoom})`,
                  transformOrigin: `${focal.x}% ${focal.y}%`,
                }}
              />
            </motion.div>
          </AnimatePresence>

          {/* Subtle optical vignette & precision focal indicator when magnified */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${
              isZoomed ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22)',
            }}
          />

          {/* Top-left subtle cue on rest; switches to focal coordinates when magnifying */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-3 left-3 px-2.5 py-1 rounded-[2px] glass-overlay text-[11px] font-mono text-[#FAF9F6] tracking-wide flex items-center gap-2 transition-opacity duration-200"
          >
            {isZoomed ? (
              <>
                <span className="w-1.5 h-1.5 bg-[#7BA1FF] inline-block" />
                <span>
                  {formatZoomLabel(effectiveZoom)} · {Math.round(focal.x)}%, {Math.round(focal.y)}%
                </span>
              </>
            ) : (
              <span>Hover or click to inspect</span>
            )}
          </div>
        </div>

        {/* Bottom-right architectural glassmorphic zoom toolbar */}
        <div
          className="absolute bottom-3 right-3 z-10 flex items-center gap-1 p-1 rounded-[3px] glass-overlay text-[#FAF9F6]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleZoomOutBtn}
            disabled={effectiveZoom <= ZOOM_LEVELS[0]}
            aria-label="Zoom out"
            className="w-8 h-8 rounded-[2px] flex items-center justify-center hover:bg-white/15 disabled:opacity-35 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <span
            data-testid="zoom-level-readout"
            className="px-2 font-mono text-[11px] tabular-nums min-w-[44px] text-center select-none"
          >
            {formatZoomLabel(effectiveZoom)}
          </span>

          <button
            type="button"
            onClick={handleZoomInBtn}
            disabled={effectiveZoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            aria-label="Zoom in"
            className="w-8 h-8 rounded-[2px] flex items-center justify-center hover:bg-white/15 disabled:opacity-35 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          {lockedZoom > 1 && (
            <button
              type="button"
              onClick={handleResetBtn}
              aria-label="Reset zoom"
              className="w-8 h-8 rounded-[2px] flex items-center justify-center hover:bg-white/15 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}

          <div className="w-px h-4 bg-white/20 mx-0.5" aria-hidden="true" />

          <button
            type="button"
            onClick={handleOpenLightbox}
            aria-label="Open full-screen detail view"
            className="w-8 h-8 rounded-[2px] flex items-center justify-center hover:bg-white/15 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Full-Screen Architectural Lightbox Inspector (Portaled to escape sticky/transform stacking contexts) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {lightboxOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                role="dialog"
                aria-modal="true"
                aria-label={`${alt} full-screen detail view`}
                className="fixed inset-0 z-[90] flex flex-col bg-[#0E0E10]/94 backdrop-blur-2xl"
              >
            {/* Lightbox Top Bar */}
            <div className="flex items-center justify-between gap-4 px-5 sm:px-8 py-4 border-b border-white/10 text-[#FAF9F6]">
              <div className="min-w-0">
                <p className="font-display text-sm sm:text-base font-semibold truncate">{alt}</p>
                <p className="text-xs font-mono text-[#A4A097]">
                  {gallery.length > 1 ? `View ${activeIndex + 1} / ${gallery.length} · ` : ''}
                  Click image to cycle magnification ({formatZoomLabel(lightboxZoom)})
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 p-1 rounded-[3px] bg-white/[0.06] border border-white/12">
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxZoom((z) => {
                        const next = stepZoomLevel(z, 'out');
                        if (next === 1) setLightboxFocal(CENTER);
                        return next;
                      })
                    }
                    disabled={lightboxZoom <= ZOOM_LEVELS[0]}
                    aria-label="Lightbox zoom out"
                    className="w-8 h-8 rounded-[2px] flex items-center justify-center hover:bg-white/15 disabled:opacity-35 cursor-pointer"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-mono text-xs tabular-nums min-w-[46px] text-center">
                    {formatZoomLabel(lightboxZoom)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLightboxZoom((z) => stepZoomLevel(z, 'in'))}
                    disabled={lightboxZoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                    aria-label="Lightbox zoom in"
                    className="w-8 h-8 rounded-[2px] flex items-center justify-center hover:bg-white/15 disabled:opacity-35 cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  aria-label="Close full-screen detail view"
                  className="w-10 h-10 rounded-[3px] bg-white/[0.08] border border-white/15 flex items-center justify-center text-[#FAF9F6] hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lightbox Stage */}
            <div className="flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden">
              {gallery.length > 1 && onSelectIndex && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectIndex((activeIndex - 1 + gallery.length) % gallery.length)
                    }
                    aria-label="Previous image"
                    className="absolute left-4 sm:left-6 z-20 w-10 h-10 rounded-[3px] glass-overlay flex items-center justify-center text-white hover:bg-white/20 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectIndex((activeIndex + 1) % gallery.length)}
                    aria-label="Next image"
                    className="absolute right-4 sm:right-6 z-20 w-10 h-10 rounded-[3px] glass-overlay flex items-center justify-center text-white hover:bg-white/20 cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              <motion.div
                ref={lightboxFrameRef}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                data-testid="lightbox-zoom-stage"
                data-zoom-level={String(lightboxZoom)}
                onPointerMove={(e) => {
                  if (lightboxZoom > 1) {
                    updateFocalFromEvent(e, lightboxFrameRef.current, setLightboxFocal);
                  }
                }}
                onClick={(e) => {
                  updateFocalFromEvent(e, lightboxFrameRef.current, setLightboxFocal);
                  setLightboxZoom((z) => {
                    const next = cycleZoomLevel(z);
                    if (next === 1) setLightboxFocal(CENTER);
                    return next;
                  });
                }}
                className={`w-full max-w-5xl max-h-full aspect-[4/3] rounded-sm overflow-hidden bg-[#17171A] border border-white/15 shadow-2xl select-none ${
                  lightboxZoom >= ZOOM_LEVELS[2] ? 'cursor-zoom-out' : 'cursor-zoom-in'
                }`}
              >
                <ProductImage
                  src={src}
                  alt={alt}
                  draggable={false}
                  className="w-full h-full object-cover will-change-transform transition-transform duration-200 ease-out"
                  style={{
                    transform: `scale(${lightboxZoom})`,
                    transformOrigin: `${lightboxFocal.x}% ${lightboxFocal.y}%`,
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
