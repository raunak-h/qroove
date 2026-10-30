import { useEffect } from 'react';

/**
 * Deterrent for shared or public devices: no context menu and no text selection on this page,
 * except in fields.
 * It stops casual tampering (copy link, view source from the menu). It is not a security
 * control; real access is protected by the HttpOnly session and the QR secret.
 */
export function useLockedPage() {
  useEffect(() => {
    // Fields keep their menu: on a phone, long-press is how you paste.
    const block = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('input, textarea')) return;
      e.preventDefault();
    };
    document.addEventListener('contextmenu', block);
    document.body.classList.add('locked');
    return () => {
      document.removeEventListener('contextmenu', block);
      document.body.classList.remove('locked');
    };
  }, []);
}
