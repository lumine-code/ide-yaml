# ide-yaml

YAML language-server adapter.

Registers [yaml-language-server](https://github.com/redhat-developer/yaml-language-server) with the `ide-client` package, providing schema-aware completion, validation, navigation, and formatting for YAML documents.

## Features

- **Bundled server**: ships an exact yaml-language-server version, with an optional custom executable path.
- **Managed upgrade**: installs a newer server from npm when you want one, and removing it returns to the bundled copy.
- **Schema intelligence**: associates local, remote, SchemaStore, and Kubernetes schemas with file patterns.
- **File associations**: includes every YAML grammar file type and user-defined YAML association in automatic schema matching.
- **Validation**: reports YAML syntax, schema, style, and key-ordering problems in the linter.
- **Formatting**: formats documents and indents new entries using the open editor's indentation.
- **Custom syntax**: accepts application-specific scalar, sequence, and mapping tags.
- **Feature switches**: each capability can be handed to another language server serving the same file.
- **Project sessions**: one server per project root, started lazily with the first YAML editor.

## Installation

To install `ide-yaml` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/ide-yaml`.

Install `ide-client` first.

## Services

- `ide-client`: consumed to register the YAML adapter with the editor's language-server client.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
