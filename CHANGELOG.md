# Changelog

## 0.3.0

Breaking: the package now uses neutral SpaceCorps names throughout. Consumers must update imports and CSS.

- The workbench widgets entrypoint is now `@spacecorps/components/workbench`.
- Components renamed: `WorkbenchShell`, `AgentDashboard`, `ProcessViewer`, `QuestionsPanel` (and their `*Props` types).
- Event callbacks are now `onHostEvent` / `HostEventHandler`; helpers are `getHostBasePath` and `getHostOrigin`.
- CSS: brand tokens are `--sc-green*` (same values), data-table variables are `--sc-data-table-*`, and component classes use the `.sc-*` prefix. The Tailwind colour is `sc-green`.
- Host contract: meta tags, the widget wrapper element and the data attributes use the `sc-` prefix, and the local-file proxy path is `/host/local-file`.
