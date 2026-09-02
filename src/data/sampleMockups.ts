import { UIElementRegion } from '../types/finding';

export interface SampleMockup {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultScale: '1x' | '2x' | '3x';
  regions: UIElementRegion[];
  svgContent: string;
}

// 1. Deliberately Broken SaaS Card (Captures all 10 acceptance test cases from GEMINI.md §10)
const brokenSaasSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" style="background:#FFFFFF; font-family:'Plus Jakarta Sans',sans-serif;">
  <!-- Header / Navigation Bar -->
  <rect x="0" y="0" width="800" height="64" fill="#0F172A" />
  <text x="32" y="40" fill="#FFFFFF" font-size="20" font-weight="bold">CloudScale OS</text>
  
  <!-- First Heading (Incorrectly starts with H3 instead of H1, and skips hierarchy) -->
  <text x="32" y="110" fill="#0F172A" font-size="24" font-weight="bold">Workspace Billing &amp; Subscriptions</text>
  <text x="32" y="140" fill="#777777" font-size="14">Manage team licenses and usage tier</text>

  <!-- Card Container -->
  <rect x="32" y="165" width="736" height="390" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" />

  <!-- Subheading with Skipped Hierarchy -->
  <text x="56" y="205" fill="#0F172A" font-size="16" font-weight="bold">Enterprise Cloud Plan</text>
  
  <!-- Near-miss ratio text: #777777 on #F8FAFC is exactly ~4.48:1 (fails 4.5:1 by 0.02) -->
  <text x="56" y="235" fill="#777777" font-size="13">Renewal date: September 15, 2026 • 24 Active Seats</text>

  <!-- Input without direct accessible label -->
  <text x="56" y="275" fill="#64748B" font-size="12">Discount Coupon</text>
  <rect x="56" y="285" width="260" height="40" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
  <text x="70" y="310" fill="#94A3B8" font-size="13">SUMMER-2026</text>

  <!-- Undersized target button (< 24x24 px) with generic layer name & unlabelled icon -->
  <rect x="325" y="293" width="20" height="20" rx="4" fill="#E2E8F0" />
  <path d="M331 299 L339 307 M339 299 L331 307" stroke="#64748B" stroke-width="1.5" stroke-linecap="round"/>

  <!-- Low Contrast Button: #8A8A8A text on #FFFFFF is 3.45:1 (Fails 4.5:1 AA) -->
  <rect x="56" y="350" width="180" height="44" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" />
  <text x="95" y="377" fill="#8A8A8A" font-size="14" font-weight="600">Export Report</text>

  <!-- Primary Action Button (Proper contrast) -->
  <rect x="250" y="350" width="180" height="44" rx="8" fill="#2563EB" />
  <text x="290" y="377" fill="#FFFFFF" font-size="14" font-weight="600">Upgrade Plan</text>

  <!-- Ambiguous Link ("Click here") -->
  <text x="56" y="425" fill="#2563EB" font-size="13" text-decoration="underline">Click here</text>
  <text x="125" y="425" fill="#64748B" font-size="13">to view billing history and tax certificates.</text>

  <!-- Div onClick mock element -->
  <rect x="56" y="460" width="374" height="40" rx="6" fill="#FEF3C7" stroke="#FDE68A" />
  <text x="72" y="485" fill="#92400E" font-size="13" font-weight="500">⚡ Instant Add-on: Activate High Performance GPU</text>

  <!-- Unlabeled Image Graphic -->
  <rect x="470" y="200" width="270" height="200" rx="8" fill="#E2E8F0" />
  <circle cx="605" cy="280" r="40" fill="#CBD5E1" />
  <path d="M520 370 L580 300 L640 350 L710 270" stroke="#94A3B8" stroke-width="3" fill="none" stroke-linecap="round" />
  <text x="545" y="385" fill="#94A3B8" font-size="12">Analytics_chart_v2.png</text>
</svg>`;

const brokenSaasRegions: UIElementRegion[] = [
  {
    id: 'broken-head-01',
    kind: 'heading',
    text: 'Workspace Billing & Subscriptions',
    headingLevel: 2, // First heading is H2 (fails H1 check)
    readingOrder: 1,
    bbox: { x: 4.0, y: 15.0, w: 55.0, h: 6.0 },
  },
  {
    id: 'broken-desc-01',
    kind: 'text',
    text: 'Manage team licenses and usage tier',
    readingOrder: 2,
    bbox: { x: 4.0, y: 22.0, w: 45.0, h: 4.0 },
  },
  {
    id: 'broken-subhead-02',
    kind: 'heading',
    text: 'Enterprise Cloud Plan',
    headingLevel: 4, // Skipped H2!
    readingOrder: 3,
    bbox: { x: 7.0, y: 32.0, w: 35.0, h: 5.0 },
  },
  {
    id: 'broken-nearmiss-01',
    kind: 'text',
    text: 'Renewal date: September 15, 2026 • 24 Active Seats',
    readingOrder: 4,
    bbox: { x: 7.0, y: 38.0, w: 50.0, h: 4.0 },
  },
  {
    id: 'broken-input-01',
    kind: 'input',
    text: 'SUMMER-2026',
    accessibleName: '', // Unlabeled input
    role: 'textbox',
    isInteractive: true,
    readingOrder: 5,
    bbox: { x: 7.0, y: 47.0, w: 32.5, h: 7.0 },
    hasVisibleFocus: false,
  },
  {
    id: 'broken-btn-undersized',
    kind: 'button',
    text: 'Rectangle 47', // Generic layer name
    accessibleName: '',
    role: 'button',
    isInteractive: true,
    readingOrder: 6,
    bbox: { x: 40.6, y: 48.8, w: 2.5, h: 3.3 }, // 20x20px -> fails 24x24
    hasVisibleFocus: false,
  },
  {
    id: 'broken-btn-lowcontrast',
    kind: 'button',
    text: 'Export Report',
    role: 'button',
    isInteractive: true,
    readingOrder: 7,
    bbox: { x: 7.0, y: 58.3, w: 22.5, h: 7.5 },
    hasVisibleFocus: true,
  },
  {
    id: 'broken-btn-primary',
    kind: 'button',
    text: 'Upgrade Plan',
    role: 'button',
    isInteractive: true,
    readingOrder: 8,
    bbox: { x: 31.2, y: 58.3, w: 22.5, h: 7.5 },
    hasVisibleFocus: true,
  },
  {
    id: 'broken-link-ambiguous',
    kind: 'link',
    text: 'Click here',
    role: 'link',
    isInteractive: true,
    readingOrder: 9,
    bbox: { x: 7.0, y: 70.0, w: 9.0, h: 4.0 },
    hasVisibleFocus: true,
  },
  {
    id: 'broken-div-onclick',
    kind: 'button',
    text: 'Instant Add-on: Activate High Performance GPU',
    role: 'button',
    isInteractive: true,
    hasOnClickWithoutKeyboard: true, // <div onClick>
    readingOrder: 10,
    bbox: { x: 7.0, y: 76.5, w: 46.8, h: 6.8 },
    hasVisibleFocus: false,
  },
  {
    id: 'broken-img-unlabeled',
    kind: 'image',
    text: 'Analytics_chart_v2.png',
    role: 'image',
    readingOrder: 11,
    bbox: { x: 58.7, y: 33.3, w: 33.8, h: 33.3 },
  },
];

// 2. High-Contrast Accessible E-Commerce Checkout
const accessibleStoreSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" style="background:#0F172A; font-family:'Plus Jakarta Sans',sans-serif;">
  <rect x="0" y="0" width="800" height="64" fill="#1E293B" />
  <text x="32" y="40" fill="#F8FAFC" font-size="20" font-weight="bold">Acme Gear Store</text>

  <text x="32" y="115" fill="#F8FAFC" font-size="28" font-weight="800">1. Checkout &amp; Payment</text>
  <text x="32" y="145" fill="#94A3B8" font-size="15">Review your order details and confirm payment method</text>

  <rect x="32" y="170" width="736" height="380" rx="12" fill="#1E293B" stroke="#334155" stroke-width="1.5" />

  <text x="56" y="215" fill="#F8FAFC" font-size="18" font-weight="700">2. Shipping Address</text>
  
  <text x="56" y="260" fill="#E2E8F0" font-size="14" font-weight="600">Full Name</text>
  <rect x="56" y="275" width="320" height="48" rx="8" fill="#0F172A" stroke="#475569" stroke-width="1.5" />
  <text x="72" y="305" fill="#F8FAFC" font-size="14">Alex Morgan</text>

  <text x="400" y="260" fill="#E2E8F0" font-size="14" font-weight="600">Postal Code</text>
  <rect x="400" y="275" width="200" height="48" rx="8" fill="#0F172A" stroke="#475569" stroke-width="1.5" />
  <text x="416" y="305" fill="#F8FAFC" font-size="14">94107</text>

  <!-- Large accessible button (14.5:1 contrast, 48px height) -->
  <rect x="56" y="360" width="220" height="48" rx="8" fill="#38BDF8" />
  <text x="105" y="390" fill="#090B0E" font-size="15" font-weight="700">Confirm &amp; Pay $149</text>

  <rect x="290" y="360" width="160" height="48" rx="8" fill="transparent" stroke="#64748B" stroke-width="2" />
  <text x="325" y="390" fill="#F8FAFC" font-size="15" font-weight="600">Return to Cart</text>

  <text x="56" y="450" fill="#38BDF8" font-size="14" font-weight="600" text-decoration="underline">View delivery guarantees &amp; returns policy</text>
</svg>`;

const accessibleStoreRegions: UIElementRegion[] = [
  {
    id: 'acc-h1',
    kind: 'heading',
    text: 'Checkout & Payment',
    headingLevel: 1,
    readingOrder: 1,
    bbox: { x: 4.0, y: 15.0, w: 45.0, h: 6.0 },
  },
  {
    id: 'acc-desc',
    kind: 'text',
    text: 'Review your order details and confirm payment method',
    readingOrder: 2,
    bbox: { x: 4.0, y: 22.0, w: 55.0, h: 4.0 },
  },
  {
    id: 'acc-h2',
    kind: 'heading',
    text: 'Shipping Address',
    headingLevel: 2,
    readingOrder: 3,
    bbox: { x: 7.0, y: 33.0, w: 30.0, h: 5.0 },
  },
  {
    id: 'acc-input-1',
    kind: 'input',
    text: 'Alex Morgan',
    accessibleName: 'Full Name',
    role: 'textbox',
    isInteractive: true,
    readingOrder: 4,
    bbox: { x: 7.0, y: 45.8, w: 40.0, h: 8.0 },
    hasVisibleFocus: true,
  },
  {
    id: 'acc-input-2',
    kind: 'input',
    text: '94107',
    accessibleName: 'Postal Code',
    role: 'textbox',
    isInteractive: true,
    readingOrder: 5,
    bbox: { x: 50.0, y: 45.8, w: 25.0, h: 8.0 },
    hasVisibleFocus: true,
  },
  {
    id: 'acc-btn-pay',
    kind: 'button',
    text: 'Confirm & Pay $149',
    role: 'button',
    isInteractive: true,
    readingOrder: 6,
    bbox: { x: 7.0, y: 60.0, w: 27.5, h: 8.0 },
    hasVisibleFocus: true,
  },
  {
    id: 'acc-btn-cart',
    kind: 'button',
    text: 'Return to Cart',
    role: 'button',
    isInteractive: true,
    readingOrder: 7,
    bbox: { x: 36.2, y: 60.0, w: 20.0, h: 8.0 },
    hasVisibleFocus: true,
  },
  {
    id: 'acc-link-returns',
    kind: 'link',
    text: 'View delivery guarantees & returns policy',
    role: 'link',
    isInteractive: true,
    readingOrder: 8,
    bbox: { x: 7.0, y: 73.0, w: 50.0, h: 4.0 },
    hasVisibleFocus: true,
  },
];

export const SAMPLE_MOCKUPS: SampleMockup[] = [
  {
    id: 'broken-saas',
    name: 'SaaS Billing Portal (WCAG Violation Demo)',
    category: 'Broken Test Case',
    description: 'Contains all 10 deliberate WCAG 2.2 barriers: 3.45:1 contrast button, 4.48:1 near-miss, 20px target size, skipped headings, unlabeled button.',
    defaultScale: '1x',
    regions: brokenSaasRegions,
    svgContent: brokenSaasSvg,
  },
  {
    id: 'accessible-store',
    name: 'Accessible E-Commerce Checkout',
    category: 'Passing Benchmark',
    description: 'Fully compliant WCAG 2.2 AA flow with 14.5:1 contrast, 48px hit targets, sequential H1/H2 hierarchy, and descriptive links.',
    defaultScale: '1x',
    regions: accessibleStoreRegions,
    svgContent: accessibleStoreSvg,
  },
];
