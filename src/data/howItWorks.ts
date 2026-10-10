/**
 * "How is this evaluated?" text shown in the info tooltip next to each page title.
 * Every statement here describes what the code actually does for that input type.
 */
export const HOW_IT_WORKS: Record<'image' | 'figma' | 'url', { title: string; steps: string[] }> = {
  image: {
    title: 'How an image is evaluated',
    steps: [
      'Finds the interface elements (text, buttons, headings, pictures) with AI vision: Google Gemini if you added a key, the local AI service if it is running, or a built-in offline detector.',
      'Measures contrast from the real pixels: the darkest and lightest tones of each element give its WCAG contrast ratio.',
      'Estimates target size from pixels. It becomes measured once you pick the export scale.',
      'A picture has no code, so keyboard, screen reader and heading checks are inferred from layout and visible text, and marked Predicted.',
    ],
  },
  figma: {
    title: 'How a Figma file is evaluated',
    steps: [
      'Uses your access token to read the selected frame, and a rendered image of it, from the Figma API.',
      'Works out each element from its layer name (for example "button", "input", "link" or "H2") and its position in the frame.',
      'Contrast uses the exact text and background colours set in the design. If a layer has no solid fill, it samples the rendered image instead.',
      'Reading and focus order follow the layout, top to bottom and then left to right. Prototype links are not used yet.',
      'A design has no code, so labels, keyboard and heading checks are inferred from layer names and visible text, and marked Predicted.',
    ],
  },
  url: {
    title: 'How a website is evaluated',
    steps: [
      'Loads the page: a headless browser fetches its HTML and a full-page screenshot. If that is unavailable it falls back to a public proxy, or you can paste the page HTML into the HTML fallback box.',
      'Removes scripts and lays the page out at 1024px wide, then reads every element\'s real tag, text, ARIA label, size and position.',
      'Contrast comes from the computed text and background colours, and sizes are real CSS pixels, so these results are marked Measured.',
      'Headings, link names and button names are read from the actual code. The screenshot is only the backdrop for the numbered pins.',
      'A static page never enters a focus state, so focus order and focus visibility are predicted.',
    ],
  },
};
