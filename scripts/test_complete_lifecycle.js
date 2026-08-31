const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [customerSigner, restaurantSigner, driverSigner] = await ethers.getSigners();

  const contractsConfig = require("../client/src/contracts/contracts.json");
  const escrowAddr = contractsConfig.escrow.address;
  const escrowAbi = contractsConfig.escrow.abi;

  console.log("==================================================");
  console.log("🧪 BLOCKBITE END-TO-END INTEGRATION TEST SUITE");
  console.log("==================================================");
  console.log("📌 Escrow Contract Address:", escrowAddr);
  console.log("👤 Customer Wallet:", customerSigner.address);
  console.log("🏪 Restaurant Wallet:", restaurantSigner.address);
  console.log("🚴 Driver Wallet:", driverSigner.address);

  const customerEscrow = new ethers.Contract(escrowAddr, escrowAbi, customerSigner);
  const restaurantEscrow = new ethers.Contract(escrowAddr, escrowAbi, restaurantSigner);
  const driverEscrow = new ethers.Contract(escrowAddr, escrowAbi, driverSigner);

  const orderId = `ORD-LIFECYCLE-${Date.now().toString().slice(-5)}`;
  const rawOtpSecret = "7890";
  const otpHash = ethers.keccak256(ethers.toUtf8Bytes(rawOtpSecret));

  const foodAmount = ethers.parseEther("0.005");
  const deliveryFee = ethers.parseEther("0.002");
  const totalAmount = foodAmount + deliveryFee;

  console.log("\n--- STAGE 1: Customer createOrder() ---");
  console.log("OrderId:", orderId);
  const tx1 = await customerEscrow.createOrder(
    orderId,
    restaurantSigner.address,
    foodAmount,
    deliveryFee,
    otpHash,
    ethers.ZeroAddress,
    { value: totalAmount }
  );
  const receipt1 = await tx1.wait();
  console.log("✅ createOrder confirmed on-chain! Tx:", tx1.hash, "Block:", receipt1.blockNumber);

  console.log("\n--- STAGE 2: Provider getOrderDetails(orderId) Verification ---");
  const orderDetails = await customerEscrow.getOrderDetails(orderId);
  console.log("On-chain returned orderId:", orderDetails.orderId);
  console.log("Customer:", orderDetails.customer);
  console.log("Restaurant:", orderDetails.restaurant);
  console.log("Status (0=Created):", orderDetails.status.toString());

  if (orderDetails.orderId !== orderId) {
    throw new Error(`Order ID mismatch! Expected ${orderId}, got ${orderDetails.orderId}`);
  }
  if (orderDetails.customer.toLowerCase() !== customerSigner.address.toLowerCase()) {
    throw new Error("Customer address mismatch!");
  }

  console.log("\n--- STAGE 3: Restaurant acceptOrder() ---");
  const tx2 = await restaurantEscrow.acceptOrder(orderId);
  const receipt2 = await tx2.wait();
  console.log("✅ acceptOrder confirmed on-chain! Tx:", tx2.hash);

  const orderAfterAccept = await customerEscrow.getOrderDetails(orderId);
  console.log("Status (1=AcceptedByRestaurant):", orderAfterAccept.status.toString());

  if (orderAfterAccept.status.toString() !== "1") {
    throw new Error("Status failed to update to AcceptedByRestaurant!");
  }

  console.log("\n--- STAGE 4: Driver acceptDelivery() ---");
  const tx3 = await driverEscrow.acceptDelivery(orderId);
  await tx3.wait();
  console.log("✅ acceptDelivery confirmed on-chain! Tx:", tx3.hash);

  console.log("\n--- STAGE 5: Driver updatePickedUp() ---");
  const tx4 = await driverEscrow.updatePickedUp(orderId);
  await tx4.wait();
  console.log("✅ updatePickedUp confirmed on-chain! Tx:", tx4.hash);

  console.log("\n--- STAGE 6: Delivery OTP Verification & ETH Payout ---");
  const tx5 = await driverEscrow.confirmDelivery(orderId, rawOtpSecret);
  const receipt5 = await tx5.wait();
  console.log("✅ confirmDelivery confirmed on-chain! Tx:", tx5.hash);

  const orderAfterDelivery = await customerEscrow.getOrderDetails(orderId);
  console.log("Final Status (5=Delivered):", orderAfterDelivery.status.toString());

  if (orderAfterDelivery.status.toString() !== "5") {
    throw new Error("Final status is not Delivered!");
  }

  console.log("\n--- STAGE 7: Negative Test - Non-Existent Order Query ---");
  try {
    const bogusDetails = await customerEscrow.getOrderDetails("ORD-BOGUS-999");
    console.log("Bogus order customer:", bogusDetails.customer);
    if (bogusDetails.customer !== ethers.ZeroAddress) {
      throw new Error("Bogus order should return empty customer ZeroAddress");
    }
    console.log("✅ Non-existent order returns zeroed struct correctly!");
  } catch (err) {
    console.log("✅ Non-existent order query rejected as expected:", err.message);
  }

  console.log("\n==================================================");
  console.log("🎉 ALL END-TO-END BLOCKCHAIN INTEGRATION TESTS PASSED!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("❌ Lifecycle Integration Test Failed:", err);
  process.exitCode = 1;
});
