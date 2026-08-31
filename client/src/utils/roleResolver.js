import roleConfig from "../config/roles.json";

/**
 * Single Authoritative Role Resolver for BLOCKBITE
 * Enforces deterministic role mapping for connected wallets and authenticated identities.
 * NEVER defaults to 'customer' for an unknown connected wallet address.
 */
export function resolveWalletRole(walletAddress, loggedInUser = null) {
  const normAddress = walletAddress ? walletAddress.toLowerCase() : "";

  // 1. Check centralized dev/deployment role mappings
  if (normAddress && roleConfig.devMappings && roleConfig.devMappings[normAddress]) {
    const mapped = roleConfig.devMappings[normAddress];
    return {
      role: mapped.role,
      name: mapped.name,
      email: mapped.email,
      walletAddress: normAddress,
      isKnown: true,
    };
  }

  // 2. Check if authenticated user matches connected wallet
  if (loggedInUser && normAddress && loggedInUser.walletAddress?.toLowerCase() === normAddress) {
    return {
      role: loggedInUser.role,
      name: loggedInUser.name,
      email: loggedInUser.email,
      walletAddress: normAddress,
      isKnown: true,
    };
  }

  // 3. Connected wallet is present but NOT registered in registry or MongoDB
  if (normAddress) {
    return {
      role: "unauthorized",
      name: `Unregistered Wallet (${normAddress.slice(0, 6)}...)`,
      email: `${normAddress.slice(0, 8)}@unknown.eth`,
      walletAddress: normAddress,
      isKnown: false,
    };
  }

  // 4. No connected wallet, fall back to authenticated identity if present
  if (loggedInUser) {
    return {
      role: loggedInUser.role,
      name: loggedInUser.name,
      email: loggedInUser.email,
      walletAddress: loggedInUser.walletAddress ? loggedInUser.walletAddress.toLowerCase() : "",
      isKnown: true,
    };
  }

  return {
    role: null,
    name: null,
    email: null,
    walletAddress: "",
    isKnown: false,
  };
}
