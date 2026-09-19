import type { ReactNode } from 'react';
import { Section } from '../../lib/ui';

type SettingsScreenProps = {
  currentUserEmail: string;
  selectedWorkspaceName: string | null;
  workspaceManagement: ReactNode;
};

export function SettingsScreen({
  currentUserEmail,
  selectedWorkspaceName,
  workspaceManagement,
}: SettingsScreenProps) {
  return (
    <div className="screen-grid screen-grid--settings">
      <div className="screen-main">{workspaceManagement}</div>

      <div className="screen-side">
        <Section title="Account" eyebrow="Authenticated session">
          <div className="summary-list">
            <div className="summary-list__item">
              <span className="summary-list__label">Signed in as</span>
              <strong>{currentUserEmail}</strong>
            </div>
            <div className="summary-list__item">
              <span className="summary-list__label">Current workspace</span>
              <strong>{selectedWorkspaceName ?? 'No workspace selected'}</strong>
            </div>
          </div>
        </Section>

        <Section title="Current product rules" eyebrow="Pre-AI scope">
          <div className="summary-list">
            <div className="summary-list__item">
              <span className="summary-list__label">Upload flow</span>
              <strong>Lecture video first</strong>
            </div>
            <div className="summary-list__item">
              <span className="summary-list__label">Search availability</span>
              <strong>After explicit indexing</strong>
            </div>
            <div className="summary-list__item">
              <span className="summary-list__label">Workspace delete</span>
              <strong>Only empty non-default workspaces</strong>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
