import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { TendrilShell } from "./TendrilShell.tsx";
import { ShellTabs } from "./ShellTabs.tsx";
import type { ShellTabDto } from "./types.ts";

/**
 * The shell as an app composes it: `hasTabs` follows the tab list, so closing the last session
 * takes the strip out of the shell, not only its tabs out of the strip.
 */
function App({ seed }: { seed: ShellTabDto[] }) {
  const [tabs, setTabs] = useState(seed);
  return (
    <TendrilShell
      id="shell"
      eventHandler={() => {}}
      hasTabs={tabs.length > 0}
      slots={{
        Content: <button type="button">Content button</button>,
        Tabs: (
          <ShellTabs
            id="tabs"
            tabs={tabs}
            selectedId={tabs[0]?.id}
            events={["OnClose", "OnNew"]}
            eventHandler={(event, _id, args) => {
              if (event === "OnClose") setTabs((cur) => cur.filter((t) => t.id !== args[0]));
              else if (event === "OnNew") setTabs((cur) => [...cur, { id: "new", title: "New" }]);
            }}
          />
        ),
      }}
    />
  );
}

const only: ShellTabDto[] = [{ id: "t1", title: "Plan Execution" }];
const add = () => screen.getByRole("button", { name: "New agent session" });

describe("TendrilShell closing the last session from the keyboard", () => {
  it("leaves focus on the new-session button instead of dropping it to the page", async () => {
    const user = userEvent.setup();
    render(<App seed={only} />);
    screen.getByRole("tab", { name: "Plan Execution" }).focus();
    await user.keyboard("{Delete}");

    await waitFor(() => expect(add()).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it("does the same for the X on the tab", async () => {
    const user = userEvent.setup();
    render(<App seed={only} />);
    await user.click(screen.getByRole("button", { name: "Close Plan Execution" }));
    await waitFor(() => expect(add()).toHaveFocus());
  });

  it("takes the strip out of the shell once focus has moved on", async () => {
    const user = userEvent.setup();
    render(<App seed={only} />);
    screen.getByRole("tab", { name: "Plan Execution" }).focus();
    await user.keyboard("{Delete}");
    await waitFor(() => expect(add()).toHaveFocus());

    screen.getByRole("button", { name: "Content button" }).focus();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "New agent session" })).toBeNull(),
    );
    expect(document.querySelector(".tsh-tabs-row")).toBeNull();
  });

  it("starts the next session from the button that kept focus, and keeps it", async () => {
    const user = userEvent.setup();
    render(<App seed={only} />);
    screen.getByRole("tab", { name: "Plan Execution" }).focus();
    await user.keyboard("{Delete}");
    await waitFor(() => expect(add()).toHaveFocus());

    await user.keyboard("{Enter}");
    expect(screen.getByRole("tab", { name: "New" })).toBeInTheDocument();
    expect(add()).toHaveFocus();
  });

  it("does not keep the strip when the last session was closed with focus elsewhere", async () => {
    render(<App seed={only} />);
    screen.getByRole("button", { name: "Content button" }).focus();
    // The pointer is on the close button but focus never moved to it (as with a middle click).
    screen
      .getByRole("tab", { name: "Plan Execution" })
      .dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    await waitFor(() => expect(screen.queryByRole("tab")).toBeNull());
    expect(document.querySelector(".tsh-tabs-row")).toBeNull();
    expect(screen.getByRole("button", { name: "Content button" })).toHaveFocus();
  });
});
