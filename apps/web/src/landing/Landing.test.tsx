import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../routes';
import { useLockedPage } from '../shared/useLockedPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const boxes = () => screen.getAllByRole('textbox') as HTMLInputElement[];
const home = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>,
  );

describe('Landing', () => {
  it('puts the six code boxes first and auto-advances as you type', async () => {
    home();
    expect(boxes()).toHaveLength(6);
    const user = userEvent.setup();
    await user.click(boxes()[0]!);
    await user.keyboard('ab1');
    expect(
      boxes()
        .map((b) => b.value)
        .join(''),
    ).toBe('AB1');
    expect(boxes()[3]).toHaveFocus();
    await user.keyboard('{Backspace}{Backspace}');
    expect(
      boxes()
        .map((b) => b.value)
        .join(''),
    ).toBe('A');
    expect(boxes()[1]).toHaveFocus();
  });

  it('fills every box from a pasted code, ignoring stray characters', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ eventId: 'e', slug: 'ABC123', name: 'Friday' })),
    );
    home();
    const user = userEvent.setup();
    await user.click(boxes()[0]!);
    await user.paste(' ab-c123 ');
    expect(
      boxes()
        .map((b) => b.value)
        .join(''),
    ).toBe('ABC123');
    // A found event tells the visitor to scan; the code alone never joins.
    expect(await screen.findByText(/scan the organiser’s QR code/i)).toBeInTheDocument();
    expect(screen.getByText('Friday')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /join/i })).toBeNull();
  });

  it('says plainly when no event has that code', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'm', action: 'a' } }), {
          status: 404,
        }),
    );
    home();
    const user = userEvent.setup();
    await user.click(boxes()[0]!);
    await user.paste('ZZZZZZ');
    await waitFor(() => expect(screen.getByText('No event has that code.')).toBeInTheDocument());
  });

  it('has the logo as a home link on the left, and the rules/theme menu on the right', async () => {
    home();
    const user = userEvent.setup();
    expect(screen.getByRole('link', { name: 'Qroove home' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button', { name: /Session rules/ })).toBeNull(); // no event, no rules
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('group', { name: 'Menu' })).toHaveTextContent('Privacy');
  });
});

describe('useLockedPage', () => {
  it('blocks the context menu while mounted and restores it afterwards', () => {
    function Page() {
      useLockedPage();
      return <p>locked</p>;
    }
    const { unmount } = render(<Page />);
    const blocked = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
    document.body.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);
    expect(document.body.classList.contains('locked')).toBe(true);
    unmount();
    const free = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
    document.body.dispatchEvent(free);
    expect(free.defaultPrevented).toBe(false);
  });
});
