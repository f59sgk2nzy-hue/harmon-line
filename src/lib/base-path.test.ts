import assert from "node:assert/strict";
import { describe, it } from "node:test";
import nextConfig from "../../next.config";
import {
  PUBLIC_BASE_PATH,
  appBasePath,
  pwaManifestFields,
  withBasePath,
} from "./base-path";

describe("app base path", () => {
  it("mounts the app at /line for the OS reverse proxy and local dogfood", () => {
    assert.equal(PUBLIC_BASE_PATH, "/line");
    assert.equal(appBasePath(), "/line");
    assert.equal(nextConfig.basePath, "/line");
    assert.equal(nextConfig.env?.NEXT_PUBLIC_BASE_PATH, "/line");
  });

  it("does not set assetPrefix — basePath already prefixes /_next assets", () => {
    assert.equal(nextConfig.assetPrefix, undefined);
  });
});

describe("withBasePath", () => {
  it("prefixes internal routes, API fetches, and public icons", () => {
    assert.equal(withBasePath("/"), "/line");
    assert.equal(withBasePath("/?league=nfl"), "/line?league=nfl");
    assert.equal(withBasePath("/oracle"), "/line/oracle");
    assert.equal(withBasePath("/api/scoreboard?division=d1"), "/line/api/scoreboard?division=d1");
    assert.equal(withBasePath("/api/highlights?league=cfb"), "/line/api/highlights?league=cfb");
    assert.equal(withBasePath("/icons/icon-192.png"), "/line/icons/icon-192.png");
    assert.equal(withBasePath("/manifest.webmanifest"), "/line/manifest.webmanifest");
  });

  it("prefixes history.replaceState targets Next does not rewrite", () => {
    assert.equal(
      withBasePath("/?division=d1&date=20260922"),
      "/line?division=d1&date=20260922"
    );
    assert.equal(withBasePath("/rankings"), "/line/rankings");
    assert.equal(withBasePath("/rankings?poll=coaches"), "/line/rankings?poll=coaches");
    assert.equal(withBasePath("/standings?conference=8"), "/line/standings?conference=8");
  });

  it("keeps hashes and does not double-prefix or rewrite absolute URLs", () => {
    assert.equal(withBasePath("/oracle?q=score#ask"), "/line/oracle?q=score#ask");
    assert.equal(withBasePath("/line/favorites"), "/line/favorites");
    assert.equal(withBasePath("/line?league=mlb"), "/line?league=mlb");
    assert.equal(withBasePath("/line/?league=mlb"), "/line/?league=mlb");
    assert.equal(
      withBasePath("https://a.espncdn.com/i/teamlogos/nfl/500/buf.png"),
      "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png"
    );
    assert.equal(withBasePath("//cdn.example/icon.png"), "//cdn.example/icon.png");
  });
});

describe("pwaManifestFields", () => {
  it("keeps start_url, scope, and icons inside /line", () => {
    const fields = pwaManifestFields();
    assert.equal(fields.start_url, "/line");
    assert.equal(fields.scope, "/line");
    for (const path of [
      "/line",
      "/line/favorites",
      "/line/standings",
      "/line/oracle",
      "/line/research",
    ]) {
      assert.equal(path.startsWith(fields.scope), true, path);
    }
    assert.deepEqual(fields.icons, [
      "/line/icons/icon-192.png",
      "/line/icons/icon-512.png",
      "/line/icons/icon.svg",
    ]);
    assert.equal(fields.appleTouchIcon, "/line/icons/apple-touch-icon.png");
    assert.equal(fields.manifestHref, "/line/manifest.webmanifest");
    for (const url of [fields.start_url, fields.scope, ...fields.icons, fields.appleTouchIcon]) {
      assert.ok(url.startsWith("/line"), url);
      assert.equal(url.startsWith("/line/line"), false);
    }
  });
});
