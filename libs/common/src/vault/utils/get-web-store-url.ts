import { DeviceType } from "../../enums";

/**
 *  Returns the web store URL for the LocalPass browser extension based on the device type.
 *  @defaults LocalPass download page
 */
export const getWebStoreUrl = (deviceType: DeviceType): string => {
  switch (deviceType) {
    // DuckDuckGoBrowser is intentionally not mapped: only its Windows (Chromium) build can
    // install Chrome Web Store extensions, and this signature carries no platform
    // information, so it falls through to the generic download page.
    case DeviceType.ChromeBrowser:
      return "https://chromewebstore.google.com/detail/localpass-password-manage/nngceckbapebfimnlniiiahkandclblb";
    case DeviceType.FirefoxBrowser:
      return "https://addons.mozilla.org/en-US/firefox/addon/localpass-password-manager/";
    case DeviceType.SafariBrowser:
      return "https://apps.apple.com/us/app/localpass/id1352778147?mt=12";
    case DeviceType.OperaBrowser:
      return "https://addons.opera.com/extensions/details/localpass-free-password-manager/";
    case DeviceType.EdgeBrowser:
      return "https://microsoftedge.microsoft.com/addons/detail/jbkfoedolllekgbhcbcoahefnbanhhlh";
    default:
      return "https://local.invalid/download/#downloads-web-browser";
  }
};
