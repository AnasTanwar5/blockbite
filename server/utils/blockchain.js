const { ethers } = require("ethers");

const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const ESCROW_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || process.env.VITE_ESCROW_CONTRACT_ADDRESS || "";

let cachedLocalProvider = null;
let cachedSepoliaProvider = null;

function getLocalProvider() {
  if (!cachedLocalProvider) {
    cachedLocalProvider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
  }
  return cachedLocalProvider;
}

function getSepoliaProvider() {
  if (!cachedSepoliaProvider) {
    cachedSepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  }
  return cachedSepoliaProvider;
}

async function getReceiptWithRetry(provider, txHash, retries = 3, delayMs = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) return receipt;
    } catch (err) {
      console.error(`  RPC attempt ${i + 1} failed:`, err.message);
    }
    if (i < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

async function verifyTransaction(txHash, expectedTo = "") {
  console.log("🔍 [BLOCKCHAIN VERIFY] Verifying transaction receipt...");
  console.log("  txHash:", txHash);
  console.log("  expectedTo:", expectedTo);

  if (!txHash || typeof txHash !== "string") {
    throw new Error("Missing transaction hash for blockchain verification");
  }

  let receipt = await getReceiptWithRetry(getLocalProvider(), txHash);
  let usedProvider = "localhost";

  if (!receipt) {
    console.log("  Not found on localhost, trying Sepolia...");
    receipt = await getReceiptWithRetry(getSepoliaProvider(), txHash);
    usedProvider = "sepolia";
  }

  console.log("  receipt found on:", usedProvider, "=>", !!receipt);
  if (receipt) {
    console.log("  receipt.status:", receipt.status);
    console.log("  receipt.to:", receipt.to);
    console.log("  receipt.blockNumber:", receipt.blockNumber);
  }

  if (!receipt) {
    throw new Error("Transaction not found on blockchain. It may have been dropped or not yet mined.");
  }

  if (expectedTo && receipt.to && receipt.to.toLowerCase() !== expectedTo.toLowerCase()) {
    if (usedProvider === "sepolia") {
      console.log("  Skipping recipient check on Sepolia (different contract address expected)");
    } else {
      throw new Error(`Transaction recipient mismatch. Expected ${expectedTo}, got ${receipt.to}`);
    }
  }

  if (Number(receipt.status) !== 1) {
    throw new Error("Blockchain transaction reverted. Funds were not transferred. Please try again.");
  }

  return receipt;
}

async function verifyOrderOnChain(txHash, orderId, escrowAddress, chainId) {
  console.log("🔍 [BLOCKCHAIN VERIFY] Starting order verification...");
  console.log("  txHash:", txHash);
  console.log("  orderId:", orderId);
  console.log("  escrowAddress:", escrowAddress || ESCROW_ADDRESS);
  console.log("  chainId:", chainId);

  const receipt = await verifyTransaction(txHash, escrowAddress || ESCROW_ADDRESS);
  console.log("  receipt.status:", receipt.status);
  console.log("  receipt.to:", receipt.to);
  console.log("  receipt.blockNumber:", receipt.blockNumber);

  if (!orderId) {
    return { verified: true, receipt };
  }

  const isLocal = String(chainId) === "31337" || String(chainId) === "1337";
  if (isLocal) {
    console.log("  Localhost detected: skipping getOrderDetails verification, trusting confirmed tx receipt");
    return { verified: true, receipt, skipped: true };
  }

  const contractAddress = receipt.to || escrowAddress || ESCROW_ADDRESS;
  console.log("  querying contract:", contractAddress);

  const provider = usedProvider === "sepolia" ? getSepoliaProvider() : getLocalProvider();
  const escrow = new ethers.Contract(
    contractAddress,
    [
      "function getOrderDetails(string orderId) view returns (string orderId, address customer, address restaurant, address driver, uint256 foodAmount, uint256 deliveryFee, uint256 tipAmount, uint256 totalAmount, uint8 status, bytes32 otpHash, uint256 createdAt, uint256 deliveredAt, string reviewHash, bool isReviewRewarded, address referrer)",
    ],
    provider
  );

  let chainOrder;
  try {
    chainOrder = await escrow.getOrderDetails(orderId);
  } catch (err) {
    console.error("  getOrderDetails reverted:", err);
    throw new Error("Order not found on blockchain. Please contact support.");
  }

  console.log("  chainOrder.orderId:", chainOrder?.orderId);
  console.log("  chainOrder.customer:", chainOrder?.customer);

  if (!chainOrder || !chainOrder.orderId || chainOrder.orderId !== orderId) {
    throw new Error("Order not found on blockchain. Please contact support.");
  }

  console.log("✅ [BLOCKCHAIN VERIFY] Order verified successfully on-chain");
  return { verified: true, receipt, chainOrder };
}

module.exports = {
  verifyTransaction,
  verifyOrderOnChain,
  getLocalProvider,
  getSepoliaProvider,
};
