#!/usr/bin/env node

import yargsFactory from "yargs";
import { hideBin } from "yargs/helpers";
import { SealIsacSDK } from "../src/index.js";

const yargs = yargsFactory(hideBin(process.argv));

const usage = "\nUsage: tran <lang_name> sentence to be translated";

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

const identity = process.env.SEAL_ISAC_IDENTITY;
if (!identity) {
    console.log("please set SEAL_ISAC_IDENTITY");
    process.exit(1);
}

const command = options._[0];

const client = new SealIsacSDK(process.env.SEAL_ISAC_HOST || "https://sealisac.org", process.env.SEAL_ISAC_API_KEY!);

if (command === "block-url") {
    console.log(`[+] blocking url ${options.url}`);

    const url = new URL(options.url as string);
    const status = await client.getDomainStatus(url.hostname);

    if (status === "allowlisted" && !options.force) {
        console.log(`[+] url is currently allowlisted, please use --force to override`);
        process.exit(1);
    }

    if (status === "blocklisted") {
        console.log(`[+] url is already blocklisted`);
        process.exit(0);
    }

    await client.addToBlocklist(url.hostname, identity);

    console.log(
        `[+] added ${url.hostname} to blocklist${status === "allowlisted" ? " and removed from allowlist" : ""}`,
    );
} else if (command === "unblock-url") {
    console.log(`[+] unblocking url ${options.url}`);

    const url = new URL(options.url as string);
    const status = await client.getDomainStatus(url.hostname);

    if (status !== "blocklisted") {
        console.log(`[+] url is not blocklisted`);
        process.exit(1);
    }

    await client.removeFromBlocklist(url.hostname);

    console.log(`[+] removed ${url.hostname} from blocklist`);
} else if (command === "allow-url") {
    console.log(`[+] allowing url ${options.url}`);

    const url = new URL(options.url as string);

    const status = await client.getDomainStatus(url.hostname);

    await client.addToAllowlist(url.hostname, identity);

    console.log(
        `[+] added ${url.hostname} to allowlist${status === "blocklisted" ? " and removed from blocklist" : ""}`,
    );
}
