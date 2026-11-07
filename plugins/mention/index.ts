import { definePlugin } from "@md-editor/plugin-sdk";

export default definePlugin({
  activate(context) {
    context.syntax.register({
      id: "example.mention.syntax",
      name: "Mention syntax",
      nodePolicy: { nodeName: "ExampleMention_Reference", kind: "raw-fallback", isBlock: false },
      buildDecorations(record) {
        const { from, to } = record.fullRange;
        return from < to
          ? [
              context.dependencies.codemirrorView.Decoration.mark({
                class: "example-mention",
              }).range(from, to),
            ]
          : [];
      },
      markdownExtension: {
        defineNodes: ["ExampleMention_Reference"],
        parseInline: [
          {
            name: "ExampleMention_Reference",
            parse(cx, next, pos) {
              if (next !== 64) return -1;
              const match = /^@[a-zA-Z][\w-]*/.exec(cx.slice(pos, cx.end));
              return match
                ? cx.addElement(cx.elt("ExampleMention_Reference", pos, pos + match[0].length))
                : -1;
            },
          },
        ],
      },
    });
  },
});
