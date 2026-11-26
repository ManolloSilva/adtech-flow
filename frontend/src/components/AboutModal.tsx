import { useEffect, useState } from 'react';

export function AboutModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        data-testid="about-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:text-white"
      >
        About
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-title"
          data-testid="about-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            data-testid="about-dialog"
            className="max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6 text-slate-200 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="about-title" className="text-lg font-bold">About AdTech Flow</h2>
            <p className="mt-3 text-sm leading-relaxed">
              AdTech Flow is an open-source, in-browser simulator that makes the
              programmatic advertising ecosystem transparent, educational, and
              explorable — with zero media spend and zero backend setup.
            </p>
            <p className="mt-3 text-sm leading-relaxed">
              <strong className="text-slate-100">Nominative Fair Use:</strong> all company
              names and trademarks belong to their respective owners and are referenced for
              educational and descriptive purposes only. No affiliation or endorsement is
              implied. All network traffic is intercepted by a mock service worker — no
              live ad server is ever contacted.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                data-testid="about-close"
                onClick={() => setOpen(false)}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
