import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconModule } from "@localpass/components";

/**
 * 弹窗底部导航：保险库 / 生成器 / 设置。
 *
 * LocalPass 没有 Send（需要服务器转发），也没有账号健康报告；这三格是实际存在的去处。
 * 详情、表单、设置二级页都在 `tabs` 路由之外，所以打开它们时导航自然隐藏。
 */
@Component({
  selector: "app-tabs-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, IconModule],
  templateUrl: "./tabs-v2.component.html",
})
export class TabsV2Component {
  protected readonly i18n = inject(I18nService);
}
