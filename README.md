# Gateway Payment Proxy

## What is it?

Civic Gateway Payment Proxy is a simple program on Solana that allows payment to a recipient if and only if they have an active [Civic Pass](https://docs.civic.com/).

It proxies the SPL-Token program transfer instruction, so you can use it instead of SPL-Token transfer in your Solana transactions.

## Why is it?

Example use cases for this program include:
- CPIs from other programs, that need to transfer tokens but do not want to check the pass status of the recipient.
- Proposals in DAOs, that pay funds to recipients, which can only be executed if the recipient meets the KYC or [other requirements](https://www.civic.com/solutions/) of the DAO.
- Safe transfer of age-restricted NFTs to recipients that pass an age check.

## How do I use it?

This program uses [Anchor](https://github.com/coral-xyz/anchor).

Sample code:

```ts
import * as anchor from "@project-serum/anchor";
import {Program, Wallet, web3, BN, fetchIdl, AnchorProvider} from "@project-serum/anchor";
import {findGatewayToken} from "@identity.com/solana-gateway-ts";

// set up anchor
const provider = AnchorProvider.local();
anchor.setProvider(provider);
const programId = "gpp77nzp35M7wfS4MofJPg3CLxqAuLa3XgKS7333Pg6"
const idl = await fetchIdl(programId);
const program = new Program(idl, programId);

// get the recipients Civic Pass PDA (in this example, a KYC pass is used)
const kycPassType = new web3.PublicKey("bni1ewus6aMxTxBi5SAfzEmmXLf8KcVFRmTfproJuKw")
const recipientGatewayToken = await getGatewayTokenAddressForOwnerAndGatekeeperNetwork(
    recipient,
    kycPassType
);

// make the transfer
const tx = await program.methods.transfer(new BN(10), kycPassType).accounts({
        payer: provider.wallet.publicKey,
        payerTokenAccount: senderATA,   // the sender's token account
        recipient: recipientATA,        // the recipient's token account
        gatewayToken: recipientGatewayToken,    
        tokenProgram: TOKEN_PROGRAM_ID
    }
).rpc();
```

## Limitations

- This program is simple - but *in alpha* and *not security audited* - use at your own risk.
- SOL transactions are not currently supported, only SPL-Tokens (including NFTs).
- Only the transfer function is currently proxied. If there is a need, this could be expanded to support functions such as freezing, burning etc (PRs welcome)
- The client is a "raw" anchor client - future improvements may bundle the anchor client into a richer client library that will allow it to be used in place of SPL-Token as a direct drop-in.