import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MultiSelect, type Option } from "@/components/ui/multiselect";
import type { SearchMode } from "@/components/ui/select/utils";
import * as React from "react";

const meta: Meta = {
  title: "UI/MultiSelect",
};

export default meta;

const frameworksList: Option[] = [
  { value: "react", label: "React" },
  { value: "vue", label: "Vue" },
  { value: "svelte", label: "Svelte" },
  { value: "angular", label: "Angular" },
];

const MultiSelectDemo = () => {
  const [selected, setSelected] = React.useState<Option[]>([]);
  return (
    <div className="w-[400px]">
      <MultiSelect
        defaultOptions={frameworksList}
        value={selected}
        onValueChange={setSelected}
        placeholder="Select frameworks..."
      />
    </div>
  );
};

export const Default: StoryObj = {
  render: () => <MultiSelectDemo />,
};

const MultiSelectSearchModesDemo = () => {
  const [selected, setSelected] = React.useState<Option[]>([]);
  const [mode, setMode] = React.useState<SearchMode>("CaseInsensitive");

  return (
    <div className="w-[400px] flex flex-col gap-4">
      <div className="flex gap-2">
        {(["CaseInsensitive", "CaseSensitive", "Fuzzy"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`px-2 py-1 text-xs rounded border ${mode === m ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <MultiSelect
        defaultOptions={frameworksList}
        value={selected}
        onValueChange={setSelected}
        searchMode={mode}
        placeholder={`Search in ${mode} mode...`}
      />
    </div>
  );
};

export const SearchModes: StoryObj = {
  render: () => <MultiSelectSearchModesDemo />,
};

const MultiSelectEmptyMessageDemo = () => {
  const [selected, setSelected] = React.useState<Option[]>([]);

  return (
    <div className="w-[400px]">
      <MultiSelect
        defaultOptions={frameworksList}
        value={selected}
        onValueChange={setSelected}
        emptyMessage="No matching frameworks found. Try another query."
        placeholder="Type to see custom empty message..."
      />
    </div>
  );
};

export const EmptyMessage: StoryObj = {
  render: () => <MultiSelectEmptyMessageDemo />,
};

const ChipsDemo = () => {
  const [selected, setSelected] = React.useState<Option[]>([frameworksList[0], frameworksList[1]]);
  return (
    <div className="w-[400px]">
      <MultiSelect
        aria-label="Frameworks"
        defaultOptions={frameworksList}
        value={selected}
        onValueChange={setSelected}
        maxVisibleBadges={2}
      />
    </div>
  );
};

/**
 * ArrowLeft from the start of the input walks onto the chips; Backspace, Delete or Enter removes the
 * focused one and focus moves to its neighbour. Escape closes the list and keeps focus in the field.
 */
export const Chips: StoryObj = {
  render: () => <ChipsDemo />,
  // The list opens in a portal outside the story root, which the screenshot does not capture.
  parameters: { visual: { disable: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "Frameworks" });
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowLeft}");
    await expect(canvas.getByRole("button", { name: "Remove Vue" })).toHaveFocus();
    await userEvent.keyboard("{Backspace}");
    await expect(canvas.queryByRole("button", { name: "Remove Vue" })).toBeNull();
    await expect(canvas.getByRole("button", { name: "Remove React" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}{Escape}");
    await expect(input).toHaveFocus();
  },
};

const InDialogDemo = () => {
  const [selected, setSelected] = React.useState<Option[]>([]);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Choose frameworks</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Choose frameworks</DialogTitle>
          <DialogDescription>Pick the ones the project uses.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <MultiSelect
            aria-label="Frameworks"
            defaultOptions={frameworksList}
            value={selected}
            onValueChange={setSelected}
            placeholder="Select frameworks..."
          />
        </DialogBody>
        <DialogFooter>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** The list stacks above the dialog; Escape closes the list first and the dialog on the next press. */
export const InsideDialog: StoryObj = {
  render: () => <InDialogDemo />,
  // The dialog and the list both open in portals, which the screenshot does not capture.
  parameters: { visual: { disable: true } },
};

const WithActionsDemo = () => {
  const [selected, setSelected] = React.useState<Option[]>([]);
  return (
    <div className="w-[560px]">
      <MultiSelect
        aria-label="Frameworks"
        showActions
        maxVisibleBadges={4}
        defaultOptions={frameworksList}
        value={selected}
        onValueChange={setSelected}
      />
    </div>
  );
};

/**
 * Select All and Clear All are items at the end of the list, so the arrow keys reach them: four
 * options, then Select All, then Clear All (End jumps to the last). Enter runs the highlighted one.
 */
export const WithActions: StoryObj = {
  render: () => <WithActionsDemo />,
  // The list opens in a portal outside the story root, which the screenshot does not capture.
  parameters: { visual: { disable: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "Frameworks" });
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");
    await expect(canvas.getByRole("button", { name: "Remove Angular" })).toBeInTheDocument();
    await userEvent.keyboard("{End}{Enter}");
    await expect(canvas.queryByRole("button", { name: "Remove Angular" })).toBeNull();
  },
};

const manyOptions: Option[] = Array.from({ length: 40 }, (_, index) => ({
  value: `option-${index + 1}`,
  label: `Option ${index + 1}`,
}));

const LongListInDialogDemo = () => {
  const [selected, setSelected] = React.useState<Option[]>([]);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Choose options</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Choose options</DialogTitle>
          <DialogDescription>The list is longer than it is tall: scroll it.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <MultiSelect
            aria-label="Options"
            defaultOptions={manyOptions}
            value={selected}
            onValueChange={setSelected}
            placeholder="Select options..."
          />
        </DialogBody>
        <DialogFooter>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** The mouse wheel and touch scroll the list even though a modal dialog locks scrolling around it. */
export const LongListInsideDialog: StoryObj = {
  render: () => <LongListInDialogDemo />,
  // The dialog and the list both open in portals, which the screenshot does not capture.
  parameters: { visual: { disable: true } },
};
