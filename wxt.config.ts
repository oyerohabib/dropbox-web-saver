import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  manifestVersion: 3,
  manifest: {
    name: "Dropbox Web Saver",
    description:
      "Save images, videos, audio files, and web assets directly into Dropbox.",
    permissions: ["storage", "contextMenus", "identity", "scripting", "activeTab"],
    host_permissions: ["http://*/*", "https://*/*"],
    action: {
      default_title: "Dropbox Web Saver",
      default_popup: "popup.html",
    },
    options_page: "options.html",
  },
});
