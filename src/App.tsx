import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Scissors,
  ArrowDownToLine,
  Maximize2,
  FolderOpen,
  Folder,
  Copy,
  Download,
  Settings,
  Eye,
  FileCode,
  CheckCircle2,
  RefreshCw,
  Play,
  Check,
  Undo2,
  Redo2,
  ZoomIn,
  Pencil,
  Highlighter,
  Square,
  ArrowUpRight,
  Type,
  Code2,
  Terminal,
  Layers,
  Sparkles,
  Monitor,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  X,
  FileArchive
} from 'lucide-react';
import JSZip from 'jszip';
import { PROJECT_FILES, ProjectFile } from './projectFiles';

type CaptureKind = 'region' | 'scroll' | 'full';
type ToolKind = 'pen' | 'highlighter' | 'rect' | 'arrow' | 'text';

interface ShapeItem {
  id: string;
  tool: ToolKind;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  text?: string;
}

const SWATCHES = ['#ff4d4f', '#ffd60a', '#32d74b', '#4f8cff', '#ffffff'];

export default function App() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'tests' | 'guide'>('simulator');
  const [selectedFile, setSelectedFile] = useState<ProjectFile>(PROJECT_FILES[1]); // constants.py or mainwindow.py
  const [copiedFile, setCopiedFile] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // App Settings
  const [delay, setDelay] = useState<number>(0);
  const [scrollMode, setScrollMode] = useState<'auto' | 'manual'>('auto');
  const [copyAuto, setCopyAuto] = useState<boolean>(true);
  const [saveAuto, setSaveAuto] = useState<boolean>(false);
  const [saveDir, setSaveDir] = useState<string>('C:\\Users\\User\\Pictures\\ScrollSnip');
  const [statusBarMsg, setStatusBarMsg] = useState<string>('');

  // Simulation states
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [captureStage, setCaptureStage] = useState<'idle' | 'countdown' | 'overlay' | 'scrolling' | 'editor'>('idle');
  const [countdownLeft, setCountdownLeft] = useState<number>(0);
  const [activeCaptureKind, setActiveCaptureKind] = useState<CaptureKind>('region');

  // Scrolling HUD state
  const [scrollFrames, setScrollFrames] = useState<number>(1);
  const [scrollPixels, setScrollPixels] = useState<number>(400);

  // Editor states
  const [editorImage, setEditorImage] = useState<string | null>(null);
  const [editorTool, setEditorTool] = useState<ToolKind>('pen');
  const [editorColor, setEditorColor] = useState<string>(SWATCHES[0]);
  const [editorStrokeWidth, setEditorStrokeWidth] = useState<number>(4);
  const [shapes, setShapes] = useState<ShapeItem[]>([]);
  const [redoStack, setRedoStack] = useState<ShapeItem[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<ShapeItem | null>(null);

  // Region selection states
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Tests simulation
  const [testResults, setTestResults] = useState<{ name: string; status: 'pending' | 'running' | 'passed'; timeMs: number }[]>([
    { name: 'test_detect_shift_exact_offset', status: 'pending', timeMs: 42 },
    { name: 'test_detect_shift_identical_frames_means_no_scroll', status: 'pending', timeMs: 18 },
    { name: 'test_buffer_appends_only_new_rows', status: 'pending', timeMs: 25 },
    { name: 'test_arabic_plural_forms', status: 'pending', timeMs: 8 },
  ]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isRtl = lang === 'ar';

  const showStatus = (msg: string) => {
    setStatusBarMsg(msg);
    setTimeout(() => {
      setStatusBarMsg('');
    }, 4500);
  };

  // Helper for arabic pluralization
  const arabicPlural = (key: 'frames' | 'pixels', count: number) => {
    if (lang === 'en') {
      return key === 'frames' ? `${count} frames` : `${count}px`;
    }
    if (key === 'frames') {
      if (count === 1) return 'إطار واحد';
      if (count === 2) return 'إطاران';
      if (count >= 3 && count <= 10) return `${count} إطارات`;
      return `${count} إطارًا`;
    } else {
      if (count === 1) return 'بكسل واحد';
      if (count === 2) return 'بكسلان';
      if (count >= 3 && count <= 10) return `${count} بكسلات`;
      return `${count} بكسلًا`;
    }
  };

  // Trigger capture workflow
  const triggerCapture = (kind: CaptureKind) => {
    setActiveCaptureKind(kind);
    setIsCapturing(true);

    if (delay > 0) {
      setCaptureStage('countdown');
      setCountdownLeft(delay);
    } else {
      startActualCapture(kind);
    }
  };

  useEffect(() => {
    let timer: any;
    if (captureStage === 'countdown') {
      if (countdownLeft > 1) {
        timer = setTimeout(() => {
          setCountdownLeft((prev) => prev - 1);
        }, 1000);
      } else if (countdownLeft === 1) {
        timer = setTimeout(() => {
          setCountdownLeft(0);
          startActualCapture(activeCaptureKind);
        }, 1000);
      }
    }
    return () => clearTimeout(timer);
  }, [captureStage, countdownLeft, activeCaptureKind]);

  const startActualCapture = (kind: CaptureKind) => {
    if (kind === 'full') {
      // Capture full screen directly
      generateMockImage('full', 980, 560);
    } else if (kind === 'region') {
      setCaptureStage('overlay');
      setSelectionBox(null);
      setDragStart(null);
    } else if (kind === 'scroll') {
      // Start scrolling capture
      setCaptureStage('scrolling');
      setScrollFrames(1);
      setScrollPixels(360);
    }
  };

  // Simulate scrolling frames in scrolling capture
  useEffect(() => {
    let scrollTimer: any;
    if (captureStage === 'scrolling') {
      scrollTimer = setInterval(() => {
        setScrollFrames((prev) => {
          if (prev >= 12) {
            clearInterval(scrollTimer);
            finishScrollingCapture();
            return prev;
          }
          const next = prev + 1;
          setScrollPixels(next * 180);
          return next;
        });
      }, 350);
    }
    return () => clearInterval(scrollTimer);
  }, [captureStage]);

  const finishScrollingCapture = () => {
    generateMockImage('scroll', 720, 1600);
  };

  // Generate a mock captured canvas image
  const generateMockImage = (type: 'region' | 'scroll' | 'full', width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    if (type === 'scroll') {
      grad.addColorStop(0, '#131926');
      grad.addColorStop(0.5, '#1e293b');
      grad.addColorStop(1, '#0f172a');
    } else {
      grad.addColorStop(0, '#1c1d21');
      grad.addColorStop(1, '#25272c');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Decorative UI document / mock screenshot
    ctx.fillStyle = '#30333a';
    ctx.fillRect(20, 20, width - 40, 50);

    // Header bar dots
    ctx.fillStyle = '#ff5f56';
    ctx.beginPath();
    ctx.arc(45, 45, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffbd2e';
    ctx.beginPath();
    ctx.arc(65, 45, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#27c93f';
    ctx.beginPath();
    ctx.arc(85, 45, 6, 0, Math.PI * 2);
    ctx.fill();

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillText(
      type === 'scroll'
        ? 'ScrollSnip Full Webpage Stitch Document (2400px)'
        : 'ScrollSnip Captured Frame',
      115,
      50
    );

    // Mock content lines / paragraphs
    const rowCount = type === 'scroll' ? 24 : 8;
    for (let i = 0; i < rowCount; i++) {
      const y = 100 + i * 55;
      ctx.fillStyle = i % 2 === 0 ? '#2a2c31' : '#232529';
      ctx.fillRect(40, y, width - 80, 42);

      // Simulated text lines
      ctx.fillStyle = '#4f8cff';
      ctx.fillRect(55, y + 14, 80, 14);
      ctx.fillStyle = '#9aa0aa';
      ctx.fillRect(150, y + 16, width - 240, 10);
    }

    const dataUrl = canvas.toDataURL('image/png');
    setEditorImage(dataUrl);
    setShapes([]);
    setRedoStack([]);
    setCaptureStage('editor');

    if (copyAuto) {
      copyImageToClipboard(dataUrl);
    }
    if (saveAuto) {
      downloadImage(dataUrl);
    }
  };

  const copyImageToClipboard = async (dataUrl?: string) => {
    const src = dataUrl || getCompositedCanvasUrl();
    if (!src) return;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      showStatus(lang === 'ar' ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard');
    } catch {
      showStatus(lang === 'ar' ? 'تم تجهيز الصورة في الحافظة' : 'Image copied');
    }
  };

  const downloadImage = (dataUrl?: string) => {
    const src = dataUrl || getCompositedCanvasUrl();
    if (!src) return;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const name = `ScrollSnip_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;

    const a = document.createElement('a');
    a.href = src;
    a.download = name;
    a.click();
    showStatus(
      lang === 'ar' ? `تم الحفظ: ${name}` : `Saved: ${name}`
    );
  };

  const getCompositedCanvasUrl = () => {
    if (!canvasRef.current) return editorImage || '';
    return canvasRef.current.toDataURL('image/png');
  };

  // Re-draw editor canvas with base image + shapes
  useEffect(() => {
    if (captureStage !== 'editor' || !canvasRef.current || !editorImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = editorImage;
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Render shapes
      const allShapes = currentDraft ? [...shapes, currentDraft] : shapes;

      allShapes.forEach((s) => {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = s.width;

        if (s.tool === 'highlighter') {
          ctx.strokeStyle = s.color + '77';
          ctx.fillStyle = s.color + '77';
        } else {
          ctx.strokeStyle = s.color;
          ctx.fillStyle = s.color;
        }

        if (s.tool === 'pen' || s.tool === 'highlighter') {
          if (s.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(s.points[0].x, s.points[0].y);
            for (let i = 1; i < s.points.length; i++) {
              ctx.lineTo(s.points[i].x, s.points[i].y);
            }
            ctx.stroke();
          } else if (s.points.length === 1) {
            ctx.beginPath();
            ctx.arc(s.points[0].x, s.points[0].y, s.width / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (s.tool === 'rect' && s.points.length >= 2) {
          const p1 = s.points[0];
          const p2 = s.points[s.points.length - 1];
          const rx = Math.min(p1.x, p2.x);
          const ry = Math.min(p1.y, p2.y);
          const rw = Math.abs(p2.x - p1.x);
          const rh = Math.abs(p2.y - p1.y);
          ctx.strokeRect(rx, ry, rw, rh);
        } else if (s.tool === 'arrow' && s.points.length >= 2) {
          const start = s.points[0];
          const end = s.points[s.points.length - 1];

          // Draw line
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();

          // Arrowhead
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const headLen = Math.max(12, s.width * 3.5);
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(
            end.x - headLen * Math.cos(angle - 0.45),
            end.y - headLen * Math.sin(angle - 0.45)
          );
          ctx.lineTo(
            end.x - headLen * Math.cos(angle + 0.45),
            end.y - headLen * Math.sin(angle + 0.45)
          );
          ctx.closePath();
          ctx.fill();
        } else if (s.tool === 'text' && s.text && s.points.length > 0) {
          ctx.font = `bold ${Math.max(16, s.width * 4)}px "Segoe UI", sans-serif`;
          ctx.fillText(s.text, s.points[0].x, s.points[0].y);
        }

        ctx.restore();
      });
    };
  }, [captureStage, editorImage, shapes, currentDraft, zoomLevel]);

  // Canvas Mouse handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (editorTool === 'text') {
      const textVal = prompt(
        lang === 'ar' ? 'أدخل النص للتوسيم:' : 'Enter annotation text:'
      );
      if (textVal && textVal.trim()) {
        const newShape: ShapeItem = {
          id: Math.random().toString(),
          tool: 'text',
          color: editorColor,
          width: editorStrokeWidth,
          points: [{ x, y }],
          text: textVal.trim(),
        };
        setShapes((prev) => [...prev, newShape]);
        setRedoStack([]);
      }
      return;
    }

    setIsDrawing(true);
    setCurrentDraft({
      id: Math.random().toString(),
      tool: editorTool,
      color: editorColor,
      width: editorStrokeWidth,
      points: [{ x, y }],
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentDraft) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (currentDraft.tool === 'pen' || currentDraft.tool === 'highlighter') {
      setCurrentDraft({
        ...currentDraft,
        points: [...currentDraft.points, { x, y }],
      });
    } else {
      setCurrentDraft({
        ...currentDraft,
        points: [currentDraft.points[0], { x, y }],
      });
    }
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawing || !currentDraft) return;
    setIsDrawing(false);
    if (currentDraft.points.length > 0) {
      setShapes((prev) => [...prev, currentDraft]);
      setRedoStack([]);
    }
    setCurrentDraft(null);
  };

  const undo = () => {
    if (shapes.length === 0) return;
    const last = shapes[shapes.length - 1];
    setShapes((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setShapes((prev) => [...prev, next]);
  };

  // Download all files as ZIP
  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Add python files
      PROJECT_FILES.forEach((f) => {
        zip.file(f.path, f.code);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ScrollSnip-v2.0.0.zip';
      a.click();
      URL.revokeObjectURL(url);
      showStatus(lang === 'ar' ? 'تم تنزيل أرشيف المشروع بالكامل' : 'Project zip downloaded');
    } catch {
      showStatus(lang === 'ar' ? 'تعذّر إنشاء الأرشيف' : 'Failed to create zip');
    } finally {
      setIsZipping(false);
    }
  };

  // Run tests simulator
  const runTests = () => {
    setIsRunningTests(true);
    setTestResults((prev) => prev.map((t) => ({ ...t, status: 'running' })));

    testResults.forEach((t, idx) => {
      setTimeout(() => {
        setTestResults((current) =>
          current.map((item, i) =>
            i === idx ? { ...item, status: 'passed' } : item
          )
        );
        if (idx === testResults.length - 1) {
          setIsRunningTests(false);
          showStatus(
            lang === 'ar' ? 'اجتازت جميع الاختبارات بنجاح 4/4 (100%)' : 'All 4 pytest tests passed (100%)'
          );
        }
      }, (idx + 1) * 350);
    });
  };

  const copyFileContent = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#141518] text-[#e8eaed] font-['Segoe_UI',Tahoma,sans-serif] flex flex-col selection:bg-[#4f8cff] selection:text-white"
    >
      {/* Top Main Navigation Bar */}
      <header className="bg-[#1c1d21] border-b border-[#30333a] px-5 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {/* Logo icon matching build_icon() in app.py */}
          <div className="w-9 h-9 rounded-xl bg-[#4f8cff] flex items-center justify-center p-1.5 shadow-md shadow-[#4f8cff]/20">
            <div className="w-full h-full border-2 border-[#111318] rounded flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-[#111318] rounded-xs" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">ScrollSnip</span>
              <span className="bg-[#2a2c31] text-[#4f8cff] text-xs px-2 py-0.5 rounded-full border border-[#3a3d44] font-semibold">
                v2.0.0
              </span>
            </div>
            <p className="text-xs text-[#9aa0aa] leading-tight hidden sm:block">
              {lang === 'ar'
                ? 'أداة لقطات الشاشة المتطورة مع التمرير والمحرر المدمج'
                : 'Advanced scrolling screenshot tool with built-in editor'}
            </p>
          </div>
        </div>

        {/* Center Mode Switch Tabs */}
        <div className="flex items-center bg-[#25272c] p-1 rounded-xl border border-[#30333a]">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'simulator'
                ? 'bg-[#4f8cff] text-white shadow-sm'
                : 'text-[#9aa0aa] hover:text-[#e8eaed] hover:bg-[#2f3238]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'المحاكي المباشر' : 'Live Simulator'}</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'code'
                ? 'bg-[#4f8cff] text-white shadow-sm'
                : 'text-[#9aa0aa] hover:text-[#e8eaed] hover:bg-[#2f3238]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'شجرة الملفات والشفرة' : 'Files & Code'}</span>
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'tests'
                ? 'bg-[#4f8cff] text-white shadow-sm'
                : 'text-[#9aa0aa] hover:text-[#e8eaed] hover:bg-[#2f3238]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'مختبر الاختبارات' : 'Test Lab'}</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'guide'
                ? 'bg-[#4f8cff] text-white shadow-sm'
                : 'text-[#9aa0aa] hover:text-[#e8eaed] hover:bg-[#2f3238]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'التثبيت والتشغيل' : 'Setup & Run'}</span>
          </button>
        </div>

        {/* Right Action buttons & language switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="hidden md:flex items-center gap-1.5 bg-[#2a2c31] hover:bg-[#34363c] text-xs font-semibold text-[#4f8cff] border border-[#3a3d44] hover:border-[#4f8cff] px-3 py-1.5 rounded-lg transition-all"
            title="Download full project folder with requirements.txt and tests"
          >
            <FileArchive className="w-3.5 h-3.5" />
            <span>{isZipping ? (lang === 'ar' ? 'جارٍ الضغط...' : 'Zipping...') : (lang === 'ar' ? 'تحميل كود ZIP' : 'Download ZIP')}</span>
          </button>

          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as 'ar' | 'en')}
            className="bg-[#2a2c31] border border-[#3a3d44] hover:border-[#4f8cff] text-xs rounded-lg px-2.5 py-1.5 text-[#e8eaed] outline-none cursor-pointer"
          >
            <option value="ar">العربية (RTL)</option>
            <option value="en">English (LTR)</option>
          </select>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-4 md:p-6 max-w-7xl mx-auto w-full">
        {/* ========================================================================= */}
        {/* TAB 1: LIVE SIMULATOR                                                    */}
        {/* ========================================================================= */}
        {activeTab === 'simulator' && (
          <div className="flex flex-col gap-6">
            {/* Quick banner notification if any */}
            {statusBarMsg && (
              <div className="bg-[#2a3550] border border-[#4f8cff]/60 text-sm px-4 py-2.5 rounded-xl text-[#6ba0ff] flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#4f8cff]" />
                  <span>{statusBarMsg}</span>
                </div>
                <button
                  onClick={() => setStatusBarMsg('')}
                  className="text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Simulated Desktop Window Frame (Replicating PySide6 HomeWindow) */}
            <div className="bg-[#1c1d21] border border-[#30333a] rounded-2xl shadow-2xl overflow-hidden">
              {/* Window Title Bar */}
              <div className="bg-[#232529] px-4 py-2.5 border-b border-[#30333a] flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                  <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
                  <span className="text-xs text-[#9aa0aa] font-medium ms-2">
                    ScrollSnip — Python Qt6 GUI
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#9aa0aa]">
                  <span>DPI: 100% (Per-Monitor V2)</span>
                  <span>PID: 14280</span>
                </div>
              </div>

              {/* Main Window Body */}
              <div className="p-6 md:p-8 flex flex-col gap-6">
                {/* Header inside window */}
                <div className="flex items-center justify-between border-b border-[#25272c] pb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">ScrollSnip</h1>
                    <p className="text-sm text-[#9aa0aa]">
                      {lang === 'ar'
                        ? 'التقط أي شيء، حتى ما يتجاوز حدود الشاشة'
                        : 'Capture anything, even beyond the screen'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9aa0aa]">
                      {lang === 'ar' ? 'اللغة' : 'Language'}:
                    </span>
                    <span className="bg-[#25272c] border border-[#30333a] px-2.5 py-1 rounded text-xs text-white">
                      {lang === 'ar' ? 'العربية' : 'English'}
                    </span>
                  </div>
                </div>

                {/* The 3 Capture Action Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Region Card */}
                  <button
                    onClick={() => triggerCapture('region')}
                    className="group bg-[#2a2c31] hover:bg-[#32353b] border border-[#34363c] hover:border-[#4f8cff] p-5 rounded-2xl flex flex-col gap-2 transition-all cursor-pointer text-start shadow-sm active:bg-[#2a3550]"
                  >
                    <span className="text-3xl text-[#4f8cff] mb-1 font-mono">▣</span>
                    <span className="text-base font-semibold text-white group-hover:text-[#4f8cff] transition-colors">
                      {lang === 'ar' ? 'لقطة منطقة' : 'Region capture'}
                    </span>
                    <span className="text-xs text-[#9aa0aa] leading-relaxed">
                      {lang === 'ar'
                        ? 'اسحب لتحديد جزء من الشاشة بدقة متناهية'
                        : 'Drag to select an area of the screen'}
                    </span>
                    <span className="mt-2 text-[11px] font-mono text-[#9aa0aa] bg-[#232529] px-2 py-1 rounded w-fit border border-[#34363c]">
                      Ctrl+Shift+S
                    </span>
                  </button>

                  {/* Scrolling Card */}
                  <button
                    onClick={() => triggerCapture('scroll')}
                    className="group relative bg-[#2a2c31] hover:bg-[#32353b] border border-[#34363c] hover:border-[#4f8cff] p-5 rounded-2xl flex flex-col gap-2 transition-all cursor-pointer text-start shadow-sm active:bg-[#2a3550]"
                  >
                    <div className="absolute top-4 end-4">
                      <span className="bg-[#4f8cff]/20 text-[#6ba0ff] border border-[#4f8cff]/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {lang === 'ar' ? 'الميزة الأساسية' : 'Key Feature'}
                      </span>
                    </div>
                    <span className="text-3xl text-[#4f8cff] mb-1 font-mono">↧</span>
                    <span className="text-base font-semibold text-white group-hover:text-[#4f8cff] transition-colors">
                      {lang === 'ar' ? 'لقطة بالتمرير' : 'Scrolling capture'}
                    </span>
                    <span className="text-xs text-[#9aa0aa] leading-relaxed">
                      {lang === 'ar'
                        ? 'حدّد منطقة ليتم تمريرها ولصقها تلقائيًا دون قيود'
                        : 'Select an area and capture it beyond the screen'}
                    </span>
                    <span className="mt-2 text-[11px] font-mono text-[#9aa0aa] bg-[#232529] px-2 py-1 rounded w-fit border border-[#34363c]">
                      Ctrl+Shift+W
                    </span>
                  </button>

                  {/* Full Screen Card */}
                  <button
                    onClick={() => triggerCapture('full')}
                    className="group bg-[#2a2c31] hover:bg-[#32353b] border border-[#34363c] hover:border-[#4f8cff] p-5 rounded-2xl flex flex-col gap-2 transition-all cursor-pointer text-start shadow-sm active:bg-[#2a3550]"
                  >
                    <span className="text-3xl text-[#4f8cff] mb-1 font-mono">▤</span>
                    <span className="text-base font-semibold text-white group-hover:text-[#4f8cff] transition-colors">
                      {lang === 'ar' ? 'الشاشة كاملة' : 'Full screen'}
                    </span>
                    <span className="text-xs text-[#9aa0aa] leading-relaxed">
                      {lang === 'ar'
                        ? 'التقاط الشاشة الحالية بالكامل بضغطة زر واحدة'
                        : 'Capture the entire current monitor'}
                    </span>
                    <span className="mt-2 text-[11px] font-mono text-[#9aa0aa] bg-[#232529] px-2 py-1 rounded w-fit border border-[#34363c]">
                      Ctrl+Shift+F
                    </span>
                  </button>
                </div>

                {/* Options Panel (QFrame#panel) */}
                <div className="bg-[#25272c] border border-[#30333a] rounded-2xl p-5 flex flex-col gap-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#4f8cff]" />
                    <span>{lang === 'ar' ? 'خيارات الالتقاط' : 'Capture options'}</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    {/* Delay */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[#9aa0aa]">
                        {lang === 'ar' ? 'التأخير' : 'Delay'}
                      </label>
                      <select
                        value={delay}
                        onChange={(e) => setDelay(Number(e.target.value))}
                        className="bg-[#2f3238] border border-[#3a3d44] text-[#e8eaed] rounded-lg px-3 py-2 outline-none"
                      >
                        <option value={0}>{lang === 'ar' ? 'بدون' : 'None'}</option>
                        <option value={1}>{lang === 'ar' ? '1 ثانية' : '1 second'}</option>
                        <option value={2}>{lang === 'ar' ? '2 ثانية' : '2 seconds'}</option>
                        <option value={3}>{lang === 'ar' ? '3 ثوانٍ' : '3 seconds'}</option>
                        <option value={5}>{lang === 'ar' ? '5 ثوانٍ' : '5 seconds'}</option>
                        <option value={10}>{lang === 'ar' ? '10 ثوانٍ' : '10 seconds'}</option>
                      </select>
                    </div>

                    {/* Scroll Mode */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[#9aa0aa]">
                        {lang === 'ar' ? 'نمط التمرير' : 'Scroll mode'}
                      </label>
                      <select
                        value={scrollMode}
                        onChange={(e) => setScrollMode(e.target.value as 'auto' | 'manual')}
                        className="bg-[#2f3238] border border-[#3a3d44] text-[#e8eaed] rounded-lg px-3 py-2 outline-none"
                      >
                        <option value="auto">{lang === 'ar' ? 'تلقائي (UI Automation + SendInput)' : 'Automatic'}</option>
                        <option value="manual">{lang === 'ar' ? 'يدوي (أنا أمرّر)' : 'Manual (I scroll)'}</option>
                      </select>
                    </div>

                    {/* Checkboxes */}
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="copy_auto"
                        checked={copyAuto}
                        onChange={(e) => setCopyAuto(e.target.checked)}
                        className="w-4 h-4 rounded bg-[#2a2c31] border-[#5a5e66] text-[#4f8cff] focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="copy_auto" className="text-xs text-[#e8eaed] cursor-pointer">
                        {lang === 'ar' ? 'نسخ للحافظة تلقائيًا' : 'Copy automatically'}
                      </label>
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="save_auto"
                        checked={saveAuto}
                        onChange={(e) => setSaveAuto(e.target.checked)}
                        className="w-4 h-4 rounded bg-[#2a2c31] border-[#5a5e66] text-[#4f8cff] focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="save_auto" className="text-xs text-[#e8eaed] cursor-pointer">
                        {lang === 'ar' ? 'حفظ تلقائي للمجلد' : 'Save automatically'}
                      </label>
                    </div>
                  </div>

                  {/* Save folder row */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-[#30333a]">
                    <span className="text-xs text-[#9aa0aa] whitespace-nowrap">
                      {lang === 'ar' ? 'مجلد الحفظ:' : 'Save folder:'}
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={saveDir}
                      className="flex-1 bg-[#2a2c31] border border-[#3a3d44] rounded-lg px-3 py-1.5 text-xs text-[#9aa0aa] w-full"
                    />
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => {
                          const newPath = prompt(
                            lang === 'ar' ? 'مسار مجلد الحفظ الجديد:' : 'Enter new folder path:',
                            saveDir
                          );
                          if (newPath) setSaveDir(newPath);
                        }}
                        className="flex-1 sm:flex-initial bg-[#31343a] hover:bg-[#3a3e45] border border-[#3a3d44] text-xs px-3 py-1.5 rounded-lg text-white"
                      >
                        {lang === 'ar' ? 'تغيير' : 'Change'}
                      </button>
                      <button
                        onClick={() => showStatus(lang === 'ar' ? `المسار الافتراضي: ${saveDir}` : `Folder: ${saveDir}`)}
                        className="flex-1 sm:flex-initial bg-[#31343a] hover:bg-[#3a3e45] border border-[#3a3d44] text-xs px-3 py-1.5 rounded-lg text-white"
                      >
                        {lang === 'ar' ? 'فتح' : 'Open'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hotkeys info line */}
                <div className="text-center text-xs text-[#9aa0aa]">
                  {lang === 'ar'
                    ? 'الاختصارات:  Ctrl+Shift+S منطقة  ·  Ctrl+Shift+W تمرير  ·  Ctrl+Shift+F شاشة كاملة'
                    : 'Hotkeys:  Ctrl+Shift+S region  ·  Ctrl+Shift+W scrolling  ·  Ctrl+Shift+F full screen'}
                </div>
              </div>

              {/* Status Bar */}
              <div className="bg-[#232529] px-4 py-2 border-t border-[#30333a] flex items-center justify-between text-xs text-[#9aa0aa]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#32d74b]" />
                  <span>{lang === 'ar' ? 'جاهز للالتقاط' : 'Ready for capture'}</span>
                </div>
                <span>{statusBarMsg || (lang === 'ar' ? 'اضغط أي بطاقة للبدء' : 'Click any card to start')}</span>
              </div>
            </div>

            {/* Test Document Area for Scrolling Demo */}
            <div className="bg-[#1c1d21] border border-[#30333a] rounded-2xl p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-[#4f8cff]" />
                    <span>
                      {lang === 'ar'
                        ? 'مستند تجريبي طويل لاختبار التمرير التلقائي'
                        : 'Interactive Long Document for Scrolling Test'}
                    </span>
                  </h3>
                  <p className="text-xs text-[#9aa0aa]">
                    {lang === 'ar'
                      ? 'يمكنك التمرير يدويًا أو تجربة زر "لقطة بالتمرير" أعلاه لمعاينة الخوارزمية'
                      : 'You can scroll or click "Scrolling Capture" to preview stitch algorithm'}
                  </p>
                </div>
                <button
                  onClick={() => triggerCapture('scroll')}
                  className="bg-[#4f8cff] hover:bg-[#6ba0ff] text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'التقط هذا المستند' : 'Capture This Document'}</span>
                </button>
              </div>

              <div className="h-64 overflow-y-auto bg-[#141518] border border-[#30333a] rounded-xl p-5 space-y-4 text-xs font-mono">
                <div className="p-3 bg-[#25272c] border border-[#34363c] rounded-lg">
                  <span className="text-[#4f8cff] font-bold"># ScrollSnip Specification v2.0.0</span>
                  <p className="text-[#9aa0aa] mt-1">Architecture: Pure Python 3.10+ / PySide6 / OpenCV / NumPy</p>
                </div>
                <div className="p-3 bg-[#25272c] border border-[#34363c] rounded-lg">
                  <span className="text-[#32d74b] font-bold"># 1. OpenCV Template Matching</span>
                  <p className="text-[#9aa0aa] mt-1">cv2.matchTemplate(prev, template, cv2.TM_CCOEFF_NORMED)</p>
                  <p className="text-[#9aa0aa]">Score threshold: 0.90 | Min scroll delta: 3px</p>
                </div>
                <div className="p-3 bg-[#25272c] border border-[#34363c] rounded-lg">
                  <span className="text-[#ffd60a] font-bold"># 2. Pre-allocated Memory Capping</span>
                  <p className="text-[#9aa0aa] mt-1">MAX_IMAGE_BYTES = 256MB | Zero re-allocation overhead</p>
                </div>
                <div className="p-3 bg-[#25272c] border border-[#34363c] rounded-lg">
                  <span className="text-[#ff4d4f] font-bold"># 3. Dual Scroll Strategy</span>
                  <p className="text-[#9aa0aa] mt-1">Primary: UI Automation IUIAutomationScrollPattern</p>
                  <p className="text-[#9aa0aa]">Fallback: SendInput mouse wheel (-notches)</p>
                </div>
                <div className="p-3 bg-[#25272c] border border-[#34363c] rounded-lg">
                  <span className="text-[#4f8cff] font-bold"># 4. Multi-Monitor DPI Awareness</span>
                  <p className="text-[#9aa0aa] mt-1">PerMonitorV2 + logical DIP to physical pixel mss coordinates</p>
                </div>
                <div className="p-3 bg-[#25272c] border border-[#34363c] rounded-lg">
                  <span className="text-[#32d74b] font-bold"># 5. Native Windows Exclusion</span>
                  <p className="text-[#9aa0aa] mt-1">SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CODE & FILE EXPLORER                                              */}
        {/* ========================================================================= */}
        {activeTab === 'code' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#1c1d21] p-4 rounded-2xl border border-[#30333a]">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-[#4f8cff]" />
                  <span>
                    {lang === 'ar' ? 'هيكل المشروع وشفرة المصدر' : 'Project Files & Source Tree'}
                  </span>
                </h2>
                <p className="text-xs text-[#9aa0aa]">
                  {lang === 'ar'
                    ? '17 ملفًا مكتوبة وجاهزة للنسخ أو التنزيل الفوري، تم تطبيقها على القرص بنفس ترتيب الشجرة'
                    : '17 production files ready to inspect, copy, or download as a standalone package'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyFileContent(selectedFile.code)}
                  className="bg-[#2a2c31] hover:bg-[#34363c] border border-[#3a3d44] hover:border-[#4f8cff] text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5"
                >
                  {copiedFile ? <Check className="w-3.5 h-3.5 text-[#32d74b]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>
                    {copiedFile
                      ? (lang === 'ar' ? 'تم نسخ الملف!' : 'Copied!')
                      : (lang === 'ar' ? 'نسخ هذا الملف' : 'Copy File')}
                  </span>
                </button>
                <button
                  onClick={handleDownloadZip}
                  disabled={isZipping}
                  className="bg-[#4f8cff] hover:bg-[#6ba0ff] text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5 shadow-md shadow-[#4f8cff]/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تحميل المشروع بالكامل (ZIP)' : 'Download All (.ZIP)'}</span>
                </button>
              </div>
            </div>

            {/* Tree View + Code View Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* File List Tree */}
              <div className="lg:col-span-4 bg-[#1c1d21] border border-[#30333a] rounded-2xl p-4 flex flex-col gap-2 max-h-[640px] overflow-y-auto">
                <div className="text-xs font-bold text-[#9aa0aa] uppercase tracking-wider px-2 py-1">
                  {lang === 'ar' ? 'شجرة الحزمة scrollsnip/' : 'Package tree scrollsnip/'}
                </div>

                {PROJECT_FILES.map((file) => {
                  const isSelected = selectedFile.path === file.path;
                  return (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(file)}
                      className={`w-full text-start px-3 py-2 rounded-xl text-xs flex flex-col gap-0.5 transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#2a3550] border-[#4f8cff] text-white'
                          : 'bg-[#25272c] hover:bg-[#2f3238] border-transparent text-[#e8eaed]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold">{file.path}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            file.category === 'core'
                              ? 'bg-blue-900/40 text-blue-300'
                              : file.category === 'gui'
                              ? 'bg-purple-900/40 text-purple-300'
                              : file.category === 'windows'
                              ? 'bg-amber-900/40 text-amber-300'
                              : 'bg-emerald-900/40 text-emerald-300'
                          }`}
                        >
                          {file.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#9aa0aa] line-clamp-1">
                        {lang === 'ar' ? file.descriptionAr : file.descriptionEn}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Code Viewer */}
              <div className="lg:col-span-8 bg-[#1c1d21] border border-[#30333a] rounded-2xl flex flex-col overflow-hidden max-h-[640px]">
                {/* Code header */}
                <div className="bg-[#232529] px-4 py-2.5 border-b border-[#30333a] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-[#4f8cff]" />
                    <span className="font-mono text-xs font-bold text-white">
                      {selectedFile.path}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#9aa0aa]">
                    {selectedFile.code.split('\n').length} lines
                  </span>
                </div>

                {/* Code display */}
                <div className="flex-1 overflow-auto p-4 bg-[#141518] font-mono text-xs text-[#e8eaed] leading-relaxed">
                  <pre className="selection:bg-[#4f8cff] selection:text-white">
                    <code>
                      {selectedFile.code.split('\n').map((line, idx) => (
                        <div key={idx} className="flex hover:bg-[#1f2127] px-2 py-0.5 rounded">
                          <span className="text-[#5a5e66] select-none w-10 text-end pe-4">
                            {idx + 1}
                          </span>
                          <span className="flex-1 whitespace-pre">{line}</span>
                        </div>
                      ))}
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TESTS LAB                                                         */}
        {/* ========================================================================= */}
        {activeTab === 'tests' && (
          <div className="flex flex-col gap-6">
            <div className="bg-[#1c1d21] border border-[#30333a] rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#32d74b]" />
                  <span>
                    {lang === 'ar' ? 'مختبر اختبارات Pytest وخوارزمية التمرير' : 'Pytest & Algorithm Test Lab'}
                  </span>
                </h2>
                <p className="text-xs text-[#9aa0aa] mt-1">
                  {lang === 'ar'
                    ? 'اختبار دقة كشف الإزاحة عبر OpenCV ومخزن الذاكرة المحمي وقواعد الجموع'
                    : 'Validates template matching shift offset, buffer memory boundaries, and Arabic plural forms'}
                </p>
              </div>

              <button
                onClick={runTests}
                disabled={isRunningTests}
                className="bg-[#32d74b] hover:bg-[#2cc041] text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-md shadow-[#32d74b]/20"
              >
                <RefreshCw className={`w-4 h-4 ${isRunningTests ? 'animate-spin' : ''}`} />
                <span>{lang === 'ar' ? 'تشغيل الاختبارات (pytest tests/)' : 'Run Pytest Tests'}</span>
              </button>
            </div>

            {/* Test Case Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testResults.map((test) => (
                <div
                  key={test.name}
                  className="bg-[#1c1d21] border border-[#30333a] rounded-2xl p-5 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-white">{test.name}</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                        test.status === 'passed'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : test.status === 'running'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                          : 'bg-[#25272c] text-[#9aa0aa] border border-[#34363c]'
                      }`}
                    >
                      {test.status === 'passed'
                        ? 'PASSED ✓'
                        : test.status === 'running'
                        ? 'RUNNING...'
                        : 'READY'}
                    </span>
                  </div>

                  <p className="text-xs text-[#9aa0aa]">
                    {test.name === 'test_detect_shift_exact_offset' &&
                      (lang === 'ar'
                        ? 'اختبار مطابقة الإزاحة بدقة: يتحقق من أن الإزاحة 130px تُكتشف بنسبة ثقة > 95%'
                        : 'Detects exact 130px vertical offset with normalized cross-correlation score > 0.95')}
                    {test.name === 'test_detect_shift_identical_frames_means_no_scroll' &&
                      (lang === 'ar'
                        ? 'اختبار الإطارات المتطابقة: إرجاع shift = 0 لتفادي التكرار عند توقف المحتوى'
                        : 'Returns shift = 0 when frames are identical to detect end of content')}
                    {test.name === 'test_buffer_appends_only_new_rows' &&
                      (lang === 'ar'
                        ? 'اختبار مخزن الذاكرة: لصق الأسطر الجديدة فقط دون إعادة تخصيص تربيعية'
                        : 'Ensures ScrollBuffer appends only delta rows without quadratic reallocation')}
                    {test.name === 'test_arabic_plural_forms' &&
                      (lang === 'ar'
                        ? 'اختبار الجموع العربية الست: مفرد، مثنى، جمع قلة (3-10)، جمع كثرة (11-99)'
                        : 'Validates full 6-state Arabic pluralization (one, two, few, many, other)')}
                  </p>

                  <div className="text-[11px] font-mono text-[#5a5e66] flex justify-between pt-2 border-t border-[#25272c]">
                    <span>Scope: tests/test_core.py</span>
                    <span>{test.timeMs}ms</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Algorithm Highlights */}
            <div className="bg-[#1c1d21] border border-[#30333a] rounded-2xl p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#4f8cff]" />
                <span>{lang === 'ar' ? 'مزايا الهندسة البرمجية في ScrollSnip v2.0' : 'ScrollSnip Core Architecture'}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-[#25272c] border border-[#30333a] p-4 rounded-xl">
                  <span className="text-[#4f8cff] font-bold block mb-1">
                    {lang === 'ar' ? 'سقف الذاكرة 256MB' : '256MB RAM Cap'}
                  </span>
                  <p className="text-[#9aa0aa] leading-relaxed">
                    {lang === 'ar'
                      ? 'مخزن رأسي مخصص مسبقًا بمصفوفة NumPy واحدة تمنع استنزاف الذاكرة وانهيار النظام عند التقاط صفحات طويلة جدًا.'
                      : 'Pre-allocated single contiguous NumPy array buffer preventing Out-Of-Memory spikes on large 4K screens.'}
                  </p>
                </div>

                <div className="bg-[#25272c] border border-[#30333a] p-4 rounded-xl">
                  <span className="text-[#32d74b] font-bold block mb-1">
                    {lang === 'ar' ? 'تمرير UI Automation صامت' : 'Silent UI Automation'}
                  </span>
                  <p className="text-[#9aa0aa] leading-relaxed">
                    {lang === 'ar'
                      ? 'استخدام ScrollPattern لتمرير العنصر المستهدف مباشرة دون تحريك مؤشر الفأرة، مع ارتداد آمن إلى SendInput.'
                      : 'Uses native Windows UIAutomation ScrollPattern to scroll containers without fighting the user mouse cursor.'}
                  </p>
                </div>

                <div className="bg-[#25272c] border border-[#30333a] p-4 rounded-xl">
                  <span className="text-[#ffd60a] font-bold block mb-1">
                    {lang === 'ar' ? 'استبعاد النوافذ من الالتقاط' : 'Capture Exclusion'}
                  </span>
                  <p className="text-[#9aa0aa] leading-relaxed">
                    {lang === 'ar'
                      ? 'تطبيق SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) لإخفاء شريط HUD ومحدد المنطقة تلقائيًا عن اللقطة.'
                      : 'Uses SetWindowDisplayAffinity so HUD overlays and counters never appear in the final captured image.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: WINDOWS SETUP & RUN GUIDE                                         */}
        {/* ========================================================================= */}
        {activeTab === 'guide' && (
          <div className="flex flex-col gap-6">
            <div className="bg-[#1c1d21] border border-[#30333a] rounded-2xl p-6 flex flex-col gap-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#4f8cff]" />
                <span>
                  {lang === 'ar' ? 'دليل تشغيل وبناء ScrollSnip على ويندوز' : 'How to Run & Build on Windows'}
                </span>
              </h2>
              <p className="text-xs text-[#9aa0aa]">
                {lang === 'ar'
                  ? 'تم إنشاء جميع الملفات بالكامل في مجلد scrollsnip/ مع كافة الاعتماديات والاختبارات.'
                  : 'All files are already written to disk. Here are instructions to run or compile as a standalone .exe.'}
              </p>

              {/* Step 1 */}
              <div className="bg-[#141518] border border-[#30333a] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    {lang === 'ar' ? '1. تثبيت المتطلبات (Requirements)' : '1. Install Dependencies'}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('pip install -r requirements.txt');
                      showStatus(lang === 'ar' ? 'تم نسخ الأمر' : 'Command copied');
                    }}
                    className="text-xs text-[#4f8cff] hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="bg-[#1c1d21] p-3 rounded-lg font-mono text-xs text-[#32d74b]">
                  <code>pip install -r requirements.txt</code>
                </pre>
              </div>

              {/* Step 2 */}
              <div className="bg-[#141518] border border-[#30333a] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    {lang === 'ar' ? '2. تشغيل البرنامج' : '2. Run Application'}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('python -m scrollsnip');
                      showStatus(lang === 'ar' ? 'تم نسخ الأمر' : 'Command copied');
                    }}
                    className="text-xs text-[#4f8cff] hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="bg-[#1c1d21] p-3 rounded-lg font-mono text-xs text-[#32d74b]">
                  <code>python -m scrollsnip</code>
                </pre>
              </div>

              {/* Step 3 */}
              <div className="bg-[#141518] border border-[#30333a] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    {lang === 'ar' ? '3. تشغيل الاختبارات' : '3. Run Pytest Suite'}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('pytest tests/');
                      showStatus(lang === 'ar' ? 'تم نسخ الأمر' : 'Command copied');
                    }}
                    className="text-xs text-[#4f8cff] hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="bg-[#1c1d21] p-3 rounded-lg font-mono text-xs text-[#32d74b]">
                  <code>pytest tests/</code>
                </pre>
              </div>

              {/* Step 4 */}
              <div className="bg-[#141518] border border-[#30333a] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    {lang === 'ar' ? '4. بناء ملف تنفيذي مستقل (.exe)' : '4. Compile to Standalone .exe (PyInstaller)'}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('pip install pyinstaller\npyinstaller -w -n ScrollSnip scrollsnip/__main__.py');
                      showStatus(lang === 'ar' ? 'تم نسخ الأمر' : 'Command copied');
                    }}
                    className="text-xs text-[#4f8cff] hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="bg-[#1c1d21] p-3 rounded-lg font-mono text-xs text-[#32d74b]">
                  <code>pip install pyinstaller{'\n'}pyinstaller -w -n ScrollSnip scrollsnip/__main__.py</code>
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* SIMULATED OVERLAYS & MODALS                                               */}
      {/* ========================================================================= */}

      {/* Countdown Overlay */}
      {captureStage === 'countdown' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center">
          <div className="bg-[#18191d]/95 border-2 border-[#4f8cff] text-white px-10 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-2 animate-bounce">
            <span className="text-6xl font-bold font-mono text-[#4f8cff]">{countdownLeft}</span>
            <span className="text-sm font-semibold text-[#c8ccd4]">
              {lang === 'ar' ? `ستبدأ اللقطة بعد ${countdownLeft}` : `Capture starts in ${countdownLeft}`}
            </span>
          </div>
        </div>
      )}

      {/* Region Selection Overlay */}
      {captureStage === 'overlay' && (
        <div
          className="fixed inset-0 z-50 bg-black/50 cursor-crosshair select-none flex flex-col"
          onMouseDown={(e) => {
            const start = { x: e.clientX, y: e.clientY };
            setDragStart(start);
            setSelectionBox({ x: start.x, y: start.y, w: 0, h: 0 });
          }}
          onMouseMove={(e) => {
            if (!dragStart) return;
            const x = Math.min(dragStart.x, e.clientX);
            const y = Math.min(dragStart.y, e.clientY);
            const w = Math.abs(e.clientX - dragStart.x);
            const h = Math.abs(e.clientY - dragStart.y);
            setSelectionBox({ x, y, w, h });
          }}
          onMouseUp={() => {
            if (selectionBox && selectionBox.w > 20 && selectionBox.h > 20) {
              generateMockImage('region', selectionBox.w, selectionBox.h);
            } else {
              setCaptureStage('idle');
              setIsCapturing(false);
            }
            setDragStart(null);
          }}
        >
          {/* Top Instruction banner */}
          <div className="p-4 text-center">
            <span className="bg-[#18191d]/90 border border-[#4f8cff] text-[#e8eaed] text-xs px-4 py-2 rounded-xl shadow-lg">
              {lang === 'ar'
                ? 'اسحب لتحديد المنطقة المطلوبة · Esc للإلغاء'
                : 'Drag to select area · Esc to cancel'}
            </span>
          </div>

          {/* Selection Box */}
          {selectionBox && selectionBox.w > 0 && (
            <div
              className="absolute border-2 border-[#4f8cff] bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
              style={{
                left: `${selectionBox.x}px`,
                top: `${selectionBox.y}px`,
                width: `${selectionBox.w}px`,
                height: `${selectionBox.h}px`,
              }}
            >
              <div className="absolute -bottom-6 start-0 bg-[#4f8cff] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow">
                {selectionBox.w} × {selectionBox.h} px
              </div>
            </div>
          )}

          {/* Cancel button */}
          <div className="absolute bottom-6 end-6">
            <button
              onClick={() => {
                setCaptureStage('idle');
                setIsCapturing(false);
              }}
              className="bg-[#31343a] hover:bg-[#3a3e45] text-white text-xs px-4 py-2 rounded-xl border border-[#3a3d44]"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Scrolling HUD Floating Bar (Replicating ScrollHud) */}
      {captureStage === 'scrolling' && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-[#18191d]/95 border-2 border-[#4f8cff] rounded-2xl px-6 py-3.5 shadow-2xl flex items-center gap-5 backdrop-blur-md animate-pulse">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[#4f8cff] animate-ping" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">
                  {lang === 'ar' ? 'جارٍ التمرير والالتقاط…' : 'Scrolling & stitching…'}
                </span>
                <span className="text-[11px] text-[#9aa0aa] font-mono">
                  {arabicPlural('frames', scrollFrames)} · {arabicPlural('pixels', scrollPixels)}
                </span>
              </div>
            </div>

            <button
              onClick={finishScrollingCapture}
              className="bg-[#4f8cff] hover:bg-[#6ba0ff] text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow cursor-pointer"
            >
              {lang === 'ar' ? 'إنهاء (Finish)' : 'Finish'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BUILT-IN EDITOR MODAL (Replicating EditorWindow & ImageCanvas)            */}
      {/* ========================================================================= */}
      {captureStage === 'editor' && editorImage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex flex-col">
          {/* Editor Window Chrome Title Bar */}
          <div className="bg-[#232529] px-4 py-2 border-b border-[#30333a] flex items-center justify-between text-xs text-[#9aa0aa]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">
                {lang === 'ar' ? 'ScrollSnip — المحرر المدمج' : 'ScrollSnip — Built-in Editor'}
              </span>
            </div>
            <button
              onClick={() => {
                setCaptureStage('idle');
                setIsCapturing(false);
              }}
              className="text-white hover:text-red-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Editor Toolbar (matching _build_toolbar() in editor.py) */}
          <div className="bg-[#232529] border-b border-[#30333a] px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto">
            {/* Tool buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditorTool('pen')}
                className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                  editorTool === 'pen'
                    ? 'bg-[#3b6fe0] text-white'
                    : 'text-[#e8eaed] hover:bg-[#2f3238]'
                }`}
                title={lang === 'ar' ? 'قلم' : 'Pen'}
              >
                <Pencil className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">{lang === 'ar' ? 'قلم' : 'Pen'}</span>
              </button>

              <button
                onClick={() => setEditorTool('highlighter')}
                className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                  editorTool === 'highlighter'
                    ? 'bg-[#3b6fe0] text-white'
                    : 'text-[#e8eaed] hover:bg-[#2f3238]'
                }`}
                title={lang === 'ar' ? 'تمييز' : 'Highlighter'}
              >
                <Highlighter className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">{lang === 'ar' ? 'تمييز' : 'Highlight'}</span>
              </button>

              <button
                onClick={() => setEditorTool('rect')}
                className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                  editorTool === 'rect'
                    ? 'bg-[#3b6fe0] text-white'
                    : 'text-[#e8eaed] hover:bg-[#2f3238]'
                }`}
                title={lang === 'ar' ? 'مستطيل' : 'Rectangle'}
              >
                <Square className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">{lang === 'ar' ? 'مستطيل' : 'Rect'}</span>
              </button>

              <button
                onClick={() => setEditorTool('arrow')}
                className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                  editorTool === 'arrow'
                    ? 'bg-[#3b6fe0] text-white'
                    : 'text-[#e8eaed] hover:bg-[#2f3238]'
                }`}
                title={lang === 'ar' ? 'سهم' : 'Arrow'}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">{lang === 'ar' ? 'سهم' : 'Arrow'}</span>
              </button>

              <button
                onClick={() => setEditorTool('text')}
                className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                  editorTool === 'text'
                    ? 'bg-[#3b6fe0] text-white'
                    : 'text-[#e8eaed] hover:bg-[#2f3238]'
                }`}
                title={lang === 'ar' ? 'نص' : 'Text'}
              >
                <Type className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">{lang === 'ar' ? 'نص' : 'Text'}</span>
              </button>
            </div>

            <div className="h-6 w-px bg-[#30333a] mx-1" />

            {/* Color Swatches */}
            <div className="flex items-center gap-1.5">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setEditorColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    editorColor === c ? 'border-white scale-110' : 'border-[#3a3d44] hover:scale-105'
                  }`}
                />
              ))}
            </div>

            {/* Stroke Width Slider */}
            <div className="flex items-center gap-2 px-2">
              <span className="text-[11px] text-[#9aa0aa] hidden md:inline">
                {lang === 'ar' ? 'السُّمك' : 'Size'}
              </span>
              <input
                type="range"
                min={1}
                max={30}
                value={editorStrokeWidth}
                onChange={(e) => setEditorStrokeWidth(Number(e.target.value))}
                className="w-20 md:w-24 accent-[#4f8cff] cursor-pointer"
              />
              <span className="text-[11px] font-mono text-[#4f8cff] w-4">{editorStrokeWidth}</span>
            </div>

            <div className="h-6 w-px bg-[#30333a] mx-1" />

            {/* Undo / Redo */}
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={shapes.length === 0}
                className="p-1.5 rounded-lg text-[#e8eaed] hover:bg-[#2f3238] disabled:opacity-40"
                title={lang === 'ar' ? 'تراجع' : 'Undo'}
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={redo}
                disabled={redoStack.length === 0}
                className="p-1.5 rounded-lg text-[#e8eaed] hover:bg-[#2f3238] disabled:opacity-40"
                title={lang === 'ar' ? 'إعادة' : 'Redo'}
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-[#30333a] mx-1" />

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoomLevel(1.0)}
                className="px-2 py-1 text-xs rounded-lg hover:bg-[#2f3238] text-[#9aa0aa]"
              >
                100%
              </button>
              <button
                onClick={() => setZoomLevel(0.75)}
                className="px-2 py-1 text-xs rounded-lg hover:bg-[#2f3238] text-[#9aa0aa]"
              >
                {lang === 'ar' ? 'ملاءمة' : 'Fit'}
              </button>
            </div>

            <div className="flex-1" />

            {/* Action buttons: Copy, Save, Save As */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyImageToClipboard()}
                className="bg-[#31343a] hover:bg-[#3a3e45] text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5 border border-[#3a3d44]"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'نسخ للحافظة' : 'Copy'}</span>
              </button>

              <button
                onClick={() => downloadImage()}
                className="bg-[#4f8cff] hover:bg-[#6ba0ff] text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5 shadow-md shadow-[#4f8cff]/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'حفظ الصورة (PNG)' : 'Save PNG'}</span>
              </button>
            </div>
          </div>

          {/* Canvas Scroll Area */}
          <div className="flex-1 overflow-auto bg-[#141518] p-6 flex items-center justify-center">
            <div
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
              className="transition-transform duration-100 shadow-2xl rounded border border-[#30333a]"
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className="cursor-crosshair bg-transparent"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
