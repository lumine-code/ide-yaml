# ide-yaml

YAML language-server adapter.

Registers [yaml-language-server](https://github.com/redhat-developer/yaml-language-server) with the bundled `ide-client` package, providing schema-aware completion, validation, navigation, and formatting for YAML documents.

## Features

- **Bundled server**: ships an exact yaml-language-server version, with an optional custom executable path.
- **Managed upgrade**: installs a newer server from npm when you want one, and removing it returns to the bundled copy.
- **Schema intelligence**: associates local, remote, SchemaStore, and Kubernetes schemas with file patterns.
- **Validation**: reports YAML syntax, schema, style, and key-ordering problems in the linter.
- **Formatting**: formats documents and indents new entries using the open editor's indentation.
- **Custom syntax**: accepts application-specific scalar, sequence, and mapping tags.
- **Feature switches**: each capability can be handed to another language server serving the same file.
- **Project sessions**: one server per project root, started lazily with the first YAML editor.

## Installation

To install `ide-yaml` search for _ide-yaml_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/ide-yaml`.

## Services

- **ide-client** (`^1.0.0`): consumed to register the YAML adapter with the editor's language-server client.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
