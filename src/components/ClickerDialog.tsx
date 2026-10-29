import { useEffect, useState } from 'react';
import type { BookmarksApi } from '../hooks/useBookmarks';
import { deploySteps } from '../oneclicker';
import Icon from './Icon';
import { aklikUrl } from '../integrations';

interface Props {
  api: BookmarksApi;
  bookmarkId: string;
  onClose: () => void;
  notify: (text: string, kind?: 'ok' | 'info' | 'warn', detail?: string) => void;
}

/**
 * 1Clicker — lokale Bereitstellung (🔵 Badge-Klick): zeigt die erkannte
 * Nutzungsart (Docker / portables Release / START-1CLICKER.cmd) mit den
 * passenden 1-Klick-Schritten: Copy-Paste-Befehle und Direktlinks.
 */
export default function ClickerDialog({ api, bookmarkId, onClose, notify }: Props) {
  const bm = api.state.bookmarks.find((b) => b.id === bookmarkId);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!bm) return null;
  const info = bm.clicker;
  if (!info) return null;
  const steps = deploySteps(bm);
  const repoUrl = info.repo ? info.repo.cloneUrl.replace(/\.git$/, '') : bm.url;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      notify('Kopieren fehlgeschlagen — Befehl manuell markieren', 'warn');
    }
  };

  const kindLabel =
    info.kind === 'docker' ? 'Docker' : info.kind === 'portable' ? 'Portable Windows-Assets' : info.kind === 'cmd' ? 'START-1CLICKER.cmd' : 'Repository';

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Lokale Bereitstellung">
        <h2>
          <span className="clicker-badge local dialog-badge" aria-hidden="true">
            <span className="clicker-dot" />
          </span>
          Lokale Bereitstellung — {bm.title}
        </h2>
        <p className="hint">
          Nutzungsweg <strong>{kindLabel}</strong>
          {info.reason ? ` — ${info.reason}` : ''}. Die Anleitung ist ein Hinweis; Ausführung und Kosten müssen vor dem Start geprüft werden.
        </p>
        <a className="btn primary" href={aklikUrl(repoUrl)} target="_blank" rel="noreferrer noopener">In aKlik lokal prüfen und bereitstellen</a>
        <p className="hint">Öffnet den laufenden lokalen aKlik-Deployer auf Port 43110. Dort werden die Bereitstellung geprüft und der Start bestätigt.</p>

        <ol className="deploy-steps">
          {steps.map((step, i) => (
            <li key={i} className="deploy-step">
              <div className="deploy-step-label">
                <span className="deploy-step-num">{i + 1}</span> {step.label}
              </div>
              {step.command && (
                <div className="deploy-cmd">
                  <code>{step.command}</code>
                  <button className="btn small" onClick={() => void copy(step.command!, step.label)}>
                    {copied === step.label ? <Icon name="check" size={13} /> : 'Kopieren'}
                  </button>
                </div>
              )}
              {step.link && (
                <a className="deploy-link" href={step.link} target="_blank" rel="noreferrer noopener">
                  {step.link.replace(/^https?:\/\//, '')} <Icon name="external" size={12} />
                </a>
              )}
            </li>
          ))}
        </ol>

        <div className="modal-actions">
          <a className="btn" href={repoUrl} target="_blank" rel="noreferrer noopener">
            <Icon name="github" size={14} /> Repository öffnen
          </a>
          <button className="btn primary" onClick={onClose}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
