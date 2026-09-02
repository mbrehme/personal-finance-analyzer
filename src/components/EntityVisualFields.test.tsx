/**
 * @file EntityVisualFields.test.tsx
 * @description Unit-Tests für die EntityVisualFields Komponente.
 * @module components/EntityVisualFields.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityVisualFields } from './EntityVisualFields';

describe('EntityVisualFields', () => {
  it('renders color, icon, name input and description', () => {
    const setName = vi.fn();
    const setColor = vi.fn();
    const setIcon = vi.fn();
    const setDescription = vi.fn();

    render(
      <EntityVisualFields
        name="Test Entity"
        setName={setName}
        color="#3b82f6"
        setColor={setColor}
        icon="Folder"
        setIcon={setIcon}
        description="Test Beschreibung"
        setDescription={setDescription}
        nameLabel="Bucket-Name *"
      />
    );

    expect(screen.getByText('Bucket-Name *')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Entity')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Beschreibung')).toBeInTheDocument();
    expect(screen.getByTitle('Farbe wählen')).toBeInTheDocument();
    expect(screen.getByTitle('Icon wählen')).toBeInTheDocument();
  });

  it('opens color picker and selects color', () => {
    const setColor = vi.fn();

    render(
      <EntityVisualFields
        name=""
        setName={vi.fn()}
        color="#3b82f6"
        setColor={setColor}
        icon="Folder"
        setIcon={vi.fn()}
      />
    );

    const colorBtn = screen.getByTitle('Farbe wählen');
    fireEvent.click(colorBtn);

    expect(screen.getByText('Farbpalette')).toBeInTheDocument();

    const redColorBtn = screen.getByTitle('#ef4444');
    fireEvent.click(redColorBtn);

    expect(setColor).toHaveBeenCalledWith('#ef4444');
  });

  it('opens icon picker and filters icons', () => {
    const setIcon = vi.fn();

    render(
      <EntityVisualFields
        name=""
        setName={vi.fn()}
        color="#3b82f6"
        setColor={vi.fn()}
        icon="Folder"
        setIcon={setIcon}
      />
    );

    const iconBtn = screen.getByTitle('Icon wählen');
    fireEvent.click(iconBtn);

    const searchInput = screen.getByPlaceholderText('Icon suchen...');
    fireEvent.change(searchInput, { target: { value: 'wallet' } });

    const walletBtn = screen.getByTitle('Wallet');
    fireEvent.click(walletBtn);

    expect(setIcon).toHaveBeenCalledWith('Wallet');
  });
});

