declare module "qrious" {
  export interface QRiousOptions {
    element?: HTMLCanvasElement | null;
    canvas?: HTMLCanvasElement | null;
    value?: string;
    size?: number;
    level?: "L" | "M" | "Q" | "H";
    background?: string;
    foreground?: string;
    padding?: number;
  }

  export default class QRious {
    constructor(options?: QRiousOptions);
    set(options: QRiousOptions): void;
    toDataURL(): string;
  }
}
