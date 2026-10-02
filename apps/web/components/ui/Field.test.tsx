import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field, FormError, SelectField } from './Field';

describe('Field', () => {
  it('links the label to the input', () => {
    render(<Field label="Email" name="email" type="email" />);

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('name', 'email');
    expect(input).toHaveAttribute('type', 'email');
  });
});

describe('SelectField', () => {
  it('renders the options', () => {
    render(
      <SelectField label="Role" name="role" defaultValue="teacher">
        <option value="teacher">Teacher</option>
        <option value="parent">Parent</option>
      </SelectField>,
    );

    expect(screen.getByLabelText('Role')).toHaveValue('teacher');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});

describe('FormError', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<FormError message={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the message as an alert', () => {
    render(<FormError message="Something failed" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Something failed');
  });
});
