import { type AssetSummary } from '../../lib/api';
import { Button, EmptyState, Section, formatDateTime } from '../../lib/ui';
import { StatusBadge } from '../assets/assets';

type WorkspaceHomeScreenProps = {
  workspaceName: string;
  currentUserEmail: string;
  assets: AssetSummary[];
  selectedAsset: AssetSummary | null;
  searchableAssetCount: number;
  activeQuery: string | null;
  onOpenLibrary: () => void;
  onOpenSearch: () => void;
  onOpenAsset: (assetId: string) => void;
  onOpenSettings: () => void;
};

function formatCountLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function WorkspaceHomeScreen({
  workspaceName,
  currentUserEmail,
  assets,
  selectedAsset,
  searchableAssetCount,
  activeQuery,
  onOpenLibrary,
  onOpenSearch,
  onOpenAsset,
  onOpenSettings,
}: WorkspaceHomeScreenProps) {
  const processingCount = assets.filter((asset) => asset.assetStatus === 'PROCESSING').length;
  const transcriptReadyCount = assets.filter((asset) => asset.assetStatus === 'TRANSCRIPT_READY').length;
  const recentAssets = [...assets]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 5);

  const nextAction = assets.length === 0
    ? {
        title: 'Upload the first lecture video',
        description: 'Start the real product flow by adding a lecture video to this workspace.',
        buttonLabel: 'Open library',
        onClick: onOpenLibrary,
      }
    : transcriptReadyCount > 0
      ? {
          title: 'Review a transcript that is ready to index',
          description: 'At least one asset has transcript rows ready. Review it and explicitly publish it to search.',
          buttonLabel: 'Open asset detail',
          onClick: () => onOpenAsset(
            assets.find((asset) => asset.assetStatus === 'TRANSCRIPT_READY')?.assetId ?? recentAssets[0]?.assetId ?? '',
          ),
        }
      : searchableAssetCount > 0
        ? {
            title: 'Search the current workspace',
            description: 'Indexed assets are available now, so the next best step is to validate search and context recovery.',
            buttonLabel: 'Open search',
            onClick: onOpenSearch,
          }
        : {
            title: 'Track processing and transcript readiness',
            description: 'Your next action is likely in the asset detail screen while processing finishes.',
            buttonLabel: 'Open library',
            onClick: onOpenLibrary,
          };

  return (
    <div className="screen-stack">
      <Section
        title="Workspace Home"
        eyebrow={workspaceName}
        actions={<span className="panel-pill">{formatCountLabel(assets.length, 'asset', 'assets')}</span>}
      >
        <div className="summary-hero">
          <div className="summary-hero__copy">
            <p className="hero__eyebrow">Current workspace</p>
            <h3>{workspaceName}</h3>
            <p>
              Keep uploads, transcript review, explicit indexing, and workspace search moving through one clear pre-AI workflow.
            </p>
          </div>
          <div className="summary-hero__actions">
            <Button type="button" onClick={nextAction.onClick} disabled={nextAction.buttonLabel === 'Open asset detail' && !recentAssets[0]}>
              {nextAction.buttonLabel}
            </Button>
            <Button type="button" tone="ghost" onClick={onOpenSettings}>
              Manage workspace
            </Button>
          </div>
        </div>

        <div className="metric-grid">
          <div className="metric-card">
            <span className="metric-card__label">Searchable</span>
            <strong>{searchableAssetCount}</strong>
            <p>{searchableAssetCount > 0 ? 'Search is available for indexed assets.' : 'Search unlocks after explicit indexing.'}</p>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Transcript ready</span>
            <strong>{transcriptReadyCount}</strong>
            <p>{transcriptReadyCount > 0 ? 'Review and publish these assets to search.' : 'No assets are waiting for indexing right now.'}</p>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Processing</span>
            <strong>{processingCount}</strong>
            <p>{processingCount > 0 ? 'Processing is still underway for some assets.' : 'No assets are currently processing.'}</p>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Current query</span>
            <strong>{activeQuery ?? 'None yet'}</strong>
            <p>{activeQuery ? 'Search activity stays scoped to this workspace.' : 'Use search after at least one asset becomes searchable.'}</p>
          </div>
        </div>
      </Section>

      <div className="screen-grid screen-grid--home">
        <Section title="Recent assets" eyebrow={workspaceName}>
          {recentAssets.length === 0 ? (
            <EmptyState
              title="No lecture videos yet"
              description="Open the library to upload a lecture video and start the transcript workflow."
            />
          ) : (
            <div className="compact-list">
              {recentAssets.map((asset) => (
                <button
                  key={asset.assetId}
                  type="button"
                  className={`compact-list__button ${selectedAsset?.assetId === asset.assetId ? 'compact-list__button--active' : ''}`}
                  onClick={() => onOpenAsset(asset.assetId)}
                >
                  <div className="compact-list__header">
                    <strong>{asset.title}</strong>
                    <StatusBadge status={asset.assetStatus} />
                  </div>
                  <span>{formatDateTime(asset.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </Section>

        <div className="screen-stack">
          <Section title="Next action" eyebrow="Workflow guidance">
            <div className="guidance-card">
              <strong>{nextAction.title}</strong>
              <p>{nextAction.description}</p>
              <Button type="button" onClick={nextAction.onClick} disabled={nextAction.buttonLabel === 'Open asset detail' && !recentAssets[0]}>
                {nextAction.buttonLabel}
              </Button>
            </div>
          </Section>

          <Section title="Workspace context" eyebrow="Session">
            <div className="summary-list">
              <div className="summary-list__item">
                <span className="summary-list__label">Signed in as</span>
                <strong>{currentUserEmail}</strong>
              </div>
              <div className="summary-list__item">
                <span className="summary-list__label">Focused asset</span>
                <strong>{selectedAsset?.title ?? 'None selected'}</strong>
              </div>
              <div className="summary-list__item">
                <span className="summary-list__label">Search readiness</span>
                <strong>{searchableAssetCount > 0 ? 'Ready' : 'Locked until indexing'}</strong>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
