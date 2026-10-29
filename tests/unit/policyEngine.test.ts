import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../../apps/server/src/policies/policyEngine.js';

describe('PolicyEngine - Security & Autonomy Sandbox', () => {
  it('blocks dangerous loopback and metadata addresses by default', () => {
    const policy = new PolicyEngine({
      allowLocalFixtures: false,
      ssrfProtectionEnabled: true,
      serverPort: 3001
    });

    // Cloud metadata
    expect(policy.validateNavigationUrl('http://169.254.169.254/latest/meta-data').allowed).toBe(false);
    expect(policy.validateNavigationUrl('http://metadata.google.internal/computeMetadata/v1/').allowed).toBe(false);

    // Private IPv4 ranges
    expect(policy.validateNavigationUrl('http://10.0.0.1/admin').allowed).toBe(false);
    expect(policy.validateNavigationUrl('http://192.168.1.1/router').allowed).toBe(false);
    expect(policy.validateNavigationUrl('http://172.16.0.5/internal').allowed).toBe(false);

    // Loopback
    expect(policy.validateNavigationUrl('http://127.0.0.1:8080/').allowed).toBe(false);
    expect(policy.validateNavigationUrl('http://localhost:3000/').allowed).toBe(false);

    // Disallowed protocols
    expect(policy.validateNavigationUrl('file:///etc/passwd').allowed).toBe(false);
    expect(policy.validateNavigationUrl('gopher://example.com').allowed).toBe(false);
  });

  it('permits valid public HTTPS web destinations', () => {
    const policy = new PolicyEngine({
      allowLocalFixtures: false,
      ssrfProtectionEnabled: true,
      serverPort: 3001
    });

    const result = policy.validateNavigationUrl('https://en.wikipedia.org/wiki/Artificial_intelligence');
    expect(result.allowed).toBe(true);
    expect(result.canonicalUrl).toBe('https://en.wikipedia.org/wiki/Artificial_intelligence');
  });

  it('permits local test fixture endpoint when explicitly configured', () => {
    const policy = new PolicyEngine({
      allowLocalFixtures: true,
      ssrfProtectionEnabled: true,
      serverPort: 3001
    });

    const result = policy.validateNavigationUrl('http://localhost:3001/fixtures/student-ai-tools');
    expect(result.allowed).toBe(true);
  });

  it('enforces autonomy policy restrictions on form interactions and clicks', () => {
    const policy = new PolicyEngine();

    // Read actions allowed in all policies
    expect(policy.checkActionPermission('NAVIGATE', 'READ_ONLY_RESEARCH', 'https://example.com').allowed).toBe(true);
    expect(policy.checkActionPermission('EXTRACT_TEXT', 'READ_ONLY_RESEARCH', 'https://example.com').allowed).toBe(true);

    // Form fill blocked in read-only policy
    const fillInReadOnly = policy.checkActionPermission('FILL', 'READ_ONLY_RESEARCH', 'https://example.com', { selector: '#email' });
    expect(fillInReadOnly.allowed).toBe(false);
    expect(fillInReadOnly.requiresApproval).toBe(true);

    // Click permitted in interactive navigation
    const clickInInteractive = policy.checkActionPermission('CLICK', 'INTERACTIVE_NAVIGATION', 'https://example.com');
    expect(clickInInteractive.allowed).toBe(true);
    expect(clickInInteractive.requiresApproval).toBe(false);
  });
});
