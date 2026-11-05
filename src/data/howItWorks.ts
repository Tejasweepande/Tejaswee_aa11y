/**
 * "How is this evaluated?" text shown in the info tooltip next to each page title.
 * Every statement describes what the code actually does for that input type.
 * Keep each step to one short line.
 */
export const HOW_IT_WORKS: Record<'image' | 'figma' | 'url', { title: string; steps: string[] }> = {
  image: {
    title: 'How an image is evaluated',
    steps: [
      'Finds UI elements with AI vision. If our built-in readers cannot, you are asked for a Gemini key. Skip it, and a basic offline detector measures contrast zones.',
      'Measures contrast from the real pixels.',
      'Estimates target size; measured once you pick the export scale.',
      'Keyboard, screen reader and heading checks are inferred, so marked Predicted.',
    ],
  },
  figma: {
    title: 'How a Figma file is evaluated',
    steps: [
      'Reads the frame and its image via the Figma API, using your token.',
      'Identifies each element from its layer name and position.',
      'Contrast uses the design\'s exact colours (or sampled pixels if no fill).',
      'Focus order follows layout position; prototype links are not used yet.',
      'Labels, keyboard and heading checks are inferred, so marked Predicted.',
    ],
  },
  url: {
    title: 'How a website is evaluated',
    steps: [
      'Fetches the HTML and a screenshot; if blocked, paste the HTML in the fallback box.',
      'Renders it without scripts and reads each element\'s tag, text, ARIA and size.',
      'Contrast and sizes come from computed styles, so results are Measured.',
      'Names and headings are read from the code; the screenshot just backs the pins.',
      'Focus checks are predicted: a static page has no focus state.',
    ],
  },
};
