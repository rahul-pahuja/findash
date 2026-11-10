import { useEffect, useMemo, useRef, useState } from "react";
import type { Goal } from "../lib/types";
import type { GoalStatus } from "../utils/goalProjection";
import { formatCompactCurrency, getNiceAxisBounds } from "../utils/format";

export interface GoalCrossing { months: number; label: string }
export interface GoalProjectionView { goal: Goal; expected: GoalCrossing | null; zero: GoalCrossing | null }

interface Props {
  projections: Array<GoalProjectionView & { status: GoalStatus | null; required: number | null }>;
  /** Goal ids drawn as lines (nearest dates first, capped at four). */
  drawnIds: string[];
  current: number;
  latestDate: string;
  pace: number | null;
  expectedReturn: number | null;
  showZeroScenario: boolean;
  masked: boolean;
  canProject: boolean;
  hoveredId: string | null;
  onHoverGoal: (id: string | null) => void;
}

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;
const WIDTH = 1000;
const BASE_HEIGHT = 260;

function parseDate(date: string) { const [y, m, d] = date.split("-").map(Number); return { y, m, d }; }
function monthsToMs(latestDate: string, months: number) { const { y, m, d } = parseDate(latestDate); return Date.UTC(y, m - 1 + months, d); }
function monthYearLabel(date: string) {
  const { y, m } = parseDate(date);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}
function scenarioValue(current: number, pace: number, annualRate: number, months: number) {
  const rate = annualRate === 0 ? 0 : Math.pow(1 + annualRate, 1 / 12) - 1;
  const growth = Math.pow(1 + rate, months);
  return current * growth + (rate === 0 ? pace * months : pace * (growth - 1) / rate);
}

export function GoalTimeline({ projections, drawnIds, current, latestDate, pace, expectedReturn, showZeroScenario, masked, canProject, hoveredId, onHoverGoal }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderedWidth, setRenderedWidth] = useState(1000);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((observerEntries) => setRenderedWidth(observerEntries[0].contentRect.width || 1000));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // On narrow screens the viewBox shrinks; scale unit-space constants so text and
  // markers keep their rendered pixel size.
  const k = Math.max(1, WIDTH / Math.max(renderedWidth, 1));
  const height = BASE_HEIGHT * k;

  const drawn = useMemo(() => drawnIds
    .flatMap((id) => {
      const view = projections.find((item) => item.goal.id === id);
      return view ? [view] : [];
    }), [projections, drawnIds]);

  const geometry = useMemo(() => {
    // Projections are based on the latest saved snapshot, so the plotted line
    // and crossing markers must share that same time origin.
    const t0 = Date.parse(`${latestDate}T00:00:00Z`);
    const cap = t0 + 30 * YEAR_MS;
    const targetDates = drawn.map(({ goal }) => goal.targetDate ? Date.parse(`${goal.targetDate}T00:00:00Z`) : null).filter((ms): ms is number => ms !== null);
    const crossingDates: number[] = [];
    for (const { expected, zero } of drawn) {
      for (const crossing of [expected, zero]) {
        if (!crossing) continue;
        const ms = monthsToMs(latestDate, crossing.months);
        if (ms <= cap) crossingDates.push(ms);
      }
    }
    const horizon = canProject && crossingDates.length ? Math.min(Math.max(...crossingDates), cap) : t0 + 30 * YEAR_MS;
    const xEnd = Math.max(horizon, t0 + YEAR_MS, ...targetDates);
    const nice = getNiceAxisBounds([0, current, ...drawn.map(({ goal }) => goal.targetAmount)], 2);
    return { t0, xEnd, yMax: nice.max, yStep: nice.step };
  }, [drawn, latestDate, current, canProject]);

  const { t0, xEnd, yMax, yStep } = geometry;
  const PLOT = {
    left: 8 * k,
    right: WIDTH - 48 * k,
    top: 30 * k,
    bottom: height - 32 * k
  };
  const xScale = (ms: number) => PLOT.left + Math.max(0, Math.min(1, (ms - t0) / (xEnd - t0))) * (PLOT.right - PLOT.left);
  const yScale = (value: number) => PLOT.bottom - Math.max(0, value) / yMax * (PLOT.bottom - PLOT.top);
  const money = (value: number) => formatCompactCurrency(value, masked);
  const textStyle = (weight = 400, fill?: string) => ({ fontSize: `${11.5 * k}px`, fontWeight: weight, ...(fill ? { fill } : {}) });

  function curvePath(annualRate: number) {
    if (pace === null) return "";
    const maxMonths = Math.ceil((xEnd - t0) / DAY_MS / 30.4375);
    let path = `M ${xScale(t0).toFixed(2)} ${yScale(current).toFixed(2)}`;
    for (let month = 1; month <= maxMonths; month += 1) {
      const value = scenarioValue(current, pace, annualRate, month);
      const x = xScale(monthsToMs(latestDate, month));
      if (x > PLOT.right) break;
      path += ` L ${x.toFixed(2)} ${yScale(Math.min(value, yMax)).toFixed(2)}`;
      if (value > yMax) break;
    }
    return path;
  }

  const yearSpan = (xEnd - t0) / YEAR_MS;
  const yearStep = [1, 2, 4, 5, 10, 20].find((step) => yearSpan / step <= 8) ?? 25;
  const startYear = parseDate(latestDate).y;
  const endYear = Math.ceil((t0 + yearSpan * YEAR_MS) / YEAR_MS) + 1;
  const yearTicks: number[] = [];
  for (let year = startYear; year <= endYear; year += yearStep) yearTicks.push(Date.UTC(year, 0, 1));
  const yTicks: number[] = [];
  for (let value = 0; value <= yMax; value += yStep) yTicks.push(Math.round(value * 100) / 100);

  const labelLayout = useMemo(() => {
    const layout: Record<string, { side: "left" | "right"; y: number }> = {};
    const items = drawn.map(({ goal }) => ({
      id: goal.id,
      rawY: yScale(goal.targetAmount),
      targetAmount: goal.targetAmount,
      hasTargetDate: Boolean(goal.targetDate)
    }));

    items.sort((a, b) => a.rawY - b.rawY);

    for (let i = 0; i < items.length; i++) {
      const defaultSide = items[i].hasTargetDate || items[i].targetAmount <= yMax / 2 ? "right" : "left";
      layout[items[i].id] = { side: defaultSide, y: items[i].rawY - 7 * k };
    }

    for (const side of ["left", "right"] as const) {
      const sideItems = items.filter((it) => layout[it.id].side === side).sort((a, b) => layout[a.id].y - layout[b.id].y);
      for (let i = 1; i < sideItems.length; i++) {
        const prev = sideItems[i - 1];
        const curr = sideItems[i];
        if (layout[curr.id].y - layout[prev.id].y < 22 * k) {
          layout[curr.id].y = layout[prev.id].y + 22 * k;
        }
      }
    }

    return layout;
  }, [drawn, yMax, k]);

  return <div ref={containerRef} className="goal-timeline-wrap">
    <svg className="goal-timeline" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Goal timeline showing projected net worth against each goal target">
      <defs>
        <clipPath id="goal-timeline-clip"><rect x={0} y={PLOT.top - height} width={WIDTH} height={height * 3} /></clipPath>
      </defs>

      {/* Vertical guide lines from target dates */}
      {drawn.map(({ goal }) => goal.targetDate ? (
        <line
          key={`guide-${goal.id}`}
          className="goal-timeline-guide goal-timeline-guide-dash"
          x1={xScale(Date.parse(`${goal.targetDate}T00:00:00Z`))}
          x2={xScale(Date.parse(`${goal.targetDate}T00:00:00Z`))}
          y1={yScale(goal.targetAmount)}
          y2={PLOT.bottom}
        />
      ) : null)}

      {/* Vertical drop lines from projected crossings (future only) */}
      {drawn.map(({ goal, expected, zero }) => {
        const y = yScale(goal.targetAmount);
        const crossings = [
          expected && expected.months > 0 ? { key: "expected", ms: monthsToMs(latestDate, expected.months) } : null,
          zero && zero.months > 0 ? { key: "zero", ms: monthsToMs(latestDate, zero.months) } : null
        ].filter(Boolean);

        return crossings.map((item) => (
          <line
            key={`drop-${goal.id}-${item!.key}`}
            className="goal-timeline-drop-guide"
            x1={xScale(item!.ms)}
            x2={xScale(item!.ms)}
            y1={y}
            y2={PLOT.bottom}
          />
        ));
      })}

      <line className="goal-timeline-baseline" x1={PLOT.left} x2={PLOT.right} y1={PLOT.bottom} y2={PLOT.bottom} />

      {yTicks.map((tick) => <text key={`y-${tick}`} className="goal-timeline-tick" style={textStyle()} x={PLOT.right + 10 * k} y={yScale(tick) + 4 * k}>{money(tick)}</text>)}
      {yearTicks.map((ms) => {
        const x = Math.max(PLOT.left, Math.min(PLOT.right, xScale(ms)));
        return <text key={`x-${ms}`} className="goal-timeline-tick" style={textStyle()} x={x} y={PLOT.bottom + 22 * k} textAnchor={ms === yearTicks[0] ? "start" : "middle"}>{new Date(ms).getUTCFullYear()}</text>;
      })}

      <g clipPath="url(#goal-timeline-clip)">
        {pace !== null && expectedReturn !== null ? <path className="goal-timeline-scenario is-expected" style={{ strokeWidth: 2.5 * k }} d={curvePath(expectedReturn)} /> : null}
        {pace !== null && showZeroScenario && expectedReturn !== 0 ? <path className="goal-timeline-scenario is-zero" style={{ strokeWidth: 2 * k, strokeDasharray: `${6 * k} ${6 * k}` }} d={curvePath(0)} /> : null}
      </g>

      {drawn.map(({ goal }) => {
        const y = yScale(goal.targetAmount);
        const pos = labelLayout[goal.id] ?? { side: "right", y: y - 7 * k };
        const dimmed = hoveredId !== null && hoveredId !== goal.id;
        const targetMs = goal.targetDate ? Date.parse(`${goal.targetDate}T00:00:00Z`) : null;
        const isAchieved = goal.targetAmount <= current;
        return <g key={goal.id} className={dimmed ? "is-dimmed" : hoveredId === goal.id ? "is-hovered" : ""} onPointerEnter={() => onHoverGoal(goal.id)} onPointerLeave={() => onHoverGoal(null)}>
          <line className="goal-timeline-goal-line" style={{ strokeWidth: 1.1 * k, strokeDasharray: `${1.5 * k} ${4.5 * k}`, opacity: isAchieved ? 0.38 : 0.65 }} x1={PLOT.left} x2={PLOT.right} y1={y} y2={y} />
          <text className="goal-timeline-goal-label" style={textStyle(650)} x={pos.side === "right" ? PLOT.right - 2 * k : PLOT.left + 2 * k} y={pos.y} textAnchor={pos.side === "right" ? "end" : "start"}>
            {goal.name} · {money(goal.targetAmount)}
          </text>
          {targetMs !== null ? <>
            <path className="goal-timeline-diamond" d={`M ${xScale(targetMs)} ${y - 5.5 * k} l ${5.5 * k} ${5.5 * k} l ${-5.5 * k} ${5.5 * k} l ${-5.5 * k} ${-5.5 * k} Z`} />
            <text className="goal-timeline-date-label" style={textStyle(600)} x={xScale(targetMs)} y={y - 11 * k} textAnchor="middle">{monthYearLabel(goal.targetDate!)}</text>
          </> : null}
        </g>;
      })}

      {drawn.map(({ goal, expected, zero }) => {
        const y = yScale(goal.targetAmount);
        const dots: Array<{ key: string; ms: number; kind: "expected" | "zero"; label: string }> = [];
        if (expected && expected.months > 0) dots.push({ key: "expected", ms: monthsToMs(latestDate, expected.months), kind: "expected", label: expected.label });
        if (zero && zero.months > 0) dots.push({ key: "zero", ms: monthsToMs(latestDate, zero.months), kind: "zero", label: zero.label });
        return dots.map(({ key, ms, kind, label }) => {
          const x = xScale(ms);
          const anchor = x > PLOT.right - 60 * k ? "end" : x < PLOT.left + 60 * k ? "start" : "middle";
          return <g key={`${goal.id}-${key}`}>
            <circle className={`goal-timeline-crossing is-${kind}`} style={{ strokeWidth: 1.5 * k }} cx={x} cy={y} r={4.5 * k} />
            <text className="goal-timeline-crossing-label" style={textStyle()} x={x} y={y + 21 * k} textAnchor={anchor}>{label}</text>
          </g>;
        });
      })}

      <circle className="goal-timeline-here-dot" cx={xScale(t0)} cy={yScale(current)} r={5 * k} />
      {!canProject ? <text className="goal-timeline-here-label" style={textStyle(650)} x={xScale(t0) + 8 * k} y={yScale(current) - 10 * k}>You are here · {money(current)}</text> : null}

    </svg>
  </div>;
}
