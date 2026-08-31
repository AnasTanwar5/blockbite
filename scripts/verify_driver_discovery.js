const path = require("path");
const axios = require(path.join(__dirname, "../server/node_modules/axios"));

async function verifyDriverDiscovery() {
  const driverWallet = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const contractsConfig = require("../client/src/contracts/contracts.json");
  const escrowAddr = contractsConfig.escrow.address;

  console.log("==================================================");
  console.log("🔍 DRIVER ORDER DISCOVERY VERIFICATION");
  console.log("==================================================");
  console.log("📌 Active Escrow Contract:", escrowAddr);
  console.log("📌 Driver Wallet:", driverWallet);

  // 1. Synchronize Driver Wallet Session with Backend to obtain Driver JWT token
  const sessionRes = await axios.post("http://localhost:5000/api/auth/wallet-session", {
    walletAddress: driverWallet,
  });

  if (!sessionRes.data.success || !sessionRes.data.token) {
    throw new Error("Failed to obtain driver wallet session token!");
  }

  const driverToken = sessionRes.data.token;
  console.log("✅ Obtained Driver JWT Token! Driver Role:", sessionRes.data.user.role);

  // 2. Query /api/delivery/available with Driver JWT Token
  const availableRes = await axios.get("http://localhost:5000/api/delivery/available", {
    headers: { Authorization: `Bearer ${driverToken}` },
  });

  console.log("\n📦 Available Orders Returned for Driver:");
  console.log("Count:", availableRes.data.count);
  availableRes.data.orders.forEach((o) => {
    console.log(`- OrderId: ${o.orderId} | Status: ${o.escrowStatus} | Contract: ${o.escrowContractAddress}`);
  });

  console.log("\n==================================================");
  console.log("🎉 DRIVER DISCOVERY API VERIFICATION SUCCESSFUL!");
  console.log("==================================================");
}

verifyDriverDiscovery().catch((err) => {
  console.error("❌ Driver Discovery Test Failed:", err.response?.data || err.message);
  process.exit(1);
});
