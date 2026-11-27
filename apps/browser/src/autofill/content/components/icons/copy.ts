import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, resolveIconColor, ruleNames } from "../constants/styles";

export function Copy(props: IconProps) {
  const { ariaHidden = true } = props;
  const shapeColor = resolveIconColor(props);

  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="${ariaHidden}"
    >
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M5.5 1.5A1.5 1.5 0 0 1 7 0h5.5A1.5 1.5 0 0 1 14 1.5V8a1.5 1.5 0 0 1-1.5 1.5H12V4a2 2 0 0 0-2-2H5V1.5h.5ZM3.5 3A1.5 1.5 0 0 0 2 4.5v9A1.5 1.5 0 0 0 3.5 15h5A1.5 1.5 0 0 0 10 13.5v-9A1.5 1.5 0 0 0 8.5 3h-5Z"
      />
    </svg>
  `;
}
