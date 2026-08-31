const hre = require("hardhat");
const { ethers } = hre;
const path = require("path");

async function main() {
  const [customerSigner, restaurantSigner] = await ethers.getSigners();

  const contractsConfig = require("../client/src/contracts/contracts.json");
  const escrowAddr = contractsConfig.escrow.address;
  const escrowAbi = contractsConfig.escrow.abi;

  console.log("==================================================");
  console.log("🔍 BLOCKBITE ORDER ID SYNCHRONIZATION VERIFICATION");
  console.log("==================================================");
  console.log("📌 Escrow Contract Address:", escrowAddr);

  const customerContract = new ethers.Contract(escrowAddr, escrowAbi, customerSigner);
  const restaurantContract = new ethers.Contract(escrowAddr, escrowAbi, restaurantSigner);

  const orderId = `ORD-${Date.now().toString().slice(-6)}-999`;
  console.log("\n1️⃣ Creating order on-chain with EXACT single orderId:", orderId);

  const foodAmount = ethers.parseEther("0.005");
  const deliveryFee = ethers.parseEther("0.002");
  const totalAmount = foodAmount + deliveryFee;
  const otpHash = ethers.keccak256(ethers.toUtf8Bytes("1234"));

  const tx1 = await customerContract.createOrder(
    orderId,
    restaurantSigner.address,
    foodAmount,
    deliveryFee,
    otpHash,
    ethers.ZeroAddress,
    { value: totalAmount }
  );
  await tx1.wait();
  console.log("✅ createOrder succeeded! Tx Hash:", tx1.hash);

  console.log("\n2️⃣ Verifying getOrderDetails(orderId) on-chain...");
  const orderData = await customerContract.getOrderDetails(orderId);
  console.log("📄 Returned Order ID from chain:", orderData.orderId);
  console.log("👤 Customer Wallet:", orderData.customer);
  console.log("🏪 Restaurant Wallet:", orderData.restaurant);
  console.log("📊 Order Status (0 = Created):", orderData.status.toString());

  if (orderData.orderId !== orderId) {
    throw new Error(`❌ MISMATCH ERROR! Expected ${orderId}, got ${orderData.orderId}`);
  }
  console.log("✅ Order ID on blockchain MATCHES exact requested orderId!");

  console.log("\n3️⃣ Testing Restaurant acceptOrder(orderId)...");
  const tx2 = await restaurantContract.acceptOrder(orderId);
  await tx2.wait();
  console.log("✅ acceptOrder succeeded! Tx Hash:", tx2.hash);

  const updatedOrder = await customerContract.getOrderDetails(orderId);
  console.log("📊 Updated Status (1 = AcceptedByRestaurant):", updatedOrder.status.toString());

  if (updatedOrder.status.toString() !== "1") {
    throw new Error("❌ Order status was not updated to AcceptedByRestaurant!");
  }

  console.log("\n🎉 ALL BLOCKCHAIN ORDER ID VERIFICATIONS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exitCode = 1;
});
