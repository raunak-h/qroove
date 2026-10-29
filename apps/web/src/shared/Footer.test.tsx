import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Footer } from './Footer';

describe('Footer', () => {
  it('links to the company and states the initiative', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Sataklela OÜ' });
    expect(link).toHaveAttribute('href', 'https://sataklela.com');
    expect(link).toHaveAttribute('rel', 'noopener');
    expect(screen.getByText(/CSR initiative/)).toBeInTheDocument();
    expect(screen.getByText(/AGPL-3\.0/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
  });
});
