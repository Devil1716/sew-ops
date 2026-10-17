"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Modal, ModalActions, describeError, inputClass } from "@/components/admin/kit";
import { useChangePassword } from "@/features/people/hooks";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = () => {
    setError(null);
    if (!current) return setError("Enter your current password.");
    if (next.length < 12) return setError("The new password must be at least 12 characters.");
    if (next !== again) return setError("The two new passwords do not match.");
    if (next === current) return setError("Choose a password different from the current one.");
    change.mutate(
      { currentPassword: current, newPassword: next },
      { onSuccess: () => setDone(true), onError: (e) => setError(describeError(e)) },
    );
  };

  if (done) {
    return (
      <Modal title="Password changed" onClose={onClose} size="sm">
        <p className="text-sm text-[var(--muted)]">Your other devices were signed out. This one stays signed in.</p>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Change password" onClose={onClose} size="sm">
      <Field label="Current password">
        <input className={inputClass} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="New password (12+ characters)">
        <input className={inputClass} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="New password again">
        <input className={inputClass} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </Field>
      <FormError message={error} />
      <ModalActions onCancel={onClose} onSubmit={submit} busy={change.isPending} submitLabel="Change password" />
    </Modal>
  );
}