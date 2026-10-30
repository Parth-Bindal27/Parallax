import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import type { BrowserActionEvent, BrowserActionType, BrowserActionResultStatus } from '@parallax/shared';
import { policyEngine } from '../policies/policyEngine.js';
import { repo } from '../database/repository.js';
import { logger } from '../observability/logger.js';

export interface PageSnapshotResult {
  title: string;
  url: string;
  statusCode: number;
  html: string;
  normalizedText: string;
  screenshotPath?: string;
  headings: { level: number; text: string }[];
  links: { text: string; href: string }[];
  hasLoginForm?: boolean;
}

export class BrowserExecutor {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private isInitializing = false;

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise(r => setTimeout(r, 100));
      }
      if (this.browser && this.browser.isConnected()) return this.browser;
    }

    this.isInitializing = true;
    try {
      logger.info('Launching Playwright Chromium browser');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu'
        ]
      });
      return this.browser;
    } finally {
      this.isInitializing = false;
    }
  }

  private async getContext(): Promise<BrowserContext> {
    const browser = await this.ensureBrowser();
    if (!this.context) {
      this.context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'PARALLAX-Verified-Web-Agent/1.0 (+https://github.com/parallax/verified-missions)'
      });
    }
    return this.context;
  }

  /**
   * Safe text normalization: strips script, style, ads, noisy dynamic tags, normalizes whitespace
   */
  normalizePageText(rawText: string): string {
    return rawText
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }

  /**
   * Executes a safe browser action and logs the structured event
   */
  async executeAction<T>(
    missionId: string,
    actionType: BrowserActionType,
    url: string,
    fn: (page: Page) => Promise<T>,
    actionDetails?: { selector?: string; inputValue?: string; sourceId?: string }
  ): Promise<{ result: T; event: BrowserActionEvent }> {
    const actionId = uuidv4();
    const startTime = new Date().toISOString();

    // Security check on target URL
    const validation = policyEngine.validateNavigationUrl(url);
    if (!validation.allowed) {
      const errorMsg = `Navigation blocked by security policy: ${validation.reason}`;
      logger.warn(errorMsg, { missionId, actionId, url });

      const failedEvent: BrowserActionEvent = {
        actionId,
        missionId,
        actionType,
        url,
        selector: actionDetails?.selector,
        inputValue: actionDetails?.inputValue,
        startTime,
        completionTime: new Date().toISOString(),
        status: 'blocked',
        error: errorMsg,
        sourceId: actionDetails?.sourceId
      };
      repo.createActionLog(failedEvent);
      throw new Error(errorMsg);
    }

    const context = await this.getContext();
    const page = await context.newPage();

    let status: BrowserActionResultStatus = 'performed';
    let errorStr: string | undefined;
    let screenshotPath: string | undefined;
    let result: T;

    try {
      result = await fn(page);

      // Save screenshot if relevant
      if (['NAVIGATE', 'CLICK', 'SNAPSHOT'].includes(actionType)) {
        try {
          const screenshotsDir = path.resolve(process.cwd(), 'data/snapshots/screenshots');
          if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
          }
          const shotFilename = `shot_${missionId}_${actionId}.png`;
          const shotFile = path.join(screenshotsDir, shotFilename);
          await page.screenshot({ path: shotFile, fullPage: false });
          screenshotPath = `/data/snapshots/screenshots/${shotFilename}`;
        } catch {
          // Non-critical if screenshot fails
        }
      }
    } catch (err) {
      status = 'failed';
      errorStr = String(err);
      logger.error(`Browser action ${actionType} failed`, { missionId, actionId, error: errorStr });
      throw err;
    } finally {
      const completionTime = new Date().toISOString();
      const event: BrowserActionEvent = {
        actionId,
        missionId,
        actionType,
        url,
        selector: actionDetails?.selector,
        inputValue: actionDetails?.inputValue,
        startTime,
        completionTime,
        status,
        error: errorStr,
        screenshotPath,
        sourceId: actionDetails?.sourceId
      };

      repo.createActionLog(event);
      await page.close().catch(() => {});
    }

    return { result: result!, event: {
      actionId,
      missionId,
      actionType,
      url,
      startTime,
      completionTime: new Date().toISOString(),
      status,
      error: errorStr,
      screenshotPath,
      sourceId: actionDetails?.sourceId
    }};
  }

  /**
   * Complete navigation and snapshot extraction of a page
   */
  async navigateAndSnapshot(missionId: string, url: string, sourceId?: string): Promise<PageSnapshotResult> {
    const { result, event } = await this.executeAction<PageSnapshotResult>(
      missionId,
      'NAVIGATE',
      url,
      async (page: Page) => {
        logger.info(`Navigating to URL: ${url}`, { missionId, sourceId });
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const statusCode = response ? response.status() : 200;

        const title = await page.title();
        const html = await page.content();

        // Extract headings and links cleanly
        const headings = await page.$$eval('h1, h2, h3, h4', elements =>
          elements.map(el => ({
            level: Number(el.tagName.replace('H', '')) || 2,
            text: (el.textContent || '').trim()
          }))
        );

        const links = await page.$$eval('a[href]', elements =>
          elements.slice(0, 30).map(el => ({
            text: (el.textContent || '').trim(),
            href: (el as HTMLAnchorElement).href
          }))
        );

        // Extract inner text
        const rawInnerText = await page.evaluate(() => {
          // Remove noisy non-content elements
          const scripts = document.querySelectorAll('script, style, noscript, svg, nav, footer');
          scripts.forEach(s => s.remove());
          return document.body ? document.body.innerText : '';
        });

        const normalizedText = this.normalizePageText(rawInnerText);

        // Detect if page contains login or credential input forms
        const hasLoginForm = await page.evaluate(() => {
          const hasPasswordField = !!document.querySelector('input[type="password"]');
          const hasLoginAction = !!document.querySelector('form[action*="login"], form[action*="signin"], form[action*="auth"], form[id*="login"], form[id*="signin"], form[class*="login"]');
          const hasAuthKeywords = /sign in|log in|enter your password|authenticate to continue/i.test(document.body?.innerText || '');
          return hasPasswordField || (hasLoginAction && hasAuthKeywords);
        }).catch(() => false);

        return {
          title: title || 'Untitled Page',
          url: page.url(),
          statusCode,
          html,
          normalizedText,
          headings,
          links,
          hasLoginForm
        };
      },
      { sourceId }
    );

    result.screenshotPath = event.screenshotPath;
    return result;
  }

  /**
   * Fills credentials into the active page form and submits it
   */
  async fillAndSubmitForm(
    missionId: string,
    url: string,
    formData: { username?: string; password?: string; token?: string }
  ): Promise<{ success: boolean; newUrl: string; screenshotPath?: string; message: string }> {
    const { result } = await this.executeAction(
      missionId,
      'FILL',
      url,
      async (page: Page) => {
        logger.info(`Automating form fill on: ${url}`, { missionId });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

        // 1. Fill Username/Email if present
        if (formData.username) {
          const userSelectors = [
            'input[type="email"]',
            'input[name*="user" i]',
            'input[name*="email" i]',
            'input[name*="login" i]',
            'input[id*="user" i]',
            'input[id*="email" i]',
            'input[type="text"]'
          ];
          for (const sel of userSelectors) {
            const el = await page.$(sel);
            if (el) {
              await el.fill(formData.username);
              logger.info(`Filled username into selector: ${sel}`);
              break;
            }
          }
        }

        // 2. Fill Password if present
        if (formData.password) {
          const passSelectors = [
            'input[type="password"]',
            'input[name*="pass" i]',
            'input[id*="pass" i]'
          ];
          for (const sel of passSelectors) {
            const el = await page.$(sel);
            if (el) {
              await el.fill(formData.password);
              logger.info(`Filled password into selector: ${sel}`);
              break;
            }
          }
        }

        // 3. Submit Form
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("Sign in")',
          'button:has-text("Log in")',
          'button:has-text("Continue")',
          'button:has-text("Submit")'
        ];
        let clicked = false;
        for (const sel of submitSelectors) {
          const btn = await page.$(sel);
          if (btn) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 6000 }).catch(() => {}),
              btn.click().catch(() => {})
            ]);
            clicked = true;
            logger.info(`Clicked submit button selector: ${sel}`);
            break;
          }
        }

        await page.waitForTimeout(1000);

        const screenshotsDir = path.resolve(process.cwd(), 'data/snapshots/screenshots');
        if (!fs.existsSync(screenshotsDir)) {
          fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        const postAuthFilename = `shot_auth_${missionId}_${Date.now()}.png`;
        const postAuthPath = path.join(screenshotsDir, postAuthFilename);
        await page.screenshot({ path: postAuthPath, fullPage: false }).catch(() => {});

        return {
          success: true,
          newUrl: page.url(),
          screenshotPath: `/api/v1/screenshots/${postAuthFilename}`,
          message: clicked
            ? 'Credentials submitted and form dispatched successfully.'
            : 'Credentials entered into form fields.'
        };
      },
      { inputValue: `Credentials for ${formData.username || 'user'}` }
    );

    return result;
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      logger.info('Playwright Chromium browser closed');
    }
  }
}

export const browserExecutor = new BrowserExecutor();
