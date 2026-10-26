import React, { useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { cn } from "@/lib/utils";
import { validateImageUrl } from "@/lib/url";

interface ImageOverlayProps {
  src: string | undefined;
  alt: string | undefined;
  onClose: () => void;
  images?: { src: string; alt: string }[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

// The backdrop is always dark, so the ring is white in both themes rather than a token that flips.
const overlayButton =
  "flex items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black cursor-pointer";

export const ImageOverlay: React.FC<ImageOverlayProps> = ({
  src,
  alt,
  onClose,
  images,
  currentIndex = 0,
  onNavigate,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  // The overlay is mounted by whatever was clicked, not by a Trigger, so Radix has no element to
  // give focus back to on close. The hook remembers the opener and returns to it.
  const focus = useReturnFocus({
    onOpenAutoFocus: (event) => {
      event.preventDefault();
      closeRef.current?.focus();
    },
  });

  const hasNavigation = images && images.length > 1 && onNavigate;

  const step = (delta: number) => {
    if (!images || !onNavigate) return;
    const len = images.length;
    onNavigate((((currentIndex + delta) % len) + len) % len);
  };

  // Validate and sanitize image URL to prevent open redirect vulnerabilities
  const validatedSrc = src ? validateImageUrl(src) : null;
  if (!validatedSrc) {
    // Invalid URL, don't render image
    return null;
  }

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          // No description: the image and its alt text are the content.
          aria-describedby={undefined}
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 cursor-zoom-out overflow-hidden outline-hidden"
          onOpenAutoFocus={focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          onKeyDown={(e) => {
            if (!hasNavigation) return;
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              step(-1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              step(1);
            }
          }}
        >
          {focus.anchor}
          <DialogPrimitive.Title className="sr-only">Image preview</DialogPrimitive.Title>
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center">
            {hasNavigation && (
              <button
                type="button"
                className={cn(
                  overlayButton,
                  "absolute -left-12 top-1/2 -translate-y-1/2 size-10 z-10",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label="Previous image"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
            )}
            <div className="relative">
              <img
                src={validatedSrc}
                alt={alt}
                className="max-w-full max-h-[90vh] object-contain"
              />
              <DialogPrimitive.Close
                ref={closeRef}
                className={cn(overlayButton, "absolute top-4 right-4 size-8")}
                aria-label="Close"
              >
                <X className="size-4" aria-hidden="true" />
              </DialogPrimitive.Close>
              {hasNavigation && (
                <div
                  aria-live="polite"
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1 rounded-full"
                >
                  {currentIndex + 1} / {images.length}
                </div>
              )}
            </div>
            {hasNavigation && (
              <button
                type="button"
                className={cn(
                  overlayButton,
                  "absolute -right-12 top-1/2 -translate-y-1/2 size-10 z-10",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label="Next image"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
