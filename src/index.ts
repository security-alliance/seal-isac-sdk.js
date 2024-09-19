import { OpenCTIClient } from "@security-alliance/opencti-client/dist/src/index.js";
import {
    generateDomainObservableId,
    generateLabelId,
    MARKING_TLP_CLEAR,
} from "@security-alliance/opencti-client/dist/src/stix.js";
import { Label, OCTIStixCyberObservable } from "@security-alliance/opencti-client/dist/src/types.js";

const BLOCKLISTED_DOMAIN_LABEL = "blocklisted domain";
const ALLOWLISTED_DOMAIN_LABEL = "allowlisted domain";

export class SealIsacSDK {
    private client: OpenCTIClient;

    constructor(host: string, apiKey: string) {
        this.client = new OpenCTIClient(host, apiKey);
    }

    private async getOrCreateObservable(
        domain: string,
        create: () => Promise<OCTIStixCyberObservable>,
    ): Promise<OCTIStixCyberObservable> {
        const existingObservable = await this.client.getDomainObservable(generateDomainObservableId(domain));
        if (existingObservable !== null) return existingObservable;

        const newObservable = await create();

        return newObservable;
    }

    private findLabel(observable: OCTIStixCyberObservable, labelName: string): Label | undefined {
        return observable.objectLabel?.find((label) => label.value === labelName);
    }

    public async getDomainStatus(domain: string): Promise<"blocklisted" | "allowlisted" | "unknown"> {
        const observable = await this.client.getDomainObservable(generateDomainObservableId(domain));
        if (observable === null) return "unknown";

        if (this.findLabel(observable, ALLOWLISTED_DOMAIN_LABEL) !== undefined) return "allowlisted";

        if (this.findLabel(observable, BLOCKLISTED_DOMAIN_LABEL) !== undefined) return "blocklisted";

        return "unknown";
    }

    public async addToBlocklist(domain: string, creator: string): Promise<OCTIStixCyberObservable> {
        const observable = await this.getOrCreateObservable(domain, async () => {
            return await this.client.createDomainObservable({
                x_opencti_score: 100,
                createdBy: creator,
                objectLabel: [BLOCKLISTED_DOMAIN_LABEL],
                objectMarking: [MARKING_TLP_CLEAR],
                domain: domain,
            });
        });

        const allowlistedDomainLabel = this.findLabel(observable, ALLOWLISTED_DOMAIN_LABEL);
        if (allowlistedDomainLabel !== undefined) {
            observable.objectLabel = await this.client.deleteLabel(
                observable.id,
                generateLabelId(ALLOWLISTED_DOMAIN_LABEL),
            );
        }

        const blocklistedDomainLabel = this.findLabel(observable, BLOCKLISTED_DOMAIN_LABEL);
        if (blocklistedDomainLabel === undefined) {
            observable.objectLabel = await this.client.addLabel(observable.id, [
                generateLabelId(BLOCKLISTED_DOMAIN_LABEL),
            ]);
        }

        return observable;
    }

    public async removeFromBlocklist(domain: string): Promise<OCTIStixCyberObservable | undefined> {
        const observable = await this.client.getDomainObservable(generateDomainObservableId(domain));
        if (observable === null) return undefined;

        if (this.findLabel(observable, BLOCKLISTED_DOMAIN_LABEL) !== undefined) {
            observable.objectLabel = await this.client.deleteLabel(
                observable.id,
                generateLabelId(BLOCKLISTED_DOMAIN_LABEL),
            );
        }

        return observable;
    }

    public async addToAllowlist(domain: string, creator: string): Promise<OCTIStixCyberObservable> {
        const observable = await this.getOrCreateObservable(domain, async () => {
            return await this.client.createDomainObservable({
                x_opencti_score: 100,
                createdBy: creator,
                objectLabel: [ALLOWLISTED_DOMAIN_LABEL],
                objectMarking: [MARKING_TLP_CLEAR],
                domain: domain,
            });
        });

        const blocklistedDomainLabel = this.findLabel(observable, BLOCKLISTED_DOMAIN_LABEL);
        if (blocklistedDomainLabel !== undefined) {
            observable.objectLabel = await this.client.deleteLabel(
                observable.id,
                generateLabelId(BLOCKLISTED_DOMAIN_LABEL),
            );
        }

        const allowlistedDomainLabel = this.findLabel(observable, ALLOWLISTED_DOMAIN_LABEL);
        if (allowlistedDomainLabel === undefined) {
            observable.objectLabel = await this.client.addLabel(observable.id, [
                generateLabelId(ALLOWLISTED_DOMAIN_LABEL),
            ]);
        }

        return observable;
    }

    public async removeFromAllowlist(domain: string): Promise<OCTIStixCyberObservable | undefined> {
        const observable = await this.client.getDomainObservable(generateDomainObservableId(domain));
        if (observable === null) return undefined;

        if (this.findLabel(observable, ALLOWLISTED_DOMAIN_LABEL) !== undefined) {
            observable.objectLabel = await this.client.deleteLabel(
                observable.id,
                generateLabelId(ALLOWLISTED_DOMAIN_LABEL),
            );
        }

        return observable;
    }
}
