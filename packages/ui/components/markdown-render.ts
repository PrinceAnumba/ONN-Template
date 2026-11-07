import "katex/dist/katex.min.css";
import DOMPurify from "dompurify";
import katex from "katex";
import { marked } from "marked";

const MATH = /\$\$([\s\S]+?)\$\$/g;

export function renderMarkdown(source: string) {
  const parts: string[] = [];
  let last = 0;
  for (const match of source.matchAll(MATH)) {
    parts.push(marked.parse(source.slice(last, match.index), { async: false }));
    parts.push(
      katex.renderToString(match[1] ?? "", {
        displayMode: true,
        throwOnError: false,
        output: "html",
      }),
    );
    last = (match.index ?? 0) + match[0].length;
  }
  parts.push(marked.parse(source.slice(last), { async: false }));
  return DOMPurify.sanitize(parts.join(""));
}
