/**
 * TradeExecutor - Execute trades via Jupiter DEX Aggregator
 * Handles buying and selling tokens on Solana
 */

import { PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

// SOL mint address
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// Jupiter API endpoints
const JUPITER_API = 'https://quote-api.jup.ag/v6';

class TradeExecutor {
  constructor(connection, wallet) {
    this.connection = connection;
    this.wallet = wallet;
  }

  /**
   * Get quote for a swap
   * @param {string} inputMint - Input token mint address
   * @param {string} outputMint - Output token mint address
   * @param {number} amount - Amount in lamports/smallest unit
   * @param {number} slippageBps - Slippage in basis points (100 = 1%)
   */
  async getQuote(inputMint, outputMint, amount, slippageBps = 100) {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false',
      });

      const response = await fetch(`${JUPITER_API}/quote?${params}`);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Jupiter quote failed: ${error}`);
      }

      const quote = await response.json();
      return quote;
    } catch (error) {
      console.error('Error getting quote:', error);
      throw error;
    }
  }

  /**
   * Get swap transaction from Jupiter
   * @param {object} quoteResponse - Quote response from getQuote
   * @param {string} userPublicKey - User's wallet public key
   */
  async getSwapTransaction(quoteResponse, userPublicKey) {
    try {
      const response = await fetch(`${JUPITER_API}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Jupiter swap failed: ${error}`);
      }

      const { swapTransaction } = await response.json();
      return swapTransaction;
    } catch (error) {
      console.error('Error getting swap transaction:', error);
      throw error;
    }
  }

  /**
   * Execute a swap transaction
   * @param {string} swapTransaction - Base64 encoded transaction
   */
  async executeSwap(swapTransaction) {
    try {
      // Decode the transaction
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.message.recentBlockhash = blockhash;

      // Sign the transaction
      const signedTransaction = await this.wallet.signTransaction(transaction);

      // Execute
      const rawTransaction = signedTransaction.serialize();
      const txid = await this.connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 3,
      });

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature: txid,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      return {
        success: true,
        signature: txid,
        status: 'confirmed',
      };
    } catch (error) {
      console.error('Error executing swap:', error);
      throw error;
    }
  }

  /**
   * Buy token with SOL
   * @param {string} tokenAddress - Token mint address to buy
   * @param {number} amountSol - Amount of SOL to spend
   * @param {number} slippageBps - Slippage in basis points
   */
  async buyToken(tokenAddress, amountSol, slippageBps = 100) {
    try {
      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

      console.log(`🛒 Buying token ${tokenAddress} with ${amountSol} SOL`);

      // Get quote
      const quote = await this.getQuote(SOL_MINT, tokenAddress, amountLamports, slippageBps);
      console.log(`📊 Quote received: ${quote.outAmount} tokens for ${amountSol} SOL`);

      // Get swap transaction
      const swapTx = await this.getSwapTransaction(quote, this.wallet.publicKey.toBase58());

      // Execute
      const result = await this.executeSwap(swapTx);
      console.log(`✅ Buy executed: ${result.signature}`);

      return {
        ...result,
        inputAmount: amountSol,
        outputAmount: quote.outAmount / Math.pow(10, quote.outputDecimals || 9),
        inputToken: 'SOL',
        outputToken: tokenAddress,
        quote,
      };
    } catch (error) {
      console.error('Error buying token:', error);
      throw error;
    }
  }

  /**
   * Sell token for SOL
   * @param {string} tokenAddress - Token mint address to sell
   * @param {number} amountTokens - Amount of tokens to sell (in token decimals)
   * @param {number} decimals - Token decimals (default 9)
   * @param {number} slippageBps - Slippage in basis points
   */
  async sellToken(tokenAddress, amountTokens, decimals = 9, slippageBps = 100) {
    try {
      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const amountSmallestUnit = Math.floor(amountTokens * Math.pow(10, decimals));

      console.log(`💰 Selling ${amountTokens} of token ${tokenAddress}`);

      // Get quote
      const quote = await this.getQuote(tokenAddress, SOL_MINT, amountSmallestUnit, slippageBps);
      const outputSol = quote.outAmount / LAMPORTS_PER_SOL;
      console.log(`📊 Quote received: ${outputSol} SOL for ${amountTokens} tokens`);

      // Get swap transaction
      const swapTx = await this.getSwapTransaction(quote, this.wallet.publicKey.toBase58());

      // Execute
      const result = await this.executeSwap(swapTx);
      console.log(`✅ Sell executed: ${result.signature}`);

      return {
        ...result,
        inputAmount: amountTokens,
        outputAmount: outputSol,
        inputToken: tokenAddress,
        outputToken: 'SOL',
        quote,
      };
    } catch (error) {
      console.error('Error selling token:', error);
      throw error;
    }
  }

  /**
   * Get token balance
   * @param {string} tokenAddress - Token mint address
   */
  async getTokenBalance(tokenAddress) {
    try {
      if (!this.wallet.publicKey) {
        return 0;
      }

      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        this.wallet.publicKey,
        { mint: new PublicKey(tokenAddress) }
      );

      if (tokenAccounts.value.length === 0) {
        return 0;
      }

      const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
      return balance.uiAmount || 0;
    } catch (error) {
      console.error('Error getting token balance:', error);
      return 0;
    }
  }

  /**
   * Get transaction status
   * @param {string} signature - Transaction signature
   */
  async getTransactionStatus(signature) {
    try {
      const status = await this.connection.getSignatureStatus(signature);

      if (!status || !status.value) {
        return { status: 'pending', confirmations: 0 };
      }

      return {
        status: status.value.confirmationStatus || 'pending',
        confirmations: status.value.confirmations || 0,
        err: status.value.err,
      };
    } catch (error) {
      console.error('Error getting transaction status:', error);
      return { status: 'unknown', error: error.message };
    }
  }
}

// Singleton instance
let tradeExecutorInstance = null;

export const getTradeExecutor = (connection, wallet) => {
  if (!tradeExecutorInstance || tradeExecutorInstance.connection !== connection) {
    tradeExecutorInstance = new TradeExecutor(connection, wallet);
  }
  return tradeExecutorInstance;
};

export default TradeExecutor;
