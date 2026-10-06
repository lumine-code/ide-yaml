// Where the editor can fetch a newer server than the one this package pins.
//
// An upgrade tier, not the only way in: the dependency below is always present,
// so uninstalling drops back to it and can never leave the user with nothing.
exports.managedServer = {
  source: "npm",
  displayName: "YAML Language Server",
  packages: ["yaml-language-server"],
  module: "node_modules/yaml-language-server/bin/yaml-language-server",
  bundled: true,
};

exports.resolveServer = async (context, configuredPath) => {
  const selection = await context.resolver.select({
    configuredPath,
    configuredKind: "auto",
    managed: () => {
      const install = context.getManagedServer();
      return install ? { path: install.modulePath, version: install.version } : null;
    },
    bundledPath: () => require.resolve("yaml-language-server/bin/yaml-language-server"),
    kind: "node",
    allowShellWrapper: true,
  });
  if (!selection) return null;
  return context.resolver.launch(selection, {
    args: ["--stdio"],
    cwd: context.rootPath,
    transport: "stdio",
  });
};
