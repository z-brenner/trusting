"use client";

import type { SnapshotSubprocessor } from "@/lib/snapshot";

/**
 * STUB — replaced by the public-page implementation.
 * Contract: interactive world map (SVG, d3-geo + world-atlas) highlighting every country
 * disclosed as a processing location (region codes EU/EEA expand to member countries,
 * GLOBAL is listed separately below the map). Clicking a highlighted country lists the
 * subprocessors processing there. Must be a client component, responsive, keyboard accessible,
 * and must never label a location as a headquarters.
 */
export type SubprocessorMapProps = {
  subprocessors: SnapshotSubprocessor[];
  brandColor?: string;
  className?: string;
};

export function SubprocessorMap({ subprocessors, className }: SubprocessorMapProps) {
  return <div className={className}>Map of {subprocessors.length} subprocessors</div>;
}
