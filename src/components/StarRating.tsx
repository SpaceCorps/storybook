"use client";

import { useState, useCallback } from "react";
import { Star } from "lucide-react";
import { m, LazyMotion, MotionConfig, domAnimation, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { InvalidIcon } from "@/components/InvalidIcon";
import { Densities } from "@/types/density";
import { useDensity } from "@/contexts/density-context";
import { clampRating, ratingKeyTarget, ratingValueText } from "@/components/keyboard/rating";
import type React from "react";

export interface StarRatingProps {
  totalStars?: number;
  value?: number;
  onRate?: (rating: number) => void;
  density?: Densities;
  className?: string;
  disabled?: boolean;
  invalid?: string;
  /**
   * Lets the left half of a star pick a half value with the pointer.
   *
   * A row of buttons can only say "this star", so with `allowHalf` the rating is a single slider
   * instead (the WAI-ARIA slider pattern): one tab stop, Left/Down and Right/Up move by half a
   * star, Page Down and Page Up by a whole one, Home clears and End gives the highest. The stars
   * are then drawn for the pointer only and are not separate controls; a pointer still rates by
   * clicking, with the left half of a star picking the half value.
   */
  allowHalf?: boolean;
  /** Names the rating. Without `allowHalf` the stars themselves are named "Rate N stars". */
  "aria-label"?: string;
}

const starSizes = {
  Small: "size-4",
  Medium: "size-6",
  Large: "size-8",
};

/** What the pointer is over: the star's half value over its left half, else the whole star. */
function pointerValue(star: number, allowHalf: boolean, e: React.MouseEvent<HTMLElement>): number {
  if (!allowHalf) return star;
  const rect = e.currentTarget.getBoundingClientRect();
  const isLeftHalf = e.clientX - rect.left < rect.width / 2;
  return isLeftHalf ? star - 0.5 : star;
}

export function StarRating({
  totalStars = 5,
  value = 0,
  onRate,
  density,
  className,
  disabled = false,
  invalid,
  allowHalf = false,
  "aria-label": ariaLabel = "Rating",
}: StarRatingProps) {
  const contextDensity = useDensity();
  const effectiveDensity = density ?? contextDensity;

  const [hover, setHover] = useState(0);
  const reduceMotion = useReducedMotion();

  const handleRating = useCallback(
    (star: number, e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      // A keyboard activation is a click with no pointer (detail 0, clientX 0), which would always
      // read as the left half, so it could only ever pick half values. Only a click is told apart
      // this way: hovering has no keyboard counterpart and always has a position.
      if (e.detail === 0) {
        // The star marked pressed holds the current value, half values included, so activating it
        // again clears the rating as aria-pressed promises.
        onRate?.(Math.ceil(value) === star ? 0 : star);
        return;
      }
      const rating = pointerValue(star, allowHalf, e);
      onRate?.(value === rating ? 0 : rating);
    },
    [disabled, onRate, value, allowHalf],
  );

  const handleMouseMove = useCallback(
    (star: number, e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      setHover(pointerValue(star, allowHalf, e));
    },
    [disabled, allowHalf],
  );

  // The slider's keys. Left and Right swap in a right-to-left layout.
  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || e.altKey || e.ctrlKey || e.metaKey) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const next = ratingKeyTarget(e.key, value, totalStars, { rtl });
    if (next === null) return;
    e.preventDefault();
    if (next !== clampRating(value, totalStars)) onRate?.(next);
  };

  const displayValue = hover || value;
  const stars = Array.from({ length: totalStars }, (_, index) => index + 1);

  /** One star's picture: an outline, with the filled part of it drawn over. */
  const glyph = (star: number) => {
    const fillRatio = Math.max(0, Math.min(1, displayValue - (star - 1)));
    const isFull = fillRatio >= 1;
    const isPartial = fillRatio > 0 && fillRatio < 1;
    return (
      <m.div
        className="relative"
        initial={{ scale: 1 }}
        animate={{
          scale: fillRatio > 0 ? 1.2 : 1,
        }}
        transition={{
          duration: 0.3,
          ease: "easeOut",
        }}
      >
        {/* The empty star is an outline in the muted text colour (4.8:1 or better on the page),
            not a fill in the border colour, which is a 1.3:1 step from the background and
            leaves an unrated row nearly invisible. */}
        <Star
          className={cn(
            starSizes[effectiveDensity],
            "fill-transparent stroke-muted-foreground stroke-[1.5px]",
          )}
        />
        {/* Filled overlay */}
        {(isFull || isPartial) && (
          <div
            className="absolute inset-0 overflow-hidden transition-colors duration-300 motion-reduce:transition-none"
            style={{ width: `${fillRatio * 100}%` }}
          >
            <Star
              className={cn(
                starSizes[effectiveDensity],
                "fill-current stroke-[1.5px] text-primary",
              )}
            />
          </div>
        )}
      </m.div>
    );
  };

  // The hover and press wobble is decoration, so with reduced motion asked for it is not there at
  // all. (Framer's own "user" setting only makes a transform jump to its end state instead of
  // easing there, which would still scale and tilt the star under the pointer.)
  const wobble = !disabled && !reduceMotion;
  const hoverMotion = wobble ? { whileHover: { scale: 1.3, rotate: -10 } } : {};
  // A press animation would make Framer add tabindex="0" to a span, putting five stops in front of
  // the slider; the buttons are focusable anyway and keep it.
  const pressMotion = wobble ? { whileTap: { scale: 0.9, rotate: 15 } } : {};

  return (
    <div className="flex items-center gap-2">
      <LazyMotion features={domAnimation}>
        {/* The fill's scale pop follows the person's reduced-motion setting: it still happens,
            but it jumps instead of easing. */}
        <MotionConfig reducedMotion="user">
          {allowHalf ? (
            <div
              role="slider"
              tabIndex={disabled ? undefined : 0}
              aria-label={ariaLabel}
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={totalStars}
              aria-valuenow={clampRating(value, totalStars)}
              aria-valuetext={ratingValueText(value, totalStars, "stars")}
              aria-disabled={disabled || undefined}
              className={cn(
                "flex items-center gap-1 rounded-sm focus-visible:outline-hidden focus-visible:ring-2",
                "focus-visible:ring-ring focus-visible:ring-offset-2",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                className,
              )}
              onKeyDown={handleSliderKeyDown}
              onMouseLeave={() => !disabled && setHover(0)}
            >
              {stars.map((star) => (
                <m.span
                  key={star}
                  data-rating={star}
                  className="relative"
                  onClick={(e) => handleRating(star, e)}
                  onMouseEnter={(e) => !disabled && handleMouseMove(star, e)}
                  onMouseMove={(e) => !disabled && handleMouseMove(star, e)}
                  {...hoverMotion}
                >
                  {glyph(star)}
                </m.span>
              ))}
            </div>
          ) : (
            <div
              role="group"
              aria-label={ariaLabel}
              className={cn("flex items-center gap-1", disabled && "opacity-50", className)}
            >
              {stars.map((star) => (
                <m.button
                  key={star}
                  type="button"
                  data-rating={star}
                  aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
                  // Pressing the selected star again clears the rating, which is a toggle: the star
                  // holding the current value (a fractional value rounds up) is the pressed one.
                  aria-pressed={Math.ceil(value) === star}
                  className={cn(
                    "relative focus-visible:outline-hidden focus-visible:ring-2",
                    "focus-visible:ring-ring focus-visible:ring-offset-2",
                    "cursor-pointer",
                    disabled && "cursor-not-allowed",
                  )}
                  onClick={(e) => handleRating(star, e)}
                  onMouseEnter={(e) => !disabled && handleMouseMove(star, e)}
                  onMouseLeave={() => !disabled && setHover(0)}
                  disabled={disabled}
                  {...hoverMotion}
                  {...pressMotion}
                >
                  {glyph(star)}
                </m.button>
              ))}
            </div>
          )}
        </MotionConfig>
      </LazyMotion>
      {invalid && <InvalidIcon message={invalid} />}
    </div>
  );
}

export default StarRating;
