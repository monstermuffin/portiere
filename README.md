# Portière 🔑
A simple web page with password authentication for triggering a webhook.

🌐🇫🇷 Portière - _A curtain that hangs over a doorway or entrance to a room._

![](assets/portiere.gif)

### Why?
I have _modified_ the intercom in my flat 👀 to trigger via Home Assistant, which opens the main doors to my block of apartments. This is available as a button/trigger in the Home Assistant app, but I also wanted to make this available for my neighbors/postpersons to use also. It had to be simple, a webpage with a simple button.

This is my solution to that. A webapp that, when a password is entered and slider slid(?), sends a webhook to HASS which triggers the intercom to unlock the block doors. 

### How?
The app uses browser-based cryptography using the Web Crypto API to hash passwords with SHA-256.

The authentication works through via client-server:
1. When a password is entered, it's combined with a salt value and hashed using SHA-256 in the browser.
2. If the hashes match, a secure session token is generated and stored. All subsequent API calls require this session token.
3. When triggered, the webhook request is handled server-side, ensuring the webhook URL is not exposed to the client.

- The actual password is never stored or transmitted.
- The salt adds protection against rainbow table attacks.
- All password verification happens in the browser using the Web Crypto API for maximum compatibility and security.
- No server-side processing is required (for the crypto).

While this provides enough security for my use case, this shouldn't be used for anything that actual requires hardened security. 

### Use case?
If you have one I'd love to know.

If you need to host a webhook on the internet but want it to be password protected, this is the app.

### Features
- Clean, mobile-friendly interface.
- Password protection with salt-based hashing.
- Session storage - valid users are remembered via on device storage.
- Optional test mode.
- Customisable text.
- Server-side webhook handling for enhanced security.
- Secure session management with configurable timeouts.
- Protected API endpoints requiring valid session tokens.
- IP address logging for authentication attempts and triggers.
- ARM/AMD64 Docker ready.

### Quick Start
Copy example `docker-compose.yml` and add your environment vars as below.

Start the container with: `docker-compose up -d`

The console log should show the following inside the container:
```shell
portiere  | Server running on port 3000
portiere  | Session timeout set to 1440 minutes
portiere  | Test mode: true
```

### Configuration
You need to fill the following environment variables at a minimum to start the container:

- TEST_MODE: When `true`, webhooks won't be triggered. Set to `false` for production. (default: `true`).
- WEBHOOK_URL: The URL that will be triggered.
- SESSION_TIMEOUT_MINS: How long sessions remain valid in minutes (default: `1440` - 24 hours).
- SALT: Salt string - See below for instructions. 
- STORED_HASH: Hash of your password - See below for instructions. 

### Generating Password Hash
To generate a hashed password for the application:

1. First, generate a random salt (16 characters, alphanumeric only):
```bash
openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16; echo
```

2. Using your salt and password, generate the SHA-256 hash:
```bash
echo -n "YOUR_PASSWORD""YOUR_SALT" | openssl dgst -sha256 -hex
```

For example:
```bash
# Generate a salt
openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16; echo
4F18vkhIY5jf01H

# Generate password hash
echo -n "myawesomepass""4F18vkhIY5jf01H" | openssl dgst -sha256 -hex
SHA2-256(stdin)= 211eb93508db75f7fb33b0802f18d6f1765a7c98baf35b91e10fdb974d77f267
```

Input the salt and generated hash into your `docker-compose.yml`
```yaml
    environment:
      - SALT=4F18vkhIY5jf01H
      - STORED_HASH=211eb93508db75f7fb33b0802f18d6f1765a7c98baf35b91e10fdb974d77f267
```

### Custom Messages
Messages can be customised by setting environment variables in your `docker-compose.yml`. For example:
```yaml
    environment:
      - MSG_WELCOME=Welcome home!
      - MSG_ERROR=Failed to unlock door
      - MSG_UNLOCKED=Door unlocked successfully
      - MSG_SLIDE_TO_UNLOCK=Slide to unlock →
```
The following substitutions are available:

| Variable                | Description                            | Default Value                           | When Shown                                                                                     |
|-------------------------|----------------------------------------|-----------------------------------------|------------------------------------------------------------------------------------------------|
| MSG_ENTER_PASSWORD      | Initial password prompt               | "Enter Password"                        | Displayed in password input field placeholder and below input when no action has been taken     |
| MSG_ACCESS_GRANTED      | Success message after correct password| "✓ Access Granted"                      | Briefly shown after entering correct password                                                  |
| MSG_INCORRECT_PASSWORD  | Wrong password message                | "✕ Incorrect Password (Attempt %attempt%)" | Shown after entering incorrect password. Note: %attempt% is replaced with the attempt number  |
| MSG_ERROR_PASSWORD      | Generic password error                | "✕ Error checking password"             | Displayed if there's a system error checking the password                                      |
| MSG_SLIDE_TO_UNLOCK     | Main slider text                      | "SLIDE TO UNLOCK"                       | Default text shown on the unlock slider                                                        |
| MSG_UNLOCKING           | Processing message                    | "UNLOCKING..."                          | Briefly shown while slider processes                                                           |
| MSG_UNLOCKED            | Success message (normal mode)         | "UNLOCKED"                              | Shown after successful unlock in normal mode                                                   |
| MSG_UNLOCKED_TEST       | Success message (test mode)           | "UNLOCKED"                              | Shown after successful unlock in test mode                                                     |
| MSG_WELCOME             | Final success message                 | "Command Sent."                         | Displayed in confirmation box after successful unlock                                          |
| MSG_ERROR               | Failure message                       | "Failed."                               | Shown in confirmation box if unlock fails                                                      |
| MSG_TEST_CONFIRMATION   | Test mode confirmation                | "TEST MODE: Confirm"                    | Displayed when confirming actions in test mode                                                 |

### Test Mode
Setting `TEST_MODE` to `true` in your environment variables prevents actual webhook triggers, this is the default. To put into 'prod' where the webhooks would actually be triggered, set `TEST_MODE` to `false`.

### Development
To build locally:

```bash
git clone https://github.com/monstermuffin/portiere.git
cd portiere
docker build -t portiere .
```

### Security Considerations
- Use HTTPs.
- Webhook URLs are never exposed to the client and all webhook calls are handled server-side.
- Sessions expire after a configurable timeout (default 24 hours).
- Authentication attempts and triggers are logged with IP addresses when the correct headers are enabled in your proxy.
- Session persistence is handled through secure tokens.
- **No rate limiting is implemented by default.**

### Webhook Response Handling
The app expects the webhook endpoint to:
- Return a valid HTTP response.
- Return either JSON or plaintext that can be parsed as JSON.
- Indicate success with `HTTP 200 OK`.
- Any other response will trigger the error message.

### Browser Compatibility
Requires browsers with support for:
- Web Crypto API.
- ES6+ JavaScript features.
- Modern CSS features (backdrop-filter, etc.).

### Notes: 

- This app was originally called 'letmein' due to its original purpose, so there may or may not be references to this. 
- Several places in the code reference things such as `unlockDoor`, this is, again, just left over from being a single purpose app before I decided to standardise it for general purpose usage here.