import { URL } from 'node:url';
import type { AutonomyPolicyLevel, BrowserActionType, ApprovalRequest } from '@parallax/shared';
import { v4 as uuidv4 } from 'uuid';
import { repo } from '../database/repository.js';
import { logger } from '../observability/logger.js';

export interface SecurityPolicyConfig {
  allowLocalFixtures: boolean;
  ssrfProtectionEnabled: boolean;
  serverPort: number;
}

export class PolicyEngine {
  private config: SecurityPolicyConfig;

  constructor(config?: Partial<SecurityPolicyConfig>) {
    this.config = {
      allowLocalFixtures: process.env.ALLOW_LOCAL_FIXTURES !== 'false',
      ssrfProtectionEnabled: process.env.SSRF_PROTECTION_ENABLED !== 'false',
      serverPort: Number(process.env.PORT || 3001),
      ...config
    };
  }

  /**
   * Validates target navigation URL against SSRF and protocol restrictions
   */
  validateNavigationUrl(urlString: string): { allowed: boolean; reason?: string; canonicalUrl?: string } {
    try {
      const parsed = new URL(urlString);

      // Only http and https protocols allowed
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          allowed: false,
          reason: `Disallowed protocol: '${parsed.protocol}'. Only http: and https: are permitted.`
        };
      }

      const hostname = parsed.hostname.toLowerCase();

      // Check for local fixture exemption
      const allowFixtures = this.config.allowLocalFixtures || process.env.ALLOW_LOCAL_FIXTURES === 'true';
      if (allowFixtures) {
        const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
        const isFixturePort = parsed.port === String(this.config.serverPort) || parsed.port === '3001' || parsed.port === '5173' || !parsed.port;
        const isFixturePath = parsed.pathname.startsWith('/fixtures') || parsed.pathname.startsWith('/api/v1/fixtures');

        if (isLocalHost && (isFixturePath || isFixturePort)) {
          return {
            allowed: true,
            canonicalUrl: parsed.toString()
          };
        }
      }

      // Check SSRF restrictions
      if (this.config.ssrfProtectionEnabled) {
        // Disallow loopback
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.startsWith('127.')) {
          return {
            allowed: false,
            reason: `Access to loopback address '${hostname}' is prohibited.`
          };
        }

        // Disallow private IPv4 ranges
        if (
          hostname.startsWith('10.') ||
          hostname.startsWith('192.168.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
        ) {
          return {
            allowed: false,
            reason: `Access to private IPv4 network range '${hostname}' is prohibited.`
          };
        }

        // Disallow link-local and cloud metadata addresses
        if (hostname === '169.254.169.254' || hostname.startsWith('169.254.') || hostname.includes('metadata.google.internal')) {
          return {
            allowed: false,
            reason: `Access to cloud metadata address '${hostname}' is strictly blocked.`
          };
        }
      }

      return {
        allowed: true,
        canonicalUrl: parsed.toString()
      };
    } catch (err) {
      return {
        allowed: false,
        reason: `Invalid URL format: ${String(err)}`
      };
    }
  }

  /**
   * Determines if a browser action can proceed under the active autonomy policy
   */
  checkActionPermission(
    actionType: BrowserActionType,
    policy: AutonomyPolicyLevel,
    targetUrl: string,
    actionDetails?: { selector?: string; inputValue?: string }
  ): { allowed: boolean; requiresApproval: boolean; riskLevel: 'low' | 'medium' | 'high' | 'critical'; reason: string } {
    // Read-only actions are always permitted
    if (['NAVIGATE', 'READ_PAGE', 'EXTRACT_TEXT', 'INSPECT_LINKS', 'LOCATE_ELEMENT', 'SCREENSHOT', 'SNAPSHOT', 'SCROLL'].includes(actionType)) {
      return { allowed: true, requiresApproval: false, riskLevel: 'low', reason: 'Safe read-only browsing action' };
    }

    if (actionType === 'CLICK') {
      if (policy === 'READ_ONLY_RESEARCH') {
        return {
          allowed: false,
          requiresApproval: true,
          riskLevel: 'medium',
          reason: `Click interaction blocked under policy '${policy}'. User approval required.`
        };
      }
      return { allowed: true, requiresApproval: false, riskLevel: 'low', reason: 'Interactive navigation click permitted' };
    }

    if (actionType === 'FILL') {
      if (policy === 'READ_ONLY_RESEARCH' || policy === 'INTERACTIVE_NAVIGATION') {
        return {
          allowed: false,
          requiresApproval: true,
          riskLevel: 'high',
          reason: `Form input blocked under policy '${policy}'. User approval required to enter data into '${actionDetails?.selector ?? 'field'}'.`
        };
      }
      return { allowed: true, requiresApproval: false, riskLevel: 'medium', reason: 'Form interaction permitted under policy' };
    }

    return { allowed: true, requiresApproval: false, riskLevel: 'low', reason: 'Action permitted' };
  }

  createApprovalRequest(
    missionId: string,
    actionType: string,
    target: string,
    reason: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): ApprovalRequest {
    const approval: ApprovalRequest = {
      id: uuidv4(),
      missionId,
      actionType,
      target,
      reason,
      riskLevel,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      resolvedAt: null
    };

    repo.createApproval(approval);
    logger.warn(`Approval requested for mission ${missionId}: ${actionType} on ${target}`, { approvalId: approval.id });
    return approval;
  }
}

export const policyEngine = new PolicyEngine();
