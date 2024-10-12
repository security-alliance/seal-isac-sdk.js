## Usage

### Setup

```typescript
import { WebContentClient } from "@security-alliance/seal-isac-sdk";
// Initialize the SDK with your SEAL-ISAC host and API key
const client = new WebContentClient("https://sealisac.org", "your-api-key");
```

### Functions

```typescript
client.blockWebContent(content: WebContent, creator: Identifier<'identity'>): Promise<Indicator>;
client.unblockWebContent(content: WebContent): Promise<Indicator | undefined>;
client.trustWebContent(content: WebContent, creator: Identifier<'identity'>): Promise<Observable>;
client.untrustWebContent(content: WebContent): Promise<Observable | undefined>;
```
