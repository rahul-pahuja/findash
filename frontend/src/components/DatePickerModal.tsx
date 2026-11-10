import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  value: string; // "YYYY-MM-DD"
  onSelect: (date: string) => void;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["M", "T", "W", "T", "F", "S", "S"];

function parseISODate(dateStr: string) {
  if (!dateStr || !dateStr.includes("-")) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

function formatISODate(year: number, month: number, day: number) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function todayISODate() {
  const now = new Date();
  return formatISODate(now.getFullYear(), now.getMonth(), now.getDate());
}

export function DatePickerModal({ open, value, onSelect, onClose, anchorEl }: Props) {
  const parsed = useMemo(() => parseISODate(value), [value]);
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);
  const [selectedDate, setSelectedDate] = useState(value || todayISODate());
  const modalRef = useRef<HTMLDivElement>(null);

  const computePopoverStyle = (): React.CSSProperties => {
    if (!anchorEl) return {};
    const rect = anchorEl.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverHeight = 390;
    const margin = 8;
    const viewportPadding = 12;

    let top = rect.bottom + margin;
    // If opening downwards overflows the viewport, flip above
    if (top + popoverHeight > window.innerHeight - viewportPadding) {
      const spaceAbove = rect.top - margin - popoverHeight;
      if (spaceAbove >= viewportPadding) {
        top = spaceAbove;
      } else {
        // If neither fits completely, clamp so bottom stays strictly within the screen
        top = Math.max(viewportPadding, window.innerHeight - popoverHeight - viewportPadding);
      }
    }

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - viewportPadding) {
      left = rect.right - popoverWidth;
    }
    left = Math.max(viewportPadding, Math.min(window.innerWidth - popoverWidth - viewportPadding, left));

    return {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      transform: "none",
      margin: 0,
      zIndex: 260,
      opacity: 1,
      visibility: "visible"
    };
  };

  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>(() => {
    if (anchorEl) return computePopoverStyle();
    return anchorEl !== undefined ? { opacity: 0, visibility: "hidden" } : {};
  });

  useLayoutEffect(() => {
    if (open) {
      const p = parseISODate(value);
      setViewYear(p.year);
      setViewMonth(p.month);
      setSelectedDate(value || todayISODate());
      if (anchorEl) {
        setPopoverStyle(computePopoverStyle());
      }
    }
  }, [open, value, anchorEl]);

  useEffect(() => {
    if (!open || !anchorEl) return;

    const updatePosition = () => {
      setPopoverStyle(computePopoverStyle());
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorEl]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  // Days matrix for viewYear, viewMonth
  // Monday is first day of week (ISO 8601)
  const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarDays: Array<{ day: number; isCurrentMonth: boolean; dateStr: string }> = [];

  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonthIdx = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
    calendarDays.push({
      day: d,
      isCurrentMonth: false,
      dateStr: formatISODate(prevYear, prevMonthIdx, d)
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({
      day: d,
      isCurrentMonth: true,
      dateStr: formatISODate(viewYear, viewMonth, d)
    });
  }

  // Next month leading days (complete 35 or 42 grid cells)
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  const totalSlots = calendarDays.length + remaining < 35 ? 35 : calendarDays.length + remaining;
  const nextMonthIdx = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  let nextDayCounter = 1;
  while (calendarDays.length < totalSlots) {
    calendarDays.push({
      day: nextDayCounter,
      isCurrentMonth: false,
      dateStr: formatISODate(nextYear, nextMonthIdx, nextDayCounter)
    });
    nextDayCounter++;
  }

  function handleSelectDay(dateStr: string) {
    setSelectedDate(dateStr);
    const p = parseISODate(dateStr);
    setViewYear(p.year);
    setViewMonth(p.month);
  }

  function handleToday() {
    const today = todayISODate();
    setSelectedDate(today);
    const p = parseISODate(today);
    setViewYear(p.year);
    setViewMonth(p.month);
  }

  function handleDone() {
    onSelect(selectedDate);
    onClose();
  }

  return createPortal(
    <div
      className={`modal-backdrop apple-modal-backdrop datepicker-backdrop ${anchorEl ? "is-popover" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget || (modalRef.current && !modalRef.current.contains(e.target as Node))) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        ref={modalRef}
        className="calendar-popover"
        style={popoverStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Choose date"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="calendar-header">
          <button type="button" className="calendar-nav-btn" onClick={prevMonth} aria-label="Previous month">
            ‹
          </button>
          <span className="calendar-title">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button type="button" className="calendar-nav-btn" onClick={nextMonth} aria-label="Next month">
            ›
          </button>
        </header>

        <div className="calendar-weekdays">
          {DAY_NAMES.map((name, i) => (
            <span key={`${name}-${i}`} className="calendar-weekday">
              {name}
            </span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((item) => {
            const isSelected = item.dateStr === selectedDate;
            const isToday = item.dateStr === todayISODate();
            return (
              <button
                key={item.dateStr}
                type="button"
                className={[
                  "calendar-day-btn",
                  !item.isCurrentMonth ? "is-other-month" : "",
                  isSelected ? "is-selected" : "",
                  isToday && !isSelected ? "is-today" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => handleSelectDay(item.dateStr)}
              >
                {item.day}
              </button>
            );
          })}
        </div>

        <footer className="calendar-footer">
          <button type="button" className="calendar-today-link" onClick={handleToday}>
            Today
          </button>
          <button type="button" className="calendar-done-btn" onClick={handleDone}>
            Done
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
