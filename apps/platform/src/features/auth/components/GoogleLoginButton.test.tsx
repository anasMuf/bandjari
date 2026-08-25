/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GoogleLoginButton } from './GoogleLoginButton';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Ganti window.location dengan object plain agar assign href bisa ditangkap. */
function mockLocation() {
  const location = { href: '' } as Location;
  vi.spyOn(window, 'location', 'get').mockReturnValue(location);
  return location;
}

describe('GoogleLoginButton', () => {
  it('merender label + logo G resmi (svg 4 warna brand Google)', () => {
    const { container } = render(<GoogleLoginButton />);

    expect(screen.getByRole('button', { name: 'Masuk dengan Google' })).toBeDefined();
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // 4 path = 4 warna brand Google (blue/red/yellow/green).
    expect(svg?.querySelectorAll('path')).toHaveLength(4);
  });

  it('redirect ke /auth/google (login)', () => {
    const location = mockLocation();
    render(<GoogleLoginButton />);
    fireEvent.click(screen.getByRole('button'));

    expect(location.href).toContain('/auth/google');
    expect(location.href).not.toContain('link=1');
  });

  it('redirect ke /auth/google?link=1 saat mode link', () => {
    const location = mockLocation();
    render(<GoogleLoginButton label="Hubungkan" link />);
    fireEvent.click(screen.getByRole('button'));

    expect(location.href).toContain('/auth/google?link=1');
  });
});
