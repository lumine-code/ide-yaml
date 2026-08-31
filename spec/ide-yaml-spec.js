const fs = require("fs");
const path = require("path");
const { resolveServer, managedServer } = require("../lib/server");
const main = require("../lib/main");

const registerAdapter = () => {
  let adapter;
  const disposable = main.consumeIdeClient({
    registerAdapter(registered) {
      adapter = registered;
      return { dispose() {} };
    },
    getSessions: () => [],
    restart: async () => {},
  });
  return { adapter, disposable };
};

describe("ide-yaml server resolution", () => {
  it("prefers the configured path", async () => {
    const launch = await resolveServer(process.execPath);
    expect(launch.command).toBe(process.execPath);
    expect(launch.args).toEqual(["--stdio"]);
  });

  it("falls back to the bundled server module", async () => {
    const launch = await resolveServer("");
    expect(launch.command).toBe(process.execPath);
    expect(fs.existsSync(launch.args[0])).toBe(true);
    expect(launch.args[1]).toBe("--stdio");
    expect(launch.env.ELECTRON_RUN_AS_NODE).toBe("1");
  });

  it("prefers a managed install over the bundled server", async () => {
    const managed = { modulePath: "/managed/server.js", version: "9.9.9" };
    const launch = await resolveServer("", managed);
    expect(launch.args[0]).toBe(managed.modulePath);
    // Reported in the session details, so which copy is running is visible.
    expect(launch.version).toBe("9.9.9");
    expect((await resolveServer(process.execPath, managed)).command).toBe(process.execPath);
  });

  it("declares the bundled floor so uninstall falls back", () => {
    // The dependency is always present, so removing the managed copy returns to
    // a working server rather than to none.
    expect(managedServer.source).toBe("npm");
    expect(managedServer.bundled).toBe(true);
    expect(managedServer.module).toContain("node_modules/");
  });
});

describe("ide-yaml adapter", () => {
  let adapter;
  let disposable;

  beforeEach(async () => {
    await lumine.packages.activatePackage("ide-yaml");
    ({ adapter, disposable } = registerAdapter());
  });

  afterEach(async () => {
    disposable.dispose();
    await lumine.packages.deactivatePackage("ide-yaml");
  });

  it("registers with the language-server service", async () => {
    expect(adapter.id).toBe("ide-yaml");
    expect(adapter.grammarScopes).toEqual(["source.yaml"]);
    expect(adapter.settingsKeyPaths).toEqual(["ide-yaml"]);
    expect(adapter.restartKeyPaths).toEqual(["ide-yaml.serverPath"]);
    const launch = await adapter.resolveServer({ rootPath: __dirname });
    expect(launch.cwd).toBe(__dirname);
    expect(launch.transport).toBe("stdio");
  });

  it("maps feature switches onto work the server can avoid", () => {
    lumine.config.set("ide-yaml.features.diagnostics", false);
    lumine.config.set("ide-yaml.features.autocomplete", false);
    lumine.config.set("ide-yaml.features.hover", false);
    lumine.config.set("ide-yaml.features.format", false);

    const yaml = adapter.getWorkspaceConfiguration("yaml");
    expect(yaml.validate).toBe(false);
    expect(yaml.completion).toBe(false);
    expect(yaml.hover).toBe(false);
    expect(yaml.format.enable).toBe(false);
  });

  it("transcribes schema and formatter settings", () => {
    lumine.config.set("ide-yaml.yaml.schemas", {
      "schema.json": ["config/*.yaml"],
    });
    lumine.config.set("ide-yaml.yaml.customTags", ["!Ref scalar"]);
    lumine.config.set("ide-yaml.yaml.format.printWidth", 100);
    lumine.config.set("ide-yaml.yaml.flowSequence", "forbid");

    const yaml = adapter.getSettings().yaml;
    expect(yaml.schemas["schema.json"]).toEqual(["config/*.yaml"]);
    expect(yaml.customTags).toEqual(["!Ref scalar"]);
    expect(yaml.format.printWidth).toBe(100);
    expect(yaml.style.flowSequence).toBe("forbid");
  });

  it("answers the configuration sections the server pulls", async () => {
    lumine.config.set("editor.tabLength", 6);
    const filePath = path.join(__dirname, "fixture.yaml");
    const editor = await lumine.workspace.open(filePath);
    editor.setTabLength(3);
    editor.setSoftTabs(true);
    const uri = `file:///${filePath.replaceAll("\\", "/")}`;

    expect(adapter.getWorkspaceConfiguration("yaml", uri).yamlVersion).toBe("1.2");
    expect(adapter.getWorkspaceConfiguration("http", uri).proxyStrictSSL).toBe(false);
    expect(adapter.getWorkspaceConfiguration("[yaml]", uri)["editor.tabSize"]).toBe(3);
    expect(adapter.getWorkspaceConfiguration("editor", uri).detectIndentation).toBe(false);
    expect(adapter.getWorkspaceConfiguration("files", uri)).toEqual({ associations: {} });
  });

  it("offers switches for exactly the capabilities the server advertises", () => {
    const { configSchema } = require("../package.json");
    expect(Object.keys(configSchema.features.properties)).toEqual([
      "diagnostics",
      "autocomplete",
      "hover",
      "definition",
      "symbols",
      "format",
      "rename",
      "codeActions",
      "codeLens",
    ]);
  });
});

describe("ide-yaml feature contracts", () => {
  const features = [
    "diagnostics",
    "autocomplete",
    "hover",
    "definition",
    "symbols",
    "format",
    "rename",
    "codeActions",
    "codeLens",
  ];
  const definitions = require("../package.json").configSchema.features.properties;

  beforeEach(async () => {
    await lumine.packages.activatePackage("ide-yaml");
  });

  afterEach(async () => {
    for (const feature of features) lumine.config.unset(`ide-yaml.features.${feature}`);
    await lumine.packages.deactivatePackage("ide-yaml");
  });

  for (const feature of features) {
    it(`exposes ${feature} as an independent enabled-by-default switch`, () => {
      expect(definitions[feature].type).toBe("boolean");
      expect(definitions[feature].default).toBe(true);
      const keyPath = `ide-yaml.features.${feature}`;
      expect(lumine.config.get(keyPath)).toBe(true);
      lumine.config.set(keyPath, false);
      expect(lumine.config.get(keyPath)).toBe(false);
    });
  }
});
