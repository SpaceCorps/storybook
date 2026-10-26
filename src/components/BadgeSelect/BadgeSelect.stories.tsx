import { useState, type CSSProperties } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { BadgeSelect, type BadgeSelectOption } from "./BadgeSelect";

export default {
  title: "Components/BadgeSelect",
  component: BadgeSelect,
};

const mockProjects: BadgeSelectOption[] = [
  { value: "tendril", label: "Tendril Core", icon: "Folder" },
  { value: "@spacecorps/components", label: "Components Storybook", icon: "Folder" },
  { value: "example-docs", label: "Example Docs", icon: "Folder" },
  { value: "lots-of-dev-tools", label: "Lots of Dev Tools", icon: "WandSparkles" },
];

const mockTags: BadgeSelectOption[] = [
  { value: "bug", label: "Bug", icon: "Flag" },
  { value: "feature", label: "Feature", icon: "Plus" },
  { value: "enhancement", label: "Enhancement", icon: "WandSparkles" },
  { value: "urgent", label: "Urgent Priority", icon: "Flag" },
];

const mockActions: BadgeSelectOption[] = [
  { value: "__add_project__", label: "Add New Project", icon: "Plus" },
  { value: "__manage_tags__", label: "Manage Tags...", icon: "WandSparkles" },
];

export const EmptySingleSelect = () => {
  const [val, setVal] = useState<string[]>([]);
  return (
    <div style={{ maxWidth: 360, padding: 24 }}>
      <BadgeSelect
        id="bs-empty-single"
        options={mockProjects}
        value={val}
        multiple={false}
        placeholder="Select a project..."
        events={["OnChange"]}
        eventHandler={(_evt, _id, args) => setVal(args[0] as string[])}
      />
    </div>
  );
};

export const SingleSelectWithPreselected = () => {
  const [val, setVal] = useState<string[]>(["@spacecorps/components"]);
  return (
    <div style={{ maxWidth: 360, padding: 24 }}>
      <BadgeSelect
        id="bs-single-preselected"
        options={mockProjects}
        value={val}
        multiple={false}
        events={["OnChange"]}
        eventHandler={(_evt, _id, args) => setVal(args[0] as string[])}
      />
    </div>
  );
};

export const MultiSelectWithPreselected = () => {
  const [val, setVal] = useState<string[]>([
    "tendril",
    "@spacecorps/components",
    "example-docs",
    "lots-of-dev-tools",
  ]);
  return (
    <div style={{ maxWidth: 400, padding: 24 }}>
      <BadgeSelect
        id="bs-multi"
        options={mockProjects}
        value={val}
        multiple={true}
        actions={mockActions}
        events={["OnChange", "OnAction"]}
        eventHandler={(evt, _id, args) => {
          if (evt === "OnChange") setVal(args[0] as string[]);
        }}
      />
    </div>
  );
};

export const EmptyMultiSelectWithActions = () => {
  const [val, setVal] = useState<string[]>([]);
  return (
    <div style={{ maxWidth: 360, padding: 24 }}>
      <BadgeSelect
        id="bs-empty-multi"
        options={mockTags}
        value={val}
        multiple={true}
        placeholder="Filter tags..."
        actions={mockActions}
        events={["OnChange", "OnAction"]}
        eventHandler={(evt, _id, args) => {
          if (evt === "OnChange") setVal(args[0] as string[]);
        }}
      />
    </div>
  );
};

export const CustomBadgeColorsAndStyling = () => {
  const [val, setVal] = useState<string[]>(["bug", "urgent"]);
  return (
    <div
      style={
        {
          maxWidth: 400,
          padding: 24,
          "--secondary": "#fee2e2",
          "--secondary-foreground": "#991b1b",
          "--border": "#fca5a5",
        } as CSSProperties
      }
    >
      <BadgeSelect
        id="bs-custom-colors"
        options={mockTags}
        value={val}
        multiple={true}
        placeholder="Urgent issues..."
        events={["OnChange"]}
        eventHandler={(_evt, _id, args) => setVal(args[0] as string[])}
      />
    </div>
  );
};

/**
 * Inside a Dialog: Escape with the list open closes the list only, and the dialog stays; a second
 * Escape, with the list closed, closes the dialog.
 */
export const InsideDialog = {
  parameters: {
    // New story: no baseline image yet, and the dialog and the list portal out of the root.
    visual: { disable: true },
  },
  render: () => {
    const [open, setOpen] = useState(true);
    const [val, setVal] = useState<string[]>(["bug"]);
    return (
      <div style={{ padding: 24 }}>
        <button type="button" onClick={() => setOpen(true)}>
          Edit tags
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogTitle>Edit tags</DialogTitle>
            <DialogDescription>Pick the tags for this plan.</DialogDescription>
            <BadgeSelect
              id="bs-dialog"
              options={mockTags}
              value={val}
              placeholder="Tags"
              events={["OnChange"]}
              eventHandler={(_evt, _id, args) => setVal(args[0] as string[])}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  },
};

/**
 * One option that cannot be removed: when it is selected it has no X in the list, so a check marks
 * it instead of a tint alone.
 */
export const NonRemovableSelected = {
  parameters: {
    // New story: no baseline image yet.
    visual: { disable: true },
  },
  render: () => {
    const [val, setVal] = useState<string[]>(["urgent", "bug"]);
    const options: BadgeSelectOption[] = mockTags.map((tag) =>
      tag.value === "urgent" ? { ...tag, removable: false } : tag,
    );
    return (
      <div style={{ maxWidth: 360, padding: 24 }}>
        <BadgeSelect
          id="bs-non-removable"
          options={options}
          value={val}
          multiple
          placeholder="Tags"
          events={["OnChange"]}
          eventHandler={(_evt, _id, args) => setVal(args[0] as string[])}
        />
      </div>
    );
  },
};
