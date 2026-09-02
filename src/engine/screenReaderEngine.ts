import { UIElementRegion, ScreenReaderItem } from '../types/finding';

/**
 * Builds the simulated screen reader announcement items and says/should-say diffs.
 */
export function buildScreenReaderItems(regions: UIElementRegion[]): ScreenReaderItem[] {
  // Sort regions by visual reading order
  const sorted = [...regions].sort((a, b) => a.readingOrder - b.readingOrder);
  const items: ScreenReaderItem[] = [];

  const roleCounters: Record<string, number> = {};
  const roleTotals: Record<string, number> = {};

  sorted.forEach((r) => {
    const role = r.role || (r.kind === 'heading' ? 'heading' : r.kind === 'button' ? 'button' : r.kind === 'input' ? 'textbox' : r.kind === 'link' ? 'link' : r.kind === 'image' ? 'image' : 'text');
    roleTotals[role] = (roleTotals[role] || 0) + 1;
  });

  sorted.forEach((region) => {
    const role = region.role || (region.kind === 'heading' ? 'heading' : region.kind === 'button' ? 'button' : region.kind === 'input' ? 'textbox' : region.kind === 'link' ? 'link' : region.kind === 'image' ? 'image' : 'text');
    roleCounters[role] = (roleCounters[role] || 0) + 1;
    const currentPos = roleCounters[role];
    const totalPos = roleTotals[role];

    const rawText = (region.text || '').trim();
    let spokenPhrase = '';
    let shouldSayPhrase = '';
    let isProblematic = false;
    let problemReason = '';

    // Check for generic layer names / empty names
    const isGenericName = !rawText || /^rectangle\s*\d+/i.test(rawText) || /^group\s*\d+/i.test(rawText) || /^frame\s*\d+/i.test(rawText) || /^image\s*\d+/i.test(rawText) || /^vector\s*\d+/i.test(rawText) || /^icon$/i.test(rawText);

    if (region.kind === 'heading') {
      const level = region.headingLevel || 2;
      spokenPhrase = `${rawText || 'Unlabeled heading'}, heading level ${level}`;
      shouldSayPhrase = `${rawText ? rawText : 'Section Title'}, heading level ${level}`;
      if (!rawText) {
        isProblematic = true;
        problemReason = 'Empty heading';
      }
    } else if (region.kind === 'button') {
      if (isGenericName) {
        spokenPhrase = `button, ${rawText || '[empty]'}`;
        shouldSayPhrase = `button, ${guessProperButtonName(rawText) || 'Perform action'}`;
        isProblematic = true;
        problemReason = 'Missing or generic accessible name';
      } else {
        spokenPhrase = `button, ${rawText}`;
        shouldSayPhrase = `button, ${rawText}`;
      }
    } else if (region.kind === 'link') {
      if (['click here', 'read more', 'learn more', 'more', 'details'].includes(rawText.toLowerCase())) {
        spokenPhrase = `link, ${rawText}`;
        shouldSayPhrase = `link, ${rawText} (destination context)`;
        isProblematic = true;
        problemReason = 'Ambiguous link text';
      } else {
        spokenPhrase = `link, ${rawText || 'unnamed link'}`;
        shouldSayPhrase = `link, ${rawText || 'Clear destination link'}`;
        if (!rawText) isProblematic = true;
      }
    } else if (region.kind === 'input') {
      spokenPhrase = `${rawText || 'edit text'}, textbox`;
      shouldSayPhrase = `${rawText || 'Form field label'}, textbox`;
      if (!rawText) {
        isProblematic = true;
        problemReason = 'Unlabeled input';
      }
    } else if (region.kind === 'image') {
      if (isGenericName) {
        spokenPhrase = `image, ${rawText || 'unlabeled graphic'}`;
        shouldSayPhrase = `image, ${guessImageAlt(rawText)}`;
        isProblematic = true;
        problemReason = 'Missing descriptive alt text';
      } else {
        spokenPhrase = `image, ${rawText}`;
        shouldSayPhrase = `image, ${rawText}`;
      }
    } else {
      spokenPhrase = rawText;
      shouldSayPhrase = rawText;
    }

    items.push({
      id: region.id,
      role,
      name: rawText,
      spokenPhrase,
      shouldSayPhrase,
      isProblematic,
      problemReason: problemReason || undefined,
      headingLevel: region.headingLevel,
      positionInSet: totalPos > 1 ? { current: currentPos, total: totalPos } : undefined,
      boundingBox: region.bbox,
    });
  });

  return items;
}

function guessProperButtonName(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('close') || lower.includes('x')) return 'Close';
  if (lower.includes('search') || lower.includes('glass')) return 'Search';
  if (lower.includes('menu') || lower.includes('hamburger')) return 'Open navigation menu';
  if (lower.includes('cart') || lower.includes('bag')) return 'View shopping cart';
  return 'Accessible button label';
}

function guessImageAlt(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('logo')) return 'Company logo';
  if (lower.includes('avatar') || lower.includes('profile')) return 'User profile avatar';
  if (lower.includes('chart') || lower.includes('graph')) return 'Sales growth bar chart';
  return 'Descriptive image explanation or mark decorative';
}

/**
 * Web Speech API synthesizer singleton controller
 */
class SpeechController {
  private synth: SpeechSynthesis | null = null;
  public isSpeaking: boolean = false;
  public rate: number = 1.0;
  public pitch: number = 1.0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  speak(text: string, onEnd?: () => void, onError?: () => void): void {
    if (!this.synth) {
      onEnd?.();
      return;
    }

    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;

    utterance.onend = () => {
      this.isSpeaking = false;
      onEnd?.();
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      this.isSpeaking = false;
      onError?.();
    };

    this.isSpeaking = true;
    this.synth.speak(utterance);
  }

  stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    this.isSpeaking = false;
  }

  pause(): void {
    if (this.synth) {
      this.synth.pause();
    }
  }

  resume(): void {
    if (this.synth) {
      this.synth.resume();
    }
  }
}

export const speechEngine = new SpeechController();
