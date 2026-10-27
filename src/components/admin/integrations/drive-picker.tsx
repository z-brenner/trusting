"use client";

/**
 * STUB — replaced by the integrations implementation.
 * Contract: a dialog that lets the administrator browse/search files in the connected
 * Google Drive or OneDrive account (via /api/integrations/{google|microsoft}/files) and
 * import selected files (POST /api/integrations/{provider}/import). Imported documents are
 * created with visibility PRIVATE. Calls onImported() after a successful import so the
 * caller can refresh (router.refresh()).
 */
export type DrivePickerProps = {
  provider: "google" | "microsoft";
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export function DrivePicker({ provider, open }: DrivePickerProps) {
  return open ? <div>Picker for {provider}</div> : null;
}
