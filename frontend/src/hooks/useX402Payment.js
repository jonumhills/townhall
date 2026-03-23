/**
 * useX402Payment — handles the x402 payment flow for AI chat.
 *
 * Flow:
 *   1. Caller fires a request (no payment header)
 *   2. If server returns 402, parse the payment requirement
 *   3. Send 1 HBAR to Townhall via MetaMask on Hedera Testnet
 *   4. Retry original request with X-Payment: { txHash }
 */
import { useState, useCallback } from 'react';
import { BrowserProvider, parseEther, getAddress } from 'ethers';
import axios from 'axios';

const HEDERA_TESTNET = {
  chainId:          '0x128',
  chainName:        'Hedera Testnet',
  nativeCurrency:   { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  rpcUrls:          ['https://testnet.hashio.io/api'],
  blockExplorerUrls:['https://hashscan.io/testnet'],
};

/** Derive the 20-byte EVM address from a Hedera account ID ("0.0.NNNN"). */
function hederaAccountToEvm(accountId) {
  const num = parseInt(accountId.split('.')[2], 10);
  return '0x' + num.toString(16).padStart(40, '0');
}

/** Switch MetaMask to Hedera Testnet if not already on it. */
async function ensureHederaTestnet(provider) {
  try {
    await provider.send('wallet_switchEthereumChain', [{ chainId: HEDERA_TESTNET.chainId }]);
  } catch (err) {
    if (err.code === 4902) {
      await provider.send('wallet_addEthereumChain', [HEDERA_TESTNET]);
    } else {
      throw err;
    }
  }
}

export function useX402Payment() {
  const [isPaying,     setIsPaying]     = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [lastTxHash,   setLastTxHash]   = useState(null);

  /**
   * payAndPost(url, body, extraHeaders?)
   *
   * Tries POST url once; if 402, pays 1 HBAR then retries.
   * Returns the axios response on success, throws on unrecoverable error.
   */
  const payAndPost = useCallback(async (url, body, extraHeaders = {}) => {
    setPaymentError('');

    // ── Step 1: try without payment ─────────────────────────────────────────
    try {
      return await axios.post(url, body, { headers: extraHeaders });
    } catch (err) {
      if (err.response?.status !== 402) throw err;

      // ── Step 2: parse payment requirement ──────────────────────────────────
      const paymentReq = err.response.data?.payment_required || {};
      const payTo = paymentReq.payTo || '0.0.5530044';
      const toEvm = paymentReq.payToEvm || hederaAccountToEvm(payTo);

      console.log('[x402] payment_required payload:', paymentReq);
      console.log('[x402] toEvm:', toEvm, '| length:', toEvm.length, '| hex chars:', toEvm.length - 2);

      if (!window.ethereum) {
        const msg = 'MetaMask not found — install it to pay for AI chat.';
        setPaymentError(msg);
        throw new Error(msg);
      }

      setIsPaying(true);
      try {
        // ── Step 3: send 1 HBAR via MetaMask ─────────────────────────────────
        const ethersProvider = new BrowserProvider(window.ethereum);
        await ensureHederaTestnet(ethersProvider);
        const signer = await ethersProvider.getSigner();

        const checksummed = getAddress(toEvm);
        console.log('[x402] checksummed address:', checksummed);
        const tx = await signer.sendTransaction({
          to:       checksummed,
          value:    parseEther('1'),   // 1 HBAR
          gasLimit: 21000n,            // plain HBAR transfer — skip estimateGas
        });

        // Wait for inclusion in a block
        await tx.wait(1);
        setLastTxHash(tx.hash);

        // ── Step 4: retry with proof ─────────────────────────────────────────
        const xPayment = JSON.stringify({ txHash: tx.hash });
        return await axios.post(url, body, {
          headers: { ...extraHeaders, 'X-Payment': xPayment },
        });
      } catch (payErr) {
        const msg = payErr.response?.data?.detail || payErr.message || 'Payment failed';
        setPaymentError(msg);
        throw payErr;
      } finally {
        setIsPaying(false);
      }
    }
  }, []);

  return { payAndPost, isPaying, paymentError, lastTxHash };
}
