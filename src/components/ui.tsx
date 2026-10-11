import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function Spinner({ size = "sm" }: { size?: "sm" | "lg" }) {
  return <span aria-hidden="true" className={`spinner${size === "lg" ? " lg" : ""}`} />;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  block?: boolean;
  large?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  block = false,
  large = false,
  className,
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    `${variant}-button`,
    block ? "button-block" : "",
    large ? "button-lg" : "",
    className ?? "",
  ].filter(Boolean).join(" ");
  return (
    <button
      {...rest}
      aria-busy={loading || undefined}
      className={classes}
      disabled={disabled || loading}
      type={type}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export type StatusTone = "info" | "success" | "error";

const STATUS_ICONS: Record<StatusTone, string> = {
  info: "i",
  success: "✓",
  error: "!",
};

export function StatusMessage({ tone = "info", children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <div className={`callout ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span aria-hidden="true" className="callout-icon">{STATUS_ICONS[tone]}</span>
      <div className="break-anywhere">{children}</div>
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-label="Loading" className="stack-sm" role="status">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton" key={index} />
      ))}
    </div>
  );
}

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <div className="copy-field">
      <code>{value}</code>
      <Button
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => setCopied(true));
        }}
        variant="ghost"
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label className="toggle">
      <span className="stack-sm">
        <span className="field-label">{label}</span>
        {description ? <span className="muted">{description}</span> : null}
      </span>
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        role="switch"
        type="checkbox"
      />
      <span aria-hidden="true" className="toggle-track" />
    </label>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  description?: string;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  description,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div aria-label={label} className="segmented" role="group">
        {options.map((option) => (
          <button
            aria-pressed={option.value === value}
            disabled={disabled}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      {description ? <span className="muted">{description}</span> : null}
    </div>
  );
}
