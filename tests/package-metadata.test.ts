import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("Package Metadata", () => {
  const packageJsonPath = join(repoRoot, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

  it("has correct SpaceCorps repository, homepage, and bugs metadata", () => {
    expect(packageJson.name).toBe("@spacecorps/components");
    expect(packageJson.author).toBe("SpaceCorps");
    expect(packageJson.homepage).toBe("https://github.com/SpaceCorps/storybook#readme");
    expect(packageJson.bugs).toEqual({
      url: "https://github.com/SpaceCorps/storybook/issues",
    });
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/SpaceCorps/storybook.git",
    });
  });

  // The package is published to GitHub Packages, not npmjs.com: the repo is private and a
  // GITHUB_TOKEN already scoped to it can publish, where npmjs.com would need a paid org plus a
  // separate NPM_TOKEN. `access: restricted` keeps it readable only by org members.
  it("publishes to the GitHub Packages registry", () => {
    expect(packageJson.publishConfig).toEqual({
      access: "restricted",
      registry: "https://npm.pkg.github.com",
    });
  });

  // Not pinned to a value: the Release workflow stamps the tag's version into package.json before it
  // runs the suite, so an exact-version assertion made every release fail its own tests.
  it("sets a semver version", () => {
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });

  it("configures bump script using bumpp", () => {
    expect(packageJson.scripts?.bump).toBeDefined();
    expect(packageJson.scripts.bump).toContain("bumpp");
  });

  it("contains no leftover template placeholder values", () => {
    const rawContent = readFileSync(packageJsonPath, "utf-8");
    expect(rawContent).not.toContain("Author Name");
    expect(rawContent).not.toContain("author.name@mail.com");
    expect(rawContent).not.toContain("https://github.com/author/library");
  });
});
