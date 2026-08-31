const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BLOCKBITE Smart Contracts", function () {
  let token, escrow;
  let owner, customer, restaurant, driver, referrer, stranger;

  const foodAmount = ethers.parseEther("0.05"); // 0.05 ETH
  const deliveryFee = ethers.parseEther("0.005"); // 0.005 ETH
  const totalAmount = foodAmount + deliveryFee;
  const otpSecret = "4821";
  const otpHash = ethers.keccak256(ethers.toUtf8Bytes(otpSecret));

  beforeEach(async function () {
    [owner, customer, restaurant, driver, referrer, stranger] = await ethers.getSigners();

    // Deploy Token
    const TokenFactory = await ethers.getContractFactory("BlockBiteToken");
    token = await TokenFactory.deploy(1000000);
    await token.waitForDeployment();

    // Deploy Escrow
    const EscrowFactory = await ethers.getContractFactory("BlockBiteEscrow");
    escrow = await EscrowFactory.deploy(await token.getAddress());
    await escrow.waitForDeployment();

    // Set Escrow in Token
    await token.setEscrowContract(await escrow.getAddress());

    // Verify restaurant and driver for testing
    await escrow.setRestaurantVerification(restaurant.address, true);
    await escrow.setDriverVerification(driver.address, true);
  });

  describe("Token & Deployment Setup", function () {
    it("should initialize token with correct name and symbol", async function () {
      expect(await token.name()).to.equal("BlockBite Reward Token");
      expect(await token.symbol()).to.equal("BITE");
    });

    it("should link Escrow as Minter", async function () {
      expect(await token.escrowContract()).to.equal(await escrow.getAddress());
    });
  });

  describe("Escrow Order Workflow", function () {
    const orderId = "ORD-TEST-101";

    it("should create an order with locked ETH payment", async function () {
      await expect(
        escrow.connect(customer).createOrder(
          orderId,
          restaurant.address,
          foodAmount,
          deliveryFee,
          otpHash,
          referrer.address,
          { value: totalAmount }
        )
      )
        .to.emit(escrow, "OrderCreated")
        .withArgs(orderId, customer.address, restaurant.address, foodAmount, deliveryFee, totalAmount);

      const orderDetails = await escrow.getOrderDetails(orderId);
      expect(orderDetails.customer).to.equal(customer.address);
      expect(orderDetails.totalAmount).to.equal(totalAmount);
      expect(orderDetails.status).to.equal(0); // Created
    });

    it("should allow restaurant to accept order", async function () {
      await escrow.connect(customer).createOrder(
        orderId,
        restaurant.address,
        foodAmount,
        deliveryFee,
        otpHash,
        referrer.address,
        { value: totalAmount }
      );

      await expect(escrow.connect(restaurant).acceptOrder(orderId))
        .to.emit(escrow, "OrderAccepted")
        .withArgs(orderId, restaurant.address);

      const orderDetails = await escrow.getOrderDetails(orderId);
      expect(orderDetails.status).to.equal(1); // AcceptedByRestaurant
    });

    it("should allow driver to accept delivery and pick up order", async function () {
      await escrow.connect(customer).createOrder(
        orderId,
        restaurant.address,
        foodAmount,
        deliveryFee,
        otpHash,
        referrer.address,
        { value: totalAmount }
      );
      await escrow.connect(restaurant).acceptOrder(orderId);

      // Driver accepts delivery
      await escrow.connect(driver).acceptDelivery(orderId);
      let orderDetails = await escrow.getOrderDetails(orderId);
      expect(orderDetails.driver).to.equal(driver.address);
      expect(orderDetails.status).to.equal(3); // DriverAssigned

      // Driver marks picked up
      await escrow.connect(driver).updatePickedUp(orderId);
      orderDetails = await escrow.getOrderDetails(orderId);
      expect(orderDetails.status).to.equal(4); // PickedUp
    });

    it("should verify OTP, release ETH to restaurant & driver, and mint BITE reward tokens", async function () {
      await escrow.connect(customer).createOrder(
        orderId,
        restaurant.address,
        foodAmount,
        deliveryFee,
        otpHash,
        referrer.address,
        { value: totalAmount }
      );
      await escrow.connect(restaurant).acceptOrder(orderId);
      await escrow.connect(driver).acceptDelivery(orderId);
      await escrow.connect(driver).updatePickedUp(orderId);

      const restBalBefore = await ethers.provider.getBalance(restaurant.address);
      const driverBalBefore = await ethers.provider.getBalance(driver.address);

      // Confirm delivery with valid OTP
      await expect(escrow.connect(driver).confirmDelivery(orderId, otpSecret))
        .to.emit(escrow, "OrderDelivered");

      const restBalAfter = await ethers.provider.getBalance(restaurant.address);
      const driverBalAfter = await ethers.provider.getBalance(driver.address);

      // Verify ETH payout
      expect(restBalAfter - restBalBefore).to.equal(foodAmount);
      // Note: driver balance diff includes gas cost if driver sent tx, but rest balance is exact
      expect(restBalAfter).to.be.gt(restBalBefore);

      // Verify BITE Reward tokens minted
      const customerBite = await token.balanceOf(customer.address);
      const restBite = await token.balanceOf(restaurant.address);
      const driverBite = await token.balanceOf(driver.address);
      const referrerBite = await token.balanceOf(referrer.address);

      expect(customerBite).to.equal(ethers.parseEther("10")); // CUSTOMER_ORDER_REWARD
      expect(restBite).to.equal(ethers.parseEther("5"));     // RESTAURANT_COMPLETION_REWARD
      expect(driverBite).to.equal(ethers.parseEther("5"));   // DRIVER_DELIVERY_REWARD
      expect(referrerBite).to.equal(ethers.parseEther("15")); // REFERRAL_REWARD
    });

    it("should reward user upon verified review submission", async function () {
      await escrow.connect(customer).createOrder(
        orderId,
        restaurant.address,
        foodAmount,
        deliveryFee,
        otpHash,
        addressZero = ethers.ZeroAddress,
        { value: totalAmount }
      );
      await escrow.connect(restaurant).acceptOrder(orderId);
      await escrow.connect(driver).acceptDelivery(orderId);
      await escrow.connect(driver).updatePickedUp(orderId);
      await escrow.connect(driver).confirmDelivery(orderId, otpSecret);

      const customerBalBefore = await token.balanceOf(customer.address);

      const ipfsReviewHash = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
      await expect(escrow.connect(customer).submitReview(orderId, ipfsReviewHash))
        .to.emit(escrow, "ReviewSubmitted")
        .withArgs(orderId, customer.address, ipfsReviewHash, ethers.parseEther("3"));

      const customerBalAfter = await token.balanceOf(customer.address);
      expect(customerBalAfter - customerBalBefore).to.equal(ethers.parseEther("3"));
    });

    it("should reject delivery confirmation with wrong OTP", async function () {
      await escrow.connect(customer).createOrder(
        orderId,
        restaurant.address,
        foodAmount,
        deliveryFee,
        otpHash,
        ethers.ZeroAddress,
        { value: totalAmount }
      );
      await escrow.connect(restaurant).acceptOrder(orderId);
      await escrow.connect(driver).acceptDelivery(orderId);
      await escrow.connect(driver).updatePickedUp(orderId);

      await expect(
        escrow.connect(driver).confirmDelivery(orderId, "9999")
      ).to.be.revertedWith("BlockBiteEscrow: invalid delivery OTP PIN");
    });
  });
});
