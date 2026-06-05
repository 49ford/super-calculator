import { mountApp as mount } from './ui/App.js';

/**
 * V6 entry point
 * This is the single public hook the offline build calls.
 */
export function mountApp(root) {
  return mount(root);
}
