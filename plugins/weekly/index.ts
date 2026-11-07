import { definePlugin } from "@md-editor/plugin-sdk";

export default definePlugin({
  activate(context) {
    context.commands.register({
      id: "example.weekly.insert",
      title: "Insert weekly note",
      async run() {
        const snapshot = context.editor.getSnapshot();
        const heading = context.settings.get().heading;
        await context.editor.applyEdit({
          markdown: `${snapshot.markdown}\n# ${heading}\n\n- Highlights:\n- Next week:\n`,
          expectedGeneration: snapshot.documentGeneration,
          expectedContentRevision: snapshot.contentRevision,
          selection: "end",
        });
      },
    });
    context.keymaps.register({
      id: "example.weekly.shortcut",
      key: "Mod-Shift-w",
      commandId: "example.weekly.insert",
    });
  },
});
