/**
 * Basic Infrastructure Tests
 * Simple tests to verify Jest and React Testing Library work
 */

import React from 'react';
import { render } from '@testing-library/react';

// Simple test component
function TestComponent() {
  return <div data-testid="test-component">Hello World</div>;
}

describe('Test Infrastructure', () => {
  it('Jest and React Testing Library work correctly', () => {
    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('test-component')).toBeInTheDocument();
    expect(getByTestId('test-component')).toHaveTextContent('Hello World');
  });

  it('Basic Jest assertions work', () => {
    expect(2 + 2).toBe(4);
    expect('hello').toContain('ell');
    expect([1, 2, 3]).toHaveLength(3);
  });

  it('Async operations work', async () => {
    const promise = Promise.resolve('test result');
    const result = await promise;
    expect(result).toBe('test result');
  });
});