import { useEffect } from 'react';

/**
 * Deterrent for shared or public devices: no context menu and no text selection on this page.
 * It stops casual tampering (copy link, view source from the menu). It is not a security
 * control; real access is protected by the HttpOnly session and the QR secret.
 */
export function useLockedPage() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    document.body.classList.add('locked');
    return () => {
      document.removeEventListener('contextmenu', block);
      document.body.classList.remove('locked');
    };
  }, []);
}
