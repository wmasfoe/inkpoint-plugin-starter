const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;

export function validateContent(examples, settings) {
  if (!Array.isArray(examples)) throw new Error("Examples must be an array");
  const ids = new Set();
  for (const example of examples) {
    if (
      !object(example) ||
      !text(example.id) ||
      ids.has(example.id) ||
      !text(example.name) ||
      typeof example.markdown !== "string" ||
      (example.instructions !== undefined && typeof example.instructions !== "string")
    )
      throw new Error("Invalid example");
    if (
      example.selection !== undefined &&
      (!object(example.selection) ||
        !Number.isInteger(example.selection.anchor) ||
        !Number.isInteger(example.selection.head) ||
        example.selection.anchor < 0 ||
        example.selection.head < 0 ||
        example.selection.anchor > example.markdown.length ||
        example.selection.head > example.markdown.length)
    )
      throw new Error("Invalid example selection");
    ids.add(example.id);
  }
  if (settings === undefined) return;
  if (!object(settings)) throw new Error("Invalid settings");
  for (const [key, setting] of Object.entries(settings)) {
    if (!text(key) || !object(setting) || !text(setting.label)) throw new Error("Invalid setting");
    if (setting.type === "enum") {
      if (
        !Array.isArray(setting.values) ||
        setting.values.length === 0 ||
        setting.values.some((value) => typeof value !== "string") ||
        new Set(setting.values).size !== setting.values.length ||
        !setting.values.includes(setting.default)
      )
        throw new Error("Invalid enum setting");
    } else if (
      !["boolean", "number", "string"].includes(setting.type) ||
      typeof setting.default !== setting.type ||
      (setting.type === "number" && !Number.isFinite(setting.default))
    )
      throw new Error("Invalid setting default");
  }
}
