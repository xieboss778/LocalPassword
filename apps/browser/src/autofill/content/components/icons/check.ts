import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, resolveIconColor, ruleNames } from "../constants/styles";

export function Check(props: IconProps) {
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
        d="M6.2 12.4 2 8.2l1.4-1.4 2.8 2.8 6.4-6.4L14 4.6l-7.8 7.8Z"
      />
    </svg>
  `;
}
