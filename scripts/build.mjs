import { readdir, readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { validateContent } from "./validate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugins = join(root, "plugins");
const output = join(root, "dist");
const idPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
// SDK helpers are bundled normally; editor runtimes must use the host's instances.
const forbidden = /^(?:@codemirror\/|@lezer\/)/;

export async function buildPlugins() {
  const descriptors = [];
  for (const dir of await readdir(plugins, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const directory = join(plugins, dir.name);
    const descriptor = JSON.parse(await readFile(join(directory, "plugin.json"), "utf8"));
    const { manifest, entry, examples, settings, styles } = descriptor;
    if (
      !manifest ||
      !idPattern.test(manifest.id) ||
      ![manifest.name, manifest.version, manifest.description].every(
        (v) => typeof v === "string" && v.trim(),
      ) ||
      manifest.apiVersion !== 1 ||
      typeof entry !== "string" ||
      !Array.isArray(examples)
    )
      throw new Error(`Invalid plugin descriptor: ${dir.name}`);
    validateContent(examples, settings);
    if (!/^[A-Za-z0-9][A-Za-z0-9.+_-]*$/.test(manifest.version))
      throw new Error("Invalid plugin version for asset filename");
    const entryPath = resolve(directory, entry);
    if (relative(directory, entryPath).startsWith(".."))
      throw new Error("Entry must be inside its plugin directory");
    descriptors.push({ manifest, entryPath, examples, settings, styles, directory });
  }
  if (
    !descriptors.length ||
    new Set(descriptors.map((d) => d.manifest.id)).size !== descriptors.length
  )
    throw new Error("Plugins must have unique IDs");
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const catalog = [];
  for (const descriptor of descriptors) {
    const result = await build({
      configFile: false,
      logLevel: "silent",
      build: {
        write: false,
        lib: { entry: descriptor.entryPath, formats: ["es"], fileName: () => "plugin.js" },
        rollupOptions: { output: { inlineDynamicImports: true } },
      },
      plugins: [
        {
          name: "reject-shared-runtime-imports",
          enforce: "pre",
          resolveId(source) {
            if (forbidden.test(source))
              throw new Error(`Use context.dependencies instead of runtime import: ${source}`);
          },
        },
      ],
    });
    const outputs = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
    if (outputs.some((item) => item.type !== "chunk"))
      throw new Error("Plugin build must not emit separate assets");
    const chunks = outputs.filter((item) => item.type === "chunk");
    if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length)
      throw new Error("Plugin must be one self-contained ESM module");
    const asset = `${descriptor.manifest.id}-${encodeURIComponent(descriptor.manifest.version)}.inkpoint.json`;
    const stylePath = descriptor.styles && resolve(descriptor.directory, descriptor.styles);
    if (stylePath && relative(descriptor.directory, stylePath).startsWith(".."))
      throw new Error("Styles must be inside its plugin directory");
    const pkg = {
      manifest: descriptor.manifest,
      code: chunks[0].code,
      examples: descriptor.examples,
      ...(descriptor.settings ? { settings: descriptor.settings } : {}),
      ...(descriptor.styles ? { styles: await readFile(stylePath, "utf8") } : {}),
    };
    if (!/\bexport\s*\{[^}]*\bdefault\b/.test(pkg.code) && !/\bexport\s+default\b/.test(pkg.code))
      throw new Error("Plugin must export a default definition");
    const content = JSON.stringify(pkg);
    if (Buffer.byteLength(content) > 10 * 1024 * 1024)
      throw new Error("Plugin package exceeds size limit");
    await writeFile(join(output, asset), content);
    catalog.push({ ...descriptor.manifest, asset });
  }
  const index = JSON.stringify({ schemaVersion: 1, plugins: catalog });
  if (Buffer.byteLength(index) > 1024 * 1024) throw new Error("Plugin catalog exceeds size limit");
  await writeFile(join(output, "inkpoint-plugin.json"), index);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await buildPlugins();
