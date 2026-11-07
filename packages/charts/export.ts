export function downloadText(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

const SCALE = 2;
const WIDTH = 800;
const PAD = 24;
const TITLE_SIZE = 20;
const SOURCE_SIZE = 12;
const FONT = "system-ui, sans-serif";

/** PNG at 2× with the title, source and logo baked in (brief §6). */
export async function exportPng(options: {
  svg: string;
  title: string;
  source?: string;
  logoUrl?: string;
  fileName: string;
}) {
  const chartUrl = URL.createObjectURL(new Blob([options.svg], { type: "image/svg+xml" }));
  try {
    const chart = await loadImage(chartUrl);
    const chartHeight = (chart.naturalHeight / chart.naturalWidth) * (WIDTH - PAD * 2) || 420;
    const height = PAD + TITLE_SIZE + PAD / 2 + chartHeight + PAD / 2 + SOURCE_SIZE + PAD;
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH * SCALE;
    canvas.height = height * SCALE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, WIDTH, height);
    ctx.fillStyle = "#0F1C2E";
    ctx.font = `600 ${TITLE_SIZE}px ${FONT}`;
    ctx.fillText(options.title, PAD, PAD + TITLE_SIZE);
    ctx.drawImage(chart, PAD, PAD + TITLE_SIZE + PAD / 2, WIDTH - PAD * 2, chartHeight);
    ctx.fillStyle = "#5B6472";
    ctx.font = `${SOURCE_SIZE}px ${FONT}`;
    ctx.fillText(options.source ?? "", PAD, height - PAD);
    if (options.logoUrl) {
      const logo = await loadImage(options.logoUrl).catch(() => null);
      if (logo) {
        const logoHeight = 24;
        const logoWidth = (logo.naturalWidth / logo.naturalHeight) * logoHeight || logoHeight;
        ctx.drawImage(
          logo,
          WIDTH - PAD - logoWidth,
          height - PAD - logoHeight + 6,
          logoWidth,
          logoHeight,
        );
      }
    }
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${options.fileName}.png`;
    link.click();
  } finally {
    URL.revokeObjectURL(chartUrl);
  }
}
