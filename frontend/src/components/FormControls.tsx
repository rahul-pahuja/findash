import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  helper?: ReactNode;
  fieldClassName?: string;
};

export function FormInput({ label, helper, fieldClassName = "", className = "", id, ...props }: FormInputProps) {
  return <label className={`form-field ${fieldClassName}`.trim()} htmlFor={id}>
    {label ? <span className="form-field-label">{label}</span> : null}
    <input id={id} className={`form-input ${className}`.trim()} {...props} />
    {helper ? <small className="form-field-helper">{helper}</small> : null}
  </label>;
}

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  helper?: ReactNode;
  fieldClassName?: string;
  options: Array<{ value: string; label: string }>;
};

type SelectControlProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string; label: string }>;
  wrapperClassName?: string;
};

export function SelectControl({ options, wrapperClassName = "", className = "", id, ...props }: SelectControlProps) {
  return <span className={`select-control-wrap ${wrapperClassName}`.trim()}>
    <select id={id} className={`select-control ${className}`.trim()} {...props}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
  </span>;
}

export function FormSelect({ label, helper, fieldClassName = "", className = "", id, options, ...props }: FormSelectProps) {
  return <label className={`form-field ${fieldClassName}`.trim()} htmlFor={id}>
    {label ? <span className="form-field-label">{label}</span> : null}
    <SelectControl id={id} className={`form-select ${className}`.trim()} options={options} {...props} />
    {helper ? <small className="form-field-helper">{helper}</small> : null}
  </label>;
}

export function SwitchControl({ label, description, checked, onChange, className = "" }: { label: ReactNode; description?: ReactNode; checked: boolean; onChange: (checked: boolean) => void; className?: string }) {
  return <label className={`switch-row ${className}`.trim()}>
    <span className="switch-copy"><strong>{label}</strong>{description ? <small>{description}</small> : null}</span>
    <input className="switch-input" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="switch-track" aria-hidden="true"><i /></span>
  </label>;
}

export function SettingsRow({ label, description, children, className = "" }: { label: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return <div className={`settings-row ${className}`.trim()}>
    <div className="settings-row-copy"><strong>{label}</strong>{description ? <small>{description}</small> : null}</div>
    <div className="settings-row-control">{children}</div>
  </div>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, role = "group", className = "" }: { options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void; ariaLabel: string; role?: "group" | "tablist"; className?: string }) {
  return <div className={`segmented-control${className ? ` ${className}` : ""}`} role={role} aria-label={ariaLabel}>
    {options.map((option) => <button key={option.value} type="button" className={value === option.value ? "is-selected" : ""} onClick={() => onChange(option.value)} aria-pressed={role === "group" ? value === option.value : undefined} aria-selected={role === "tablist" ? value === option.value : undefined} role={role === "tablist" ? "tab" : undefined}>{option.label}</button>)}
  </div>;
}
