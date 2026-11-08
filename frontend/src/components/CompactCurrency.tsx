import { getCompactCurrencyParts } from "../utils/format";

interface Props {
  value: number | null | undefined;
  masked: boolean;
  className?: string;
}

export function CompactCurrency({ value, masked, className }: Props) {
  const parts = getCompactCurrencyParts(value, masked);
  if (typeof parts === "string") return <>{parts}</>;

  return (
    <span className={className ? `compact-currency ${className}` : "compact-currency"}>
      <span>{parts.amount}</span>
      {parts.unit ? <><span className="compact-currency-space"> </span><small>{parts.unit}</small></> : null}
    </span>
  );
}
