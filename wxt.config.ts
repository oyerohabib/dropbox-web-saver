import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  srcDir: "src",
  manifestVersion: 3,
  autoIcons: {
    baseIconPath: "assets/icon.svg",
    developmentIndicator: "overlay",
  },
  manifest: {
    name: "Web Saver for Dropbox",
    short_name: "Web Saver",
    description:
      "Save images, videos, audio and files from any web page straight to your Dropbox. Not affiliated with Dropbox, Inc.",
    permissions: ["storage", "contextMenus", "identity", "scripting", "activeTab"],
    optional_host_permissions: ["http://*/*", "https://*/*"],
    action: {
      default_title: "Web Saver for Dropbox",
      default_popup: "popup.html",
    },
  },
});
