import { Indicator, Label, Observable, OpenCTIClient } from "@security-alliance/opencti-client";
import { generateIndicatorId, generateLabelId, MARKING_TLP_CLEAR } from "@security-alliance/opencti-client/stix";
import { Identifier } from "@security-alliance/stix/2.1";
import { ALLOWLISTED_DOMAIN_LABEL, BLOCKLISTED_DOMAIN_LABEL, TRUSTED_WEB_CONTENT_LABEL, WebContent } from "./types.js";
import { generateObservableIdForWebContent, generatePatternForWebContent } from "./utils.js";

type CreateOrUpdateProperties = {
    creator?: Identifier<"identity">;
    labels?: string[];
    removeLabels?: string[];
};

const toOpenCTIObservableType = (type: "domain-name" | "ipv4-addr" | "ipv6-addr" | "url") => {
    switch (type) {
        case "domain-name":
            return "Domain-Name";
        case "ipv4-addr":
            return "IPv4-Addr";
        case "ipv6-addr":
            return "IPv6-Addr";
        case "url":
            return "Url";
    }
};

const ONE_YEAR_IN_MILLIS = 1000 * 60 * 60 * 24 * 365;

export class WebContentClient {
    private client: OpenCTIClient;

    constructor(client: OpenCTIClient) {
        this.client = client;
    }

    private async createOrUpdateIndicator(
        content: WebContent,
        props: CreateOrUpdateProperties,

        observable: Observable,
    ): Promise<Indicator> {
        const now = Date.now();

        const existingIndicator = await this.client.getIndicator(
            generateIndicatorId({ pattern: generatePatternForWebContent(content) }),
        );
        if (existingIndicator !== null) {
            return await this.client.editIndicator(existingIndicator.id, [
                { key: "valid_from", value: [new Date(now)] },
                { key: "valid_until", value: [new Date(now + ONE_YEAR_IN_MILLIS)] },
                { key: "x_opencti_score", value: [100] },
                { key: "revoked", value: [false] },
            ]);
        }

        const indicator = await this.client.createIndicator({
            createdBy: props.creator,
            name: content.value,
            pattern_type: "stix",
            pattern: generatePatternForWebContent(content),
            x_opencti_main_observable_type: toOpenCTIObservableType(content.type),
            x_opencti_score: 100,
            valid_from: new Date(now),
            valid_until: new Date(now + ONE_YEAR_IN_MILLIS),
        });

        await this.client.addIndicatorRelationship(indicator.id, observable.id, "based-on");

        return indicator;
    }

    private async createOrUpdateObservable(content: WebContent, props: CreateOrUpdateProperties): Promise<Observable> {
        const existingObservable = await this.client.getStixCyberObservable(generateObservableIdForWebContent(content));
        if (existingObservable !== null) return await this.updateObservable(existingObservable, props);
        else return await this.createObservable(content, props);
    }

    private async createObservable(content: WebContent, props: CreateOrUpdateProperties): Promise<Observable> {
        switch (content.type) {
            case "domain-name":
                return await this.client.createDomainObservable({
                    createdBy: props.creator,
                    domain: content.value,
                    objectLabel: props.labels,
                    objectMarking: [MARKING_TLP_CLEAR],
                });
            case "ipv4-addr":
                return await this.client.createIPv4AddressObservable({
                    createdBy: props.creator,
                    ip: content.value,
                    objectLabel: props.labels,
                    objectMarking: [MARKING_TLP_CLEAR],
                });
            case "ipv6-addr":
                return await this.client.createIPv6AddressObservable({
                    createdBy: props.creator,
                    ip: content.value,
                    objectLabel: props.labels,
                    objectMarking: [MARKING_TLP_CLEAR],
                });
            case "url":
                const url = new URL(content.value);

                const urlObservable = await this.client.createUrlObservable({
                    createdBy: props.creator,
                    url: content.value,
                    objectLabel: props.labels,
                    objectMarking: [MARKING_TLP_CLEAR],
                });

                if (url.protocol === "http:" || url.protocol === "https:") {
                    const domainObservable = await this.createOrUpdateObservable(
                        { type: "domain-name", value: url.hostname },
                        {
                            creator: props.creator,
                        },
                    );
                    await this.client.createRelationshipFromEntity({
                        fromId: urlObservable.id,
                        toId: domainObservable.id,
                        relationship_type: "related-to",
                    });
                }

                return urlObservable;
        }
    }

    private async updateObservable(observable: Observable, props: CreateOrUpdateProperties): Promise<Observable> {
        for (const label of props.labels ?? []) {
            if (this.findLabel(observable, label) === undefined) {
                observable.objectLabel = await this.client.addLabel(observable.id, [generateLabelId({ value: label })]);
            }
        }
        for (const label of props.removeLabels ?? []) {
            if (this.findLabel(observable, label) !== undefined) {
                observable.objectLabel = await this.client.deleteLabel(
                    observable.id,
                    generateLabelId({ value: label }),
                );
            }
        }
        return observable;
    }

    private findLabel(observable: Observable, labelName: string): Label | undefined {
        return observable.objectLabel?.find((label) => label.value === labelName);
    }

    public async getWebContentStatus(content: WebContent): Promise<"blocked" | "trusted" | "unknown"> {
        const [observable, indicator] = await Promise.all([
            this.client.getStixCyberObservable(generateObservableIdForWebContent(content)),
            this.client.getIndicator(generateIndicatorId({ pattern: generatePatternForWebContent(content) })),
        ]);

        if (observable !== null) {
            if (this.findLabel(observable, TRUSTED_WEB_CONTENT_LABEL) !== undefined) return "trusted";

            if (this.findLabel(observable, ALLOWLISTED_DOMAIN_LABEL) !== undefined) return "trusted";

            if (this.findLabel(observable, BLOCKLISTED_DOMAIN_LABEL) !== undefined) return "blocked";
        }

        if (indicator !== null) {
            if (indicator.revoked) return "unknown";

            return "blocked";
        }

        return "unknown";
    }

    public async blockWebContent(content: WebContent, creator: Identifier<"identity">): Promise<Indicator> {
        const observable = await this.createOrUpdateObservable(content, {
            creator: creator,
            removeLabels: [ALLOWLISTED_DOMAIN_LABEL, BLOCKLISTED_DOMAIN_LABEL, TRUSTED_WEB_CONTENT_LABEL],
        });

        const indicator = await this.createOrUpdateIndicator(
            content,
            {
                creator: creator,
            },
            observable,
        );

        return indicator;
    }

    public async unblockWebContent(content: WebContent): Promise<Indicator | undefined> {
        const observable = await this.client.getStixCyberObservable(generateObservableIdForWebContent(content));
        if (observable !== null) {
            await this.updateObservable(observable, {
                removeLabels: [ALLOWLISTED_DOMAIN_LABEL, BLOCKLISTED_DOMAIN_LABEL, TRUSTED_WEB_CONTENT_LABEL],
            });
        }

        const indicator = await this.client.getIndicator(
            generateIndicatorId({ pattern: generatePatternForWebContent(content) }),
        );
        if (indicator === null) return undefined;
        if (indicator.revoked) return indicator;

        return await this.client.editIndicator(indicator.id, [{ key: "x_opencti_score", value: [0] }]);
    }

    public async trustWebContent(content: WebContent, creator: Identifier<"identity">): Promise<Observable> {
        await this.unblockWebContent(content);

        return await this.createOrUpdateObservable(content, {
            creator: creator,
            labels: [TRUSTED_WEB_CONTENT_LABEL],
            removeLabels: [ALLOWLISTED_DOMAIN_LABEL, BLOCKLISTED_DOMAIN_LABEL],
        });
    }

    public async untrustWebContent(content: WebContent): Promise<Observable | undefined> {
        const observable = await this.client.getStixCyberObservable(generateObservableIdForWebContent(content));
        if (observable === null) return undefined;

        return await this.updateObservable(observable, {
            removeLabels: [BLOCKLISTED_DOMAIN_LABEL, ALLOWLISTED_DOMAIN_LABEL, TRUSTED_WEB_CONTENT_LABEL],
        });
    }
}
