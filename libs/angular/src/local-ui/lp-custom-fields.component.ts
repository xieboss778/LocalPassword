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
        <div class="tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0">
          <div class="tw-flex tw-items-center tw-gap-2">
            <input
              class="tw-min-w-0 tw-flex-1 tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 tw-py-2 tw-text-sm tw-text-main tw-outline-none placeholder:tw-text-muted focus:tw-border-border-focus"
              [id]="'custom-field_input_name_' + field.id"
              [value]="field.name"
              [attr.placeholder]="i18n.t('fieldName')"
              [attr.aria-label]="i18n.t('fieldName')"
              (input)="rename(field.id, $event)"
            />
            <select
              class="tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-p-2 tw-text-sm tw-text-main tw-outline-none focus:tw-border-border-focus"
              [id]="'custom-field_select_type_' + field.id"
              [value]="field.hidden ? 'hidden' : 'text'"
              [attr.aria-label]="i18n.t('fieldType')"
              (change)="setHidden(field.id, $event)"
            >
              <option value="text">{{ i18n.t("typeText") }}</option>
              <option value="hidden">{{ i18n.t("typeHidden") }}</option>
            </select>
            <button
              type="button"
              class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-md tw-text-muted hover:tw-bg-bg-danger-soft hover:tw-text-fg-danger"
              [attr.aria-label]="i18n.t('remove')"
              [attr.title]="i18n.t('remove')"
              (click)="remove(field.id)"
            >
              <bit-icon name="bwi-trash"></bit-icon>
            </button>
          </div>

          <div class="tw-relative tw-mt-2">
            <input
              class="tw-w-full tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 tw-py-2 tw-pe-10 tw-text-sm tw-text-main tw-outline-none placeholder:tw-text-muted focus:tw-border-border-focus"
              [class.tw-font-mono]="field.hidden"
              [id]="'custom-field_input_value_' + field.id"
              [type]="field.hidden && !isRevealed(field.id) ? 'password' : 'text'"
              [value]="field.value"
              [attr.placeholder]="i18n.t('fieldValue')"
              [attr.aria-label]="i18n.t('fieldValue')"
              autocomplete="off"
              (input)="setValue(field.id, $event)"
            />
            @if (field.hidden) {
              <button
                type="button"
                class="tw-absolute tw-end-1 tw-top-1/2 tw-grid tw-size-8 -tw-translate-y-1/2 tw-place-items-center tw-rounded-md tw-text-muted hover:tw-bg-bg-hover hover:tw-text-main"
                [attr.aria-label]="isRevealed(field.id) ? i18n.t('hideValue') : i18n.t('showValue')"
                (click)="toggleReveal(field.id)"
              >
                <bit-icon
                  [name]="isRevealed(field.id) ? 'bwi-visibility-off' : 'bwi-visibility'"
                ></bit-icon>
              </button>
            }
          </div>
        </div>
      }

      @if (editable()) {
        <button
          type="button"
          class="tw-flex tw-w-full tw-items-center tw-gap-2 tw-px-4 tw-py-3 tw-text-start tw-text-sm tw-font-medium tw-text-fg-brand hover:tw-bg-bg-brand-softer"
          (click)="add()"
        >
          <bit-icon name="bwi-plus" class="tw-text-base"></bit-icon>
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

  protected setHidden(id: string, event: Event): void {
    this.patch(id, { hidden: (event.target as HTMLSelectElement).value === "hidden" });
  }

  private patch(id: string, change: Partial<Pick<CustomFieldDraft, "name" | "value" | "hidden">>) {
    this.fields.update((current) =>
      current.map((field) => (field.id === id ? { ...field, ...change } : field)),
    );
  }
}
