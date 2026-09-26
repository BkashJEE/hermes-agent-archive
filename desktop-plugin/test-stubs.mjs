/**
 * Stand-ins for the two modules Hermes Desktop supplies at load time.
 *
 * The plugin imports `react` and `@hermes/plugin-sdk`, and neither is a dependency of this
 * repository — the runtime provides them. Installing React just to test one file would put
 * a node_modules tree in a project whose whole claim is that it does not have one, so the
 * test resolves both specifiers here instead. Only what the plugin actually touches is
 * implemented; anything else should fail loudly rather than pretend.
 */

/* A React element, reduced to what an assertion needs to read. */
export const createElement = (type, props, ...children) => ({
  type, props: props ?? {}, children: children.flat().filter(c => c != null)
});

export const useState = initial => [typeof initial === 'function' ? initial() : initial, () => {}];
export const useRef = initial => ({ current: initial ?? null });
export const useCallback = fn => fn;
export const useEffect = () => {};

export default { createElement, useState, useRef, useCallback, useEffect };

/* ---- @hermes/plugin-sdk ---- */

export const ROUTES_AREA = 'routes';
export const SIDEBAR_NAV_AREA = 'sidebar.nav';
export const PALETTE_AREA = 'palette';

export const navigated = [];
export const host = { navigate: path => navigated.push(path) };
export const Button = props => createElement('button', props);
export const Codicon = ({ name }) => createElement('span', { 'data-icon': name });
