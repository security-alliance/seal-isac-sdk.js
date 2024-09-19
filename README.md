## Usage

### Setup

```typescript
import { SealIsacSDK } from "@security-alliance/seal-isac-sdk";
// Initialize the SDK with your SEAL-ISAC host and API key
const sdk = new SealIsacSDK("https://sealisac.org", "your-api-key");
```

### Functions

```typescript
sdk.addToBlocklist(domain: string, createdBy: string): Promise<{ status: string; metadata: { id: string; standard_id: string } }>

sdk.addToAllowlist(domain: string, createdBy: string): Promise<{ status: string; metadata: { id: string; standard_id: string } }>
```
