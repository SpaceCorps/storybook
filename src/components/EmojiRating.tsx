"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { InvalidIcon } from "@/components/InvalidIcon";
import { Densities } from "@/types/density";
import { useDensity } from "@/contexts/density-context";
import { clampRating, ratingKeyTarget, ratingValueText } from "@/components/keyboard/rating";
import type React from "react";

export interface EmojiRatingProps {
  value?: number;
  onRate?: (rating: number) => void;
  totalEmojis?: number;
  density?: Densities;
  className?: string;
  disabled?: boolean;
  invalid?: string;
  /**
   * Lets the left half of a face pick a half value with the pointer.
   *
   * A row of buttons can only say "this face", so with `allowHalf` the rating is a single slider
   * instead (the WAI-ARIA slider pattern): one tab stop, Left/Down and Right/Up move by half a
   * step, Page Down and Page Up by a whole one, Home clears and End gives the highest. The faces
   * are then drawn for the pointer only and are not separate controls; a pointer still rates by
   * clicking, with the left half of a face picking the half value.
   */
  allowHalf?: boolean;
  /** Names the rating. Without `allowHalf` each face is named "Rate N out of M". */
  "aria-label"?: string;
}

const baseEmojis = ["😢", "😕", "😐", "🙂", "😊"];

function getEmojis(total: number): string[] {
  if (total <= 0) return [];
  if (total === baseEmojis.length) return baseEmojis;
  if (total < baseEmojis.length) {
    const indices = Array.from({ length: total }, (_, i) =>
      Math.round((i * (baseEmojis.length - 1)) / (total - 1)),
    );
    return indices.map((i) => baseEmojis[i]);
  }
  return Array.from({ length: total }, (_, i) => {
    const mapped = Math.round((i * (baseEmojis.length - 1)) / (total - 1));
    return baseEmojis[mapped];
  });
}

const emojiSizes = {
  Small: "text-lg",
  Medium: "text-2xl",
  Large: "text-4xl",
};

/** What the pointer is over: the face's half value over its left half, else the whole face. */
function pointerValue(
  rating: number,
  allowHalf: boolean,
  e: React.MouseEvent<HTMLElement>,
): number {
  if (!allowHalf) return rating;
  const rect = e.currentTarget.getBoundingClientRect();
  const isLeftHalf = e.clientX - rect.left < rect.width / 2;
  return isLeftHalf ? rating - 0.5 : rating;
}

export function EmojiRating({
  value = 0,
  onRate,
  totalEmojis = 5,
  density,
  className,
  disabled = false,
  invalid,
  allowHalf = false,
  "aria-label": ariaLabel = "Rating",
}: EmojiRatingProps) {
  const contextDensity = useDensity();
  const effectiveDensity = density ?? contextDensity;

  const emojis = useMemo(() => getEmojis(totalEmojis), [totalEmojis]);
  const [hover, setHover] = useState(0);

  const handleRating = useCallback(
    (rating: number, e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      // A keyboard activation is a click with no pointer (detail 0, clientX 0), which would always
      // read as the left half, so it could only ever pick half values. Only a click is told apart
      // this way: hovering has no keyboard counterpart and always has a position.
      if (e.detail === 0) {
        // The face marked pressed holds the current value, half values included, so activating it
        // again clears the rating as aria-pressed promises.
        onRate?.(Math.ceil(value) === rating ? 0 : rating);
        return;
      }
      const val = pointerValue(rating, allowHalf, e);
      onRate?.(value === val ? 0 : val);
    },
    [disabled, onRate, value, allowHalf],
  );

  const handleMouseMove = useCallback(
    (rating: number, e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      setHover(pointerValue(rating, allowHalf, e));
    },
    [disabled, allowHalf],
  );

  // The slider's keys. Left and Right swap in a right-to-left layout.
  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || e.altKey || e.ctrlKey || e.metaKey) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const next = ratingKeyTarget(e.key, value, emojis.length, { rtl });
    if (next === null) return;
    e.preventDefault();
    if (next !== clampRating(value, emojis.length)) onRate?.(next);
  };

  const displayValue = hover || value;

  /** One face. The ones not yet reached are drawn grey and circled, so the difference between a
      rated and an unrated face does not rest on a colour glyph being dimmed (40% opacity left an
      unrated face at 1.3:1 against a light page). */
  const face = (emoji: string, rating: number) => {
    const fillRatio = Math.max(0, Math.min(1, displayValue - (rating - 1)));
    const isActive = fillRatio >= 1;
    const isPartial = fillRatio > 0 && fillRatio < 1;
    return (
      <span
        aria-hidden="true"
        data-state={isActive ? "full" : isPartial ? "partial" : "off"}
        className={cn(
          "inline-flex items-center justify-center rounded-full p-0.5",
          "transition-opacity duration-200 motion-reduce:transition-none",
          isActive
            ? "text-primary opacity-100"
            : isPartial
              ? "text-primary opacity-70 ring-1 ring-muted-foreground forced-colors:outline forced-colors:outline-1"
              : "grayscale text-muted-foreground opacity-70 ring-1 ring-muted-foreground forced-colors:outline forced-colors:outline-1",
        )}
      >
        {emoji}
      </span>
    );
  };

  const motionClasses = cn(
    "transition-transform duration-200 motion-reduce:transition-none",
    "hover:scale-125 active:scale-90 motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
    disabled && "hover:scale-100 active:scale-100",
  );

  return (
    <div className="flex items-center gap-2">
      {allowHalf ? (
        <div
          role="slider"
          tabIndex={disabled ? undefined : 0}
          aria-label={ariaLabel}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={emojis.length}
          aria-valuenow={clampRating(value, emojis.length)}
          aria-valuetext={ratingValueText(value, emojis.length)}
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
          {emojis.map((emoji, index) => {
            const rating = index + 1;
            return (
              <span
                key={rating}
                data-rating={rating}
                className={cn("relative", emojiSizes[effectiveDensity], motionClasses)}
                onClick={(e) => handleRating(rating, e)}
                onMouseEnter={(e) => !disabled && handleMouseMove(rating, e)}
                onMouseMove={(e) => !disabled && handleMouseMove(rating, e)}
              >
                {face(emoji, rating)}
              </span>
            );
          })}
        </div>
      ) : (
        <div
          role="group"
          aria-label={ariaLabel}
          className={cn("flex items-center gap-1", disabled && "opacity-50", className)}
        >
          {emojis.map((emoji, index) => {
            const rating = index + 1;
            return (
              <button
                key={rating}
                type="button"
                data-rating={rating}
                aria-label={`Rate ${rating} out of ${emojis.length}`}
                // Pressing the selected face again clears the rating, which is a toggle: the face
                // holding the current value (a fractional value rounds up) is the pressed one.
                aria-pressed={Math.ceil(value) === rating}
                className={cn(
                  "relative focus-visible:outline-hidden focus-visible:ring-2",
                  "focus-visible:ring-ring focus-visible:ring-offset-2",
                  motionClasses,
                  "cursor-pointer",
                  disabled && "cursor-not-allowed",
                  emojiSizes[effectiveDensity],
                )}
                onClick={(e) => handleRating(rating, e)}
                onMouseEnter={(e) => !disabled && handleMouseMove(rating, e)}
                onMouseLeave={() => !disabled && setHover(0)}
                disabled={disabled}
              >
                {face(emoji, rating)}
              </button>
            );
          })}
        </div>
      )}
      {invalid && <InvalidIcon message={invalid} />}
    </div>
  );
}

export default EmojiRating;
