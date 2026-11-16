import { Button } from "./ui";

const LOOM_SHARE_URL = "https://www.loom.com/share/c74743c06c9241ceb1d7588408c8e656";
const LOOM_EMBED_URL = "https://www.loom.com/embed/c74743c06c9241ceb1d7588408c8e656";

export function WalkthroughCard({ onHide }: { onHide: () => void }) {
  return (
    <section className="panel" id="walkthrough">
      <div className="panel-header">
        <div>
          <div className="section-title">How to use Web Saver</div>
          <div className="muted">A short walkthrough of connecting Dropbox and saving a file.</div>
        </div>
        <Button onClick={onHide} variant="secondary">
          Hide
        </Button>
      </div>
      <div className="stack">
        <div className="walkthrough-frame">
          <iframe
          allow="fullscreen"
          referrerPolicy="no-referrer"
            src={LOOM_EMBED_URL}
            title="How to Save Web Assets to Dropbox"
          />
        </div>
        <div className="muted">
          <a href={LOOM_SHARE_URL} rel="noopener noreferrer" target="_blank">
            Open on Loom
          </a>
        </div>
      </div>
    </section>
  );
}
