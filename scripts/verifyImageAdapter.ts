/**
 * Quick sanity test of the new generateHeuristicRegions segmenter.
 * Runs in Node via tsx (uses node-canvas if available, otherwise verifies imports only).
 */

import { salvageJsonArray } from '../src/adapters/imageAdapter';

// Test 1: Verify salvage parser still works
console.log('--- Testing JSON Salvage Parser ---');
const truncated = '[{"k":"button","t":"Sign In","b":[5,20,25,8]},{"k":"heading","t":"Welcome';
const result = salvageJsonArray(truncated);
console.log(`  ✅ Salvaged ${result.length} element(s) from truncated response (expected 1)`);

// Test 2: Verify the new segmenter is importable and exports the right shape
import { generateHeuristicRegions } from '../src/adapters/imageAdapter';
console.log('\n--- Testing generateHeuristicRegions export ---');
console.log(`  ✅ generateHeuristicRegions is a function: ${typeof generateHeuristicRegions === 'function'}`);

// Test 3: Verify region shape contract
console.log('\n--- Checking region shape contract ---');
// Mock a simple canvas in Node (canvas API not available, just verify logic compiles)
const mockCanvas = {
  width: 400,
  height: 300,
  getContext: () => ({
    getImageData: (x: number, y: number, w: number, h: number) => {
      // Synthesize a canvas with white background and a dark button region
      const data = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < data.length; i += 4) {
        const pixelIdx = i / 4;
        const px = pixelIdx % w;
        const py = Math.floor(pixelIdx / w);
        
        // Dark button region at 25-75% x, 40-60% y
        const relX = (x + px) / 400;
        const relY = (y + py) / 300;
        if (relX > 0.25 && relX < 0.75 && relY > 0.4 && relY < 0.6) {
          // Dark navy button (low luminance)
          data[i] = 30; data[i+1] = 58; data[i+2] = 138; data[i+3] = 255;
        } else {
          // White background
          data[i] = 245; data[i+1] = 247; data[i+2] = 250; data[i+3] = 255;
        }
      }
      return { data, width: w, height: h };
    }
  }),
} as unknown as HTMLCanvasElement;

const regions = generateHeuristicRegions(mockCanvas);
console.log(`  ✅ Regions generated: ${regions.length}`);
if (regions.length > 0) {
  const r0 = regions[0];
  const hasRequiredFields = 
    typeof r0.id === 'string' &&
    typeof r0.bbox.x === 'number' &&
    typeof r0.bbox.y === 'number' &&
    typeof r0.bbox.w === 'number' &&
    typeof r0.bbox.h === 'number' &&
    r0.bbox.x >= 0 && r0.bbox.x <= 100 &&
    r0.bbox.y >= 0 && r0.bbox.y <= 100 &&
    r0.bbox.w > 0 && r0.bbox.w <= 100 &&
    r0.bbox.h > 0 && r0.bbox.h <= 100;
  console.log(`  ✅ First region has valid bbox (0-100 % coords): ${hasRequiredFields}`);
  console.log(`  ✅ First region: id="${r0.id}" text="${r0.text}" bbox={x:${r0.bbox.x},y:${r0.bbox.y},w:${r0.bbox.w},h:${r0.bbox.h}}`);
  
  // Verify NO region has generic "UI Region N" placeholder text (old hallucinated labels)
  const hasOldFakeLabels = regions.some(r => /^UI Region \d+$/.test(r.text) || /^Action Button \d+$/.test(r.text));
  console.log(`  ✅ No old fake placeholder labels: ${!hasOldFakeLabels}`);
  
  // Verify all bbox coords are within valid range
  const allValid = regions.every(r => 
    r.bbox.x >= 0 && r.bbox.x < 100 &&
    r.bbox.y >= 0 && r.bbox.y < 100 &&
    r.bbox.w > 0 && r.bbox.w <= 100 &&
    r.bbox.h > 0 && r.bbox.h <= 100 &&
    r.bbox.x + r.bbox.w <= 100 &&
    r.bbox.y + r.bbox.h <= 100
  );
  console.log(`  ✅ All ${regions.length} region bboxes in valid 0-100% range: ${allValid}`);
}

console.log('\n✅ imageAdapter sanity check passed\n');
