import "@onn/ui/base.css";
import "./fonts.css";
import type { Decorator, Preview } from "@storybook/react";
import { useEffect } from "react";

/** Applies the toolbar's direction to the whole document, so portals (drawers, toasts) follow. */
const WithDirection: Decorator = (Story, context) => {
  const dir = context.parameters.direction ?? context.globals.direction ?? "ltr";
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = dir === "rtl" ? "ar" : "en";
  }, [dir]);
  return (
    <div dir={dir}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [WithDirection],
  globalTypes: {
    direction: {
      description: "Text direction",
      toolbar: { icon: "transfer", items: ["ltr", "rtl"], dynamicTitle: true },
    },
  },
  initialGlobals: { direction: "ltr" },
  parameters: {
    layout: "padded",
    controls: { expanded: true },
    viewport: {
      viewports: {
        mobile360: { name: "Android Go 360×640", styles: { width: "360px", height: "640px" } },
        tablet: { name: "Tablet 768", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop 1280", styles: { width: "1280px", height: "800px" } },
      },
    },
    a11y: { config: { rules: [{ id: "region", enabled: false }] } },
  },
};

export default preview;
