import { RECENT_SAVE_LIMIT } from "../lib/constants";
import type { RecentSaveRecord } from "../lib/types";
import { formatRelativeTime } from "../lib/utils/time";
import { getDropboxWebUrl } from "../lib/utils/url";
import { Button } from "./ui";

interface RecentSavesProps {
  items: RecentSaveRecord[];
  limit?: number;
  onViewAll?: () => void;
  onClear?: () => void;
  clearing?: boolean;
}

export function RecentSaves({ items, limit, onViewAll, onClear, clearing }: RecentSavesProps) {
  const visibleItems = limit ? items.slice(0, limit) : items;

  return (
    <div className="panel">
      <div className="panel-header" style={{ marginBottom: 0 }}>
        <div>
          <div className="section-title">Recent saves</div>
          <div className="muted">
            {limit && items.length > limit
              ? `Showing ${limit} of ${items.length}`
              : `Last ${RECENT_SAVE_LIMIT} saves`}
          </div>
        </div>
        {onViewAll && items.length > 0 ? (
          <button className="link-button" onClick={onViewAll} type="button">
            View all
          </button>
        ) : null}
        {onClear && items.length > 0 ? (
          <Button className="danger-text" loading={clearing} onClick={onClear} variant="ghost">
            Clear history
          </Button>
        ) : null}
      </div>
      <div className="recent-list">
        {visibleItems.length === 0 ? (
          <div className="empty-state">No saves yet. Right-click any image, video, or file link to save it.</div>
        ) : null}
        {visibleItems.map((item) => (
          <div className="recent-item" key={item.id}>
            <div className="row row-between">
              <strong className="truncate" title={item.filename}>{item.filename}</strong>
              <span className={`badge ${item.success ? "success" : "error"}`}>
                {item.success ? "Saved" : "Failed"}
              </span>
            </div>
            <div className="muted truncate">
              <time dateTime={new Date(item.timestamp).toISOString()} title={new Date(item.timestamp).toLocaleString()}>
                {formatRelativeTime(item.timestamp)}
              </time>
              {" · "}
              {item.sourceDomain}
            </div>
            {item.success ? (
              <div className="row row-between">
                <span className="path-pill" title={item.destinationPath}>{item.destinationPath}</span>
                <a className="nowrap" href={getDropboxWebUrl(item.destinationPath)} rel="noopener noreferrer" target="_blank">
                  Open in Dropbox
                </a>
              </div>
            ) : (
              <div className="muted danger-text break-anywhere">{item.message}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
