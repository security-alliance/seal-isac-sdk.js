#!/usr/bin/env node

import yargsFactory from "yargs";
import { hideBin } from "yargs/helpers";
import { WebContentClient } from "../index.js";
import { OpenCTIClient } from "@security-alliance/opencti-client";
import { Identifier } from "@security-alliance/stix/2.1";

const yargs = yargsFactory(hideBin(process.argv));

const options = yargs
    .scriptName("seal-isac")
    .usage("$0 <cmd> [args]")
    .command("block-url [url]", "block a given url", (yargs) => {
        yargs
            .positional("url", {
                type: "string",
                describe: "the url to block",
            })
            .option("force", {
                type: "boolean",
                describe: `force the url to be blocked, even if it's currently allowlisted`,
            })
            .demandOption("url");
    })
    .command("unblock-url [url]", "unblock a given url without allowlisting it", (yargs) => {
        yargs
            .positional("url", {
                type: "string",
                describe: "the url to unblock",
            })
            .demandOption("url");
    })
    .command("allow-url [url]", "allowlist a given url", (yargs) => {
        yargs
            .positional("url", {
                type: "string",
                describe: "the url to allowlist",
            })
            .demandOption("url");
    })
    .help(true)
    .demandCommand(1)
    .parseSync();

const apiKey = process.env.SEAL_ISAC_API_KEY;
if (!apiKey) {
    console.log("please set SEAL_ISAC_API_KEY");
    process.exit(1);
}

const identity = process.env.SEAL_ISAC_IDENTITY as Identifier<"identity"> | undefined;
if (!identity) {
    console.log("please set SEAL_ISAC_IDENTITY");
    process.exit(1);
}

const command = options._[0];

const client = new WebContentClient(
    new OpenCTIClient(process.env.SEAL_ISAC_HOST || "https://sealisac.org", process.env.SEAL_ISAC_API_KEY!),
);

if (command === "block-url") {
    console.log(`[+] blocking url ${options.url}`);

    const url = new URL(options.url as string);
    const status = await client.getWebContentStatus({
        type: "domain-name",
        value: url.hostname,
    });

    if (status === "trusted" && !options.force) {
        console.log(`[+] url is currently trusted, please use --force to override`);
        process.exit(1);
    }

    if (status === "blocked") {
        console.log(`[+] url is already blocked`);
        process.exit(0);
    }

    await client.blockWebContent({ type: "domain-name", value: url.host }, identity);

    console.log(`[+] blocked${status === "trusted" ? " and untrusted" : ""} ${url.hostname}`);
} else if (command === "unblock-url") {
    console.log(`[+] unblocking url ${options.url}`);

    const url = new URL(options.url as string);
    const status = await client.getWebContentStatus({
        type: "domain-name",
        value: url.hostname,
    });

    if (status !== "blocked") {
        console.log(`[+] url is not blocked`);
        process.exit(1);
    }

    await client.unblockWebContent({ type: "domain-name", value: url.hostname });

    console.log(`[+] removed ${url.hostname} from blocklist`);
} else if (command === "allow-url") {
    console.log(`[+] allowing url ${options.url}`);

    const url = new URL(options.url as string);

    const status = await client.getWebContentStatus({
        type: "domain-name",
        value: url.hostname,
    });

    await client.trustWebContent({ type: "domain-name", value: url.hostname }, identity);

    console.log(`[+] trusted${status === "blocked" ? " and unblocked" : ""}  ${url.hostname}`);
}
