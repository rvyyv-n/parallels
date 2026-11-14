import fs from "node:fs";
import { defineConfig, type Plugin } from "vite";
import type { Manifest } from "./src/contract";

function preload(): Plugin {
  return {
    name: "data-preload",
    transformIndexHtml() {
      const m: Manifest = JSON.parse(fs.readFileSync("public/data/manifest.json", "utf8"));
      const files = Object.fromEntries(m.targets.map((t) => [t.id, t.bin.file]));
      const first = (m.targets.find((t) => t.default) ?? m.targets[0]).id;
      const link = (href: string) => ({ tag: "link", attrs: { rel: "preload", href, as: "fetch", crossorigin: "anonymous" }, injectTo: "head" as const });
      return [
        link("/data/manifest.json"),
        link(`/data/${m.grid.file}`),
        {
          tag: "script",
          children: `(function(){var f=${JSON.stringify(files)},t=new URLSearchParams(location.search).get("t"),l=document.createElement("link");l.rel="preload";l.as="fetch";l.crossOrigin="anonymous";l.href="/data/"+(f[t]||f[${JSON.stringify(first)}]);document.head.appendChild(l)})()`,
          injectTo: "head",
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [preload()],
  build: { chunkSizeWarningLimit: 1200 },
});
