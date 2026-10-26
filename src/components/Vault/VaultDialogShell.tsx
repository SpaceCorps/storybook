import React from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { Button, type ButtonProps } from "../ui/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Tooltip } from "../ui/TuiTooltip";

export interface VaultDialogShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  testId: string;
  /** A failed request: rendered inline so the dialog can stay open with the user's input intact. */
  error?: string | null;
  submitLabel: string;
  /**
   * Holds the primary action back. The button is soft-disabled, not natively disabled: it renders
   * `aria-disabled="true"` with no `disabled` attribute, stays in the tab order and ignores click,
   * Enter and Space. This is a breaking change for a consumer that asserted `toBeDisabled()` on the
   * submit button or relied on `:disabled`; assert `aria-disabled` instead.
   */
  submitDisabled?: boolean;
  /**
   * Why the primary action is unavailable while `submitDisabled`: announced as its description and
   * shown in a tooltip on hover and on keyboard focus. The button stays in the tab order either way.
   */
  submitDisabledReason?: string;
  submitVariant?: ButtonProps["variant"];
  onSubmit: () => void;
  children?: React.ReactNode;
}

/**
 * The frame every vault dialog shares: title, scrollable body, inline error, Cancel + one primary
 * action. Escape and the header close button cancel; submitting is always an explicit click, and a
 * server error never discards what was typed.
 *
 * Focus is moved onto the dialog itself rather than its first tabbable node, so opening a dialog
 * never lands on a destructive confirm.
 */
export const VaultDialogShell: React.FC<VaultDialogShellProps> = ({
  open,
  onClose,
  title,
  description,
  testId,
  error,
  submitLabel,
  submitDisabled = false,
  submitDisabledReason,
  submitVariant,
  onSubmit,
  children,
}) => (
  <Dialog
    open={open}
    onOpenChange={(next) => {
      if (!next) onClose();
    }}
  >
    <DialogContent
      data-testid={testId}
      aria-modal="true"
      {...(description === undefined ? { "aria-describedby": undefined } : {})}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        (event.currentTarget as HTMLElement | null)?.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description !== undefined && (
          <DialogDescription className="mt-1">{description}</DialogDescription>
        )}
      </DialogHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-2 text-sm text-foreground">
        {children}
        {error && (
          <Alert variant="destructive" data-testid={`${testId}-error`}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Tooltip content={submitDisabled ? submitDisabledReason : undefined}>
          {/* Soft-disabled, so a keyboard user can land on it and hear why it is unavailable. */}
          <Button
            variant={submitVariant}
            size="sm"
            disabled={submitDisabled}
            focusableWhenDisabled
            disabledReason={submitDisabledReason}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </Tooltip>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
