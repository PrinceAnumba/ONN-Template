import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { useState } from "react";
import { FileDrop } from "./file-drop";

const labels = {
  prompt: "Drag a file here or",
  browse: "choose a file",
  hint: "CSV, XLSX, JSON or XML, up to 50 MB",
  remove: "Remove file",
  progress: "Upload progress",
};

function Demo({ progress, initialError }: { progress?: number; initialError?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState(initialError);
  return (
    <FileDrop
      accept={[".csv", ".xlsx", ".json", ".xml"]}
      maxBytes={50 * 1024 * 1024}
      file={file}
      fileLabel={file ? `${file.name} (${Math.ceil(file.size / 1000)} kB)` : undefined}
      onFile={(picked) => {
        setFile(picked);
        setError(undefined);
      }}
      onReject={(reason) =>
        setError(reason === "type" ? "Use CSV, XLSX, JSON or XML." : "The file is over 50 MB.")
      }
      onClear={() => setFile(null)}
      error={error}
      progress={progress}
      labels={labels}
    />
  );
}

/** A native drop event: Testing Library’s fireEvent rebuilds DataTransfer and loses files. */
function drop(target: Element, file: File) {
  const data = new DataTransfer();
  data.items.add(file);
  target.dispatchEvent(
    new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true }),
  );
}

const meta = {
  title: "UI/FileDrop",
  component: FileDrop,
  render: () => <Demo />,
} satisfies Meta<typeof FileDrop>;
export default meta;
type Story = StoryObj<typeof meta>;

const args = {} as Story["args"];

export const Default: Story = {
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const zone = canvas.getByText(labels.hint).parentElement!;
    drop(zone, new File(["x"], "photo.png"));
    await expect(await canvas.findByText("Use CSV, XLSX, JSON or XML.")).toBeVisible();
    // The picker path (keyboard and touch): the hidden input behind "choose a file".
    await userEvent.upload(
      canvasElement.querySelector<HTMLInputElement>("input[type=file]")!,
      new File(["a,b"], "data.csv"),
    );
    await expect(canvas.getByText(/data\.csv/)).toBeVisible();
    await expect(canvas.queryByText("Use CSV, XLSX, JSON or XML.")).toBeNull();
  },
};

export const Loading: Story = { args, render: () => <Demo progress={0.45} /> };

export const Error: Story = { args, render: () => <Demo initialError="The file is over 50 MB." /> };

export const LongText: Story = {
  args,
  render: () => (
    <Demo initialError="Le fichier dépasse 50 Mo. Divisez-le par période ou par indicateur, puis importez chaque partie séparément." />
  ),
};

export const Rtl: Story = { args, parameters: { direction: "rtl" } };

export const Mobile: Story = { args, parameters: { viewport: { defaultViewport: "mobile360" } } };
