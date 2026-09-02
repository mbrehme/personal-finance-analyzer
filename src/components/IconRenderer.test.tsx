/**
 * @file IconRenderer.test.tsx
 * @description Unit-Tests für IconRenderer.
 * @module components/IconRenderer.test
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { IconRenderer } from './IconRenderer';

describe('IconRenderer', () => {
  it('renders standard icon without crashing', () => {
    const { container } = render(<IconRenderer name="Home" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders fallback icon when icon name is unknown', () => {
    const { container } = render(<IconRenderer name="NonExistentIcon" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
