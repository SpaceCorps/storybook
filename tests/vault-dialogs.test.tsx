import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  ConnectVaultDialog,
  CreateVaultDialog,
  GatedActionButton,
  ImportFromVaultDialog,
  PushToVaultDialog,
  VaultDialogShell,
  VaultEmptyState,
  computeVaultGate,
  suggestLocalProjectName,
} from "../src/components/Vault/index.ts";
import type {
  ProjectAssets,
  VaultCatalogItem,
  VaultExportRequest,
  VaultImportRequest,
} from "../src/components/Vault/index.ts";

/** Radix Select opens on ArrowDown; jsdom has no pointer events for its trigger. */
function openSelect(trigger: HTMLElement) {
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
}

function catalogItem(overrides: Partial<VaultCatalogItem> = {}): VaultCatalogItem {
  return {
    name: "Alpha",
    description: "",
    color: "blue",
    remoteVersion: "2026.01.01.120000",
    reposCount: 0,
    skillsCount: 0,
    mcpsCount: 0,
    memoriesCount: 0,
    reviewActionsCount: 0,
    verificationsCount: 0,
    skillNames: [],
    mcpServerNames: [],
    memoryFileNames: [],
    reviewActionNames: [],
    verificationNames: [],
    syncStatus: "NotImported",
    repos: [],
    hasLocalConflict: false,
    ...overrides,
  };
}

describe("VaultEmptyState", () => {
  it("renders the heading and both actions and reports which was clicked", () => {
    const onCreate = vi.fn();
    const onConnect = vi.fn();
    render(<VaultEmptyState onCreate={onCreate} onConnect={onConnect} />);

    expect(screen.getByTestId("vault-empty-state")).toBeDefined();
    expect(screen.getByText("Team Configuration Vault")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Create GitHub Vault/ }));
    fireEvent.click(screen.getByRole("button", { name: /Connect Existing Git Vault/ }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });
});

describe("computeVaultGate", () => {
  it("blocks on a missing GitHub identity before anything else", () => {
    expect(
      computeVaultGate({ hasGitHubAuth: false, hasVault: false, requires: ["github"] }),
    ).toEqual({
      disabled: true,
      reason: "Sign in to GitHub to create or connect a vault",
    });
  });

  it("blocks on a missing vault", () => {
    expect(computeVaultGate({ hasGitHubAuth: true, hasVault: false, requires: ["vault"] })).toEqual(
      { disabled: true, reason: "Connect a vault first" },
    );
  });

  it("blocks while a request is in flight", () => {
    expect(
      computeVaultGate({
        hasGitHubAuth: true,
        hasVault: true,
        isBusy: true,
        requires: ["github", "vault"],
      }),
    ).toEqual({ disabled: true, reason: "Action already in progress" });
  });

  it("opens once every requirement is satisfied", () => {
    expect(
      computeVaultGate({ hasGitHubAuth: true, hasVault: true, requires: ["github", "vault"] }),
    ).toEqual({ disabled: false });
  });
});

describe("GatedActionButton", () => {
  it("is soft-disabled, exposes the reason, and swallows no click silently", () => {
    const onClick = vi.fn();
    render(
      <GatedActionButton
        gate={{ disabled: true, reason: "Connect a vault first" }}
        onClick={onClick}
      >
        Sync
      </GatedActionButton>,
    );

    const button = screen.getByRole("button", { name: "Sync" });
    // Not natively disabled: a native `disabled` button leaves the tab order, so its reason would
    // reach nobody on a keyboard.
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("title", "Connect a vault first");
    expect(button).toHaveAccessibleDescription("Connect a vault first");

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("clicks through when the gate is open", () => {
    const onClick = vi.fn();
    render(
      <GatedActionButton gate={{ disabled: false }} onClick={onClick}>
        Sync
      </GatedActionButton>,
    );

    const button = screen.getByRole("button", { name: "Sync" });
    expect(button).not.toHaveAttribute("aria-disabled");
    expect(button).toHaveAccessibleDescription("");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("stays a tab stop while the gate is closed, between its neighbours", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <button type="button">Before</button>
        <GatedActionButton gate={{ disabled: true, reason: "Unlock the vault first" }}>
          Deploy
        </GatedActionButton>
        <button type="button">After</button>
      </>,
    );

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Before" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Deploy" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
    // The old fix was a focusable wrapper around a natively disabled button. There is none now.
    expect(container.querySelector(".tui-tooltip-trigger-wrap")).toBeNull();
  });

  it("shows the reason in a tooltip when the button takes keyboard focus", async () => {
    const user = userEvent.setup();
    render(
      <GatedActionButton gate={{ disabled: true, reason: "Unlock the vault first" }}>
        Deploy
      </GatedActionButton>,
    );

    await user.tab();

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Unlock the vault first");
  });

  it("keeps focus when the gate closes and opens under it", () => {
    function Gated(props: { disabled: boolean }) {
      return (
        <GatedActionButton
          gate={
            props.disabled
              ? { disabled: true, reason: "Action already in progress" }
              : { disabled: false }
          }
        >
          Sync
        </GatedActionButton>
      );
    }
    const { rerender } = render(<Gated disabled={false} />);
    const button = screen.getByRole("button", { name: "Sync" });
    button.focus();

    rerender(<Gated disabled />);
    expect(screen.getByRole("button", { name: "Sync" })).toBe(button);
    expect(document.activeElement).toBe(button);

    rerender(<Gated disabled={false} />);
    expect(screen.getByRole("button", { name: "Sync" })).toBe(button);
    expect(document.activeElement).toBe(button);
  });
});

describe("VaultDialogShell submit", () => {
  function Shell(props: { submitDisabled: boolean; reason?: string; onSubmit?: () => void }) {
    return (
      <VaultDialogShell
        open
        onClose={vi.fn()}
        title="Rename"
        testId="shell"
        submitLabel="Rename"
        submitDisabled={props.submitDisabled}
        submitDisabledReason={props.reason}
        onSubmit={props.onSubmit ?? vi.fn()}
      >
        <input aria-label="New name" />
      </VaultDialogShell>
    );
  }

  it("keeps a disabled submit in the tab order and says why", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Shell submitDisabled reason="Enter a name first" onSubmit={onSubmit} />);
    const submit = screen.getByRole("button", { name: "Rename" });

    expect(submit).not.toBeDisabled();
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit).toHaveAccessibleDescription("Enter a name first");

    submit.focus();
    expect(document.activeElement).toBe(submit);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enter a name first");

    await user.click(submit);
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is reachable by Tab from Cancel when disabled, with or without a reason", async () => {
    const user = userEvent.setup();
    render(<Shell submitDisabled />);

    screen.getByRole("button", { name: "Cancel" }).focus();
    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Rename" }));
  });

  it("submits once enabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Shell submitDisabled={false} reason="Enter a name first" onSubmit={onSubmit} />);
    const submit = screen.getByRole("button", { name: "Rename" });

    expect(submit).not.toHaveAttribute("aria-disabled");
    expect(submit).toHaveAccessibleDescription("");
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("CreateVaultDialog", () => {
  const accounts = [
    { login: "octocat", type: "User" },
    { login: "acme", type: "Organization" },
  ];

  it("requires a non-blank repository name", () => {
    const onSubmit = vi.fn();
    render(<CreateVaultDialog open onClose={vi.fn()} accounts={accounts} onSubmit={onSubmit} />);

    const submit = screen.getByRole("button", { name: "Create Vault" });
    expect(submit).not.toHaveAttribute("aria-disabled");

    fireEvent.change(screen.getByLabelText("Repository Name"), { target: { value: "   " } });
    // Soft-disabled, not native: the button stays in the tab order.
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Repository Name"), { target: { value: "Team-Vault" } });
    expect(submit).not.toHaveAttribute("aria-disabled");
  });

  it("lists the accounts as 'login (type)' and submits the picked owner", () => {
    const onSubmit = vi.fn();
    render(<CreateVaultDialog open onClose={vi.fn()} accounts={accounts} onSubmit={onSubmit} />);

    openSelect(screen.getByRole("combobox", { name: "Owner / Organization" }));
    expect(screen.getByRole("option", { name: "octocat (User)" })).toBeDefined();
    fireEvent.click(screen.getByRole("option", { name: "acme (Organization)" }));

    fireEvent.click(screen.getByRole("button", { name: "Create Vault" }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Tendril-Vault",
      isPrivate: true,
      owner: "acme",
    });
  });

  it("falls back to a text input when no accounts came back", () => {
    const onSubmit = vi.fn();
    render(<CreateVaultDialog open onClose={vi.fn()} accounts={[]} onSubmit={onSubmit} />);

    const owner = screen.getByLabelText("Owner / Organization");
    expect(owner.tagName).toBe("INPUT");
    fireEvent.change(owner, { target: { value: "acme" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Vault" }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Tendril-Vault",
      isPrivate: true,
      owner: "acme",
    });
  });
});

describe("ConnectVaultDialog", () => {
  const discovered = [
    {
      fullName: "acme/Tendril-Vault",
      repoUrl: "https://github.com/acme/Tendril-Vault.git",
      owner: "acme",
      name: "Tendril-Vault",
      accountType: "Organization",
      isPrivate: true,
    },
  ];

  it("needs a URL or a detected repo before it will submit", () => {
    render(<ConnectVaultDialog open onClose={vi.fn()} discovered={[]} onSubmit={vi.fn()} />);

    const submit = screen.getByRole("button", { name: "Connect Vault" });
    expect(submit).toHaveAttribute("aria-disabled", "true");

    fireEvent.change(screen.getByLabelText("Git Repository URL"), { target: { value: "   " } });
    expect(submit).toHaveAttribute("aria-disabled", "true");

    fireEvent.change(screen.getByLabelText("Git Repository URL"), {
      target: { value: "https://github.com/acme/Vault.git" },
    });
    expect(submit).not.toHaveAttribute("aria-disabled");
  });

  it("fills the URL and display name from a detected repo", () => {
    const onSubmit = vi.fn();
    render(
      <ConnectVaultDialog open onClose={vi.fn()} discovered={discovered} onSubmit={onSubmit} />,
    );

    openSelect(screen.getByRole("combobox", { name: "Detected GitHub Vaults" }));
    fireEvent.click(
      screen.getByRole("option", { name: "acme/Tendril-Vault (Organization, private)" }),
    );

    expect(screen.getByLabelText("Git Repository URL")).toHaveValue(
      "https://github.com/acme/Tendril-Vault.git",
    );
    expect(screen.getByLabelText("Display Name (Optional)")).toHaveValue("acme/Tendril-Vault");

    const submit = screen.getByRole("button", { name: "Connect Vault" });
    expect(submit).not.toHaveAttribute("aria-disabled");
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith({
      repoUrl: "https://github.com/acme/Tendril-Vault.git",
      displayName: "acme/Tendril-Vault",
    });
  });

  it("says it is still looking while discovery runs", () => {
    render(
      <ConnectVaultDialog
        open
        onClose={vi.fn()}
        discovered={[]}
        isDiscovering
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByTestId("connect-vault-discovering")).toBeDefined();
  });
});

describe("ImportFromVaultDialog repo mapping", () => {
  const item = catalogItem({
    name: "Beta",
    repos: [
      { owner: "acme", name: "beta-api" },
      { owner: "local", name: "beta-docs" },
    ],
    reposCount: 2,
  });

  it("keys rows by owner/name, defaults to <home>/git/<repo>, and flags existing folders", () => {
    render(
      <ImportFromVaultDialog
        open
        onClose={vi.fn()}
        item={item}
        existingNames={[]}
        existingPaths={["/home/dev/git/beta-api"]}
        homeDir="/home/dev"
        onSubmit={vi.fn()}
      />,
    );

    const apiRow = screen.getByTestId("import-vault-repo-acme/beta-api");
    expect(within(apiRow).getByLabelText("Local path for acme/beta-api")).toHaveValue(
      "/home/dev/git/beta-api",
    );
    expect(within(apiRow).getByText("✓ Existing Local Folder")).toBeDefined();

    /* `local` is a placeholder owner, so the key is the bare repo name. */
    const docsRow = screen.getByTestId("import-vault-repo-beta-docs");
    expect(within(docsRow).getByText("Will Clone from GitHub")).toBeDefined();
  });

  it("passes edited paths through to onSubmit", () => {
    const onSubmit = vi.fn<(request: VaultImportRequest) => void>();
    render(
      <ImportFromVaultDialog
        open
        onClose={vi.fn()}
        item={item}
        existingNames={[]}
        homeDir="/home/dev"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Local path for acme/beta-api"), {
      target: { value: "/work/beta-api" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Project" }));

    expect(onSubmit.mock.calls[0][0].localRepoMappings).toEqual({
      "acme/beta-api": "/work/beta-api",
      "beta-docs": "/home/dev/git/beta-docs",
    });
  });
});

describe("ImportFromVaultDialog name conflicts", () => {
  const item = catalogItem({
    name: "Alpha",
    syncStatus: "Conflict",
    repos: [{ owner: "acme", name: "alpha-api" }],
    reposCount: 1,
  });

  it("suggests the next free name and refuses a colliding one", () => {
    const onSubmit = vi.fn();
    render(
      <ImportFromVaultDialog
        open
        onClose={vi.fn()}
        item={item}
        existingNames={["Alpha"]}
        homeDir="/home/dev"
        onSubmit={onSubmit}
      />,
    );

    const name = screen.getByLabelText("Local Project Name");
    expect(name).toHaveValue("Alpha-2");

    fireEvent.change(name, { target: { value: "Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Import Project" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("import-vault-dialog-error").textContent).toContain(
      "A local project named 'Alpha' already exists.",
    );
  });

  it("in merge mode fixes the name and keeps the local repo paths", () => {
    const onSubmit = vi.fn<(request: VaultImportRequest) => void>();
    render(
      <ImportFromVaultDialog
        open
        mergeMode
        onClose={vi.fn()}
        item={item}
        existingNames={["Alpha"]}
        localProjects={[{ name: "Alpha", repos: ["/srv/checkouts/alpha-api"] }]}
        homeDir="/home/dev"
        onSubmit={onSubmit}
      />,
    );

    const name = screen.getByLabelText("Local Project Name");
    expect(name).toHaveValue("Alpha");
    expect(name).toBeDisabled();
    expect(screen.getByTestId("merge-vault-callout")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Link & Merge" }));

    const request = onSubmit.mock.calls[0][0];
    expect(request.targetLocalProjectName).toBe("Alpha");
    expect(request.localRepoMappings).toEqual({ "acme/alpha-api": "/srv/checkouts/alpha-api" });
  });
});

describe("suggestLocalProjectName", () => {
  it("keeps a free name", () => {
    expect(suggestLocalProjectName("Alpha", ["Beta"])).toBe("Alpha");
  });

  it("counts up past the names that are taken", () => {
    expect(suggestLocalProjectName("Alpha", ["Alpha"])).toBe("Alpha-2");
    expect(suggestLocalProjectName("Alpha", ["Alpha", "Alpha-2"])).toBe("Alpha-3");
  });

  it("matches case-insensitively", () => {
    expect(suggestLocalProjectName("Alpha", ["alpha"])).toBe("Alpha-2");
  });
});

describe("PushToVaultDialog", () => {
  const assets: ProjectAssets[] = [
    {
      projectName: "Alpha",
      skills: ["review", "release"],
      mcpServers: ["github"],
      memories: [],
      reviewActions: [],
      verifications: [],
    },
  ];

  it("will not publish with no project selected", () => {
    const onSubmit = vi.fn();
    render(
      <PushToVaultDialog
        open
        onClose={vi.fn()}
        vaultDisplayName="acme/Tendril-Vault"
        availableProjects={["Alpha"]}
        assets={assets}
        onSubmit={onSubmit}
      />,
    );

    const submit = screen.getByRole("button", { name: "Publish & Open PR" });
    expect(submit).not.toHaveAttribute("aria-disabled");

    /* Dropping the only selected project is what leaves nothing to publish. */
    fireEvent.click(screen.getByRole("button", { name: "Remove Alpha" }));

    expect(submit).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("bulk-toggles a category and carries the selections into the request", () => {
    const onSubmit = vi.fn<(draft: Omit<VaultExportRequest, "prTitle" | "prBody">) => void>();
    render(
      <PushToVaultDialog
        open
        onClose={vi.fn()}
        vaultDisplayName="acme/Tendril-Vault"
        targetVaultId="default"
        availableProjects={["Alpha"]}
        assets={assets}
        onSubmit={onSubmit}
      />,
    );

    const skills = screen.getByTestId("asset-group-Alpha-skills");
    expect(within(skills).getAllByRole("checkbox")).toHaveLength(2);

    fireEvent.click(screen.getByLabelText("Deselect all Skills for Alpha"));
    fireEvent.change(screen.getByLabelText("Request PR Reviewers"), {
      target: { value: "alice, bob," },
    });
    fireEvent.click(screen.getByLabelText("Include Security & Permissions Policies for Alpha"));
    fireEvent.click(screen.getByRole("button", { name: "Publish & Open PR" }));

    const draft = onSubmit.mock.calls[0][0];
    expect(draft.projectNames).toEqual(["Alpha"]);
    expect(draft.selectedSkills).toEqual({ Alpha: [] });
    expect(draft.selectedMcps).toEqual({ Alpha: ["github"] });
    expect(draft.reviewers).toEqual(["alice", "bob"]);
    expect(draft.syncPermissions).toEqual({ Alpha: false });
    expect(draft.targetVaultId).toBe("default");
  });

  it("re-selects a single asset after a bulk deselect", () => {
    const onSubmit = vi.fn<(draft: Omit<VaultExportRequest, "prTitle" | "prBody">) => void>();
    render(
      <PushToVaultDialog
        open
        onClose={vi.fn()}
        vaultDisplayName="acme/Tendril-Vault"
        availableProjects={["Alpha"]}
        assets={assets}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByLabelText("Deselect all Skills for Alpha"));
    const release = screen.getByTestId("asset-Alpha-skills-release");
    fireEvent.click(within(release).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Publish & Open PR" }));

    expect(onSubmit.mock.calls[0][0].selectedSkills).toEqual({ Alpha: ["release"] });
  });
});
