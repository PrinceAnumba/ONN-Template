import type { CmsBlock } from "@onn/api-client/types";
import { InfoIcon } from "lucide-react";
import Image from "next/image";
import { renderRichText } from "@/lib/rich-text";

/** Server-rendered rich text in the shared prose style. */
export function RichText({ source, className }: { source: string; className?: string }) {
  return (
    <div
      className={["onn-prose max-w-prose", className].filter(Boolean).join(" ")}
      // Sanitised by renderRichText.
      dangerouslySetInnerHTML={{ __html: renderRichText(source) }}
    />
  );
}

export interface CmsBlocksProps {
  blocks: CmsBlock[];
  tableCaption: string;
  /** Lite mode (brief §9): images are replaced by their description; partner logos stay. */
  lite?: boolean;
  /** Label above an image's description in Lite mode. */
  imageHidden?: string;
  /** Set when the page fell back to the default language. */
  lang?: string;
}

/** CMS blocks (brief §5.9): rich text, image, callout, table and partner grid. */
export function CmsBlocks({ blocks, tableCaption, lite, imageHidden, lang }: CmsBlocksProps) {
  return (
    <div lang={lang} className="flex flex-col gap-6">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "richText":
            return block.body ? <RichText key={i} source={block.body} /> : null;
          case "callout":
            return (
              <aside
                key={i}
                className="bg-surface-2 border-primary flex max-w-prose gap-3 rounded-md border-s-4 p-4"
              >
                <InfoIcon aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
                {block.body && <RichText source={block.body} />}
              </aside>
            );
          case "image":
            if (lite) {
              return block.alt ? (
                <p
                  key={i}
                  className="text-muted-foreground max-w-prose rounded-lg border p-4 text-sm"
                >
                  <span className="block font-semibold">{imageHidden}</span>
                  {block.alt}
                </p>
              ) : null;
            }
            return block.src ? (
              <Image
                key={i}
                src={block.src}
                alt={block.alt ?? ""}
                width={1200}
                height={500}
                unoptimized
                loading="lazy"
                className="h-auto w-full max-w-3xl rounded-lg border"
              />
            ) : null;
          case "table": {
            const [head, ...body] = block.rows ?? [];
            if (!head) return null;
            return (
              <div
                key={i}
                // Wide tables scroll inside this region rather than widening the page.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                role="region"
                aria-label={tableCaption}
                className="relative max-w-3xl overflow-x-auto rounded-lg border"
              >
                <table className="w-full text-sm">
                  <caption className="sr-only">{tableCaption}</caption>
                  <thead className="bg-surface-2">
                    <tr>
                      {head.map((cell) => (
                        <th key={cell} scope="col" className="px-3 py-2 text-start font-semibold">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {body.map((row, r) => (
                      <tr key={r} className="border-t">
                        {row.map((cell, c) =>
                          c === 0 ? (
                            <th key={c} scope="row" className="px-3 py-2 text-start font-semibold">
                              {cell}
                            </th>
                          ) : (
                            <td key={c} className="px-3 py-2">
                              {cell}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case "partners":
            return (
              <ul key={i} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(block.partners ?? []).map((partner) => {
                  const content = (
                    <>
                      {partner.logo && (
                        <Image
                          src={partner.logo}
                          alt=""
                          width={160}
                          height={64}
                          unoptimized
                          className="h-12 w-auto object-contain"
                        />
                      )}
                      <span className="font-semibold">{partner.name}</span>
                    </>
                  );
                  return (
                    <li key={partner.name} className="flex">
                      {partner.url ? (
                        <a
                          href={partner.url}
                          rel="noopener"
                          className="hover:bg-surface-2 flex min-h-24 flex-1 flex-col justify-center gap-2 rounded-lg border p-4 underline-offset-4 hover:underline"
                        >
                          {content}
                        </a>
                      ) : (
                        <div className="flex min-h-24 flex-1 flex-col justify-center gap-2 rounded-lg border p-4">
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
