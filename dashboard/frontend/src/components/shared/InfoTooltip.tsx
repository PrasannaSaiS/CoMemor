import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface InfoTooltipProps {
  content: ReactNode;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export function InfoTooltip({ content, size = 'sm', ariaLabel = 'More information' }: InfoTooltipProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();

    const popoverEl = popoverRef.current;
    const popoverWidth = popoverEl ? popoverEl.offsetWidth : 280;
    const popoverHeight = popoverEl ? popoverEl.offsetHeight : 120;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;

    // Horizontal centering relative to trigger button
    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    let left = triggerCenter - popoverWidth / 2;
    // Keep within viewport boundaries horizontally
    left = Math.max(margin, Math.min(left, viewportWidth - popoverWidth - margin));

    // Vertical placement logic:
    // Check available space below and above
    const spaceBelow = viewportHeight - triggerRect.bottom - margin;
    const spaceAbove = triggerRect.top - margin;
    const gap = 8;

    let top: number;
    let placement: 'top' | 'bottom';

    // If space below is not enough for the popover, and space above has more room, flip above!
    if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      placement = 'top';
      top = triggerRect.top - popoverHeight - gap;
      if (top < margin) {
        top = margin;
      }
    } else {
      placement = 'bottom';
      top = triggerRect.bottom + gap;
      if (top + popoverHeight > viewportHeight - margin) {
        top = Math.max(margin, viewportHeight - popoverHeight - margin);
      }
    }

    setCoords({ top, left, placement });
  }, []);

  const handleOpen = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(true);
  };

  const handleClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setCoords(null);
    }, 120);
  };

  const cancelClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      setCoords(null);
    } else {
      setOpen(true);
    }
  };

  // When open state changes, update position & attach window listeners
  useEffect(() => {
    if (!open) return;

    // Initial position calculation
    updatePosition();

    // Re-measure after DOM paint to get exact offsetHeight/offsetWidth
    const frameId = requestAnimationFrame(() => {
      updatePosition();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    const onScrollOrResize = () => {
      updatePosition();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    window.addEventListener('scroll', onScrollOrResize, { capture: true, passive: true });
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, { capture: true });
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const iconDim = size === 'md' ? 18 : 15;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="info-btn"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={toggle}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        style={{ width: iconDim, height: iconDim }}
      >
        <svg viewBox="0 0 16 16" fill="none" width="100%" height="100%" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="8" cy="8" r="6.5" />
          <line x1="8" y1="7" x2="8" y2="11.5" />
          <circle cx="8" cy="4.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className={`info-popover ${coords?.placement ? `info-popover-${coords.placement}` : ''}`}
            role="tooltip"
            onMouseEnter={cancelClose}
            onMouseLeave={handleClose}
            style={{
              position: 'fixed',
              top: coords ? `${coords.top}px` : '-9999px',
              left: coords ? `${coords.left}px` : '-9999px',
              opacity: coords ? 1 : 0,
              visibility: coords ? 'visible' : 'hidden',
              pointerEvents: 'auto',
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

export const InfoButton = InfoTooltip;
