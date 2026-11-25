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
      const byWorld = {
        moon: (m.targets.find((t) => t.body === "moon" && t.default) ?? m.targets.find((t) => t.body === "moon"))?.id ?? first,
        mars: (m.targets.find((t) => t.body === "mars" && t.default) ?? m.targets.find((t) => t.body === "mars"))?.id ?? first,
      };
      const link = (href: string) => ({ tag: "link", attrs: { rel: "preload", href, as: "fetch", crossorigin: "anonymous" }, injectTo: "head" as const });
      const script = `(function(){var f=${JSON.stringify(files)},w=${JSON.stringify(byWorld)},d=${JSON.stringify(first)},g=${JSON.stringify(m.grid.file)},sq=new URLSearchParams(location.search),h=location.hash.replace(/^#\\/?/,""),i=h.indexOf("?"),r=i<0?h:h.slice(0,i),hq=new URLSearchParams(i<0?"":h.slice(i+1)),legacy=sq.has("t");if(!legacy&&r!=="find"&&r!=="place"&&r!=="learn")return;var add=function(p){var l=document.createElement("link");l.rel="preload";l.as="fetch";l.crossOrigin="anonymous";l.href="/data/"+p;document.head.appendChild(l)};add(g);var t=legacy?sq.get("t"):r==="learn"?w[hq.get("world")==="mars"?"mars":"moon"]:hq.get("t");add(f[t]||f[d])})()`;
      return [
        link("/data/manifest.json"),
        { tag: "script", children: script, injectTo: "head" },
      ];
    },
  };
}

export default defineConfig({
  plugins: [preload()],
  // Compile down to 2020-era syntax so older browsers (Chrome 87, Safari 14, Firefox 78 and up) can run the site.
  build: { chunkSizeWarningLimit: 1200, target: ["es2020", "chrome87", "edge88", "firefox78", "safari14"], cssTarget: ["chrome87", "edge88", "firefox78", "safari14"] },
});
