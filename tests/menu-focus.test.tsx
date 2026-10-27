import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vite-plus/test";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../src/components/ui/accordion";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandItem,
  CommandList,
} from "../src/components/ui/command";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../src/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../src/components/ui/dropdown-menu";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarTrigger,
} from "../src/components/ui/menubar";
import { menuItemRing } from "../src/components/ui/overlay-variant";
import { CopyToClipboardButton } from "../src/components/CopyToClipboardButton";

const ringTokens = menuItemRing.split(" ");
const classesOf = (element: Element) => element.className.split(/\s+/);

describe("menu highlight", () => {
  it("has a ring on top of the tint, for the keyboard only", () => {
    // `focus-visible`, and off again under the pointer: Radix focuses the hovered row too, and a
    // ring chasing the mouse around the menu is noise.
    expect(ringTokens).toEqual([
      "focus-visible:ring-1",
      "focus-visible:ring-inset",
      "focus-visible:ring-ring",
      "hover:focus-visible:ring-0",
    ]);
  });

  it("is on every DropdownMenu item kind", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Plain</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">Remove</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked>Checked</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a">Radio</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));

    for (const role of ["menuitem", "menuitemcheckbox", "menuitemradio"]) {
      for (const item of await screen.findAllByRole(role)) {
        expect(classesOf(item), `${role} ${item.textContent}`).toEqual(
          expect.arrayContaining(ringTokens),
        );
      }
    }
  });

  it("is on every ContextMenu item kind", async () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Plain</ContextMenuItem>
          <ContextMenuCheckboxItem checked>Checked</ContextMenuCheckboxItem>
          <ContextMenuRadioGroup value="a">
            <ContextMenuRadioItem value="a">Radio</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
          <ContextMenuSub>
            <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Nested</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByText("Area"));

    for (const role of ["menuitem", "menuitemcheckbox", "menuitemradio"]) {
      for (const item of await screen.findAllByRole(role)) {
        expect(classesOf(item), `${role} ${item.textContent}`).toEqual(
          expect.arrayContaining(ringTokens),
        );
      }
    }
  });

  it("is on the Menubar triggers and every item kind", async () => {
    const user = userEvent.setup();
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>New</MenubarItem>
            <MenubarCheckboxItem checked>Autosave</MenubarCheckboxItem>
            <MenubarRadioGroup value="a">
              <MenubarRadioItem value="a">Radio</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    );

    expect(classesOf(screen.getByRole("menuitem", { name: "File" }))).toEqual(
      expect.arrayContaining(ringTokens),
    );
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    for (const role of ["menuitem", "menuitemcheckbox", "menuitemradio"]) {
      for (const item of await screen.findAllByRole(role)) {
        expect(classesOf(item), `${role} ${item.textContent}`).toEqual(
          expect.arrayContaining(ringTokens),
        );
      }
    }
  });
});

describe("other keyboard focus indicators", () => {
  it("gives the command input row a focus-within ring, since the input has no outline", () => {
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandItem>One</CommandItem>
        </CommandList>
      </Command>,
    );
    const shell = document.querySelector("[data-cmdk-input-wrapper]")!;

    expect(classesOf(shell)).toEqual(
      expect.arrayContaining([
        "focus-within:ring-1",
        "focus-within:ring-inset",
        "focus-within:ring-ring",
      ]),
    );
  });

  it("rings the highlighted command item as well as tinting it", () => {
    render(
      <Command>
        <CommandList>
          <CommandItem>One</CommandItem>
        </CommandList>
      </Command>,
    );

    expect(classesOf(screen.getByRole("option", { name: "One" }))).toEqual(
      expect.arrayContaining([
        "data-[selected=true]:bg-accent",
        "data-[selected=true]:ring-1",
        "data-[selected=true]:ring-inset",
        "data-[selected=true]:ring-ring",
        "hover:data-[selected=true]:ring-0",
      ]),
    );
  });

  it("names the command dialog and focuses its input", async () => {
    render(
      <CommandDialog open>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandItem>One</CommandItem>
        </CommandList>
      </CommandDialog>,
    );

    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Search"));
  });

  it("lets the command dialog take a different accessible name", async () => {
    render(
      <CommandDialog open title="Go to">
        <CommandInput placeholder="Search" />
      </CommandDialog>,
    );

    expect(await screen.findByRole("dialog", { name: "Go to" })).toBeTruthy();
  });

  it("rings the accordion trigger with the system ring rather than the browser outline", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="a">
          <AccordionTrigger>Section</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(classesOf(screen.getByRole("button", { name: "Section" }))).toEqual(
      expect.arrayContaining([
        "focus-visible:outline-hidden",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
      ]),
    );
  });

  it.each([
    ["icon-only", {}],
    ["labelled", { label: "Copy" }],
  ])("rings the %s copy button", (_name, props) => {
    render(<CopyToClipboardButton textToCopy="x" {...props} />);
    const classes = classesOf(screen.getByRole("button"));

    expect(classes).toEqual(
      expect.arrayContaining([
        "focus-visible:outline-hidden",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
      ]),
    );
    expect(classes).not.toContain("focus:outline-hidden");
  });

  it("keeps the copy button's ring visible once it has turned primary after a copy", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => {} },
      configurable: true,
    });
    render(<CopyToClipboardButton textToCopy="x" />);

    await user.click(screen.getByRole("button"));

    // The old ring colour was the new fill itself, which is invisible.
    expect(classesOf(screen.getByRole("button"))).not.toContain("focus-visible:ring-primary");
    expect(classesOf(screen.getByRole("button"))).toContain("focus-visible:ring-ring");
  });
});
