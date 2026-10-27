"use client";

import { Button } from "@/components/ui/button";

/** Footer for forms rendered inside <Dialog>; sits flush with the dialog edges. */
export function DialogFooter({
  saving,
  onClose,
  submitLabel,
  formId,
}: {
  saving: boolean;
  onClose: () => void;
  submitLabel: string;
  formId: string;
}) {
  return (
    <div className="-mx-6 -mb-5 mt-6 flex justify-end gap-2 border-t border-line bg-surface-muted px-6 py-4">
      <Button variant="secondary" onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" form={formId} loading={saving}>
        {submitLabel}
      </Button>
    </div>
  );
}
