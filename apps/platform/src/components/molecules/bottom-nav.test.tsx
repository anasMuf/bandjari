/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { BottomNav } from './BottomNav';

/**
 * Router minimal dengan route tree yang sama (path) dengan shell _app —
 * memakai BottomNav asli untuk menguji perilaku highlight menu aktif
 * (activeProps/data-status) dari TanStack Router pada kondisi nyata.
 */
const rootRoute = createRootRoute({
  component: () => (
    <div>
      <BottomNav />
      <Outlet />
    </div>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <h1>Home</h1>,
});
const exploreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore',
  component: () => <h1>Explore</h1>,
});
const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project',
  component: () => <h1>Project</h1>,
});
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: () => <h1>Profile</h1>,
});
const faqRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/faq',
  component: () => <h1>FAQ</h1>,
});

const routeTree = rootRoute.addChildren([homeRoute, exploreRoute, projectRoute, profileRoute, faqRoute]);

function setup(initialEntry: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

const ACTIVE_COLOR_CLASS = 'data-[status=active]:text-brand-800';
const SECTION_ACTIVE_COLOR_CLASS = 'data-[section-active=true]:text-brand-800';

function navLink(name: string): HTMLElement {
  const link = screen.getByRole('link', { name });
  expect(link.getAttribute('data-status')).toBe('active');
  return link;
}

afterEach(cleanup);

describe('BottomNav — highlight menu aktif', () => {
  it('menyorot Home di /', async () => {
    setup('/');
    expect(await screen.findByRole('link', { name: 'Home' })).toBeDefined();
    navLink('Home');
    expect(screen.getByRole('link', { name: 'Explore' }).getAttribute('data-status')).not.toBe('active');
  });

  it('menyorot Explore di /explore', async () => {
    setup('/explore');
    expect(await screen.findByRole('link', { name: 'Explore' })).toBeDefined();
    navLink('Explore');
  });

  it('menyorot Project di /project', async () => {
    setup('/project');
    expect(await screen.findByRole('link', { name: 'Project' })).toBeDefined();
    navLink('Project');
  });

  it('menyorot Profile di /profile', async () => {
    setup('/profile');
    expect(await screen.findByRole('link', { name: 'Profile' })).toBeDefined();
    navLink('Profile');
  });

  it('memasang variant highlight pada menu aktif (aktivasi via atribut data-status)', async () => {
    setup('/explore');
    await screen.findByRole('link', { name: 'Explore' });
    const explore = navLink('Explore');
    expect(explore.className).toContain(ACTIVE_COLOR_CLASS);
    // Item non-aktif tidak mendapat data-status active (variant tak aktif).
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('data-status')).toBeNull();
  });

  it('menu non-aktif tidak menerima data-status active', async () => {
    setup('/project');
    await screen.findByRole('link', { name: 'Project' });
    for (const name of ['Home', 'Explore', 'Profile']) {
      expect(screen.getByRole('link', { name }).getAttribute('data-status')).not.toBe('active');
    }
  });

  it('menyorot Profile saat berada di halaman support (/faq)', async () => {
    setup('/faq');
    await screen.findByRole('link', { name: 'Profile' });
    const profile = screen.getByRole('link', { name: 'Profile' });
    expect(profile.getAttribute('data-section-active')).toBe('true');
    expect(profile.className).toContain(SECTION_ACTIVE_COLOR_CLASS);
    // Menu lain tidak membawa penanda seksi aktif.
    for (const name of ['Home', 'Explore', 'Project']) {
      expect(screen.getByRole('link', { name }).getAttribute('data-section-active')).toBeNull();
    }
  });

  it('tidak menaruh data-section-active di halaman non-support', async () => {
    setup('/explore');
    await screen.findByRole('link', { name: 'Profile' });
    expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('data-section-active')).toBeNull();
  });
});
