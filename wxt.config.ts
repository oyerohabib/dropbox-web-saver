import { defineConfig } from "wxt";
import { PRODUCT_SHORT_NAME, PRODUCT_STORE_NAME, PRODUCT_SUMMARY } from "./src/lib/project";

export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  srcDir: "src",
  manifestVersion: 3,
  autoIcons: {
    baseIconPath: "assets/icon.svg",
    developmentIndicator: "overlay",
  },
  manifest: {
    name: PRODUCT_STORE_NAME,
    short_name: PRODUCT_SHORT_NAME,
    description: PRODUCT_SUMMARY,
    permissions: ["storage", "contextMenus", "identity", "scripting", "activeTab"],
    host_permissions: [
      "https://www.googleapis.com/*",
      "https://oauth2.googleapis.com/*",
      "https://accounts.google.com/*",
    ],
    optional_host_permissions: ["http://*/*", "https://*/*"],
    action: {
      default_title: PRODUCT_STORE_NAME,
      default_popup: "popup.html",
    },
  },
});
