import { Fragment } from "react";
import { Text, View } from "react-native";
import { parseNoteMarkdown, type InlineNode } from "@/src/lib/markdown";
import { fonts } from "@/src/lib/fonts";
import { useTheme } from "@/src/lib/theme";

/**
 * Renders a note the way apps/web's NoteContent does.
 *
 * The reader printed `note.content` into a single <Text>, so a note written
 * with emphasis arrived showing its `**` and `==` as literal characters -
 * the markup leaking through on the one screen whose whole job is the words.
 *
 * `format` falls back to PLAINTEXT when absent, which keeps every note
 * published before markdown shipped rendering exactly as it always has.
 * Those are immutable and already hashed, so re-interpreting their
 * asterisks would change what a permanent note says.
 */
function renderNodes(nodes: InlineNode[], colors: ReturnType<typeof useTheme>["colors"], keyPrefix = ""): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}${index}`;
    if (node.type === "text") return <Fragment key={key}>{node.value}</Fragment>;
    if (node.type === "strong") {
      return (
        <Text key={key} style={{ fontFamily: fonts.bold }}>
          {renderNodes(node.children, colors, `${key}-`)}
        </Text>
      );
    }
    if (node.type === "em") {
      return (
        <Text key={key} style={{ fontFamily: fonts.bodyItalic }}>
          {renderNodes(node.children, colors, `${key}-`)}
        </Text>
      );
    }
    // `mark`. The UA highlight is a hardcoded yellow/black on the web and has
    // no equivalent here at all, so it is drawn from tokens either way.
    return (
      <Text key={key} style={{ backgroundColor: colors.notice, color: colors.noticeText }}>
        {renderNodes(node.children, colors, `${key}-`)}
      </Text>
    );
  });
}

export function NoteContent({
  source,
  format,
  fontScale,
}: {
  source: string;
  format?: "PLAINTEXT" | "MARKDOWN";
  fontScale: number;
}) {
  const { colors } = useTheme();
  const base = {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 17 * fontScale,
    lineHeight: 28 * fontScale,
  };

  if (format !== "MARKDOWN") {
    return <Text style={base}>{source}</Text>;
  }

  const paragraphs = parseNoteMarkdown(source);
  return (
    <View style={{ gap: 16 }}>
      {paragraphs.map((paragraph, index) => (
        <Text key={index} style={base}>
          {renderNodes(paragraph.children, colors, `${index}-`)}
        </Text>
      ))}
    </View>
  );
}
