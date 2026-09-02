/**
 * URL and HTML Live DOM Pipeline Adapter (Phase 3)
 * Implements GEMINI.md §4C security and rendering rules
 */

const BLOCKED_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
];

export function validateLiveUrl(rawUrl: string): { isValid: boolean; error?: string; cleanUrl?: string } {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { isValid: false, error: 'Only HTTP and HTTPS URLs are supported' };
    }

    const host = parsed.hostname;
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(host)) {
        return { isValid: false, error: 'SSRF Guard: Private network and localhost addresses are blocked' };
      }
    }

    return { isValid: true, cleanUrl: parsed.toString() };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Sanitizes and injects <base href="..."> into raw HTML for safe same-origin iframe rendering
 */
export function prepareIframeSrcdoc(html: string, originalUrl: string): string {
  // Strip script tags to prevent execution and cross-origin security issues
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Strip CSP and X-Frame-Options meta tags
  sanitized = sanitized.replace(/<meta[^>]*http-equiv=["']?(?:content-security-policy|x-frame-options)["']?[^>]*>/gi, '');

  // Inject <base href="..."> as first child of <head>
  const baseTag = `<base href="${originalUrl}">`;
  if (/<head>/i.test(sanitized)) {
    sanitized = sanitized.replace(/<head>/i, `<head>${baseTag}`);
  } else {
    sanitized = `<head>${baseTag}</head>${sanitized}`;
  }

  return sanitized;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchUrlFromLocalAI(url: string): Promise<{ html: string; screenshot: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/fetch-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      throw new Error(`Local AI backend returned ${res.status}`);
    }

    const data = await res.json();
    if (!data.html || !data.screenshot) {
      throw new Error('Invalid response format from Local AI URL fetcher');
    }

    return data;
  } catch (error) {
    console.error('Error fetching URL via Local AI Playwright:', error);
    throw error;
  }
}
