const fs = require("fs");
const os = require("os");
const path = require("path");
const main = require("../lib/main");
const { LiveLspClient, fileUri, positionParams } = require("./helpers/live-lsp-client");

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

describe("ide-yaml bundled server", () => {
  let adapter, client, disposable, rootPath;
  let originalTimeout;

  beforeAll(() => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
  });

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  beforeEach(async () => {
    jasmine.useRealClock();
    await lumine.packages.activatePackage("ide-yaml");
    ({ adapter, disposable } = registerAdapter());
    rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "ide-yaml-live-"));
    client = new LiveLspClient(adapter, rootPath);
  });

  afterEach(async () => {
    await client.stop();
    disposable.dispose();
    fs.rmSync(rootPath, { recursive: true, force: true });
    await lumine.packages.deactivatePackage("ide-yaml");
  });

  it("exercises every advertised feature and the document lifecycle", async () => {
    const schemaPath = path.join(rootPath, "schema.json");
    fs.writeFileSync(
      schemaPath,
      JSON.stringify({
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "A human-readable name." },
          enabled: { type: "boolean", description: "Whether this entry is enabled." },
          anchor: { type: "string" },
          copy: { type: "string" },
          items: { type: "array", items: { type: "string" } },
          parent: { type: "object" },
        },
        additionalProperties: false,
      }),
    );
    lumine.config.set("ide-yaml.yaml.schemas", {
      [fileUri(schemaPath)]: "fixture.yaml",
    });
    lumine.config.set("ide-yaml.yaml.schemaStore.enable", false);
    lumine.config.set("ide-yaml.yaml.kubernetesCRDStore.enable", false);

    const filePath = path.join(rootPath, "fixture.yaml");
    const source = [
      "name:      42",
      "anchor: &shared hello",
      "copy: *shared",
      "items: [one,two]",
      "parent:",
      "",
    ].join("\n");
    fs.writeFileSync(filePath, source);
    const uri = fileUri(filePath);
    const { capabilities } = await client.start();
    client.open(uri, "yaml", source);

    expect(capabilities.completionProvider).toBeDefined();
    expect(capabilities.hoverProvider).toBe(true);
    expect(capabilities.definitionProvider).toBe(true);
    expect(capabilities.documentSymbolProvider).toBe(true);
    expect(capabilities.documentOnTypeFormattingProvider).toBeDefined();
    expect(capabilities.renameProvider.prepareProvider).toBe(true);
    expect(capabilities.codeActionProvider).toBe(true);
    expect(capabilities.codeLensProvider).toBeDefined();

    const formatterRegistration = await client.waitFor(
      () => client.registrations.find(({ method }) => method === "textDocument/formatting"),
      "dynamic formatter registration",
    );
    expect(formatterRegistration.registerOptions.documentSelector[0].language).toBe("yaml");

    const published = await client.waitFor(
      () =>
        client
          .messages("textDocument/publishDiagnostics")
          .find(({ params }) => params.diagnostics.length > 0),
      "schema diagnostics",
    );
    const typeDiagnostic = published.params.diagnostics.find(({ code }) => code === 0);
    expect(typeDiagnostic.message).toContain('Expected "string"');

    const completion = await client.request("textDocument/completion", positionParams(uri, 0, 0));
    expect(completion.items.some(({ label }) => label === "enabled")).toBe(true);

    const hover = await client.request("textDocument/hover", positionParams(uri, 0, 1));
    expect(hover.contents.value).toContain("A human-readable name.");

    const definition = await client.request("textDocument/definition", positionParams(uri, 2, 8));
    expect(definition[0].targetSelectionRange.start.line).toBe(1);

    const symbols = await client.request("textDocument/documentSymbol", {
      textDocument: { uri },
    });
    expect(symbols.map(({ name }) => name)).toContain("items");
    expect(symbols.find(({ name }) => name === "items").children.length).toBe(2);

    const edits = await client.request("textDocument/formatting", {
      textDocument: { uri },
      options: { tabSize: 2, insertSpaces: true },
    });
    expect(edits[0].newText).toContain("name: 42");
    expect(edits[0].newText).toContain("items: [one, two]");

    const onTypeEdits = await client.request("textDocument/onTypeFormatting", {
      ...positionParams(uri, 5, 0),
      ch: "\n",
      options: { tabSize: 2, insertSpaces: true },
    });
    expect(onTypeEdits[0].newText).toBe("  ");

    const prepared = await client.request("textDocument/prepareRename", positionParams(uri, 1, 10));
    expect(prepared.start.character).toBe(9);
    const rename = await client.request("textDocument/rename", {
      ...positionParams(uri, 1, 10),
      newName: "renamed",
    });
    expect(rename.changes[uri].map(({ newText }) => newText)).toEqual(["renamed", "renamed"]);

    const actions = await client.request("textDocument/codeAction", {
      textDocument: { uri },
      range: typeDiagnostic.range,
      context: { diagnostics: [typeDiagnostic] },
    });
    expect(actions[0].command.command).toBe("jumpToSchema");

    const lenses = await client.request("textDocument/codeLens", {
      textDocument: { uri },
    });
    expect(lenses[0].command.command).toBe("jumpToSchema");

    const beforeChange = client.messages("textDocument/publishDiagnostics").length;
    const fixed = source
      .replace("name:      42", 'name: "demo"')
      .replace("parent:\n", "parent: {}\n");
    client.change(uri, fixed);
    await client.waitFor(
      () =>
        client
          .messages("textDocument/publishDiagnostics")
          .slice(beforeChange)
          .find(({ params }) => params.diagnostics.length === 0),
      "cleared diagnostics after didChange",
    );

    const beforeClose = client.messages("textDocument/publishDiagnostics").length;
    client.closeDocument(uri);
    await client.waitFor(
      () =>
        client
          .messages("textDocument/publishDiagnostics")
          .slice(beforeClose)
          .find(({ params }) => params.diagnostics.length === 0),
      "cleared diagnostics after didClose",
    );
  });
});
