import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Maximize, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export default function ResumeViewer() {
  const { applicationId, studentId, driveId, registrationId } = useParams();
  const { apiFetch } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const viewerRef = useRef(null);
  const [documentUrl, setDocumentUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [retryCount, setRetryCount] = useState(0);
  const [retryable, setRetryable] = useState(false);

  const endpoint = useMemo(() => {
    if (applicationId) return `/api/v1/applications/${encodeURIComponent(applicationId)}/resume`;
    if (studentId) return `/api/v1/students/${encodeURIComponent(studentId)}/resume`;
    if (driveId && registrationId) {
      return `/api/v1/drives/placement-drives/${encodeURIComponent(driveId)}/registrations/${encodeURIComponent(registrationId)}/resume`;
    }
    return '/api/v1/students/profile/resume';
  }, [applicationId, studentId, driveId, registrationId]);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let active = true;
    let createdUrl = '';
    let timedOut = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30_000);

    setLoading(true);
    setError('');
    setRetryable(false);
    setPageCount(0);
    setPageNumber(1);
    setDocumentUrl('');

    async function loadResume() {
      try {
        const response = await apiFetch(endpoint, { signal: controller.signal });
        if (!response.ok) {
          const responseText = await response.text();
          let responseMessage = '';
          const contentType = response.headers.get('content-type') || '';

          if (contentType.includes('application/json')) {
            try {
              const body = JSON.parse(responseText);
              responseMessage = body.error?.message || body.message || '';
            } catch {
              responseMessage = responseText || 'Server returned an invalid JSON error.';
            }
          } else {
            responseMessage = responseText ? responseText.replace(/<[^>]*>/g, '').trim() : '';
          }

          if (response.status === 404) {
            throw Object.assign(new Error(`Resume Not Available${responseMessage ? `: ${responseMessage}` : '.'}`), { retryable: false });
          }
          if (response.status === 403) {
            throw Object.assign(new Error(`Access Denied${responseMessage ? `: ${responseMessage}` : '.'}`), { retryable: false });
          }
          if (response.status === 401) {
            throw Object.assign(new Error('Your session has expired. Please sign in again.'), { retryable: false });
          }
          throw Object.assign(
            new Error(responseMessage || `Unable to load resume (${response.status}).`),
            { retryable: response.status >= 500 }
          );
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          throw Object.assign(new Error('The resume response was empty.'), { retryable: false });
        }
        const pdfSignature = await blob.slice(0, 5).text();
        if (active) {
          createdUrl = URL.createObjectURL(blob);
          setDocumentUrl(createdUrl);
        }
        if (pdfSignature !== '%PDF-') {
          setError('PDF Preview Failed: this resume is not a valid PDF. You can download the original file.');
          setRetryable(false);
        }
      } catch (loadError) {
        if (!active || (controller.signal.aborted && !timedOut)) return;
        if (timedOut) {
          setError('The resume request timed out. Check your connection and try again.');
          setRetryable(true);
        } else if (loadError.name === 'TypeError') {
          setError('Network error while loading the resume. Check your connection and try again.');
          setRetryable(true);
        } else {
          setError(loadError.message || 'Unable to load resume.');
          setRetryable(loadError.retryable ?? loadError.name !== 'AbortError');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadResume();
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [apiFetch, endpoint, retryCount]);

  const pageWidth = Math.max(240, Math.min(viewportWidth - 48, 900) * zoom);
  const fileName = location.state?.fileName || 'resume.pdf';

  function downloadResume() {
    if (!documentUrl) return;
    const link = document.createElement('a');
    link.href = documentUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function enterFullscreen() {
    try {
      await viewerRef.current?.requestFullscreen?.();
    } catch (fullscreenError) {
      setError(fullscreenError.message || 'Unable to enter fullscreen mode.');
    }
  }

  return (
    <section ref={viewerRef} className="max-w-7xl mx-auto space-y-4 rounded-xl bg-slate-950 p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-white">Resume Viewer</h1>
            <p className="truncate text-xs text-slate-400">{fileName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))} aria-label="Zoom out" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-12 text-center text-xs text-slate-300">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(2, value + 0.1))} aria-label="Zoom in" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" onClick={enterFullscreen} aria-label="Enter fullscreen" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800">
            <Maximize className="h-4 w-4" />
          </button>
          <button type="button" onClick={downloadResume} disabled={!documentUrl} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}

      {loading && <p className="py-12 text-center text-sm text-slate-400">Loading resume securely...</p>}
      {error && retryable && !loading && (
        <button
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      )}

      {documentUrl && !error && (
        <div className="overflow-auto rounded-lg bg-slate-800 p-2 sm:p-4">
          <div className="mb-3 flex items-center justify-center gap-3">
            <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)} aria-label="Previous page" className="rounded p-1 text-slate-300 disabled:opacity-40">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-xs text-slate-300">Page {pageNumber} of {pageCount || '…'}</span>
            <button type="button" disabled={!pageCount || pageNumber >= pageCount} onClick={() => setPageNumber((page) => page + 1)} aria-label="Next page" className="rounded p-1 text-slate-300 disabled:opacity-40">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <Document
            file={documentUrl}
            loading={<p className="py-8 text-center text-sm text-slate-400">Rendering PDF...</p>}
            error={<p role="alert" className="py-8 text-center text-sm text-rose-300">This file could not be displayed as a PDF.</p>}
            onLoadSuccess={({ numPages }) => setPageCount(numPages)}
            onLoadError={(loadError) => {
              setError(`PDF Preview Failed: ${loadError.message || 'unable to render this document.'}`);
              setRetryable(true);
            }}
          >
            <Page
              pageNumber={pageNumber}
              width={pageWidth}
              renderTextLayer
              renderAnnotationLayer
              className="mx-auto shadow-xl"
            />
          </Document>
        </div>
      )}
    </section>
  );
}
