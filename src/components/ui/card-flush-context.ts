import * as React from "react";

/**
 * How a `CardContent` lays out its children, published so a `DataTable` inside it can pick a fitting
 * default look without the card knowing about tables.
 *
 * - `"padded"`: the default `p-6 pt-0` content area. A table here sits inside the padding.
 * - `"flush"`: no padding, so a table can run edge to edge and let the card's own border be its frame.
 * - `null` (outside any `CardContent`): there is no host surface, so the table draws its own.
 *
 * Kept out of the package barrels on purpose: it is plumbing between two components, not API.
 */
export type CardContentLayout = "padded" | "flush";

export const CardContentLayoutContext = React.createContext<CardContentLayout | null>(null);

export function useCardContentLayout(): CardContentLayout | null {
  return React.useContext(CardContentLayoutContext);
}

/**
 * Cuts the link to the surrounding `CardContent`. React context crosses portals, so a dialog, sheet or
 * popover opened from inside a card is still "in" it as far as `useCardContentLayout` can tell, though
 * its DOM sits at the end of `<body>` with no card around it. A table in there would then drop its own
 * border and run flush against a surface that is not the card's.
 *
 * Wrapped around the portal by exactly four overlay content components, each next to `FieldReset`, which
 * does the same for the surrounding field: `DialogContent`, `AlertDialogContent`, `SheetContent` and
 * `PopoverContent`. Those are the ones that can hold a table or a form. Menus (`DropdownMenuContent`,
 * `ContextMenuContent`, `MenubarContent`), `SelectContent` and tooltips do not hold either, so they skip
 * it. Add it next to any new overlay that can.
 */
export function CardContentLayoutReset({ children }: { children?: React.ReactNode }) {
  return React.createElement(CardContentLayoutContext.Provider, { value: null }, children);
}
