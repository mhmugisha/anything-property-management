import { useCallback, useMemo } from "react";
import { Printer } from "lucide-react";

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function PrintPreviewButtons({ targetRef, title = "Preview" }) {
  const safeTitle = useMemo(() => escapeHtml(title), [title]);

  const open = useCallback(
    (autoPrint) => {
      if (typeof window === "undefined") return;

      const node = targetRef?.current;
      if (!node) {
        console.error("PrintPreviewButtons: targetRef is not attached");
        return;
      }

      // Clone so we can strip controls before showing/printing.
      const clone = node.cloneNode(true);
      const noPrintNodes = clone.querySelectorAll('[data-no-print="true"]');
      for (const el of noPrintNodes) {
        el.remove();
      }

      // Ensure textarea content is printable (textarea.value is not included in innerHTML).
      const textareas = clone.querySelectorAll("textarea");
      for (const ta of textareas) {
        const wrapper = document.createElement("div");
        wrapper.style.whiteSpace = "pre-wrap";
        wrapper.style.border = "1px solid #e5e7eb";
        wrapper.style.borderRadius = "12px";
        wrapper.style.padding = "10px 12px";
        wrapper.style.minHeight = "56px";
        wrapper.textContent = ta.value || "";
        ta.replaceWith(wrapper);
      }

      // Convert simple inputs to plain text so they print cleanly if any remain.
      const inputs = clone.querySelectorAll("input");
      for (const input of inputs) {
        const type = String(input.getAttribute("type") || "text").toLowerCase();
        if (type === "checkbox" || type === "radio") continue;

        const span = document.createElement("span");
        span.textContent = input.value || "";
        input.replaceWith(span);
      }

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      @page { margin: 0.5in; }
      body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 24px; color: #0f172a; }
      h1, h2, h3 { margin: 0 0 10px 0; }
      .card { box-shadow: none !important; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
      th { text-align: left; color: #64748b; font-weight: 600; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      @media print {
        body { margin: 0.5in; }
        a { color: inherit; text-decoration: none; }
      }
    </style>
  </head>
  <body>
    ${clone.innerHTML}
  </body>
</html>`;

      const w = window.open("", "_blank");
      if (!w) {
        console.error(
          "Could not open preview window. Please allow pop-ups for this site.",
        );
        return;
      }

      w.document.open();
      w.document.write(html);
      w.document.close();

      if (autoPrint) {
        w.focus();
        // Give the browser a moment to paint content before printing.
        setTimeout(() => {
          try {
            w.print();
          } catch (e) {
            console.error("Failed to print", e);
          }
        }, 250);
      }
    },
    [safeTitle, targetRef],
  );

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => open(true)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c]"
      >
        <Printer className="w-4 h-4" />
        Print / PDF
      </button>
    </div>
  );
}
