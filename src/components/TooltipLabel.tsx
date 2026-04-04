type TooltipLabelProps = {
  label: string;
  hint: string;
};

export function TooltipLabel({ label, hint }: TooltipLabelProps) {
  return (
    <span className="tooltip-label">
      <span>{label}</span>
      <span
        aria-label={`${label} help`}
        className="tooltip-dot"
        title={hint}
      >
        i
      </span>
    </span>
  );
}
