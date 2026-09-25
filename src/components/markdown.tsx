import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// Only files Quizz serves itself: an outside image would show its host the Learner's IP (ADR 0002).
const OWN_FILE = /^\/files\/[0-9a-f-]{36}$/;

/** Question and option Markdown, the same in the editor preview and the Attempt. Raw HTML never renders. */
export function Markdown({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      // Sanitize first: highlighting afterwards adds classes the sanitizer would strip.
      rehypePlugins={[rehypeSanitize, rehypeHighlight]}
      urlTransform={(url, key, node) =>
        node.tagName === "img" && key === "src"
          ? OWN_FILE.test(url)
            ? url
            : null
          : defaultUrlTransform(url)
      }
    >
      {source}
    </ReactMarkdown>
  );
}
