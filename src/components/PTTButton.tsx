import { useEffect, useRef } from "react";
export function PTTButton({
  disabled,
  disconnected = false,
  talking,
  busy,
  requesting,
  onStart,
  onEnd,
}: {
  disabled: boolean;
  disconnected?: boolean;
  talking: boolean;
  busy: boolean;
  requesting: boolean;
  onStart: () => void;
  onEnd: () => void;
}) {
  const pointer = useRef<number | null>(null);
  const key = useRef(false);
  const end = () => {
    pointer.current = null;
    key.current = false;
    onEnd();
  };
  useEffect(() => {
    if (disabled) {
      pointer.current = null;
      key.current = false;
      onEnd();
    }
  }, [disabled, onEnd]);
  return (
    <button
      type="button"
      className={`ptt ${talking ? "transmitting" : ""} ${busy ? "busy" : ""} ${disconnected ? "disconnected" : ""}`}
      disabled={disabled}
      aria-label="Hold to talk"
      aria-pressed={talking}
      onPointerDown={(e) => {
        if (pointer.current !== null || key.current || e.button !== 0) return;
        e.preventDefault();
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        onStart();
      }}
      onPointerUp={(e) => {
        if (pointer.current === e.pointerId) end();
      }}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onBlur={end}
      onKeyDown={(e) => {
        if ([" ", "Enter"].includes(e.key)) {
          e.preventDefault();
          if (!e.repeat && !key.current && pointer.current === null) {
            key.current = true;
            onStart();
          }
        }
      }}
      onKeyUp={(e) => {
        if ([" ", "Enter"].includes(e.key)) {
          e.preventDefault();
          end();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg
        viewBox="0 0 24 24"
        width="42"
        height="42"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
      </svg>
      <strong>
        {talking
          ? "Speaking"
          : requesting
            ? "Requesting…"
            : busy
              ? "Channel busy"
              : "Hold to talk"}
      </strong>
      <span>
        {talking
          ? "Release to stop"
          : disabled
            ? disconnected
              ? "Reconnect to your team"
              : "Turn mode on to connect"
            : busy
              ? "Wait for your turn"
              : "Press and hold"}
      </span>
    </button>
  );
}
