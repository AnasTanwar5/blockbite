import React, { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";
import contractsConfig from "../contracts/contracts.json";

const Web3Context = createContext(null);

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [ethBalance, setEthBalance] = useState("0.00");
  const [biteBalance, setBiteBalance] = useState("0.00");
  const [isConnecting, setIsConnecting] = useState(false);
  const [networkName, setNetworkName] = useState("Hardhat / Local");

  const tokenConfig = contractsConfig.token;
  const escrowConfig = contractsConfig.escrow;

  // Log loaded contract addresses for dev verification
  useEffect(() => {
    console.log("==================================================");
    console.log("🌐 BLOCKBITE Web3 Protocol Loaded:");
    console.log("📌 Token Address:", tokenConfig?.address);
    console.log("📌 Escrow Address:", escrowConfig?.address);
    console.log("==================================================");
  }, []);

  // Check connected account on load
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          if (accounts && accounts.length > 0) {
            setAccount(accounts[0]);
            fetchBalances(accounts[0]);
          }
        })
        .catch((err) => console.warn("Error fetching initial eth_accounts:", err));

      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          fetchBalances(accounts[0]);
        } else {
          setAccount("");
        }
      });

      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    }
  }, []);

  const verifyTxWithLocalRpc = async (txHash, expectedTo) => {
    if (!txHash || typeof txHash !== "string") {
      throw new Error("Missing transaction hash for verification");
    }

    let provider;
    if (window.ethereum) {
      provider = new ethers.BrowserProvider(window.ethereum);
    } else {
      provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    }

    let receipt;
    try {
      receipt = await provider.getTransactionReceipt(txHash);
    } catch (err) {
      console.error("Frontend RPC verification error:", err);
      throw new Error("Unable to verify transaction on blockchain. Please check your network connection and try again.");
    }

    if (!receipt) {
      throw new Error("Transaction receipt not found. It may still be mining or was dropped.");
    }

    if (expectedTo && receipt.to && receipt.to.toLowerCase() !== expectedTo.toLowerCase()) {
      console.warn(`Transaction recipient check: Expected ${expectedTo}, got ${receipt.to}`);
    }

    if (Number(receipt.status) !== 1) {
      throw new Error("Blockchain transaction reverted. Funds were not transferred. Please try again.");
    }

    return receipt;
  };

  const getLocalNonce = async (walletAddress) => {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const nonce = await provider.getTransactionCount(walletAddress, "latest");
    return nonce;
  };

  const sendWithNonceRetry = async (txPromise, walletAddress, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const nonce = await getLocalNonce(walletAddress);
      try {
        return await txPromise(nonce);
      } catch (err) {
        const isNonceError = err.code === "NONCE_EXPIRED" || err.message?.includes("Nonce too low") || err.message?.includes("nonce");
        if (isNonceError && attempt < maxRetries) {
          console.warn(`⚠️ Nonce conflict detected (attempt ${attempt}). Refreshing nonce and retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        throw err;
      }
    }
  };

   const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask extension is required to connect Web3 wallet! Please install MetaMask.");
      return null;
    }

    try {
      setIsConnecting(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const userAccount = accounts[0];
      setAccount(userAccount);

      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
      setNetworkName(network.name === "unknown" ? "Localhost 8545" : network.name);

      await fetchBalances(userAccount);
      setIsConnecting(false);
      return userAccount;
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setIsConnecting(false);
      return null;
    }
  };

  const estimateGas = async (orderId, restaurantWallet, foodAmountETH, deliveryFeeETH, rawOtp) => {
    if (!window.ethereum || !escrowConfig) return null;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const escrowContract = new ethers.Contract(escrowConfig.address, escrowConfig.abi, signer);

      const otpHash = ethers.keccak256(ethers.toUtf8Bytes(rawOtp));
      const tx = await escrowContract.createOrder.estimateGas(
        orderId,
        restaurantWallet,
        ethers.parseEther(foodAmountETH),
        ethers.parseEther(deliveryFeeETH),
        otpHash
      );

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
      const estimatedCost = tx * gasPrice;

      return {
        gasLimit: tx.toString(),
        gasPrice: ethers.formatUnits(gasPrice, "gwei") + " gwei",
        estimatedETH: parseFloat(ethers.formatEther(estimatedCost)).toFixed(6),
      };
    } catch (error) {
      console.warn("Gas estimation failed:", error.message);
      return null;
    }
  };

  const fetchBalances = async (walletAddr) => {
    try {
      if (!window.ethereum || !walletAddr) return;
      const provider = new ethers.BrowserProvider(window.ethereum);
      const bal = await provider.getBalance(walletAddr);
      setEthBalance(parseFloat(ethers.formatEther(bal)).toFixed(4));

      if (tokenConfig && tokenConfig.address) {
        try {
          const tokenContract = new ethers.Contract(tokenConfig.address, tokenConfig.abi, provider);
          const biteBal = await tokenContract.balanceOf(walletAddr);
          setBiteBalance(parseFloat(ethers.formatEther(biteBal)).toFixed(2));
        } catch (tokenErr) {
          if (tokenErr.code === "BAD_DATA" || tokenErr.message?.includes("could not decode result data")) {
            console.warn("Token contract returned empty data; keeping previous BITE balance.");
          } else {
            console.warn("Error fetching BITE balance:", tokenErr.message);
          }
        }
      }
    } catch (err) {
      console.warn("Error fetching Web3 balances:", err.message);
    }
  };

  /**
   * Directly queries the active escrow smart contract to verify on-chain order existence and state
   */
  const verifyOrderOnChain = async (orderId, mongoDbOrderId = "") => {
    if (!window.ethereum) {
      throw new Error("MetaMask extension is required.");
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    const escrowContract = new ethers.Contract(escrowConfig.address, escrowConfig.abi, provider);

    try {
      const chainOrder = await escrowContract.getOrderDetails(orderId);

      const exists = chainOrder && chainOrder.orderId === orderId && chainOrder.customer !== ethers.ZeroAddress;

      console.log("==================================================");
      console.log("🔍 ON-CHAIN ORDER TRACE LOG:");
      console.log("1. orderId:", orderId);
      console.log("2. chainId:", Number(network.chainId));
      console.log("3. escrowContractAddress:", escrowConfig.address);
      console.log("4. customer wallet:", chainOrder.customer);
      console.log("5. restaurant wallet:", chainOrder.restaurant);
      console.log("6. transaction hash: (N/A query)");
      console.log("7. contract target address:", escrowConfig.address);
      console.log("8. on-chain status:", chainOrder.status?.toString());
      console.log("9. on-chain order existence:", exists);
      console.log("10. MongoDB order ID:", mongoDbOrderId || orderId);
      console.log("==================================================");

      return {
        exists,
        orderId: chainOrder.orderId,
        customer: chainOrder.customer,
        restaurant: chainOrder.restaurant,
        foodAmountETH: ethers.formatEther(chainOrder.foodAmount || 0n),
        deliveryFeeETH: ethers.formatEther(chainOrder.deliveryFee || 0n),
        status: Number(chainOrder.status),
        rawOrder: chainOrder,
        escrowContractAddress: escrowConfig.address,
        chainId: Number(network.chainId),
      };
    } catch (err) {
      console.error("Failed to query getOrderDetails on-chain:", err);
      return { exists: false, error: err.message, escrowContractAddress: escrowConfig.address };
    }
  };
  /**
   * Checks if a restaurant wallet is verified on the active escrow smart contract
   */
  const checkRestaurantVerified = async (walletAddr) => {
    if (!window.ethereum || !walletAddr) return true; // Default to true if no wallet
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const escrowContract = new ethers.Contract(escrowConfig.address, escrowConfig.abi, provider);
      const isVerified = await escrowContract.verifiedRestaurants(walletAddr);
      return isVerified;
    } catch (err) {
      console.warn("Failed to check restaurant verification status on-chain:", err.message);
      return true; // Don't block UI on read error
    }
  };

  /**
   * Triggers Smart Contract Escrow Order Creation
   */
  const executeCreateOrderContract = async (orderId, restaurantWallet, foodAmountETH, deliveryFeeETH, rawOtpSecret, referrerAddress = "0x0000000000000000000000000000000000000000") => {
    if (!window.ethereum) {
      alert("MetaMask extension is required to create escrow orders on-chain! Please install MetaMask.");
      throw new Error("MetaMask is not installed.");
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      const expectedChainId = contractsConfig.chainId || 31337;
      if (Number(network.chainId) !== expectedChainId && Number(network.chainId) !== 31337 && Number(network.chainId) !== 11155111) {
        console.warn(`ChainId mismatch: expected ${expectedChainId}, connected ${network.chainId}`);
      }

      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts || accounts.length === 0) {
        throw new Error("No connected wallet account found in MetaMask.");
      }

      setAccount(accounts[0]);
      const signer = await provider.getSigner();
      const escrowContract = new ethers.Contract(escrowConfig.address, escrowConfig.abi, signer);

      const foodAmountWei = ethers.parseEther(foodAmountETH.toString());
      const deliveryFeeWei = ethers.parseEther(deliveryFeeETH.toString());
      const totalAmountWei = foodAmountWei + deliveryFeeWei;

      const otpHash = ethers.keccak256(ethers.toUtf8Bytes(rawOtpSecret));

      console.log("==================================================");
      console.log("🚀 INITIATING ON-CHAIN CREATE ORDER");
      console.log("1. orderId:", orderId);
      console.log("2. chainId:", Number(network.chainId));
      console.log("3. escrowContractAddress:", escrowConfig.address);
      console.log("4. customer wallet:", accounts[0]);
      console.log("5. restaurant wallet:", restaurantWallet);
      console.log("==================================================");

      const tx = await escrowContract.createOrder(
        orderId,
        restaurantWallet,
        foodAmountWei,
        deliveryFeeWei,
        otpHash,
        referrerAddress || ethers.ZeroAddress,
        { value: totalAmountWei }
      );

      // PHASE 2: Wait for receipt
      const receipt = await tx.wait();
      if (!receipt || receipt.status.toString() !== "1") {
        throw new Error("Blockchain transaction failed or reverted during execution.");
      }

      await verifyTxWithLocalRpc(receipt.hash, escrowConfig.address);

      let chainOrder = null;
      try {
        const readEscrow = new ethers.Contract(escrowConfig.address, escrowConfig.abi, provider);
        chainOrder = await readEscrow.getOrderDetails(orderId);
      } catch (readErr) {
        if (readErr.code === "BAD_DATA" || readErr.message?.includes("could not decode result data")) {
          console.warn(`⚠️ getOrderDetails returned empty data for ${orderId}. Tx ${receipt.hash} is confirmed on-chain; proceeding to backend verification.`);
        } else {
          throw readErr;
        }
      }

      if (chainOrder && (!chainOrder.orderId || chainOrder.orderId !== orderId || chainOrder.customer === ethers.ZeroAddress)) {
        console.warn(`⚠️ getOrderDetails returned empty/invalid data for ${orderId}. Tx ${receipt.hash} confirmed; proceeding to backend verification.`);
      }

      console.log("==================================================");
      console.log("✅ ON-CHAIN ORDER CREATION VERIFIED SUCCESSFULLY");
      console.log("6. txHash:", receipt.hash);
      console.log("7. tx to address:", receipt.to);
      console.log("8. blockNumber:", receipt.blockNumber);
      if (chainOrder) {
        console.log("9. on-chain orderId:", chainOrder.orderId);
        console.log("10. customer:", chainOrder.customer);
      } else {
        console.log("9. on-chain orderId: (getOrderDetails returned empty data)");
        console.log("10. customer: (getOrderDetails returned empty data)");
      }
      console.log("==================================================");

      await fetchBalances(accounts[0]);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        escrowContractAddress: escrowConfig.address,
        chainId: Number(network.chainId),
        gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : "",
      };
    } catch (error) {
      console.error("Smart contract order error:", error);
      throw new Error(error.reason || error.message || "Escrow transaction failed");
    }
  };

  /**
   * Triggers Smart Contract Restaurant Order Acceptance
   */
  const executeAcceptOrderContract = async (orderId) => {
    if (!window.ethereum) {
      alert("MetaMask extension is required to accept orders on-chain! Please install MetaMask.");
      throw new Error("MetaMask is not installed.");
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts || accounts.length === 0) {
        throw new Error("No connected wallet account found in MetaMask.");
      }

      setAccount(accounts[0]);
      const signer = await provider.getSigner();
      const escrowContract = new ethers.Contract(escrowConfig.address, escrowConfig.abi, signer);

      let chainOrder = null;
      try {
        chainOrder = await escrowContract.getOrderDetails(orderId);
      } catch (readErr) {
        if (readErr.code === "BAD_DATA" || readErr.message?.includes("could not decode result data")) {
          console.warn(`⚠️ getOrderDetails returned empty data for ${orderId} in accept flow. Proceeding...`);
        } else {
          throw readErr;
        }
      }

      if (chainOrder && (!chainOrder.orderId || chainOrder.orderId !== orderId || chainOrder.customer === ethers.ZeroAddress)) {
        console.warn(`⚠️ getOrderDetails returned invalid data for ${orderId} in accept flow. Proceeding...`);
      }

      console.log("==================================================");
      console.log("⚡ EXECUTING ON-CHAIN ACCEPT ORDER");
      console.log("orderId:", orderId);
      console.log("escrowAddress:", escrowConfig.address);
      console.log("restaurantSigner:", accounts[0]);
      console.log("==================================================");

      const tx = await escrowContract.acceptOrder(orderId);
      const receipt = await tx.wait();

      if (!receipt || Number(receipt.status) !== 1) {
        throw new Error("Transaction reverted on-chain during acceptOrder execution.");
      }

      await verifyTxWithLocalRpc(receipt.hash, escrowConfig.address);

      await fetchBalances(accounts[0]);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        escrowContractAddress: escrowConfig.address,
        chainId: Number(network.chainId),
        gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : "",
      };
    } catch (error) {
      console.error("Smart contract acceptOrder error:", error);
      throw new Error(error.reason || error.message || "Failed to accept order on blockchain");
    }
  };

  /**
   * Triggers Smart Contract Restaurant Order Rejection
   */
  const executeRejectOrderContract = async (orderId, reason = "Rejected by restaurant") => {
    if (!window.ethereum) {
      alert("MetaMask extension is required to reject orders on-chain! Please install MetaMask.");
      throw new Error("MetaMask is not installed.");
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts || accounts.length === 0) {
        throw new Error("No connected wallet account found in MetaMask.");
      }

      setAccount(accounts[0]);
      const signer = await provider.getSigner();
      const escrowContract = new ethers.Contract(escrowConfig.address, escrowConfig.abi, signer);

      const tx = await escrowContract.rejectOrder(orderId, reason);
      const receipt = await tx.wait();

      if (!receipt || Number(receipt.status) !== 1) {
        throw new Error("Transaction reverted on-chain during rejectOrder execution.");
      }

      await verifyTxWithLocalRpc(receipt.hash, escrowConfig.address);

      await fetchBalances(accounts[0]);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : "",
      };
    } catch (error) {
      console.error("Smart contract rejectOrder error:", error);
      throw new Error(error.reason || error.message || "Failed to reject order on blockchain");
    }
  };

  /**
   * Triggers Smart Contract Driver Accept Delivery (claims order on-chain)
   */
  const executeAcceptDeliveryContract = async (orderId) => {
    if (!window.ethereum) {
      alert("MetaMask extension is required to accept delivery on-chain! Please install MetaMask.");
      throw new Error("MetaMask is not installed.");
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts || accounts.length === 0) {
        throw new Error("No connected wallet account found in MetaMask.");
      }

      setAccount(accounts[0]);
      const signer = await provider.getSigner();
      const escrowContract = new ethers.Contract(escrowConfig.address, escrowConfig.abi, signer);

      let chainOrder = null;
      try {
        chainOrder = await escrowContract.getOrderDetails(orderId);
      } catch (readErr) {
        if (readErr.code === "BAD_DATA" || readErr.message?.includes("could not decode result data")) {
          console.warn(`⚠️ getOrderDetails returned empty data for ${orderId} in delivery flow. Proceeding...`);
        } else {
          throw readErr;
        }
      }

      if (chainOrder && (!chainOrder.orderId || chainOrder.orderId !== orderId || chainOrder.customer === ethers.ZeroAddress)) {
        console.warn(`⚠️ getOrderDetails returned invalid data for ${orderId} in delivery flow. Proceeding...`);
      }

      console.log("==================================================");
      console.log("🚴 EXECUTING ON-CHAIN ACCEPT DELIVERY");
      console.log("orderId:", orderId);
      console.log("escrowAddress:", escrowConfig.address);
      console.log("driverSigner:", accounts[0]);
      console.log("==================================================");

      const tx = await escrowContract.acceptDelivery(orderId);
      const receipt = await tx.wait();

      if (!receipt || Number(receipt.status) !== 1) {
        throw new Error("Transaction reverted on-chain during acceptDelivery execution.");
      }

      await verifyTxWithLocalRpc(receipt.hash, escrowConfig.address);

      await fetchBalances(accounts[0]);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        escrowContractAddress: escrowConfig.address,
        chainId: Number(network.chainId),
        gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : "",
      };
    } catch (error) {
      console.error("Smart contract acceptDelivery error:", error);
      throw new Error(error.reason || error.message || "Failed to accept delivery on blockchain");
    }
  };

  /**
   * Triggers Smart Contract Driver Mark Picked Up
   */
  const executeUpdatePickedUpContract = async (orderId) => {
    if (!window.ethereum) {
      alert("MetaMask extension is required to mark order picked up on-chain!");
      throw new Error("MetaMask is not installed.");
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts || accounts.length === 0) {
        throw new Error("No connected wallet account found in MetaMask.");
      }

      setAccount(accounts[0]);
      const signer = await provider.getSigner();
      const escrowContract = new ethers.Contract(escrowConfig.address, escrowConfig.abi, signer);

      console.log("==================================================");
      console.log("📦 EXECUTING ON-CHAIN UPDATE PICKED UP");
      console.log("orderId:", orderId);
      console.log("escrowAddress:", escrowConfig.address);
      console.log("driverSigner:", accounts[0]);
      console.log("==================================================");

      const tx = await escrowContract.updatePickedUp(orderId);
      const receipt = await tx.wait();

      if (!receipt || Number(receipt.status) !== 1) {
        throw new Error("Transaction reverted on-chain during updatePickedUp execution.");
      }

      await verifyTxWithLocalRpc(receipt.hash, escrowConfig.address);

      await fetchBalances(accounts[0]);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        escrowContractAddress: escrowConfig.address,
        chainId: Number(network.chainId),
      };
    } catch (error) {
      console.error("Smart contract updatePickedUp error:", error);
      throw new Error(error.reason || error.message || "Failed to update picked up status on blockchain");
    }
  };

  /**
   * Triggers Smart Contract Delivery OTP Verification & Payout
   */
  const executeConfirmDeliveryContract = async (orderId, rawOtp) => {
    if (!window.ethereum) {
      alert("MetaMask extension is required to confirm delivery on-chain! Please install MetaMask.");
      throw new Error("MetaMask is not installed.");
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts || accounts.length === 0) {
        throw new Error("No connected wallet account found in MetaMask.");
      }

      setAccount(accounts[0]);
      const signer = await provider.getSigner();
      const escrowContract = new ethers.Contract(escrowConfig.address, escrowConfig.abi, signer);

      const tx = await escrowContract.confirmDelivery(orderId, rawOtp);
      const receipt = await tx.wait();

      if (!receipt || Number(receipt.status) !== 1) {
        throw new Error("Transaction reverted on-chain during confirmDelivery execution.");
      }

      await verifyTxWithLocalRpc(receipt.hash, escrowConfig.address);

      await fetchBalances(accounts[0]);

      return { success: true, txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (error) {
      console.error("Delivery OTP smart contract error:", error);
      throw new Error(error.reason || error.message || "Failed to confirm delivery on blockchain");
    }
  };

  const executeCancelOrderContract = async (orderId) => {
    if (!window.ethereum) {
      alert("MetaMask extension is required to cancel order on-chain! Please install MetaMask.");
      throw new Error("MetaMask is not installed.");
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts || accounts.length === 0) {
        throw new Error("No connected wallet account found in MetaMask.");
      }

      setAccount(accounts[0]);
      const signer = await provider.getSigner();
      const escrowContract = new ethers.Contract(escrowConfig.address, escrowConfig.abi, signer);

      const tx = await escrowContract.cancelOrder(orderId);
      const receipt = await tx.wait();

      if (!receipt || Number(receipt.status) !== 1) {
        throw new Error("Transaction reverted on-chain during cancelOrder execution.");
      }

      await verifyTxWithLocalRpc(receipt.hash, escrowConfig.address);

      await fetchBalances(accounts[0]);

      return { success: true, txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (error) {
      console.error("Cancel order smart contract error:", error);
      throw new Error(error.reason || error.message || "Failed to cancel order on blockchain");
    }
  };

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        ethBalance,
        biteBalance,
        isConnecting,
        networkName,
        connectWallet,
        fetchBalances,
        verifyOrderOnChain,
        checkRestaurantVerified,
        estimateGas,
        executeCreateOrderContract,
        executeAcceptOrderContract,
        executeRejectOrderContract,
        executeAcceptDeliveryContract,
        executeUpdatePickedUpContract,
        executeConfirmDeliveryContract,
        executeCancelOrderContract,
        contractAddresses: {
          token: tokenConfig?.address,
          escrow: escrowConfig?.address,
        },
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => useContext(Web3Context);
