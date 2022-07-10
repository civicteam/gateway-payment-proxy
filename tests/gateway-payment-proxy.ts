import * as anchor from "@project-serum/anchor";
import {Program, Wallet, web3, BN} from "@project-serum/anchor";
import {
    createAssociatedTokenAccount,
    createMint,
    getAccount,
    mintTo,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { GatewayPaymentProxy } from "../target/types/gateway_payment_proxy";
import {addGatekeeper, sendGatewayTransaction} from "./gatekeeperUtils";
import {getGatewayTokenAddressForOwnerAndGatekeeperNetwork} from "@identity.com/solana-gateway-ts";
import {GatekeeperService} from "@identity.com/solana-gatekeeper-lib";

chai.use(chaiAsPromised);

const { expect } = chai;

describe("gateway-payment-proxy", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.GatewayPaymentProxy as Program<GatewayPaymentProxy>;
    const recipientAuthority = web3.Keypair.generate();

    const signer = {
        publicKey: provider.wallet.publicKey,
        secretKey: (provider.wallet as Wallet).payer.secretKey
    }

    let mint: web3.PublicKey;
    let senderATA: web3.PublicKey;
    let recipientATA: web3.PublicKey;
    let gatekeeperNetwork = web3.Keypair.generate();
    let gatekeeper = web3.Keypair.generate();
    let gatekeeperService: GatekeeperService;
    let recipientGatewayToken: web3.PublicKey;

    before(async () => {
        mint = await createMint(
            anchor.getProvider().connection,
            signer,
            provider.wallet.publicKey,
            provider.wallet.publicKey,
            2,
        )

        senderATA = await createAssociatedTokenAccount(
            anchor.getProvider().connection,
            signer,
            mint,
            provider.wallet.publicKey,
        )

        recipientATA = await createAssociatedTokenAccount(
            anchor.getProvider().connection,
            signer,
            mint,
            recipientAuthority.publicKey,
        );

        await mintTo(
            anchor.getProvider().connection,
            signer,
            mint,
            senderATA,
            signer,
            100
        );

        gatekeeperService = await addGatekeeper(provider, gatekeeperNetwork, gatekeeper);

        recipientGatewayToken =
            await getGatewayTokenAddressForOwnerAndGatekeeperNetwork(
                recipientAuthority.publicKey,
                gatekeeperNetwork.publicKey
            );
    });

    it("transfer fails without gateway token", async () => {
        const shouldFail = program.methods.transfer(new BN(10), gatekeeperNetwork.publicKey).accounts({
                payer: provider.wallet.publicKey,
                payerTokenAccount: senderATA,
                recipient: recipientATA,
                gatewayToken: recipientGatewayToken,
                tokenProgram: TOKEN_PROGRAM_ID
            }
        ).rpc();

        await expect(shouldFail).to.be.rejectedWith(/Invalid Gateway Token/);
    });

    it("transfer passes with gateway token", async () => {
        await sendGatewayTransaction(() => gatekeeperService.issue(recipientAuthority.publicKey));

        const signature = await program.methods.transfer(new BN(10), gatekeeperNetwork.publicKey).accounts({
                payer: provider.wallet.publicKey,
                payerTokenAccount: senderATA,
                recipient: recipientATA,
                gatewayToken: recipientGatewayToken,
                tokenProgram: TOKEN_PROGRAM_ID
            }
        ).rpc();
        const blockhash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
            signature,
            ...blockhash,
        });

        const balance = (await getAccount(anchor.getProvider().connection, recipientATA)).amount;

        expect(Number(balance)).to.equal(10);
    });

    it("transfer fails if the gatekeeper network does not match the expected one", async () => {
        const differentGatekeeperNetwork = web3.Keypair.generate().publicKey;

        const shouldFail = program.methods.transfer(new BN(10), differentGatekeeperNetwork).accounts({
                payer: provider.wallet.publicKey,
                payerTokenAccount: senderATA,
                recipient: recipientATA,
                gatewayToken: recipientGatewayToken,
                tokenProgram: TOKEN_PROGRAM_ID
            }
        ).rpc();

        await expect(shouldFail).to.be.rejectedWith(/Invalid Gateway Token/);
    });
});
