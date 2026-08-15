/**
 * Visual Verification Helper — uses OpenAI GPT-4o vision to validate screenshots.
 *
 * Takes screenshots during E2E tests, sends them to OpenAI for visual validation,
 * and saves results. On failure, writes a report the VS Code agent can review.
 *
 * Usage in tests:
 *   import { VisualVerifier } from './visual-verify';
 *   const verifier = new VisualVerifier('test-name');
 *   const result = await verifier.verify(frame, 'after-station-upgrade',
 *     'Station should show an orange progress bar labeled UPGRADING with a percentage'
 *   );
 *   expect(result.pass).toBe(true);
 *   // At end of test:
 *   verifier.writeReport();
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Frame } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCREENSHOTS_DIR = join(__dirname, '..', '..', 'test-screenshots');
const KEY_FILE = join(__dirname, '.openai-key');

function getApiKey(): string {
  return readFileSync(KEY_FILE, 'utf-8').trim();
}

export interface VerifyResult {
  pass: boolean;
  explanation: string;
  screenshot: string;
  label: string;
  expectation: string;
}

export class VisualVerifier {
  private testName: string;
  private results: VerifyResult[] = [];
  private dir: string;

  constructor(testName: string) {
    this.testName = testName;
    this.dir = join(SCREENSHOTS_DIR, testName);
    mkdirSync(this.dir, { recursive: true });
  }

  /**
   * Capture a screenshot and ask OpenAI vision if it matches the expectation.
   * @param frame - The game iframe
   * @param label - Short label (e.g. 'station-upgrading')
   * @param expectation - What should be visible (natural language)
   * @returns VerifyResult with pass/fail and AI explanation
   */
  async verify(frame: Frame, label: string, expectation: string): Promise<VerifyResult> {
    const filename = `${label}-${Date.now()}.png`;
    const filepath = join(this.dir, filename);

    // Capture screenshot
    try {
      const canvas = frame.locator('#game-canvas');
      if (await canvas.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await canvas.screenshot({ path: filepath });
      } else {
        await frame.locator('body').screenshot({ path: filepath });
      }
    } catch {
      await frame.page().screenshot({ path: filepath });
    }

    // Send to OpenAI vision for validation
    const result = await this.askVision(filepath, expectation, label);
    this.results.push(result);

    if (result.pass) {
      console.log(`[VISUAL] ✓ ${label}: ${result.explanation}`);
    } else {
      console.log(`[VISUAL] ✗ ${label}: ${result.explanation}`);
    }

    return result;
  }

  private async askVision(imagePath: string, expectation: string, label: string): Promise<VerifyResult> {
    const apiKey = getApiKey();
    const imageBuffer = readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = `You are a QA tester validating a game screenshot. The game is "Valcordia Space" — a space strategy game rendered on an HTML canvas with wireframe/retro styling (dark background, colored text, orange/green UI elements).

EXPECTATION: "${expectation}"

Look at the screenshot and determine if the expectation is met. Respond in this exact JSON format:
{"pass": true/false, "explanation": "Brief 1-2 sentence explanation of what you see and why it passes or fails"}

Be strict but reasonable — the game uses monospace text, canvas rendering, and wireframe aesthetics. Look for the specific elements mentioned in the expectation.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } },
              ],
            },
          ],
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return {
          pass: false,
          explanation: `OpenAI API error (${response.status}): ${errText.substring(0, 200)}`,
          screenshot: imagePath,
          label,
          expectation,
        };
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? '';

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { pass: boolean; explanation: string };
        return {
          pass: parsed.pass,
          explanation: parsed.explanation,
          screenshot: imagePath,
          label,
          expectation,
        };
      }

      return {
        pass: false,
        explanation: `Could not parse AI response: ${content.substring(0, 200)}`,
        screenshot: imagePath,
        label,
        expectation,
      };
    } catch (err) {
      return {
        pass: false,
        explanation: `Vision API call failed: ${String(err)}`,
        screenshot: imagePath,
        label,
        expectation,
      };
    }
  }

  /**
   * Write the verification report. Call at end of test.
   * Creates a markdown report + JSON with all results.
   */
  writeReport(): string {
    const reportPath = join(this.dir, 'REVIEW.md');
    const jsonPath = join(this.dir, 'results.json');

    writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));

    const failures = this.results.filter(r => !r.pass);
    const lines: string[] = [
      `# Visual Verification Report: ${this.testName}`,
      ``,
      `Generated: ${new Date().toISOString()}`,
      `Total checks: ${this.results.length}`,
      `Passed: ${this.results.length - failures.length}`,
      `Failed: ${failures.length}`,
      ``,
    ];

    if (failures.length > 0) {
      lines.push(`## ⚠ FAILURES`);
      lines.push(``);
      for (const r of failures) {
        lines.push(`### ${r.label}`);
        lines.push(`- **Expected:** ${r.expectation}`);
        lines.push(`- **AI says:** ${r.explanation}`);
        lines.push(`- **Screenshot:** \`${r.screenshot}\``);
        lines.push(``);
      }
    }

    lines.push(`## All Results`);
    lines.push(``);
    for (const r of this.results) {
      const icon = r.pass ? '✓' : '✗';
      lines.push(`- ${icon} **${r.label}**: ${r.explanation}`);
      lines.push(`  - Expected: ${r.expectation}`);
      lines.push(`  - Image: \`${r.screenshot}\``);
    }

    writeFileSync(reportPath, lines.join('\n'));
    console.log(`[VISUAL] Report: ${reportPath}`);

    return reportPath;
  }
}
