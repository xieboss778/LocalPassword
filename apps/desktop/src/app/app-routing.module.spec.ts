import { Route } from "@angular/router";

import { IMPORT_DESTINATION_ROUTE_PATH } from "@localpass/importer-ui";
import { vaultFilterRestoreGuard, VAULT_FILTER_SCOPE } from "@localpass/vault";

import { routes } from "./app-routing.module";

/** A route that omits the filter memory fails silently, so every scoped path is asserted here. */
const SCOPED_VAULT_PATHS = [
  "",
  ":vaultId",
  ":vaultId/my-items",
  ":vaultId/shared-folders/:collectionId",
];

function findRoute(candidates: Route[], path: string): Route[] {
  return candidates.flatMap((route) => [
    ...(route.path === path ? [route] : []),
    ...findRoute(route.children ?? [], path),
  ]);
}

function vaultChildren(): Route[] {
  // The LocalPass shell also exposes a flat "vault" route. These assertions are
  // about the legacy vault tree, which is the only one with children.
  const vaultTrees = findRoute(routes, "vault").filter((route) => route.children?.length);
  expect(vaultTrees).toHaveLength(1);
  return vaultTrees[0].children ?? [];
}

describe("desktop vault routes", () => {
  describe.each(SCOPED_VAULT_PATHS)("%s", (path) => {
    // The "" path resolves to two routes — the flag swap holds one for each nav. Only the flagged
    // one carries the filter memory, so a scoped route is the one to assert against.
    const scopedRoutes = () =>
      findRoute(vaultChildren(), path).filter((route) => route.data?.[VAULT_FILTER_SCOPE] === true);

    it("opts into the filter memory", () => {
      expect(scopedRoutes()).toHaveLength(1);
    });

    it("restores the remembered filters", () => {
      expect(scopedRoutes()[0].canActivate).toContain(vaultFilterRestoreGuard);
    });
  });
});

describe("desktop import route", () => {
  // The LocalPass shell offers import unconditionally; the vendor/destination pages live under
  // the redesigned import shell.
  function importRoute(): Route {
    const importRoutes = findRoute(routes, "import/all");
    expect(importRoutes).toHaveLength(1);
    return importRoutes[0];
  }

  it("keeps the location selection route inside the import subtree", () => {
    const route = importRoute();

    expect((route.children ?? []).map((child) => child.path)).toEqual([
      "",
      ":importType",
      IMPORT_DESTINATION_ROUTE_PATH,
    ]);
  });

  it("guards the vendor and destination pages", () => {
    const children = importRoute().children ?? [];
    const guarded = children.filter((child) => child.path !== "");

    expect(guarded).toHaveLength(2);
    expect(guarded.every((child) => (child.canActivate ?? []).length === 1)).toBe(true);
  });
});
