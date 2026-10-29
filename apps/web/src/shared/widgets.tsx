import { useState, type ReactNode } from 'react';
import qrcode from 'qrcode-generator';

/** Two-step button: the first tap asks, the second does it. No modal dialogs to trap focus. */
export function ConfirmButton({
  label,
  confirmLabel = 'Yes, do it',
  ariaLabel,
  danger = false,
  disabled = false,
  onConfirm,
}: {
  label: string;
  confirmLabel?: string;
  ariaLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => unknown;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button
        type="button"
        className={`btn${danger ? ' ghost' : ''}`}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onClick={() => setAsking(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <span className="row">
      <button
        type="button"
        className="btn danger"
        onClick={() => {
          setAsking(false);
          void onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="btn ghost" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <button
      type="button"
      className="btn"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => setState('copied'))
          .catch(() => setState('failed'));
      }}
    >
      {state === 'copied' ? 'Copied ✓' : state === 'failed' ? 'Select and copy manually' : label}
    </button>
  );
}

/** Local, dependency-light QR: renders the modules as one SVG path. Never put secrets in `text`. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
  }
  const size = n + 8;
  return (
    <svg
      className="qr"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label>{label}</label>
      {children}
    </div>
  );
}
