type PreviewCardProps = {
  label: string;
  src: string | null;
  active: boolean;
  onClick: () => void;
};

export function PreviewCard({
  label,
  src,
  active,
  onClick,
}: PreviewCardProps) {
  return (
    <button
      className={`preview-card ${active ? "active" : ""}`}
      onClick={onClick}
      type="button"
    >
      <span className="preview-card-label">{label}</span>
      {src ? (
        <img alt={`${label} preview`} src={src} />
      ) : (
        <div className="preview-card-placeholder">Waiting for image</div>
      )}
    </button>
  );
}
