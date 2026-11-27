import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, resolveIconColor, ruleNames } from "../constants/styles";

export function Clock(props: IconProps) {
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
        d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM2.6 8a5.4 5.4 0 1 1 10.8 0A5.4 5.4 0 0 1 2.6 8Zm6.35-3.2a.9.9 0 0 0-1.8 0V8a.9.9 0 0 0 .37.74l2.1 1.5a.9.9 0 0 0 1.06-1.45L8.95 7.55V4.8Z"
      />
    </svg>
  `;
}
