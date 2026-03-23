/**
 * useHederaWallet — thin alias for useWallet().
 * Wallet state now lives in WalletContext so it's shared across all pages.
 */
export { useWallet as useHederaWallet } from '../context/WalletContext';
