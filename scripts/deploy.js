const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("==================================================");
  console.log("🚀 Starting BLOCKBITE Smart Contracts Deployment...");
  console.log("==================================================");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📌 Deployer Address: ${deployer.address}`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Deployer ETH Balance: ${hre.ethers.formatEther(balance)} ETH`);

  // 1. Deploy BlockBiteToken (Initial supply: 1,000,000 BITE tokens for owner/treasury)
  console.log("\n1️⃣ Deploying BlockBiteToken ($BITE)...");
  const BlockBiteToken = await hre.ethers.getContractFactory("BlockBiteToken");
  const token = await BlockBiteToken.deploy(1000000); // 1,000,000 tokens
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`✅ BlockBiteToken Deployed to: ${tokenAddress}`);

  // 2. Deploy BlockBiteEscrow
  console.log("\n2️⃣ Deploying BlockBiteEscrow...");
  const BlockBiteEscrow = await hre.ethers.getContractFactory("BlockBiteEscrow");
  const escrow = await BlockBiteEscrow.deploy(tokenAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`✅ BlockBiteEscrow Deployed to: ${escrowAddress}`);

  // 3. Grant Minter Rights to Escrow Contract
  console.log("\n3️⃣ Linking Escrow to Token Minter Role...");
  const setEscrowTx = await token.setEscrowContract(escrowAddress);
  await setEscrowTx.wait();
  console.log(`✅ Escrow Contract authorized as Token Minter.`);

  // 4. Verify Test Restaurant & Driver Wallets on Escrow Contract
  //    (Required: the smart contract checks verifiedRestaurants[msg.sender] and verifiedDrivers[msg.sender])
  console.log("\n4️⃣ Verifying test restaurant & driver wallets on-chain...");

  // Hardhat Account #1 = Restaurant Owner
  const restaurantWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const verifyRestaurantTx = await escrow.setRestaurantVerification(restaurantWallet, true);
  await verifyRestaurantTx.wait();
  console.log(`✅ Restaurant verified: ${restaurantWallet}`);

  // Hardhat Account #2 = Delivery Driver
  const driverWallet = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const verifyDriverTx = await escrow.setDriverVerification(driverWallet, true);
  await verifyDriverTx.wait();
  console.log(`✅ Driver verified: ${driverWallet}`);

  // 5. Extract ABIs & Addresses
  const tokenArtifact = await hre.artifacts.readArtifact("BlockBiteToken");
  const escrowArtifact = await hre.artifacts.readArtifact("BlockBiteEscrow");

  const contractData = {
    network: hre.network.name,
    chainId: hre.network.config.chainId || 31337,
    token: {
      address: tokenAddress,
      abi: tokenArtifact.abi,
    },
    escrow: {
      address: escrowAddress,
      abi: escrowArtifact.abi,
    },
    deployedAt: new Date().toISOString(),
  };

  // Export to server and client directories
  const pathsToExport = [
    path.join(__dirname, "../server/config/contracts.json"),
    path.join(__dirname, "../client/src/contracts/contracts.json"),
  ];

  pathsToExport.forEach((destPath) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(destPath, JSON.stringify(contractData, null, 2));
    console.log(`📄 Exported Contract Config to: ${destPath}`);
  });

  console.log("\n🎉 BLOCKBITE Smart Contracts Deployment Completed Successfully!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
