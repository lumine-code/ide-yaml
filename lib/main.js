const path = require("path");
const { fileURLToPath } = require("url");
const { resolveServer, managedServer } = require("./server");

const setting = (key) => lumine.config.get(`ide-yaml.${key}`);
const text = (key) => setting(key) || undefined;
const list = (key) => {
  const value = setting(key);
  return value?.length ? value : undefined;
};
const pathKey = (filePath) => {
  const normalized = path.normalize(path.resolve(filePath));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
};

const associationPatterns = (fileType) => {
  if (fileType.startsWith("*") || fileType.includes("/") || fileType.includes("\\"))
    return [fileType];
  const bare = fileType.replace(/^\./, "");
  return [...new Set([fileType, `.${bare}`, `*.${bare}`])];
};

const fileAssociations = () => {
  const scope = "source.yaml";
  const grammarFileTypes = lumine.grammars?.grammarForScopeName(scope)?.fileTypes || [];
  const customFileTypes = lumine.config.get("core.customFileTypes")?.[scope] || [];
  return Object.fromEntries(
    [...new Set([...grammarFileTypes, ...customFileTypes])].flatMap((fileType) =>
      associationPatterns(fileType).map((pattern) => [pattern, "yaml"]),
    ),
  );
};

const yamlSettings = () => ({
  yamlVersion: setting("yaml.yamlVersion"),
  maxItemsComputed: setting("yaml.maxItemsComputed"),
  // The client router owns grammar-scoped feature switches. The server remains
  // capable so a scoped true override is not defeated by a false base value.
  validate: true,
  hover: true,
  hoverAnchor: setting("yaml.hoverAnchor"),
  hoverSchemaSource: setting("yaml.hoverSchemaSource"),
  completion: true,
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
    enable: true,
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
  let filePath = null;
  try {
    if (resource?.startsWith("file:")) filePath = fileURLToPath(resource);
  } catch {
    // A malformed or non-local URI has no editor-specific indentation.
  }
  const editor = filePath
    ? lumine.workspace
        .getTextEditors()
        .find((item) => item.getPath() && pathKey(item.getPath()) === pathKey(filePath))
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
      "editor.formatOnType": true,
    };
  }
  if (section === "editor") {
    return {
      detectIndentation: false,
      tabSize: formatting.tabSize,
      insertSpaces: formatting.insertSpaces,
    };
  }
  if (section === "files") return { associations: fileAssociations() };
  return undefined;
};

module.exports = {
  consumeIdeClient(service) {
    const adapter = {
      id: "ide-yaml",
      displayName: "YAML Language Server",
      grammarScopes: ["source.yaml"],
      sessionScope: "project-root",
      settingsKeyPaths: ["ide-yaml", "core.customFileTypes"],
      restartKeyPaths: ["ide-yaml.serverPath", "core.customFileTypes"],
      managedServer,
      async resolveServer(context) {
        const launch = await resolveServer(setting("serverPath"), context.managedServer);
        return { ...launch, cwd: context.rootPath, transport: "stdio" };
      },
      getSettings() {
        return { yaml: yamlSettings(), http: httpSettings() };
      },
      getWorkspaceConfiguration(section, resource) {
        return configurationFor(section, resource);
      },
    };

    return service.registerAdapter(adapter);
  },
};
