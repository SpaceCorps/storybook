import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { PlanWorkspace } from "./PlanWorkspace";

export default {
  title: "Components/PlanWorkspace",
  component: PlanWorkspace,
  parameters: {
    // New story: no baseline image yet, and the overflow menu opens over the screenshotted root.
    visual: { disable: true },
  },
};

const actions = [
  { tag: "Edit", label: "Edit", icon: "Pencil" },
  { tag: "Chat", label: "Update", icon: "WandSparkles", focusChat: true },
];

const menuItems = [
  { tag: "Archive", label: "Archive", icon: "Trash" },
  { tag: "Duplicate", label: "Duplicate", icon: "Trash" },
  { tag: "Delete", label: "Delete", icon: "Trash", danger: true },
];

const tabs = [
  { id: "plan", label: "Plan" },
  { id: "details", label: "Details", badge: "3" },
  { id: "history", label: "History" },
];

export const TabsMenuAndResizableChat = {
  render: () => {
    const [selected, setSelected] = useState("plan");
    const [last, setLast] = useState("nothing yet");
    return (
      <div style={{ height: 520, width: "100%" }}>
        <PlanWorkspace
          id="workspace"
          planId="#59"
          title="Revamp the user authentication experience"
          meta="1/32 plans"
          actions={actions}
          menuItems={menuItems}
          primary={{ tag: "Execute", label: "Execute", icon: "Rocket" }}
          tabs={tabs}
          selectedTab={selected}
          events={["OnAction", "OnTabSelect"]}
          eventHandler={(event, _id, args) => {
            if (event === "OnTabSelect") setSelected(args[0] as string);
            else setLast(String(args[0]));
          }}
          slots={{
            Content: [
              <div key="content" style={{ padding: 16 }}>
                <p>Showing the {selected} view.</p>
                <p>Last action: {last}.</p>
              </div>,
            ],
            Chat: [
              <div key="chat" style={{ padding: 12 }}>
                <textarea
                  aria-label="Message the plan chat"
                  placeholder="Ask about this plan"
                  style={{ width: "100%", height: 80 }}
                />
              </div>,
            ],
          }}
        />
      </div>
    );
  },
};

/**
 * A Verifications panel that holds a popover of its own. Escape closes the popover first and the
 * panel with the next press; a press inside the popover does not close the panel.
 */
export const VerificationsWithNestedPopover = {
  render: () => (
    <div style={{ height: 420, width: "100%" }}>
      <PlanWorkspace
        id="workspace-nested"
        planId="#60"
        title="A panel that hosts a popover"
        tabs={tabs}
        selectedTab="plan"
        events={["OnTabSelect"]}
        eventHandler={() => {}}
        slots={{
          Content: [
            <div key="content" style={{ padding: 16 }}>
              Plan body.
            </div>,
          ],
          Verifications: [
            <div key="v" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span>3 of 5 checks passed.</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button">Why did two fail?</button>
                </PopoverTrigger>
                <PopoverContent aria-label="Why two checks failed">
                  <p>The lint and the type check failed on the last run.</p>
                  <button type="button">Re-run them</button>
                </PopoverContent>
              </Popover>
            </div>,
          ],
        }}
      />
    </div>
  ),
};

/**
 * Icon actions that carry a pressed state and a count. In a narrow workspace they fold into the
 * More actions menu, which keeps both: a checked item and its count.
 */
export const ActionsWithStateInNarrowWorkspace = {
  render: () => (
    <div style={{ height: 320, width: 500 }}>
      <PlanWorkspace
        id="workspace-narrow"
        planId="#61"
        title="Narrow"
        actions={[
          { tag: "Edit", label: "Edit", icon: "Pencil", active: true, badge: "2" },
          { tag: "Sync", label: "Sync", icon: "Rocket", loading: true },
        ]}
        menuItems={menuItems}
        events={["OnAction"]}
        eventHandler={() => {}}
        slots={{
          Content: [
            <div key="content" style={{ padding: 16 }}>
              Plan body.
            </div>,
          ],
        }}
      />
    </div>
  ),
};
