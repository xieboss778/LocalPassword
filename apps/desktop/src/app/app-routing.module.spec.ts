import { TestBed } from "@angular/core/testing";
import {
  PartialMatchRouteSnapshot,
  RedirectFunction,
  Route,
  Router,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from "@angular/router";

import { IMPORT_DESTINATION_ROUTE_PATH } from "@localpass/importer-ui";
import { vaultFilterRestoreGuard, VAULT_FILTER_SCOPE } from "@localpass/vault";

import { VaultDesktopV2Component } from "../vault/app/vault-desktop-v2/vault-desktop-v2.component";

import { routes } from "./app-routing.module";
import { unsavedVaultEditsGuard } from "./vault/guards/unsaved-vault-edits.guard";

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

describe("desktop local vault edit protection", () => {
  it("routes the LocalPass vault through the unsaved-edits deactivation guard", () => {
    const vaultRoute = findRoute(routes, "vault").find(
      (route) => route.component === VaultDesktopV2Component,
    );

    expect(vaultRoute?.canDeactivate).toContain(unsavedVaultEditsGuard);
  });
});

describe("desktop legacy item form routes", () => {
  it.each(["new-item-v2", "edit-item-v2"])(
    "%s redirects instead of rendering a full-page form",
    (path) => {
      const route = findRoute(routes, path)[0];

      expect(route.component).toBeUndefined();
      expect(route.pathMatch).toBe("full");
      expect(typeof route.redirectTo).toBe("function");
    },
  );

  describe("redirect targets", () => {
    let router: Router;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      router = TestBed.inject(Router);
    });

    const target = (path: string, params: Record<string, string>): string => {
      const redirect = findRoute(routes, path)[0].redirectTo as RedirectFunction;
      const snapshot = {
        queryParamMap: convertToParamMap(params),
      } as PartialMatchRouteSnapshot;
      const tree = TestBed.runInInjectionContext(() => redirect(snapshot)) as UrlTree;

      return router.serializeUrl(tree);
    };

    it("maps new-item-v2 to the vault drawer with a valid kind", () => {
      expect(target("new-item-v2", { kind: "login" })).toBe("/vault?action=add&kind=login");
    });

    it("drops an absent or invalid kind from new-item-v2", () => {
      expect(target("new-item-v2", {})).toBe("/vault?action=add");
      expect(target("new-item-v2", { kind: "bogus" })).toBe("/vault?action=add");
    });

    it("maps edit-item-v2 with a cipherId to the edit drawer", () => {
      expect(target("edit-item-v2", { cipherId: "abc" })).toBe("/vault?cipherId=abc&edit=1");
    });

    it("falls back to creating an item when edit-item-v2 has no cipherId", () => {
      expect(target("edit-item-v2", { kind: "card" })).toBe("/vault?action=add&kind=card");
      expect(target("edit-item-v2", {})).toBe("/vault?action=add");
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
