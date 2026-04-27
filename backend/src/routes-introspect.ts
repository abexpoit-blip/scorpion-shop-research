// Walks the Express app stack and returns every mounted route + method.
// Used by GET /api/admin/routes to verify routers are wired correctly.

import type { Express } from "express";

type RouteInfo = { method: string; path: string };

function joinPath(base: string, sub: string) {
  const a = base.replace(/\/+$/, "");
  const b = sub.replace(/^\/+/, "");
  return `${a}/${b}`.replace(/\/+/g, "/");
}

// Express stores router mount paths as RegExps. Convert the common case
// (e.g. "/api/wallet") back to a string for display.
function regexpToPath(re: RegExp): string {
  const src = re.toString();
  // /^\/api\/wallet\/?(?=\/|$)/i  →  /api/wallet
  const m = src.match(/^\/\^\\?(.*?)\\\/\?\(\?=/);
  if (m) return "/" + m[1].replace(/\\\//g, "/");
  return src;
}

function walk(stack: any[], base: string, out: RouteInfo[]) {
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).filter(
        (m) => layer.route.methods[m]
      );
      for (const method of methods) {
        out.push({
          method: method.toUpperCase(),
          path: joinPath(base, layer.route.path),
        });
      }
    } else if (layer.name === "router" && layer.handle?.stack) {
      const sub = layer.regexp ? regexpToPath(layer.regexp) : "";
      walk(layer.handle.stack, joinPath(base, sub), out);
    }
  }
}

export function listRoutes(app: Express): {
  mounts: { path: string; routes: number }[];
  routes: RouteInfo[];
} {
  const routes: RouteInfo[] = [];
  // @ts-ignore — _router is internal but stable in Express 4
  const stack = app._router?.stack ?? [];
  walk(stack, "", routes);

  const byMount = new Map<string, number>();
  for (const r of routes) {
    const mount = r.path.split("/").slice(0, 3).join("/"); // "/api/wallet"
    byMount.set(mount, (byMount.get(mount) ?? 0) + 1);
  }
  const mounts = [...byMount.entries()]
    .map(([path, n]) => ({ path, routes: n }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return { mounts, routes: routes.sort((a, b) => a.path.localeCompare(b.path)) };
}
