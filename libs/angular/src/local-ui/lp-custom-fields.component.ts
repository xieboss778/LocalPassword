import { ChangeDetectionStrategy, Component, inject, input, model, signal } from "@angular/core";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconComponent } from "@localpass/components";

import { LpGroupComponent } from "./lp-group.component";

/** 编辑器里的一行。`id` 只用于 track，不落库。 */
export interface CustomFieldDraft {
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly hidden: boolean;
}

let nextDraftId = 0;

export function newCustomFieldDraft(name = "", value = "", hidden = false): CustomFieldDraft {
  nextDraftId += 1;
  return { id: `custom-field-${nextDraftId}`, name, value, hidden };
}

/**
 * 自定义字段编辑器：表单里唯一能增删用户字段的地方。
 *
 * 名称与值分开两行，隐藏字段的值默认遮罩；类别标记和类型自带槽位不在这里出现，
 * 由 `readCustomFields` / `applyCustomFields` 过滤与保留。
 */
@Component({
  selector: "lp-custom-fields",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LpGroupComponent],
  template: `
    <lp-group [label]="i18n.t('customFields')">
      @for (field of fields(); track field.id) {
        <div class="agy-cfield">
          <input
            class="agy-input"
            [id]="'custom-field_input_name_' + field.id"
            [value]="field.name"
            [attr.placeholder]="i18n.t('fieldName')"
            [attr.aria-label]="i18n.t('fieldName')"
            (input)="rename(field.id, $event)"
          />
          <input
            class="agy-input"
            [class.agy-mono]="field.hidden"
            [id]="'custom-field_input_value_' + field.id"
            [type]="field.hidden && !isRevealed(field.id) ? 'password' : 'text'"
            [value]="field.value"
            [attr.placeholder]="i18n.t('fieldValue')"
            [attr.aria-label]="i18n.t('fieldValue')"
            autocomplete="off"
            (input)="setValue(field.id, $event)"
          />
          <span class="tw-flex tw-flex-none tw-items-center tw-gap-0.5">
            <button
              type="button"
              class="agy-iconbtn agy-sm"
              [attr.aria-label]="field.hidden ? i18n.t('typeHidden') : i18n.t('typeText')"
              [attr.title]="field.hidden ? i18n.t('typeHidden') : i18n.t('typeText')"
              (click)="toggleHidden(field.id)"
            >
              <bit-icon
                [name]="field.hidden ? 'bwi-lock' : 'bwi-file-text'"
                class="tw-text-xs"
              ></bit-icon>
            </button>
            @if (field.hidden) {
              <button
                type="button"
                class="agy-iconbtn agy-sm"
                [attr.aria-label]="isRevealed(field.id) ? i18n.t('hideValue') : i18n.t('showValue')"
                [attr.title]="isRevealed(field.id) ? i18n.t('hideValue') : i18n.t('showValue')"
                (click)="toggleReveal(field.id)"
              >
                <bit-icon
                  [name]="isRevealed(field.id) ? 'bwi-eye-slash' : 'bwi-eye'"
                  class="tw-text-xs"
                ></bit-icon>
              </button>
            }
            <button
              type="button"
              class="agy-iconbtn agy-sm"
              [attr.aria-label]="i18n.t('remove')"
              [attr.title]="i18n.t('remove')"
              (click)="remove(field.id)"
            >
              <bit-icon name="bwi-trash" class="tw-text-xs"></bit-icon>
            </button>
          </span>
        </div>
      }

      @if (editable()) {
        <button type="button" class="agy-addrow" (click)="add()">
          <bit-icon name="bwi-plus" class="tw-text-xs"></bit-icon>
          {{ i18n.t("addField") }}
        </button>
      }
    </lp-group>
  `,
})
export class LpCustomFieldsComponent {
  protected readonly i18n = inject(I18nService);

  readonly fields = model<readonly CustomFieldDraft[]>([]);
  readonly editable = input(true);

  private readonly revealed = signal<ReadonlySet<string>>(new Set());

  protected isRevealed(id: string): boolean {
    return this.revealed().has(id);
  }

  protected toggleReveal(id: string): void {
    this.revealed.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected add(): void {
    this.fields.update((current) => [...current, newCustomFieldDraft()]);
  }

  protected remove(id: string): void {
    this.fields.update((current) => current.filter((field) => field.id !== id));
  }

  protected rename(id: string, event: Event): void {
    this.patch(id, { name: (event.target as HTMLInputElement).value });
  }

  protected setValue(id: string, event: Event): void {
    this.patch(id, { value: (event.target as HTMLInputElement).value });
  }

  protected toggleHidden(id: string): void {
    const field = this.fields().find((current) => current.id === id);
    this.patch(id, { hidden: !field?.hidden });
  }

  private patch(id: string, change: Partial<Pick<CustomFieldDraft, "name" | "value" | "hidden">>) {
    this.fields.update((current) =>
      current.map((field) => (field.id === id ? { ...field, ...change } : field)),
    );
  }
}
