import { useMemo, useState } from "react";
import { useTranslation } from "../i18n/useTranslation";

type RecentWorkspaceCard = {
  id: string;
  label: string;
  rootName: string;
  savedAt: number;
};

type WorkspaceProgressCard = {
  message: string;
  currentPath: string | null;
  percent: number | null;
  processedCount: number;
  totalCount: number | null;
  phase: string;
};

type WelcomeHomeProps = {
  onCreateUiDocument: () => void;
  onForgetCachedWorkspace: () => void;
  onImportWorkspace: () => void;
  onOpenWorkspace: () => void;
  onRemoveRecentWorkspace: (workspaceId: string) => void;
  onRestoreCachedWorkspace: (workspaceId?: string) => void;
  currentWorkspaceLabel: string | null;
  currentWorkspaceProfile: string;
  recentWorkspaces: RecentWorkspaceCard[];
  rememberedWorkspace: { label: string; savedAt: number } | null;
  workspaceProgress: WorkspaceProgressCard | null;
};

export function WelcomeHome({
  onCreateUiDocument,
  onForgetCachedWorkspace,
  onImportWorkspace,
  onOpenWorkspace,
  onRemoveRecentWorkspace,
  onRestoreCachedWorkspace,
  currentWorkspaceLabel,
  currentWorkspaceProfile,
  recentWorkspaces,
  rememberedWorkspace,
  workspaceProgress
}: WelcomeHomeProps) {
  const { t } = useTranslation();
  const [dashboardSection, setDashboardSection] = useState<"home" | "projects" | "editors">("home");
  const [projectQuery, setProjectQuery] = useState("");
  const [projectSort, setProjectSort] = useState<"recent" | "name">("recent");
  const workspaceActivityLabel = workspaceProgress
    ? t('status.running')
    : currentWorkspaceLabel
      ? t('status.ready')
      : t('status.idle');
  const recentWorkspaceEntries = recentWorkspaces.slice(0, 6);
  const filteredRecentWorkspaces = useMemo(() => {
    const normalizedQuery = projectQuery.trim().toLowerCase();
    const baseList = recentWorkspaces.filter((workspace) =>
      normalizedQuery
        ? workspace.label.toLowerCase().includes(normalizedQuery) || workspace.rootName.toLowerCase().includes(normalizedQuery)
        : true
    );
    return [...baseList].sort((left, right) => (
      projectSort === "name"
        ? left.label.localeCompare(right.label)
        : right.savedAt - left.savedAt
    ));
  }, [projectQuery, projectSort, recentWorkspaces]);

  if (currentWorkspaceLabel) {
    return (
      <div className="welcome welcome--workspace-empty">
        <section className="scene-empty">
          <div className="scene-empty__viewport">
            <div className="scene-empty__overlay">
              <section className="scene-empty__panel">
                <div className="scene-empty__panel-head">
                  <span className="welcome__eyebrow">{t('dashboard.scene')}</span>
                  <span className="scene-empty__state">{workspaceActivityLabel}</span>
                </div>
                <div className="scene-empty__panel-copy">
                  <h2>{currentWorkspaceLabel}</h2>
                  <p>
                    {t('dashboard.noDocumentHint')}
                  </p>
                </div>
                <div className="welcome__hero-actions">
                  <button type="button" className="toolbar__button toolbar__button--primary" onClick={onCreateUiDocument}>
                    {t('file.newUiLayout')}
                  </button>
                  <button type="button" className="toolbar__button" onClick={onImportWorkspace}>
                    {t('file.importFolder')}
                  </button>
                  <button type="button" className="toolbar__button" onClick={() => onRestoreCachedWorkspace()}>
                    {t('welcome.openLatest')}
                  </button>
                </div>
                <div className="scene-empty__metrics">
                  <article className="scene-empty__metric">
                    <span>{t('metrics.workspace')}</span>
                    <strong>{currentWorkspaceLabel}</strong>
                    <small>{currentWorkspaceProfile}</small>
                  </article>
                  <article className="scene-empty__metric">
                    <span>{t('status.workspace')}</span>
                    <strong>{workspaceActivityLabel}</strong>
                    <small>{workspaceProgress ? workspaceProgress.message : t('welcome.sceneReady')}</small>
                  </article>
                  <article className="scene-empty__metric">
                    <span>{t('metrics.recentProjects')}</span>
                    <strong>{recentWorkspaces.length}</strong>
                    <small>{rememberedWorkspace ? `${t('dashboard.latestProject')}: ${rememberedWorkspace.label}` : t('dashboard.noCachedProject')}</small>
                  </article>
                </div>
                {workspaceProgress ? (
                  <section className="welcome__progress-card">
                    <div className="welcome__progress-copy">
                      <strong>{workspaceProgress.message}</strong>
                      <span>
                        {workspaceProgress.percent !== null
                          ? `${workspaceProgress.percent}% · ${workspaceProgress.processedCount}/${workspaceProgress.totalCount ?? 0}`
                          : `${workspaceProgress.processedCount} ${t('app.itemsIndexed')}`}
                      </span>
                      {workspaceProgress.currentPath ? <small>{workspaceProgress.currentPath}</small> : null}
                    </div>
                    <div className="welcome__progress-track">
                      <div
                        className={`welcome__progress-bar${workspaceProgress.percent === null ? " welcome__progress-bar--indeterminate" : ""}`}
                        style={workspaceProgress.percent !== null ? { width: `${workspaceProgress.percent}%` } : undefined}
                      />
                    </div>
                  </section>
                ) : null}
              </section>
              <aside className="scene-empty__sidebar">
                <div className="scene-empty__sidebar-head">
                  <div>
                    <span className="welcome__eyebrow">{t('metrics.recentProjects')}</span>
                    <h3>{t('welcome.projects')}</h3>
                  </div>
                  <div className="scene-empty__sidebar-actions">
                    <button type="button" className="toolbar__button" onClick={() => onRestoreCachedWorkspace()}>
                      {t('welcome.openLatest')}
                    </button>
                    <button type="button" className="toolbar__button" disabled={recentWorkspaces.length <= 0} onClick={onForgetCachedWorkspace}>
                      {t('welcome.clear')}
                    </button>
                  </div>
                </div>
                <div className="scene-empty__recent-list">
                  {recentWorkspaceEntries.length > 0 ? recentWorkspaceEntries.map((workspace) => (
                    <article key={workspace.id} className="scene-empty__recent-item">
                      <div className="scene-empty__recent-copy">
                        <strong>{workspace.label}</strong>
                        <span>{workspace.rootName}</span>
                        <small>{formatSavedAt(workspace.savedAt)}</small>
                      </div>
                      <div className="scene-empty__recent-actions">
                        <button type="button" className="toolbar__button toolbar__button--primary" onClick={() => onRestoreCachedWorkspace(workspace.id)}>
                          {t('welcome.open')}
                        </button>
                        <button type="button" className="toolbar__button" onClick={() => onRemoveRecentWorkspace(workspace.id)}>
                          {t('welcome.remove')}
                        </button>
                      </div>
                    </article>
                  )) : (
                    <article className="scene-empty__recent-item scene-empty__recent-item--empty">
                      <strong>{t('dashboard.noProjects')}</strong>
                      <span>{t('dashboard.chooseProject')}</span>
                    </article>
                  )}
                </div>
              </aside>
            </div>
            <div className="scene-empty__origin" />
          </div>
          <div className="scene-empty__statusbar">
            <span>{currentWorkspaceLabel}</span>
            <span>{currentWorkspaceProfile}</span>
            <span>{workspaceActivityLabel}</span>
            <span>{rememberedWorkspace ? `${t('dashboard.latestProject')}: ${rememberedWorkspace.label}` : t('dashboard.noCachedProject')}</span>
            <span>{recentWorkspaces.length} {t('metrics.recentProjects').toLowerCase()}</span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="welcome welcome--dashboard">
      <section className="dashboard-hub">
        <aside className="dashboard-hub__sidebar" data-dashboard-nav>
          <div className="dashboard-hub__brand">
            <span className="dashboard-hub__brand-mark">BRM</span>
            <div>
              <strong>{t('dashboard.dashboard')}</strong>
              <small>{t('dashboard.creatorCenter')}</small>
            </div>
          </div>
          <nav className="dashboard-hub__nav">
            {([
              ["home", t('dashboard.home')],
              ["projects", t('dashboard.projects')],
              ["editors", t('dashboard.editors')]
            ] as Array<["home" | "projects" | "editors", string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`dashboard-hub__nav-item${dashboardSection === value ? " dashboard-hub__nav-item--active" : ""}`}
                onClick={() => setDashboardSection(value)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="dashboard-hub__sidebar-status">
            <article>
              <span>{t('dashboard.status')}</span>
              <strong>{workspaceActivityLabel}</strong>
            </article>
            <article>
              <span>{t('dashboard.recent')}</span>
              <strong>{recentWorkspaces.length}</strong>
            </article>
            <article>
              <span>{t('dashboard.latest')}</span>
              <strong>{rememberedWorkspace?.label ?? t('dashboard.none')}</strong>
            </article>
          </div>
        </aside>
        <div className="dashboard-hub__content">
          <header className="dashboard-hub__hero">
            <div>
              <span className="welcome__eyebrow">{t('dashboard.project')}</span>
              <h2>{t('dashboard.chooseProject')}</h2>
            </div>
            <div className="dashboard-hub__hero-actions">
              <button type="button" className="toolbar__button toolbar__button--primary" onClick={onOpenWorkspace}>
                {t('welcome.openProject')}
              </button>
              <button type="button" className="toolbar__button" onClick={onImportWorkspace}>
                {t('welcome.importFolder')}
              </button>
              <button type="button" className="toolbar__button" onClick={onCreateUiDocument}>
                {t('welcome.newUiLayout')}
              </button>
            </div>
          </header>

          <div className="dashboard-hub__toolbar">
            <div className="dashboard-hub__toolbar-group">
              <input
                className="panel__search"
                placeholder={t('dashboard.searchProjects')}
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
              />
              <select className="panel__inline-select" value={projectSort} onChange={(event) => setProjectSort(event.target.value as "recent" | "name")}>
                <option value="recent">{t('dashboard.sortRecent')}</option>
                <option value="name">{t('dashboard.sortName')}</option>
              </select>
            </div>
            <div className="dashboard-hub__toolbar-group">
              <span className="toolbar__status-pill">{filteredRecentWorkspaces.length} {t('dashboard.projects')}</span>
              <span className="toolbar__status-pill">{workspaceActivityLabel}</span>
            </div>
          </div>

          {dashboardSection === "home" ? (
            <div className="dashboard-hub__grid">
              <section className="dashboard-hub__panel">
                <div className="dashboard-hub__panel-head">
                  <div>
                    <span className="welcome__eyebrow">{t('welcome.recent')}</span>
                    <h3>{t('welcome.projects')}</h3>
                  </div>
                  <div className="scene-empty__sidebar-actions">
                    <button type="button" className="toolbar__button" onClick={() => onRestoreCachedWorkspace()}>
                      {t('welcome.openLatest')}
                    </button>
                    <button type="button" className="toolbar__button" disabled={recentWorkspaces.length <= 0} onClick={onForgetCachedWorkspace}>
                      {t('welcome.clear')}
                    </button>
                  </div>
                </div>
                <div className="dashboard-hub__project-list">
                  {filteredRecentWorkspaces.length > 0 ? filteredRecentWorkspaces.slice(0, 6).map((workspace) => (
                    <article key={workspace.id} className="dashboard-hub__project-card">
                      <div>
                        <strong>{workspace.label}</strong>
                        <span>{workspace.rootName}</span>
                        <small>{formatSavedAt(workspace.savedAt)}</small>
                      </div>
                      <div className="dashboard-hub__project-actions">
                        <button type="button" className="toolbar__button toolbar__button--primary" onClick={() => onRestoreCachedWorkspace(workspace.id)}>
                          {t('welcome.open')}
                        </button>
                        <button type="button" className="toolbar__button" onClick={() => onRemoveRecentWorkspace(workspace.id)}>
                          {t('welcome.remove')}
                        </button>
                      </div>
                    </article>
                  )) : (
                    <article className="dashboard-hub__project-card dashboard-hub__project-card--empty">
                      <strong>{t('dashboard.noCachedProjectsTitle')}</strong>
                      <span>{t('dashboard.noCachedProjectsHint')}</span>
                    </article>
                  )}
                </div>
              </section>

              <section className="dashboard-hub__panel">
                <div className="dashboard-hub__panel-head">
                  <div>
                    <span className="welcome__eyebrow">{t('dashboard.editors')}</span>
                    <h3>{t('dashboard.workspaceTools')}</h3>
                  </div>
                </div>
                <div className="dashboard-hub__tool-grid">
                  <article className="dashboard-hub__tool-card">
                    <strong>{t('tool.uiLayoutEditor')}</strong>
                    <p>{t('tool.uiLayoutEditorDesc')}</p>
                  </article>
                  <article className="dashboard-hub__tool-card">
                    <strong>{t('tool.avatarEffectLabs')}</strong>
                    <p>{t('tool.avatarEffectLabsDesc')}</p>
                  </article>
                  <article className="dashboard-hub__tool-card">
                    <strong>{t('tool.atlasBmfontMap')}</strong>
                    <p>{t('tool.atlasBmfontMapDesc')}</p>
                  </article>
                </div>
              </section>
            </div>
          ) : dashboardSection === "projects" ? (
            <section className="dashboard-hub__panel dashboard-hub__panel--table">
              <div className="dashboard-hub__panel-head">
                <div>
                  <span className="welcome__eyebrow">{t('dashboard.projects')}</span>
                  <h3>{t('dashboard.projectList')}</h3>
                </div>
              </div>
              <div className="dashboard-hub__project-table">
                {filteredRecentWorkspaces.length > 0 ? filteredRecentWorkspaces.map((workspace, index) => (
                  <article key={workspace.id} className="dashboard-hub__project-row">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{workspace.label}</strong>
                    <span>{workspace.rootName}</span>
                    <small>{formatSavedAt(workspace.savedAt)}</small>
                    <div className="dashboard-hub__project-actions">
                      <button type="button" className="toolbar__button toolbar__button--primary" onClick={() => onRestoreCachedWorkspace(workspace.id)}>
                        {t('welcome.open')}
                      </button>
                      <button type="button" className="toolbar__button" onClick={() => onRemoveRecentWorkspace(workspace.id)}>
                        {t('welcome.remove')}
                      </button>
                    </div>
                  </article>
                )) : (
                  <article className="dashboard-hub__project-card dashboard-hub__project-card--empty">
                    <strong>{t('dashboard.noProjectsAvailable')}</strong>
                    <span>{t('dashboard.noProjectsAvailableHint')}</span>
                  </article>
                )}
              </div>
            </section>
          ) : (
            <section className="dashboard-hub__panel">
              <div className="dashboard-hub__panel-head">
                <div>
                  <span className="welcome__eyebrow">{t('dashboard.editors')}</span>
                  <h3>{t('dashboard.editorsTitle')}</h3>
                </div>
              </div>
              <div className="dashboard-hub__editor-list">
                <article className="dashboard-hub__editor-card">
                  <strong>{t('brand.name')}</strong>
                  <span>{t('brand.tagline')}</span>
                </article>
                <article className="dashboard-hub__editor-card">
                  <strong>{t('brand.legacyLabs')}</strong>
                  <span>{t('brand.legacyLabsDesc')}</span>
                </article>
              </div>
            </section>
          )}

          {workspaceProgress ? (
            <section className="welcome__progress-card">
              <div className="welcome__progress-copy">
                <strong>{workspaceProgress.message}</strong>
                <span>
                  {workspaceProgress.percent !== null
                    ? `${workspaceProgress.percent}% · ${workspaceProgress.processedCount}/${workspaceProgress.totalCount ?? 0}`
                    : `${workspaceProgress.processedCount} ${t('app.itemsIndexed')}`}
                </span>
                {workspaceProgress.currentPath ? <small>{workspaceProgress.currentPath}</small> : null}
              </div>
              <div className="welcome__progress-track">
                <div
                  className={`welcome__progress-bar${workspaceProgress.percent === null ? " welcome__progress-bar--indeterminate" : ""}`}
                  style={workspaceProgress.percent !== null ? { width: `${workspaceProgress.percent}%` } : undefined}
                />
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function formatSavedAt(savedAt: number): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(savedAt);
  } catch {
    return new Date(savedAt).toLocaleString();
  }
}
