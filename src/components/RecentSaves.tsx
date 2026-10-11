import type { RecentSaveRecord } from "../lib/types";

interface RecentSavesProps {
  items: RecentSaveRecord[];
}

export function RecentSaves({ items }: RecentSavesProps) {
  return (
    <div className="panel">
      <div className="row row-between">
        <div className="section-title">Recent Saves</div>
        <div className="muted">{items.length} item(s)</div>
      </div>
      <div className="recent-list">
        {items.length === 0 ? <div className="empty-state">No saves yet.</div> : null}
        {items.map((item) => (
          <div className="recent-item" key={item.id}>
            <div className="row row-between">
              <strong className="truncate" title={item.filename}>{item.filename}</strong>
              <span className={`badge ${item.success ? "success" : "error"}`}>
                {item.success ? "Saved" : "Failed"}
              </span>
            </div>
            <div className="muted">{item.sourceDomain}</div>
            <div className="muted">{item.destinationPath}</div>
            <div className="muted">{item.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
