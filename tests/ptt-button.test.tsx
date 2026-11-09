// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PTTButton } from "../src/components/PTTButton";
beforeAll(() => {
  class Pointer extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  Object.defineProperty(window, "PointerEvent", { value: Pointer });
  HTMLElement.prototype.setPointerCapture = vi.fn();
});
afterEach(cleanup);
function setup() {
  const start = vi.fn(),
    end = vi.fn();
  const view = render(
    <PTTButton
      disabled={false}
      talking={false}
      busy={false}
      requesting={false}
      onStart={start}
      onEnd={end}
    />,
  );
  return { start, end, button: screen.getByRole("button"), view };
}
describe("hold-to-talk input safety", () => {
  it("captures one pointer and releases transmission on pointer up", () => {
    const { start, end, button } = setup();
    fireEvent.pointerDown(button, { pointerId: 7, button: 0 });
    expect(start).toHaveBeenCalledTimes(1);
    expect(button.setPointerCapture).toHaveBeenCalledWith(7);
    fireEvent.pointerUp(button, { pointerId: 7 });
    expect(end).toHaveBeenCalledTimes(1);
  });
  it("ignores a second pointer and does not release the first pointer on second-pointer up", () => {
    const { start, end, button } = setup();
    fireEvent.pointerDown(button, { pointerId: 1, button: 0 });
    fireEvent.pointerDown(button, { pointerId: 2, button: 0 });
    fireEvent.pointerUp(button, { pointerId: 2 });
    expect(start).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();
    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(end).toHaveBeenCalledTimes(1);
  });
  it.each(["pointerCancel", "lostPointerCapture", "blur"] as const)(
    "stops on %s",
    (event) => {
      const { end, button } = setup();
      fireEvent.pointerDown(button, { pointerId: 1, button: 0 });
      fireEvent[event](button);
      expect(end).toHaveBeenCalled();
    },
  );
  it("ignores key repeats and releases on space keyup", () => {
    const { start, end, button } = setup();
    fireEvent.keyDown(button, { key: " " });
    fireEvent.keyDown(button, { key: " ", repeat: true });
    expect(start).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(button, { key: " " });
    expect(end).toHaveBeenCalledTimes(1);
  });
  it("supports Enter and ignores mouse presses while keyboard is held", () => {
    const { start, end, button } = setup();
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.pointerDown(button, { pointerId: 1, button: 0 });
    expect(start).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(button, { key: "Enter" });
    expect(end).toHaveBeenCalledTimes(1);
  });
  it("cuts transmission if disabled during a press", () => {
    const { start, end, button, view } = setup();
    fireEvent.pointerDown(button, { pointerId: 1, button: 0 });
    view.rerender(
      <PTTButton
        disabled
        talking={false}
        busy={false}
        requesting={false}
        onStart={start}
        onEnd={end}
      />,
    );
    expect(end).toHaveBeenCalled();
    expect(button).toHaveProperty("disabled", true);
  });
});
