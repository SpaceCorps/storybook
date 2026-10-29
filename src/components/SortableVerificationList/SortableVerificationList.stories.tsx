import type { StoryObj } from "@storybook/react";
import { expect } from "@storybook/test";
import { useState } from "react";
import { SortableVerificationList, type VerificationItem } from "./SortableVerificationList";

export default {
  title: "Components/SortableVerificationList",
  component: SortableVerificationList,
};

const tendrilVerifications: VerificationItem[] = [
  { name: "NpmLint", enabled: true, required: true },
  { name: "NpmBuild", enabled: true, required: true },
  { name: "NpmTest", enabled: true, required: false },
  { name: "CheckResult", enabled: true, required: true },
];

export const ReorderableVerificationList = () => {
  const [items, setItems] = useState<VerificationItem[]>(tendrilVerifications);

  return (
    <div style={{ maxWidth: 450, padding: 24 }}>
      <p style={{ marginBottom: 12, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
        Drag the grip handle to reorder verification steps. Toggle checkboxes to enable/disable or
        mark required.
      </p>
      <SortableVerificationList
        id="svl-reorder"
        itemsJson={JSON.stringify(items)}
        events={["OnChange", "OnReorder"]}
        eventHandler={(evt, _id, args) => {
          if (evt === "OnChange") {
            const updated = JSON.parse(args[0] as string) as VerificationItem;
            setItems((prev) => prev.map((it) => (it.name === updated.name ? updated : it)));
          } else if (evt === "OnReorder") {
            const indices = JSON.parse(args[0] as string) as number[];
            const reordered = indices.map((idx) => items[idx]);
            setItems(reordered);
          }
        }}
      />
    </div>
  );
};

export const WithStatusBadges = () => {
  const itemsWithStatuses = [
    { name: "NpmLint", enabled: true, required: true, status: "Pass" },
    { name: "NpmBuild", enabled: true, required: true, status: "Pass" },
    { name: "NpmTest", enabled: true, required: true, status: "Fail" },
    { name: "CheckResult", enabled: true, required: true, status: "Pending" },
  ];

  const [items, setItems] = useState(itemsWithStatuses);

  // The named palette colors, not hex: each is picked per theme, so the status reads on the dark page
  // as well as the light one (#15803d is 4.0:1 on the dark page, #dc2626 4.1:1, #a16207 4.0:1).
  const statusColor: Record<string, string> = {
    Pass: "var(--green)",
    Fail: "var(--red)",
    Pending: "var(--yellow)",
  };

  return (
    <div style={{ maxWidth: 450, padding: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SortableVerificationList
          id="svl-statuses"
          itemsJson={JSON.stringify(items)}
          events={["OnChange"]}
          eventHandler={(_evt, _id, args) => {
            const updated = JSON.parse(args[0] as string) as VerificationItem;
            setItems((prev) =>
              prev.map((it) => (it.name === updated.name ? { ...it, ...updated } : it)),
            );
          }}
        />
        <div style={{ marginTop: 12, fontSize: "0.8125rem" }}>
          <strong>Execution Statuses:</strong>
          <ul style={{ paddingLeft: 16, marginTop: 4 }}>
            {items.map((it) => (
              <li key={it.name}>
                {it.name}:{" "}
                <span
                  style={{
                    color: statusColor[it.status] || "var(--muted-foreground)",
                    fontWeight: 600,
                  }}
                >
                  {it.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * The same list on the dark page. CI visits stories in light unless the story names its theme, and the
 * status colours were hex written for the light page: 4.0:1 on the dark one. The theme is a
 * story-level `globals` entry, and the play function says so out loud so a story that silently stayed
 * light cannot pass for it.
 */
export const WithStatusBadgesDark: StoryObj = {
  globals: { theme: "dark" },
  play: async () => {
    await expect(document.documentElement.classList.contains("dark")).toBe(true);
  },
  render: () => <WithStatusBadges />,
};

export const OptionalAndDisabledVerifications = () => {
  const [items, setItems] = useState<VerificationItem[]>([
    { name: "DotnetFormat", enabled: true, required: false },
    { name: "DotnetBuild", enabled: true, required: true },
    { name: "DotnetTest", enabled: false, required: false },
    { name: "E2ETest", enabled: false, required: false },
  ]);

  return (
    <div style={{ maxWidth: 450, padding: 24 }}>
      <SortableVerificationList
        id="svl-optional"
        itemsJson={JSON.stringify(items)}
        events={["OnChange"]}
        eventHandler={(_evt, _id, args) => {
          const updated = JSON.parse(args[0] as string) as VerificationItem;
          setItems((prev) => prev.map((it) => (it.name === updated.name ? updated : it)));
        }}
      />
    </div>
  );
};
