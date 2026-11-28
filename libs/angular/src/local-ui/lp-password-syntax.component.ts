import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

/** 生成历史默认遮罩；展开只影响当前画面，不改动存储。 */
export const GENERATOR_HISTORY_MASK = "••••••••••••••••";

/** 生成值的字符分类：字母保持主色，数字蓝色，符号绿色。 */
export type PasswordCharKind = "plain" | "digit" | "symbol";

export interface PasswordCharSegment {
  readonly char: string;
  readonly kind: PasswordCharKind;
}

/**
 * 把生成值拆成可着色片段。纯函数，便于单测；不改变原始字符顺序。
 */
export function splitPasswordSyntax(value: string): PasswordCharSegment[] {
  return [...value].map((char) => {
    if (/\d/.test(char)) {
      return { char, kind: "digit" };
    }
    if (/[^a-zA-Z0-9]/.test(char)) {
      return { char, kind: "symbol" };
    }
    return { char, kind: "plain" };
  });
}

/**
 * 生成器输出的字符着色。只负责呈现，不记录、不复制值。
 */
@Component({
  selector: "lp-password-syntax",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-inline" },
  template: `@for (segment of segments(); track $index) {
    <span
      [class.tw-text-fg-brand]="segment.kind === 'digit'"
      [class.tw-text-fg-success]="segment.kind === 'symbol'"
      >{{ segment.char }}</span
    >
  }`,
})
export class LpPasswordSyntaxComponent {
  readonly value = input.required<string>();

  protected readonly segments = computed(() => splitPasswordSyntax(this.value()));
}
