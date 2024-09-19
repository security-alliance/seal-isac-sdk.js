import { generateIdentityId } from "@security-alliance/opencti-client/dist/src/stix.js";
import { SealIsacSDK } from "../src/index.js";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert";

const apiKey = process.env.SEAL_ISAC_API_KEY!;

describe("SEAL-ISAC SDK", () => {
    const client = new SealIsacSDK("https://sealisac.dev", apiKey);

    it("should add to blocklist successfully", async () => {
        const domain = `${randomUUID()}.invalid`;

        const status = await client.getDomainStatus(domain);
        assert.equal(status, "unknown");

        await client.addToBlocklist(domain, generateIdentityId("SEAL", "organization"));
        {
            const newStatus = await client.getDomainStatus(domain);
            assert.equal(newStatus, "blocklisted");
        }

        await client.removeFromBlocklist(domain);
        {
            const newStatus = await client.getDomainStatus(domain);
            assert.equal(newStatus, "unknown");
        }
    })

    it("should add to allowlist successfully", async () => {
        const domain = `${randomUUID()}.invalid`;

        const status = await client.getDomainStatus(domain);
        assert.equal(status, "unknown");

        await client.addToAllowlist(domain, generateIdentityId("SEAL", "organization"));
        {
            const newStatus = await client.getDomainStatus(domain);
            assert.equal(newStatus, "allowlisted");
        }

        await client.removeFromAllowlist(domain);
        {
            const newStatus = await client.getDomainStatus(domain);
            assert.equal(newStatus, "unknown");
        }
    })

    it("should unblock domain successfully", async () => {
        const domain = `${randomUUID()}.invalid`;

        const status = await client.getDomainStatus(domain);
        assert.equal(status, "unknown");

        await client.addToBlocklist(domain, generateIdentityId("SEAL", "organization"));
        {
            const newStatus = await client.getDomainStatus(domain);
            assert.equal(newStatus, "blocklisted");
        }

        await client.addToAllowlist(domain, generateIdentityId("SEAL", "organization"));
        {
            const newStatus = await client.getDomainStatus(domain);
            assert.equal(newStatus, "allowlisted");
        }

        await client.removeFromAllowlist(domain);
        {
            const newStatus = await client.getDomainStatus(domain);
            assert.equal(newStatus, "unknown");
        }
    })
});
