"use client";

import * as React from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Native colour picker paired with an editable hex value. */
export function ColorField({
  id,
  label,
  value,
  onChange,
  error,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (hex: string) => void;
  error?: string | null;
  help?: string;
}) {
  const safe = HEX.test(value) ? value : "#000000";
  return (
    <Field label={label} htmlFor={id} error={error} help={help}>
      <div className="flex items-center gap-2">
        <span
          className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line-strong shadow-xs"
          style={{ backgroundColor: safe }}
        >
          <input
            type="color"
            value={safe}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={`${label} picker`}
          />
        </span>
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v.startsWith("#") || v === "" ? v : `#${v}`);
          }}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          className="w-32 font-mono uppercase"
          aria-invalid={error ? true : undefined}
          placeholder="#1F3A5F"
        />
      </div>
    </Field>
  );
}
