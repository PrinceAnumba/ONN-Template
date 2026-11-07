"use client";

import { cn } from "@onn/ui/lib/utils";
import { ChevronDownIcon, XIcon } from "lucide-react";
import * as React from "react";
import { filterGroups, type ComboboxGroup, type ComboboxOption } from "./combobox-filter";

export type { ComboboxGroup, ComboboxOption };

export interface ComboboxProps {
  label: string;
  groups: ComboboxGroup[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  clearLabel: string;
  noResultsLabel: string;
  className?: string;
}

/** APG editable combobox with a grouped listbox. Full-screen on mobile (brief §6). */
export function Combobox({
  label,
  groups,
  value,
  onChange,
  placeholder,
  clearLabel,
  noResultsLabel,
  className,
}: ComboboxProps) {
  const id = React.useId();
  const listId = `${id}-list`;
  const listRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  const selected = React.useMemo(
    () => groups.flatMap((group) => group.options).find((option) => option.value === value),
    [groups, value],
  );
  const visible = React.useMemo(() => filterGroups(groups, query), [groups, query]);
  const flat = React.useMemo(() => visible.flatMap((group) => group.options), [visible]);
  const optionId = React.useCallback((index: number) => `${id}-option-${index}`, [id]);

  const show = () => {
    const index = flat.findIndex((option) => option.value === value);
    setActive(Math.max(index, 0));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const choose = (option: ComboboxOption) => {
    onChange(option.value);
    close();
  };

  React.useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  }, [active, open, optionId]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const last = flat.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) show();
        else setActive((index) => Math.min(index + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) show();
        else setActive((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActive(last);
        }
        break;
      case "Enter":
        if (open) {
          event.preventDefault();
          const option = flat[active];
          if (option) choose(option);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
        }
        break;
      case "Tab":
        close();
        break;
    }
  };

  let index = -1;
  return (
    <div
      className={cn(
        "relative min-w-0",
        open && "max-md:bg-background max-md:fixed max-md:inset-0 max-md:z-50",
        open && "max-md:flex max-md:flex-col max-md:p-4",
        className,
      )}
    >
      <label htmlFor={`${id}-input`} className="text-muted-foreground mb-1 block text-xs">
        {label}
      </label>
      <div className="relative">
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat[active] ? optionId(active) : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={open ? query : (selected?.label ?? "")}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={show}
          onClick={() => !open && show()}
          onBlur={close}
          onKeyDown={onKeyDown}
          className="bg-background placeholder:text-muted-foreground h-11 w-full truncate rounded-md border ps-3 pe-16"
        />
        <div className="absolute inset-y-0 end-1 flex items-center">
          {value !== null && !open && (
            <button
              type="button"
              aria-label={clearLabel}
              onClick={() => onChange(null)}
              className="text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-md max-md:size-11"
            >
              <XIcon aria-hidden className="size-4" />
            </button>
          )}
          <ChevronDownIcon aria-hidden className="text-muted-foreground me-2 size-4" />
        </div>
      </div>
      {open && flat.length === 0 && (
        <div
          role="status"
          className="bg-popover text-muted-foreground z-40 mt-1 w-full rounded-md border p-3 text-sm shadow-md md:absolute"
        >
          {noResultsLabel}
        </div>
      )}
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        tabIndex={-1}
        aria-label={label}
        hidden={!open || flat.length === 0}
        // Keeps focus in the input so the blur handler doesn't close before a click lands.
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          "bg-popover z-40 mt-1 max-h-[360px] w-full rounded-md border shadow-md md:absolute",
          flat.length > 0 && "overflow-y-auto",
          "max-md:max-h-none max-md:flex-1 max-md:border-0 max-md:shadow-none",
        )}
      >
        {visible.map((group, groupIndex) => (
          <div key={group.label ?? groupIndex} role="group" aria-label={group.label}>
            {group.label && (
              <div
                aria-hidden
                className="bg-popover text-muted-foreground sticky top-0 z-10 px-3 py-2 text-xs font-semibold"
              >
                {group.label}
              </div>
            )}
            {group.options.map((option) => {
              index += 1;
              const position = index;
              return (
                <div
                  key={option.value}
                  id={optionId(position)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={option.value === value}
                  onClick={() => choose(option)}
                  onKeyDown={onKeyDown}
                  onMouseEnter={() => setActive(position)}
                  style={{ paddingInlineStart: 12 + (option.indent ?? 0) * 16 }}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-between gap-2 py-2 pe-3",
                    position === active && "bg-accent",
                    option.value === value && "font-semibold",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block">{option.label}</span>
                    {option.description && (
                      <span className="text-muted-foreground block text-xs">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {option.badge && (
                    <span className="rounded-pill text-muted-foreground shrink-0 border px-2 text-xs">
                      {option.badge}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
