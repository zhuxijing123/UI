export function WelcomeHome({ onCreateUiDocument }: { onCreateUiDocument: () => void }) {
  return (
    <div className="welcome">
      <div className="welcome__hero">
        <div>
          <span className="welcome__eyebrow">Integrated Legacy Toolchain</span>
          <h2>Build, inspect and repair the BRM asset pipeline from one workbench.</h2>
          <p>
            This first milestone already combines a UI layout editor, atlas/plist inspector, biz animation metadata
            viewer, text-meta editing and run-length map painting.
          </p>
        </div>
        <button type="button" className="toolbar__button toolbar__button--primary" onClick={onCreateUiDocument}>
          Create Starter Layout
        </button>
      </div>
      <div className="welcome__grid">
        <article>
          <h3>UI Layout</h3>
          <p>Hierarchy, viewport drag, inspector edits, JSON/Lua round-trip save.</p>
        </article>
        <article>
          <h3>Atlas / Plist</h3>
          <p>Frame metadata overlay and sprite sheet validation for UI skinning.</p>
        </article>
        <article>
          <h3>BIZ Bank</h3>
          <p>Legacy animation index inspection, file grouping and frame rect diagnostics.</p>
        </article>
        <article>
          <h3>MAPO</h3>
          <p>Logic grid painting with RLE save-back to support pathing and minimap workflows.</p>
        </article>
      </div>
    </div>
  );
}
