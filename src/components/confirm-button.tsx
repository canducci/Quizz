"use client";

import { useState, useTransition } from "react";

/** A button that runs `action` only after a second, confirming click. */
export function ConfirmButton(props: {
  label: string;
  hint: string;
  confirm: string;
  cancel: string;
  action: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) return <button onClick={() => setConfirming(true)}>{props.label}</button>;
  return (
    <div className="stack" role="group" aria-label={props.label}>
      <p>{props.hint}</p>
      <div className="row">
        <button
          className="danger"
          disabled={pending}
          onClick={() => startTransition(() => props.action())}
        >
          {props.confirm}
        </button>
        <button onClick={() => setConfirming(false)}>{props.cancel}</button>
      </div>
    </div>
  );
}
