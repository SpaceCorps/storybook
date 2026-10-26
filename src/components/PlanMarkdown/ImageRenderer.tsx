import React, { useState, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

interface ImageRendererProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  title?: string;
}

const BrokenImageIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </svg>
);

export const ImageRenderer: React.FC<ImageRendererProps> = ({ src, alt, title, ...props }) => {
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const handleLoad = useCallback(() => {
    setLoadState("loaded");
  }, []);

  const handleError = useCallback(() => {
    setLoadState("error");
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOverlayOpen(false);
    }
  }, []);

  if (loadState === "error") {
    return (
      <div className="pmv-img-error">
        <BrokenImageIcon />
        <div className="pmv-img-error-text">{alt || "Image failed to load"}</div>
        {title && <div className="pmv-img-error-title">{title}</div>}
      </div>
    );
  }

  // The image sits inside a Trigger button, so it opens from the keyboard and Radix hands focus
  // back to it on close. The button stays disabled until the image has loaded, as the click used to
  // be ignored until then; the same element is kept throughout so the image never remounts.
  return (
    <DialogPrimitive.Root open={isOverlayOpen} onOpenChange={setIsOverlayOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="pmv-img-button"
          disabled={loadState !== "loaded"}
          aria-label={alt ? undefined : "Open image"}
        >
          <img
            {...props}
            src={src}
            alt={alt}
            title={title}
            className={loadState === "loaded" ? "pmv-img-clickable" : ""}
            onLoad={handleLoad}
            onError={handleError}
          />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          className="pmv-img-overlay"
          // No description: the image and its alt text are the content.
          aria-describedby={undefined}
          onClick={handleBackdropClick}
        >
          <DialogPrimitive.Title className="pmv-sr-only">Image preview</DialogPrimitive.Title>
          <DialogPrimitive.Close className="pmv-img-overlay-close" aria-label="Close">
            <span aria-hidden="true">×</span>
          </DialogPrimitive.Close>
          <img src={src} alt={alt} title={title} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
