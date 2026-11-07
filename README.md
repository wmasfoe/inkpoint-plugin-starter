# Inkpoint Plugin Starter

A ready-to-fork template for building **Inkpoint** (md-editor) plugins and
distributing them through **GitHub Releases**. Fork this repository, edit the
example plugins (or add your own), push a tag, and GitHub Actions publishes a
Release that the desktop app can install and the web playground can preview.

No app source changes, no recompiling the editor — plugins are loaded at runtime
from the Release assets.

---

## Quick start

```bash
# 1. Fork this repo on GitHub, then clone your fork
git clone https://github.com/<you>/<your-fork>.git
cd <your-fork>

# 2. Install dependencies
npm install

# 3. Type-check and build the plugin packages
npm run typecheck
npm run build        # writes dist/*.inkpoint.json + dist/inkpoint-plugin.json
```

To publish:

```bash
git tag v1.0.0
git push origin v1.0.0   # GitHub Actions builds + creates the Release
```

Then install in the desktop app by pasting your repo address
(`owner/repo`, a repo URL, or a specific Release URL), or share a web preview
link from `/playground/plugins`.

---

## Repository layout

```
plugins/
  mention/              # example: custom inline syntax (@mentions)
    plugin.json         #   descriptor: manifest + entry + examples + styles
    index.ts            #   plugin code (default export via definePlugin)
    style.css           #   optional styles, added/removed with the plugin
  weekly/               # example: writing command + keymap + settings
    plugin.json
    index.ts
scripts/
  build.mjs             # builds each plugin into a self-contained *.inkpoint.json
  validate.mjs          # validates examples + settings shape
.github/workflows/
  release.yml           # tag push -> typecheck -> build -> draft Release -> publish
```

Each subdirectory under `plugins/` is one installable plugin. **Add a directory,
get another plugin** — there is no fixed limit on how many a single repo ships.

---

## Writing a plugin

A plugin is a `plugin.json` descriptor plus a TypeScript entry that default-exports
a definition created with `definePlugin`:

```ts
import { definePlugin } from "@md-editor/plugin-sdk";

export default definePlugin({
  activate(context) {
    context.commands.register({
      id: "author.weekly.insert", // contribution IDs MUST start with "<plugin id>."
      title: "Insert weekly note",
      async run() {
        const snapshot = context.editor.getSnapshot();
        const result = await context.editor.applyEdit({
          markdown: snapshot.markdown + "\n\n## This week\n",
          expectedGeneration: snapshot.documentGeneration,
          expectedContentRevision: snapshot.contentRevision,
          selection: "end",
        });
        if (result.status === "stale") return; // document changed; abort
      },
    });
    // Optional: return a cleanup function run on deactivate.
  },
});
```

### `plugin.json`

```jsonc
{
  "manifest": {
    "id": "author.weekly",        // unique, stable; renaming display name keeps ID
    "name": "Weekly note",
    "version": "1.0.0",
    "description": "Insert a configurable weekly note template.",
    "apiVersion": 1
  },
  "entry": "index.ts",            // must live inside this plugin directory
  "examples": [                   // shown in the web playground
    { "id": "weekly", "name": "Weekly note", "markdown": "# My week\n" }
  ],
  "settings": {                   // optional: string | number | boolean | enum
    "heading": { "type": "string", "label": "Heading", "default": "Weekly review" }
  },
  "styles": "style.css"           // optional: added/cleaned up with the plugin
}
```

### Plugin context API

| API | Purpose |
|---|---|
| `syntax.register` | Register a Markdown syntax extension (parsing + WYSIWYG decorations) |
| `commands.register` | Register a writing command (appears in the command palette) |
| `keymaps.register` | Declare a default shortcut (users can rebind) |
| `editor.getSnapshot` | Read the current document + selection + revision |
| `editor.applyEdit` | Commit an edit through the host's edit transaction |
| `settings.get` / `settings.update` | Read/write this plugin's isolated settings |
| `signal` | AbortSignal cancelled on deactivate; stop async work |
| `dependencies` | Host-injected CodeMirror / Lezer runtimes |

### Rules that the build enforces

- **IDs are namespaced.** Contribution IDs (commands, keymaps, syntax) must start
  with `<plugin id>.`. Lezer node names use the PascalCase of the plugin ID segments
  (e.g. `author.weekly` -> `AuthorWeekly`) plus your own suffix.
- **Never bundle CodeMirror/Lezer.** Import them only as *types*; get the runtime
  from `context.dependencies`. The build rejects runtime imports of
  `@codemirror/*` and `@lezer/*`.
- **One self-contained ESM per plugin.** All other dependencies must be bundled into
  the single module. Runtime dependencies between plugins are not supported.
- **Size limits.** Each plugin package ≤ 10 MiB, the catalog index ≤ 1 MiB.

---

## How distribution works

Every Release uploads:

- `inkpoint-plugin.json` — the catalog index. Metadata only, no executable code.
  Each entry maps a plugin to exactly one asset in the same Release.
- `<id>-<version>.inkpoint.json` — one self-contained package per plugin, containing
  the manifest, compiled ESM `code`, optional `styles`, `examples`, and optional
  `settings`.

Clients read the catalog, download only the selected plugin package, and re-validate
that the package's manifest matches the index and the bytes match the recorded digest
before running any code. Unlisted assets (READMEs, screenshots) are ignored by the
installer and can coexist in the Release.

The `.github/workflows/release.yml` workflow type-checks, builds, creates a **draft**
Release, uploads the validated assets, then flips it public — so a half-uploaded
Release is never installable.

---

## The SDK dependency

This template depends on [`@md-editor/plugin-sdk`](https://www.npmjs.com/package/@md-editor/plugin-sdk),
installed from npm like any other dev dependency:

```jsonc
"devDependencies": {
  "@md-editor/plugin-sdk": "^0.1.0"
}
```

The SDK ships only types plus the `definePlugin` identity helper — it is not the
editor runtime. CodeMirror and Lezer are injected by the host at runtime via
`context.dependencies`, so plugins must **not** bundle them.

CodeMirror / Lezer are declared as the SDK's **optional peer dependencies**. You
only need them installed when you author syntax plugins that reference their
types (like the `mention` example). This template already lists them as
`devDependencies` so type-checking works out of the box:

```jsonc
"@codemirror/state", "@codemirror/view", "@lezer/common", "@lezer/markdown"
```

If you only write command/template plugins, you can drop those four from
`devDependencies`.

---

## Security note

A digest proves a package's bytes are consistent — it does **not** certify the author
or that the code is safe. Desktop plugins run in the same JavaScript environment as the
app; the plugin API is a development contract, not a per-plugin security sandbox. Only
install plugins from authors you trust.

---

## License

GPL-3.0-or-later. See [LICENSE](./LICENSE).
