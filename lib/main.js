const { CompositeDisposable } = require("lumine");
const { resolveServer } = require("./server");

const setting = (key) => lumine.config.get(`ide-yaml.${key}`);
const text = (key) => setting(key) || undefined;
const list = (key) => {
  const value = setting(key);
  return value?.length ? value : undefined;
};

const yamlSettings = () => ({
  yamlVersion: setting("yaml.yamlVersion"),
  maxItemsComputed: setting("yaml.maxItemsComputed"),
  validate: setting("features.diagnostics"),
  hover: setting("features.hover"),
  hoverAnchor: setting("yaml.hoverAnchor"),
  hoverSchemaSource: setting("yaml.hoverSchemaSource"),
  completion: setting("features.autocomplete"),
  schemas: setting("yaml.schemas") || {},
  disableSchemaDetection: list("yaml.disableSchemaDetection"),
  schemaStore: {
    enable: setting("yaml.schemaStore.enable"),
    url: setting("yaml.schemaStore.url"),
  },
  customTags: list("yaml.customTags"),
  disableAdditionalProperties: setting("yaml.disableAdditionalProperties"),
  disableDefaultProperties: setting("yaml.disableDefaultProperties"),
  suggest: {
    parentSkeletonSelectedFirst: setting("yaml.parentSkeletonSelectedFirst"),
  },
  kubernetesCRDStore: {
    enable: setting("yaml.kubernetesCRDStore.enable"),
    url: setting("yaml.kubernetesCRDStore.url"),
  },
  kubernetesVersion: text("yaml.kubernetesVersion"),
  style: {
    flowMapping: setting("yaml.flowMapping"),
    flowSequence: setting("yaml.flowSequence"),
  },
  keyOrdering: setting("yaml.keyOrdering"),
  format: {
    enable: setting("features.format"),
    singleQuote: setting("yaml.format.singleQuote"),
    bracketSpacing: setting("yaml.format.bracketSpacing"),
    proseWrap: setting("yaml.format.proseWrap"),
    printWidth: setting("yaml.format.printWidth"),
    trailingComma: setting("yaml.format.trailingComma"),
  },
});

const httpSettings = () => ({
  proxy: setting("http.proxy"),
  proxyStrictSSL: setting("http.proxyStrictSSL"),
});

const formattingOptions = (resource) => {
  const filePath = resource?.startsWith("file:")
    ? decodeURIComponent(new URL(resource).pathname)
    : null;
  const normalizedPath =
    filePath && /^\/[a-zA-Z]:/.test(filePath) ? filePath.slice(1).replaceAll("/", "\\") : filePath;
  const editor = normalizedPath
    ? lumine.workspace.getTextEditors().find((item) => item.getPath() === normalizedPath)
    : null;
  return {
    tabSize: editor?.getTabLength() ?? lumine.config.get("editor.tabLength"),
    insertSpaces: editor?.getSoftTabs() ?? lumine.config.get("editor.tabType") !== "hard",
  };
};

const configurationFor = (section, resource) => {
  const formatting = formattingOptions(resource);
  if (!section) return { yaml: yamlSettings(), http: httpSettings() };
  if (section === "yaml") return yamlSettings();
  if (section === "http") return httpSettings();
  if (section === "[yaml]") {
    return {
      "editor.tabSize": formatting.tabSize,
      "editor.insertSpaces": formatting.insertSpaces,
      "editor.formatOnType": setting("features.format"),
    };
  }
  if (section === "editor") {
    return {
      detectIndentation: false,
      tabSize: formatting.tabSize,
      insertSpaces: formatting.insertSpaces,
    };
  }
  if (section === "files") return { associations: {} };
  return undefined;
};

module.exports = {
  consumeIdeClient(service) {
    const adapter = {
      id: "ide-yaml",
      displayName: "YAML Language Server",
      grammarScopes: ["source.yaml"],
      sessionScope: "project-root",
      settingsKeyPaths: ["ide-yaml"],
      async resolveServer(context) {
        const launch = await resolveServer(setting("serverPath"));
        return { ...launch, cwd: context.rootPath, transport: "stdio" };
      },
      getSettings() {
        return { yaml: yamlSettings(), http: httpSettings() };
      },
      getWorkspaceConfiguration(section, resource) {
        return configurationFor(section, resource);
      },
    };

    const subscriptions = new CompositeDisposable(service.registerAdapter(adapter));
    subscriptions.add(
      lumine.config.onDidChange("ide-yaml.serverPath", () => {
        for (const session of service.getSessions()) {
          if (session.adapter !== adapter || ["stopping", "stopped"].includes(session.state))
            continue;
          service.restart(session).catch((error) => {
            lumine.notifications.addError("Unable to restart YAML Language Server", {
              detail: error.message,
              dismissable: true,
            });
          });
        }
      }),
    );
    return subscriptions;
  },
};
