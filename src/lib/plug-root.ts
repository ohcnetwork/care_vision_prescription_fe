import { useState } from "react";

/**
 * The class that scopes the plug stylesheet.
 *
 * The post-build pass in `scripts/postcss-scope-plugin.ts` puts this class in
 * front of every rule. Only elements below this class get the plug tokens.
 */
export const PLUG_ROOT_CLASS = "care-vision-prescription-fe";

let portalHost: HTMLElement | null = null;

/**
 * Gives the element that holds portalled UI, such as a dropdown.
 *
 * Base UI sends a portal to `document.body`, which is above the plug root.
 * The plug tokens do not apply there, so a popup loses its background and its
 * text colour. This host carries the scope class, so the tokens apply again.
 * The host stays outside the form, so a table with a scrollbar cannot clip a
 * popup. Theme rules such as `.dark .care-vision-prescription-fe` still match,
 * because the host is below the `<html>` element that holds the theme class.
 */
export function getPortalContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  if (portalHost?.isConnected) return portalHost;
  portalHost = document.createElement("div");
  // `contents` keeps the host from making a box of its own.
  portalHost.className = `${PLUG_ROOT_CLASS} contents`;
  portalHost.dataset.slot = "plug-portal-root";
  document.body.append(portalHost);
  return portalHost;
}

export function usePortalContainer(): HTMLElement | undefined {
  const [container] = useState(getPortalContainer);
  return container;
}
