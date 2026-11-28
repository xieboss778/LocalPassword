import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconModule } from "@localpass/components";

/**
 * 弹窗底部导航：保险库 / 生成器 / 同步 / 设置。
 *
 * LocalPass 没有 Send（需要服务器转发），这四格覆盖弹窗核心主入口。
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
