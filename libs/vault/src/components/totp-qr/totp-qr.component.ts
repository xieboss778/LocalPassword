import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  viewChild,
} from "@angular/core";
// qrious ships no types and no @types package exists; the constructor is all this component needs.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRious = require("qrious") as new (options: {
  element: HTMLCanvasElement;
  value: string;
  size: number;
  level: string;
  background: string;
  foreground: string;
}) => unknown;

/**
 * Renders a QR code for a TOTP uri, so the code can be scanned into another authenticator.
 *
 * The canvas is drawn whenever the value changes; `qrious` does the encoding and keeps this
 * component free of any QR logic of its own.
 */
@Component({
  selector: "vault-totp-qr",
  template: `<canvas #canvas [attr.aria-label]="ariaLabel()" role="img"></canvas>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TotpQrComponent {
  /** The `otpauth://` uri to encode. */
  readonly value = input<string>("");
  /** Pixel size of the square code. */
  readonly size = input<number>(200);
  readonly ariaLabel = input<string>("");

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>("canvas");

  constructor() {
    effect(() => {
      const element = this.canvas()?.nativeElement;
      const value = this.value();
      if (element == null || value === "") {
        return;
      }

      new QRious({
        element,
        value,
        size: this.size(),
        level: "M",
        background: "#ffffff",
        foreground: "#000000",
      });
    });
  }
}
