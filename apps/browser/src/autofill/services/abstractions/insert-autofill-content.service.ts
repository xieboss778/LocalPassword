import AutofillScript from "../../models/autofill-script";

interface InsertAutofillContentService {
  fillForm(
    fillScript: AutofillScript,
    showAnimations?: boolean,
  ): Promise<boolean> | Promise<void> | void;
}

export { InsertAutofillContentService };
