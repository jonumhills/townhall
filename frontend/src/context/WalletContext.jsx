/**
 * WalletContext — single shared wallet session for the entire app.
 * Wrap <App> with <WalletProvider> so any page can call useHederaWallet()
 * and get the same connected account.
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { BrowserProvider } from 'ethers';

const HEDERA_TESTNET = {
  chainId:          '0x128',
  chainName:        'Hedera Testnet',
  nativeCurrency:   { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  rpcUrls:          ['https://testnet.hashio.io/api'],
  blockExplorerUrls:['https://hashscan.io/testnet'],
};

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account,      setAccount]      = useState(null);
  const [walletType,   setWalletType]   = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error,        setError]        = useState('');
  const listenerAttached = useRef(false);

  // Restore session + listen for account changes once on mount
  useEffect(() => {
    if (!window.ethereum || listenerAttached.current) return;
    listenerAttached.current = true;

    window.ethereum.request({ method: 'eth_accounts' })
      .then(accounts => { if (accounts[0]) setAccount(accounts[0]); })
      .catch(() => {});

    const onChange = (accounts) => setAccount(accounts[0] || null);
    window.ethereum.on('accountsChanged', onChange);
    return () => window.ethereum.removeListener('accountsChanged', onChange);
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('No wallet found. Install MetaMask to connect.');
      return null;
    }
    setIsConnecting(true);
    setError('');
    try {
      // Switch / add Hedera Testnet
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: HEDERA_TESTNET.chainId }],
        });
      } catch (switchErr) {
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [HEDERA_TESTNET],
          });
        } else {
          throw switchErr;
        }
      }

      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      setAccount(accounts[0]);
      setWalletType('metamask');
      return accounts[0];
    } catch (err) {
      setError(err.message || 'Wallet connection failed');
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setWalletType(null);
  }, []);

  const shortAddress = account
    ? `${account.slice(0, 6)}…${account.slice(-5)}`
    : null;

  return (
    <WalletContext.Provider value={{
      account, shortAddress, walletType,
      connect, disconnect,
      isConnecting, error,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
