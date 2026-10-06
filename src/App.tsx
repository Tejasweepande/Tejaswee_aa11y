import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  InputMode,
  ExportScale,
  ModuleType,
  Finding,
  UIElementRegion,
  ScreenReaderItem,
  AuditHistoryItem,
} from './types/finding';
import { SAMPLE_MOCKUPS } from './data/sampleMockups';
import { sampleDecileCore, DecileSampleResult } from './engine/decileSampling';
import { auditElements } from './engine/wcagRules';
import { buildScreenReaderItems } from './engine/screenReaderEngine';
import {
  extractRegionsFromImageViaGemini,
  extractRegionsFromLocalAI,
  generateHeuristicRegions,
} from './adapters/imageAdapter';
import { validateLiveUrl, prepareIframeSrcdoc, fetchUrlFromLocalAI } from './adapters/urlAdapter';
import { extractFromDOM } from './engine/domEngine';
import { parseFigmaUrl, fetchFigmaNode, fetchFigmaImage, extractFromFigma } from './adapters/figmaAdapter';
import { getContrastRatio } from './engine/colorUtils';

import { InputPanel } from './components/InputPanel';
import { PreviewCanvas, CanvasMode } from './components/PreviewCanvas';
import { IssueRail } from './components/IssueRail';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ReportModal } from './components/ReportModal';

import {
  Sparkles,
  AlertCircle,
  Sun,
  Moon,
  ArrowLeft,
} from 'lucide-react';

export const App: React.FC = () => {
  // Theme State (default to crisp modern Light Theme per user request)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Application State
  const [inputMode, setInputMode] = useState<InputMode>('image');
  const [exportScale, setExportScale] = useState<ExportScale>('1x');
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>('broken-saas');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [iframeHtml, setIframeHtml] = useState<string | null>(null);
  const [regions, setRegions] = useState<UIElementRegion[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [exemptedCount, setExemptedCount] = useState<number>(0);
  const [exemptedDetails, setExemptedDetails] = useState<any[]>([]);
  const [screenReaderItems, setScreenReaderItems] = useState<ScreenReaderItem[]>([]);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [hoveredFindingId, setHoveredFindingId] = useState<string | null>(null);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('overlay');
  const [hasAudited, setHasAudited] = useState<boolean>(false);
  const [pastAudits, setPastAudits] = useState<AuditHistoryItem[]>([]);
  const [viewStep, setViewStep] = useState<'upload' | 'results'>('upload');

  const [moduleToggles, setModuleToggles] = useState<Record<ModuleType, boolean>>({
    contrast: true,
    keyboard: true,
    screenreader: true,
    structure: true,
  });

  const [isAuditing, setIsAuditing] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  // The header's Export Report button appears only after the report has been opened once for this audit.
  const [hasViewedReport, setHasViewedReport] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [webUrl, setWebUrl] = useState<string>('');
  const [pastedHtml, setPastedHtml] = useState<string>('');
  const [figmaUrl, setFigmaUrl] = useState<string>('');
  const [figmaPat, setFigmaPat] = useState<string>('');
  const [imageFileName, setImageFileName] = useState<string>('');

  const [auditNotice, setAuditNotice] = useState<{
    type: 'success' | 'warning' | 'info' | 'error';
    message: string;
  } | null>(null);

  // Sync theme with document class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Hidden audit canvas for decile pixel sampling
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);

  const saveToHistory = useCallback((
    auditResultMode: InputMode,
    targetRegions: UIElementRegion[],
    activeFindings: Finding[],
    srItems: ScreenReaderItem[],
    auditExemptedCount: number,
    auditExemptedDetails: any[],
    auditImageSrc: string | null,
    auditIframeHtml: string | null,
    auditImageFileName: string,
    auditFigmaUrl: string,
    auditWebUrl: string,
    auditPastedHtml: string,
    auditExportScale: ExportScale,
    currentModuleToggles: Record<ModuleType, boolean>
  ) => {
    let label = 'Audit Run';
    if (auditResultMode === 'image') {
      label = auditImageFileName || 'Image Upload';
    } else if (auditResultMode === 'figma') {
      if (auditFigmaUrl) {
        try {
          const urlObj = new URL(auditFigmaUrl);
          const parts = urlObj.pathname.split('/');
          const namePart = parts[parts.length - 1];
          if (namePart) {
            label = decodeURIComponent(namePart).replace(/-/g, ' ');
          } else {
            label = auditFigmaUrl;
          }
        } catch {
          label = 'Figma Node';
        }
      } else {
        label = 'Figma Node';
      }
    } else if (auditResultMode === 'url') {
      if (auditWebUrl) {
        try {
          label = new URL(auditWebUrl).hostname;
        } catch {
          label = auditWebUrl;
        }
      } else {
        label = 'HTML Snippet';
      }
    }

    const historyItem: AuditHistoryItem = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      inputMode: auditResultMode,
      label,
      regionsCount: targetRegions.length,
      findingsCount: activeFindings.length,
      imageSrc: auditImageSrc,
      iframeHtml: auditIframeHtml,
      figmaUrl: auditFigmaUrl,
      webUrl: auditWebUrl,
      pastedHtml: auditPastedHtml,
      regions: targetRegions,
      findings: activeFindings,
      screenReaderItems: srItems,
      exemptedCount: auditExemptedCount,
      exemptedDetails: auditExemptedDetails,
      moduleToggles: currentModuleToggles,
      exportScale: auditExportScale,
    };
    setPastAudits((prev) => [historyItem, ...prev]);
  }, []);

  const executeAuditOnRegions = useCallback((
    targetRegions: UIElementRegion[],
    imgElement: HTMLImageElement,
    currentScale: ExportScale,
    currentInputMode: InputMode,
    currentImageSrc: string | null,
    currentIframeHtml: string | null,
    currentImageFileName: string,
    currentFigmaUrl: string,
    currentWebUrl: string,
    currentPastedHtml: string
  ) => {
    const canvas = hiddenCanvasRef.current || document.createElement('canvas');
    const width = imgElement.naturalWidth || imgElement.width || 800;
    const height = imgElement.naturalHeight || imgElement.height || 600;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      setIsAuditing(false);
      return;
    }

    ctx.drawImage(imgElement, 0, 0, width, height);

    // 1. Decile-Core pixel sampling for all regions
    const sampleMap = new Map<string, DecileSampleResult>();
    targetRegions.forEach((region) => {
      // Use literal styles if available (Figma)
      if (currentInputMode === 'figma' && region.styles?.color && region.styles?.backgroundColor) {
        const fg = region.styles.color;
        const bg = region.styles.backgroundColor;
        const ratio = getContrastRatio(fg, bg);
        sampleMap.set(region.id, {
          darkestHex: fg,
          lightestHex: bg,
          darkestDecileRgb: { r: 0, g: 0, b: 0 }, // Mock
          lightestDecileRgb: { r: 255, g: 255, b: 255 }, // Mock
          ratio,
          spread: 1, // Max spread
          isSampleable: true,
          sampleCount: 1,
        });
      } else {
        const sample = sampleDecileCore(ctx, region.bbox, width, height);
        if (sample) {
          sampleMap.set(region.id, sample);
        }
      }
    });

    // 5. Run audit engine (R1, R2, R5, R7 applied here)
    const auditResult = auditElements(targetRegions, sampleMap, {
      inputMode: currentInputMode,
      exportScale: currentScale,
      canvasWidth: width,
      canvasHeight: height,
    });
    
    const allFindings = auditResult.findings;
    setExemptedCount(auditResult.exemptedCount);
    setExemptedDetails(auditResult.exemptedDetails);

    // Filter by active module toggles
    const activeFindings = allFindings.filter((f) => moduleToggles[f.module]);

    // 3. Screen Reader simulation tree
    const srItems = buildScreenReaderItems(targetRegions);

    setFindings(activeFindings);
    setScreenReaderItems(srItems);
    setHasAudited(true);
    setIsAuditing(false);
    setViewStep('results');

    saveToHistory(
      currentInputMode,
      targetRegions,
      activeFindings,
      srItems,
      auditResult.exemptedCount,
      auditResult.exemptedDetails,
      currentImageSrc,
      currentIframeHtml,
      currentImageFileName,
      currentFigmaUrl,
      currentWebUrl,
      currentPastedHtml,
      currentScale,
      moduleToggles
    );

    const announcement = `Audit complete. Found ${activeFindings.length} accessibility barriers across ${targetRegions.length} regions.`;
    setLiveAnnouncement(announcement);
  }, [inputMode, moduleToggles]);

  const handleLoadHistoryItem = useCallback((item: AuditHistoryItem) => {
    setImageSrc(item.imageSrc);
    setIframeHtml(item.iframeHtml);
    // don't have imageFileName in history item currently, maybe we can keep it as is or pull from label
    if (item.inputMode === 'image') setImageFileName(item.label);
    setFigmaUrl(item.figmaUrl);
    setWebUrl(item.webUrl);
    setPastedHtml(item.pastedHtml);
    setRegions(item.regions);
    setFindings(item.findings);
    setScreenReaderItems(item.screenReaderItems);
    setExemptedCount(item.exemptedCount);
    setExemptedDetails(item.exemptedDetails);
    setModuleToggles(item.moduleToggles);
    setExportScale(item.exportScale);
    setHasAudited(true);
    setHasViewedReport(false);
    setInputMode(item.inputMode);
    setViewStep('results');

    // Switch to overlay mode on load
    setCanvasMode('overlay');
  }, []);

  // Removed initial sample mockup on mount to require explicit user upload


  const handleImageUploaded = (dataUrl: string, name: string) => {
    setSelectedSampleId(null);
    setImageSrc(dataUrl);
    setImageFileName(name);
    setSelectedFindingId(null);
    setHoveredFindingId(null);

    const img = new Image();
    img.onload = () => {
      setAuditNotice({
        type: 'info',
        message: `Image "${name}" (${img.naturalWidth || img.width}×${img.naturalHeight || img.height}) loaded. Click "Run Accessibility Audit" to inspect.`,
      });
      setLiveAnnouncement(`Image ${name} loaded.`);
      
      // Auto-run offline segmentation immediately so canvas is alive (without running full audit yet)
      const canvas = hiddenCanvasRef.current || document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 800;
      canvas.height = img.naturalHeight || img.height || 600;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const heuristic = generateHeuristicRegions(canvas);
        setRegions(heuristic);
      }
    };
    img.src = dataUrl;
  };

  /**
   * Deterministic Audit Execution (Rules R1, R2, R5)
   * Triggered when the user explicitly clicks the Audit button!
   */
  const handleRunAudit = async () => {
    setIsAuditing(true);
    setLiveAnnouncement('Starting deterministic accessibility audit...');

    // Clear old state immediately
    setRegions([]);
    setFindings([]);
    setScreenReaderItems([]);
    setHasAudited(false);
    setHasViewedReport(false);
    setSelectedSampleId(null);
    
    if (inputMode === 'figma') {
      setImageSrc(null);
      setIframeHtml(null);

      if (!figmaUrl.trim() || !figmaPat.trim()) {
        setAuditNotice({ type: 'error', message: 'Figma URL and Personal Access Token (PAT) are required.' });
        setIsAuditing(false);
        return;
      }

      const figmaInfo = parseFigmaUrl(figmaUrl);
      if (!figmaInfo) {
        setAuditNotice({ type: 'error', message: 'Invalid Figma URL. Use a /proto/ or /design/ link.' });
        setIsAuditing(false);
        return;
      }

      setAuditNotice({ type: 'info', message: 'Fetching design from Figma API...' });
      try {
        const rootData = await fetchFigmaNode(figmaInfo.fileKey, figmaInfo.nodeId, figmaPat) as any;
        const node = rootData.nodes[figmaInfo.nodeId].document;
        
        const imageUrl = await fetchFigmaImage(figmaInfo.fileKey, figmaInfo.nodeId, figmaPat);
        setImageSrc(imageUrl);

        // Preload image to get dimensions for geometric extraction
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
           const width = img.naturalWidth || img.width || 800;
           const height = img.naturalHeight || img.height || 600;
           const bbox = node.absoluteBoundingBox || { x: 0, y: 0, width, height };
           
           const { regions: figmaRegions } = extractFromFigma(node, bbox.width, bbox.height, bbox.x, bbox.y);
           
           if (figmaRegions.length === 0) {
             setAuditNotice({ type: 'warning', message: 'No regions extracted from Figma node. Check token scope and node-id.' });
             setIsAuditing(false);
             return;
           }

           setRegions(figmaRegions);
           executeAuditOnRegions(figmaRegions, img, '1x', 'figma', imageUrl, null, '', figmaUrl, '', '');
           setAuditNotice({ type: 'success', message: `Figma node audited: ${figmaRegions.length} elements extracted deterministically.` });
        };
        img.onerror = () => {
           throw new Error('Failed to load Figma preview image due to CORS or network error.');
        };
        img.src = imageUrl;

      } catch (err: any) {
        setAuditNotice({ type: 'error', message: err.message || 'Figma API Error' });
        setIsAuditing(false);
      }
      return;
    }

    if (inputMode === 'url') {
      let html = '';
      let cleanUrl = 'about:blank';
      let currentUrlImageSrc: string | null = null;
      
      setImageSrc(null);
      
      if (webUrl.trim()) {
        const { isValid, error, cleanUrl: parsedUrl } = validateLiveUrl(webUrl);
        if (!isValid || !parsedUrl) {
          setAuditNotice({ type: 'error', message: error || 'Invalid URL format' });
          setIsAuditing(false);
          return;
        }
        cleanUrl = parsedUrl;
      }

      if (pastedHtml.trim()) {
        html = pastedHtml;
        setAuditNotice({ type: 'info', message: 'Processing pasted HTML fallback...' });
      } else if (cleanUrl !== 'about:blank') {
        setAuditNotice({ type: 'info', message: `Fetching ${cleanUrl} via Local AI Playwright...` });
        try {
          const res = await fetchUrlFromLocalAI(cleanUrl);
          html = res.html;
          currentUrlImageSrc = res.screenshot;
          setImageSrc(res.screenshot);
        } catch (err) {
          setAuditNotice({ type: 'warning', message: `Local AI failed, falling back to public CORS proxy...` });
          try {
            const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`);
            if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
            html = await res.text();
            currentUrlImageSrc = `https://image.thum.io/get/width/1200/crop/800/noanimate/${cleanUrl}`;
            setImageSrc(currentUrlImageSrc);
          } catch (proxyErr) {
            setAuditNotice({ type: 'error', message: `Failed to fetch URL: ${proxyErr}. Try pasting the HTML directly below.` });
            setIsAuditing(false);
            return;
          }
        }
      } else {
        setAuditNotice({ type: 'error', message: 'Please enter a URL or paste HTML.' });
        setIsAuditing(false);
        return;
      }
      
      const safeHtml = prepareIframeSrcdoc(html, cleanUrl);
      setIframeHtml(safeHtml);
      setAuditNotice({ type: 'success', message: 'DOM Loaded. Extracting accessibility tree...' });
      
      const hiddenIframe = document.createElement('iframe');
      // Position off-screen instead of display: none to allow layout calculation
      hiddenIframe.style.position = 'absolute';
      hiddenIframe.style.left = '-9999px';
      hiddenIframe.style.visibility = 'hidden';
      hiddenIframe.style.width = '1024px';
      hiddenIframe.style.height = '768px';
      
      hiddenIframe.sandbox.add('allow-same-origin');
      document.body.appendChild(hiddenIframe);
      
      hiddenIframe.onload = () => {
        try {
          const doc = hiddenIframe.contentDocument;
          if (doc) {
             // Use the page's real full content height for every pin's percentage
             // math, not the fixed 768px measuring box - real pages are almost
             // always taller than that, and dividing by a fixed height stretched
             // every pin's box hugely out of proportion once shown against the
             // actual (correctly full-height) preview container.
             const actualHeight = Math.max(
               doc.documentElement?.scrollHeight || 0,
               doc.body?.scrollHeight || 0,
               768
             );
             const { regions: domRegions, samples } = extractFromDOM(doc, { width: 1024, height: actualHeight });
             
             if (domRegions.length < 3) {
               setAuditNotice({ type: 'warning', message: 'Fewer than 3 elements extracted from DOM. Verify URL allows proxying, or paste HTML directly.' });
             } else {
               setRegions(domRegions);
               
               const auditResult = auditElements(domRegions, samples, {
                 inputMode,
                 exportScale: '1x',
               });
               
               const allFindings = auditResult.findings;
               setExemptedCount(auditResult.exemptedCount);
               setExemptedDetails(auditResult.exemptedDetails);
               
               const activeFindings = allFindings.filter((f) => moduleToggles[f.module]);
               const srItems = buildScreenReaderItems(domRegions);

               setFindings(activeFindings);
               setScreenReaderItems(srItems);
               setHasAudited(true);
               setViewStep('results');
               setLiveAnnouncement(`Audit complete. Found ${activeFindings.length} accessibility barriers.`);
               setAuditNotice({ type: 'success', message: `Live DOM Audited: ${domRegions.length} elements mapped deterministically.` });

               saveToHistory(
                 'url',
                 domRegions,
                 activeFindings,
                 srItems,
                 auditResult.exemptedCount,
                 auditResult.exemptedDetails,
                 currentUrlImageSrc,
                 safeHtml,
                 '',
                 '',
                 webUrl,
                 pastedHtml,
                 '1x',
                 moduleToggles
               );
             }
          }
        } catch (e) {
           setAuditNotice({ type: 'error', message: `DOM Extraction failed: ${e}` });
        } finally {
          document.body.removeChild(hiddenIframe);
          setIsAuditing(false);
        }
      };
      hiddenIframe.srcdoc = safeHtml;
      
      return;
    }

    if (!imageSrc) {
       setIsAuditing(false);
       return;
    }

    const img = new Image();
    img.onload = async () => {
      let targetRegions: UIElementRegion[] = [];
      let isPartial = false;
      let aiErrorNotice = '';

      // 1. If an explicit benchmark is loaded, use its calibrated regions
      if (selectedSampleId) {
        const sample = SAMPLE_MOCKUPS.find((s) => s.id === selectedSampleId);
        targetRegions = sample ? sample.regions : regions;
      } else {
        // 2. Try Google Gemini Vision API (Gemini 3.6 Flash) if key provided
        if (geminiApiKey.trim()) {
          setAuditNotice({ type: 'info', message: 'Calling Google Gemini Vision API (Gemini 3.6 Flash) to identify UI elements...' });
          try {
            const res = await extractRegionsFromImageViaGemini(imageSrc, geminiApiKey);
            targetRegions = res.regions;
            isPartial = res.isPartial;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn('[Gemini Vision API error]', msg);
            aiErrorNotice = `Gemini API: ${msg}`;
          }
        }

        // 3. Try Local Offline AI (Python Backend) if Gemini was not used or failed
        if (targetRegions.length === 0) {
          setAuditNotice({ type: 'info', message: 'Calling Local AI Backend (Hugging Face YOLOv11) to identify UI elements...' });
          try {
            const res = await extractRegionsFromLocalAI(imageSrc);
            targetRegions = res.regions;
            isPartial = res.isPartial;
            aiErrorNotice = ''; // Clear error if local AI succeeds
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn('[Local AI error]', msg);
            aiErrorNotice = aiErrorNotice ? `${aiErrorNotice} | Local AI: ${msg}` : `Local AI: ${msg}`;
          }
        }

        // 4. Resilient Offline local Computer Vision fallback
        if (targetRegions.length === 0) {
          const canvas = hiddenCanvasRef.current || document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 800;
          canvas.height = img.naturalHeight || img.height || 600;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            targetRegions = generateHeuristicRegions(canvas);
          }

          if (aiErrorNotice) {
            setAuditNotice({
              type: 'warning',
              message: `${aiErrorNotice}. Proceeding with deterministic local Computer Vision & decile sampling.`,
            });
          } else {
            setAuditNotice({
              type: 'info',
              message: `Offline mode: identified ${targetRegions.length} contrast zones. Paste a Gemini API key or run the Python backend for deep semantic OCR.`,
            });
          }
        } else {
          setAuditNotice({
            type: 'success',
            message: `AI Vision: extracted ${targetRegions.length} UI elements. Running deterministic WCAG 2.2 checks...`,
          });
        }
      }

      // Rule R4: refuse to report on fewer than 3 regions
      if (targetRegions.length < 3) {
        setIsAuditing(false);
        setHasAudited(true);
        setFindings([]);
        setAuditNotice({
          type: 'warning',
          message: 'Fewer than 3 usable regions detected. Try a higher contrast screenshot.',
        });
        setLiveAnnouncement('Audit warning: Fewer than 3 usable regions detected.');
        return;
      }

      setRegions(targetRegions);
      executeAuditOnRegions(targetRegions, img, exportScale, 'image', imageSrc, null, imageFileName, '', '', '');

      if (isPartial) {
        setAuditNotice({
          type: 'info',
          message: `Partial pass: Token limit reached; covered ${targetRegions.length} regions.`,
        });
      }
    };
    img.src = imageSrc;
  };

  const handleToggleModule = (mod: ModuleType) => {
    setModuleToggles((prev) => {
      const next = { ...prev, [mod]: !prev[mod] };
      // Re-evaluate if audit has already been run
      if (imageSrc && hasAudited) {
        const img = new Image();
        img.onload = () => {
          const canvas = hiddenCanvasRef.current || document.createElement('canvas');
          const width = img.naturalWidth || img.width || 800;
          const height = img.naturalHeight || img.height || 600;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const sampleMap = new Map<string, DecileSampleResult>();
            regions.forEach((r) => {
              const sample = sampleDecileCore(ctx, r.bbox, width, height);
              if (sample) sampleMap.set(r.id, sample);
            });
            const auditResult = auditElements(regions, sampleMap, {
              inputMode,
              exportScale,
              canvasWidth: width,
              canvasHeight: height,
            });
            setExemptedCount(auditResult.exemptedCount);
            setExemptedDetails(auditResult.exemptedDetails);
            setFindings(auditResult.findings.filter((f) => next[f.module]));
          }
        };
        img.src = imageSrc;
      }
      return next;
    });
  };

  const handleChangeScale = (newScale: ExportScale) => {
    setExportScale(newScale);
    // Re-evaluate to demonstrate Rule R5 live if audit was executed
    if (imageSrc && hasAudited) {
      const img = new Image();
      img.onload = () => {
        executeAuditOnRegions(regions, img, newScale, inputMode, imageSrc, iframeHtml, imageFileName, figmaUrl, webUrl, pastedHtml);
      };
      img.src = imageSrc;
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(findings, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `a11y-lab-findings-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSelectFinding = useCallback((id: string | null) => {
    setSelectedFindingId(id);
    if (id && canvasMode !== 'overlay') {
      setCanvasMode('overlay');
    }
  }, [canvasMode]);

  const auditNoticeBanner = auditNotice && (
    <div
      role="alert"
      className={`p-3 rounded border flex items-start gap-2.5 text-sm animate-fade-in ${
        auditNotice.type === 'error'
          ? 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-700/70 text-red-900 dark:text-red-200'
          : auditNotice.type === 'warning'
          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
          : auditNotice.type === 'success'
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
          : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60 text-sky-900 dark:text-sky-200'
      }`}
    >
      <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
        auditNotice.type === 'error' ? 'text-red-600 dark:text-red-400' :
        auditNotice.type === 'warning' ? 'text-amber-600 dark:text-amber-400' :
        auditNotice.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'
      }`} aria-hidden="true" />
      <span>{auditNotice.message}</span>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden bg-lab-bg text-lab-text flex flex-col font-sans">
      {/* WCAG 2.2 Live Region Announcement (Rule R3) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Hidden processing canvas */}
      <canvas ref={hiddenCanvasRef} className="hidden" aria-hidden="true" />

      {/* Top Application Header */}
      <header className="border-b border-lab-border bg-lab-card/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3.5">
        <div className="w-full mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-lab-accent flex items-center justify-center text-lab-onAccent font-extrabold">
              <Sparkles className="w-5 h-5 fill-current" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-lab-text">
                  A11y Lab
                </h1>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/80">
                  WCAG 2.2 • ARIA 1.2
                </span>
              </div>
              <p className="text-xs text-lab-muted">
                Accessibility auditor &amp; barrier perception simulator
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded bg-lab-subtle border border-lab-border text-lab-muted hover:text-lab-text transition-colors flex items-center gap-1.5 text-sm font-semibold"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-4 h-4 text-sky-600" aria-hidden="true" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  <span className="hidden sm:inline">Light</span>
                </>
              )}
            </button>

            {hasAudited && hasViewedReport && (
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="px-3.5 py-1.5 rounded text-sm font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40 transition-colors"
              >
                Export Report ({findings.length})
              </button>
            )}
          </div>
        </div>
      </header>

      {viewStep === 'upload' ? (
        /* Step 1: Full-page Upload & Configure */
        <main className="flex-1 min-h-0 w-full mx-auto p-4 sm:p-6 h-[calc(100vh-76px)] overflow-hidden flex flex-col gap-4">
          {auditNoticeBanner}
          <div className="flex-1 min-h-0">
          <InputPanel
            currentInput={inputMode}
            onSelectInput={setInputMode}
            exportScale={exportScale}
            onChangeScale={handleChangeScale}
            onImageUploaded={handleImageUploaded}
            moduleToggles={moduleToggles}
            onToggleModule={handleToggleModule}
            onRunAudit={handleRunAudit}
            isAuditing={isAuditing}
            figmaUrl={figmaUrl}
            onChangeFigmaUrl={setFigmaUrl}
            figmaPat={figmaPat}
            onChangeFigmaPat={setFigmaPat}
            webUrl={webUrl}
            onChangeWebUrl={setWebUrl}
            pastedHtml={pastedHtml}
            onChangePastedHtml={setPastedHtml}
            pastAudits={pastAudits}
            hasImage={!!imageSrc}
            onLoadHistoryItem={handleLoadHistoryItem}
          />
          </div>
        </main>
      ) : (
        /* Step 2: Preview & Issues List */
        <main className="flex-1 min-h-0 w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-76px)] overflow-hidden">
          {/* Centre Column: Preview Canvas + Interactive Multi-modal Barrier Simulator (Takes 2/3 = 8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4 h-full overflow-hidden min-h-0">
            <button
              type="button"
              onClick={() => setViewStep('upload')}
              className="self-start flex items-center gap-1.5 text-sm font-semibold text-lab-muted hover:text-lab-text transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back to Upload
            </button>

            {/* The results speak for themselves: only warnings and errors get a banner here. */}
            {auditNotice?.type !== 'success' && auditNoticeBanner}

            <PreviewCanvas
              imageSrc={imageSrc}
              iframeHtml={iframeHtml}
              regions={regions}
              findings={findings}
              screenReaderItems={screenReaderItems}
              selectedFindingId={selectedFindingId}
              onSelectFinding={handleSelectFinding}
              hoveredFindingId={hoveredFindingId}
              onHoverFinding={setHoveredFindingId}
              canvasMode={canvasMode}
              onChangeMode={setCanvasMode}
              hasAudited={hasAudited}
              onRunAudit={handleRunAudit}
              isAuditing={isAuditing}
            />
          </div>

          {/* Right Column: Issue Rail (Takes 1/3 = 4 cols) */}
          <div className="lg:col-span-4 flex flex-col h-full overflow-hidden min-h-0 bg-lab-card/80 border border-lab-border rounded shadow-panel">
            <IssueRail
              findings={findings}
              selectedFindingId={selectedFindingId}
              onSelectFinding={handleSelectFinding}
              hoveredFindingId={hoveredFindingId}
              onHoverFinding={setHoveredFindingId}
              onOpenReportModal={() => { setReportModalOpen(true); setHasViewedReport(true); }}
              onExportJson={handleExportJson}
              hasAudited={hasAudited}
            />
          </div>
        </main>
      )}

      {/* Modals */}
      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
        apiKey={geminiApiKey}
        onSaveKey={setGeminiApiKey}
      />

      {reportModalOpen && (
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          findings={findings}
          exemptedCount={exemptedCount}
          exemptedDetails={exemptedDetails}
          inputMode={inputMode}
          exportScale={exportScale}
          figmaUrl={figmaUrl}
          figmaToken={figmaPat}
          imageSrc={imageSrc}
          iframeHtml={iframeHtml}
          moduleToggles={moduleToggles}
        />
      )}
    </div>
  );
};
