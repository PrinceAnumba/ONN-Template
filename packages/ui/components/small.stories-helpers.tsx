import { useState } from "react";
import { LiteModeToggle } from "./lite-mode-toggle";

export function LiteDemo({ label, description }: { label: string; description: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="bg-foreground max-w-sm rounded-lg p-4 text-white">
      <LiteModeToggle
        label={label}
        description={description}
        checked={checked}
        onCheckedChange={setChecked}
      />
    </div>
  );
}
