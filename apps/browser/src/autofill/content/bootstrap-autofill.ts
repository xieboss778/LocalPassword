import DomElementVisibilityService from "../services/dom-element-visibility.service";
import { DomQueryService } from "../services/dom-query.service";
import { setupAutofillInitDisconnectAction } from "../utils";

import AutofillInit from "./autofill-init";

(function (windowContext) {
  if (!windowContext.localpassAutofillInit) {
    const domQueryService = new DomQueryService();
    const domElementVisibilityService = new DomElementVisibilityService();
    windowContext.localpassAutofillInit = new AutofillInit(
      domQueryService,
      domElementVisibilityService,
    );
    setupAutofillInitDisconnectAction(windowContext);

    windowContext.localpassAutofillInit.init();
  }
})(window);
