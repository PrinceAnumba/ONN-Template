import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { useState } from "react";
import { RichTextEditor, type RichTextEditorProps } from "./rich-text-editor";

const labels = {
  toolbar: "Formatting",
  bold: "Bold",
  italic: "Italic",
  heading2: "Heading",
  heading3: "Subheading",
  bulletList: "Bulleted list",
  orderedList: "Numbered list",
  quote: "Quote",
  undo: "Undo",
  redo: "Redo",
};

function Demo(props: Partial<RichTextEditorProps>) {
  const [value, setValue] = useState(
    props.value ?? "<h2>Summary</h2><p>Key changes this quarter.</p>",
  );
  return (
    <div className="max-w-2xl">
      <RichTextEditor label="Text" labels={labels} {...props} value={value} onChange={setValue} />
      <output data-testid="html" className="text-muted-foreground mt-2 block text-xs break-all">
        {value}
      </output>
    </div>
  );
}

const meta = {
  title: "UI/RichTextEditor",
  component: RichTextEditor,
  render: () => <Demo />,
} satisfies Meta<typeof RichTextEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

const args = {} as Story["args"];

export const Default: Story = {
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = await canvas.findByRole("textbox", { name: "Text" });
    await userEvent.click(box);
    await userEvent.keyboard("{Control>}a{/Control}");
    await userEvent.click(canvas.getByRole("button", { name: "Bold" }));
    await expect(canvas.getByRole("button", { name: "Bold" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await waitFor(() => expect(canvas.getByTestId("html").textContent).toContain("<strong>"));
    // One tab stop: arrow keys move between toolbar buttons.
    canvas.getByRole("button", { name: "Bold" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("button", { name: "Italic" })).toHaveFocus();
  },
};

export const Loading: Story = { args, render: () => <Demo loading /> };

export const Empty: Story = {
  args,
  render: () => <Demo value="" hint="Write the summary readers see first." />,
};

export const Error: Story = {
  args,
  render: () => <Demo value="" error="Write some text before generating the report." />,
};

export const LongText: Story = {
  args,
  render: () => (
    <Demo
      value={`<h2>Analyse détaillée de la couverture des réseaux mobiles à haut débit dans les régions</h2>${"<p>La couverture 4G de la population a progressé dans toutes les régions, avec des écarts persistants entre les zones urbaines et rurales, qui appellent des investissements ciblés.</p>".repeat(4)}<ul><li>Un élément de liste particulièrement long pour vérifier le retour à la ligne dans l’éditeur.</li></ul>`}
    />
  ),
};

export const Rtl: Story = {
  args,
  parameters: { direction: "rtl" },
  render: () => <Demo value="<h2>ملخص</h2><p>أهم التغييرات في هذا الربع.</p>" />,
};

export const Mobile: Story = { args, parameters: { viewport: { defaultViewport: "mobile360" } } };
