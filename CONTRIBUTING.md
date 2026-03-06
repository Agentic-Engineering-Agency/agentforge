# Contributing to AgentForge

First off, thank you for considering contributing to AgentForge! It's people like you that make the open-source community such a great place.

## Code of Conduct

This project and everyone participating in it is governed by the [AgentForge Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [contact@agenticengineering.agency](mailto:contact@agenticengineering.agency).

## How Can I Contribute?

### Reporting Bugs

This is one of the easiest and most helpful ways to contribute. If you find a bug, please ensure the bug was not already reported by searching on GitHub under [Issues](https://github.com/Agentic-Engineering-Agency/agentforge/issues).

If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/Agentic-Engineering-Agency/agentforge/issues/new). Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

If you have an idea for a new feature or an improvement to an existing one, please open an issue with the "enhancement" label. Provide a clear and detailed explanation of the feature, why it's needed, and how it should work.

### Pull Requests

We love pull requests! For any significant changes, please open an issue first to discuss what you would like to change.

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes (`pnpm test`).
5. Make sure your code lints (`pnpm lint`).
6. Issue that pull request!

## Styleguides

We use [Prettier](https://prettier.io/) for code formatting and [ESLint](https://eslint.org/) for linting. The configurations are in the root of the repository. Please run `pnpm format` and `pnpm lint` before committing your changes.

## License

By contributing, you agree that your contributions will be licensed under its Apache 2.0 License.

## Security Guidelines

### Secret Rotation

AgentForge uses several environment variables for security. Regular rotation is recommended for production deployments.

#### AGENTFORGE_KEY_SALT Rotation

The `AGENTFORGE_KEY_SALT` is used to encrypt API keys stored in Convex. To rotate:

1. **Generate a new salt** (32+ characters, cryptographically random):
   ```bash
   openssl rand -base64 32
   ```

2. **Back up your Convex data** (export from dashboard or CLI)

3. **Re-encrypt all API keys** with the new salt:
   - Update `AGENTFORGE_KEY_SALT` in your environment
   - For each API key in your database, re-run the encryption process
   - The XOR-based encryption in the current implementation requires the salt to stay the same for existing encrypted keys

4. **Important**: Due to the current XOR encryption implementation, **salt rotation requires decrypting and re-encrypting all keys**. Future versions will use AES-256-GCM with key rotation support.

#### AGENTFORGE_API_KEY Rotation

The `AGENTFORGE_API_KEY` is used for HTTP channel authentication:

1. **Generate a new token**:
   ```bash
   agentforge tokens generate --name "rotated-token"
   ```

2. **Update clients** to use the new token

3. **Revoke old tokens**:
   ```bash
   agentforge tokens revoke <old-token-id>
   ```

#### Channel Bot Tokens

For Discord and Telegram bot tokens:

1. Generate new tokens in the respective developer portals
2. Update `DISCORD_BOT_TOKEN` or `TELEGRAM_BOT_TOKEN` environment variables
3. Restart the AgentForge daemon
4. Invalidate old tokens in the developer portals

### Security Best Practices

- Never commit `.env` files or secrets to version control
- Use strong, unique salts (32+ characters)
- Rotate secrets quarterly or after any suspected breach
- Use read-only database credentials where possible
- Enable rate limiting on public endpoints
- Sanitize all user input before processing

