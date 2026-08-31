// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BlockBiteToken.sol";

/**
 * @title BlockBiteEscrow
 * @notice Decentralized Escrow and Order Management Contract for BLOCKBITE.
 * @dev Locks order payment (ETH) until delivery is confirmed by customer/driver via secret verification PIN/OTP.
 *      Triggers multi-party $BITE token rewards upon successful delivery and review submission.
 */

contract BlockBiteEscrow {
    // Reentrancy Guard
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    // Ownership & Pausable
    address public owner;
    bool public paused;

    // BITE Token Contract Reference
    BlockBiteToken public rewardToken;

    // Reward Constants (in 18 decimals)
    uint256 public constant CUSTOMER_ORDER_REWARD = 10 * 10**18;
    uint256 public constant DRIVER_DELIVERY_REWARD = 5 * 10**18;
    uint256 public constant RESTAURANT_COMPLETION_REWARD = 5 * 10**18;
    uint256 public constant REVIEW_REWARD = 3 * 10**18;
    uint256 public constant REFERRAL_REWARD = 15 * 10**18;

    enum OrderStatus {
        Created,
        AcceptedByRestaurant,
        RejectedByRestaurant,
        DriverAssigned,
        PickedUp,
        Delivered,
        Cancelled,
        Disputed
    }

    struct Order {
        string orderId;
        address payable customer;
        address payable restaurant;
        address payable driver;
        uint256 foodAmount;
        uint256 deliveryFee;
        uint256 tipAmount;
        uint256 totalAmount;
        OrderStatus status;
        bytes32 otpHash; // keccak256 hash of secret OTP string
        uint256 createdAt;
        uint256 deliveredAt;
        string reviewHash; // IPFS CID of food review
        bool isReviewRewarded;
        address referrer;
    }

    // Mappings
    mapping(string => Order) public orders;
    mapping(address => string[]) private userOrderIds;
    mapping(address => string[]) private restaurantOrderIds;
    mapping(address => string[]) private driverOrderIds;
    mapping(address => bool) public verifiedRestaurants;
    mapping(address => bool) public verifiedDrivers;

    // Events
    event OrderCreated(
        string indexed orderId,
        address indexed customer,
        address indexed restaurant,
        uint256 foodAmount,
        uint256 deliveryFee,
        uint256 totalAmount
    );
    event OrderAccepted(string indexed orderId, address indexed restaurant);
    event OrderRejected(string indexed orderId, address indexed restaurant, string reason);
    event DriverAssigned(string indexed orderId, address indexed driver);
    event OrderPickedUp(string indexed orderId);
    event OrderDelivered(
        string indexed orderId,
        address indexed customer,
        address indexed driver,
        uint256 restaurantPayout,
        uint256 driverPayout
    );
    event OrderCancelled(string indexed orderId, address indexed refundRecipient, uint256 amount);
    event DisputeRaised(string indexed orderId, address indexed raisedBy, string reason);
    event DisputeResolved(string indexed orderId, bool refundedCustomer, uint256 refundAmount);
    event ReviewSubmitted(string indexed orderId, address indexed reviewer, string reviewHash, uint256 rewardTokens);
    event RestaurantStatusUpdated(address indexed restaurant, bool isVerified);
    event DriverStatusUpdated(address indexed driver, bool isVerified);
    event Paused(address account);
    event Unpaused(address account);

    modifier onlyOwner() {
        require(msg.sender == owner, "BlockBiteEscrow: caller is not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "BlockBiteEscrow: contract is paused");
        _;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "BlockBiteEscrow: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "BlockBiteEscrow: invalid token address");
        owner = msg.sender;
        rewardToken = BlockBiteToken(_tokenAddress);
        _status = _NOT_ENTERED;
    }

    function setTokenContract(address _tokenAddress) external onlyOwner {
        require(_tokenAddress != address(0), "BlockBiteEscrow: invalid token address");
        rewardToken = BlockBiteToken(_tokenAddress);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function setRestaurantVerification(address restaurant, bool isVerified) external onlyOwner {
        verifiedRestaurants[restaurant] = isVerified;
        emit RestaurantStatusUpdated(restaurant, isVerified);
    }

    function setDriverVerification(address driver, bool isVerified) external onlyOwner {
        verifiedDrivers[driver] = isVerified;
        emit DriverStatusUpdated(driver, isVerified);
    }

    /**
     * @notice Creates an order and locks total ETH payment in escrow.
     * @param orderId Unique alphanumeric ID generated by backend.
     * @param restaurant Wallet address of restaurant.
     * @param foodAmount Food total in wei.
     * @param deliveryFee Delivery fee in wei.
     * @param otpSecret Verification secret string (e.g. "4821") passed as keccak256 hash.
     * @param referrer Address of customer who referred this user (optional, address(0) if none).
     */
    function createOrder(
        string calldata orderId,
        address payable restaurant,
        uint256 foodAmount,
        uint256 deliveryFee,
        bytes32 otpSecret,
        address referrer
    ) external payable whenNotPaused nonReentrant {
        require(bytes(orderId).length > 0, "BlockBiteEscrow: empty order ID");
        require(restaurant != address(0), "BlockBiteEscrow: invalid restaurant address");
        require(restaurant != msg.sender, "BlockBiteEscrow: customer cannot be restaurant");
        require(orders[orderId].customer == address(0), "BlockBiteEscrow: order ID already exists");
        require(msg.value == foodAmount + deliveryFee, "BlockBiteEscrow: payment does not match total amount");

        orders[orderId] = Order({
            orderId: orderId,
            customer: payable(msg.sender),
            restaurant: restaurant,
            driver: payable(address(0)),
            foodAmount: foodAmount,
            deliveryFee: deliveryFee,
            tipAmount: 0,
            totalAmount: msg.value,
            status: OrderStatus.Created,
            otpHash: otpSecret,
            createdAt: block.timestamp,
            deliveredAt: 0,
            reviewHash: "",
            isReviewRewarded: false,
            referrer: referrer
        });

        userOrderIds[msg.sender].push(orderId);
        restaurantOrderIds[restaurant].push(orderId);

        emit OrderCreated(orderId, msg.sender, restaurant, foodAmount, deliveryFee, msg.value);
    }

    /**
     * @notice Restaurant accepts order.
     */
    function acceptOrder(string calldata orderId) external whenNotPaused {
        Order storage order = orders[orderId];
        require(order.customer != address(0), "BlockBiteEscrow: order not found");
        require(msg.sender == order.restaurant, "BlockBiteEscrow: caller is not restaurant owner");
        require(verifiedRestaurants[msg.sender], "BlockBiteEscrow: restaurant is not verified");
        require(order.status == OrderStatus.Created, "BlockBiteEscrow: order cannot be accepted at this state");

        order.status = OrderStatus.AcceptedByRestaurant;
        emit OrderAccepted(orderId, msg.sender);
    }

    /**
     * @notice Restaurant rejects order and refunds customer immediately.
     */
    function rejectOrder(string calldata orderId, string calldata reason) external whenNotPaused nonReentrant {
        Order storage order = orders[orderId];
        require(order.customer != address(0), "BlockBiteEscrow: order not found");
        require(msg.sender == order.restaurant || msg.sender == owner, "BlockBiteEscrow: unauthorized");
        require(
            order.status == OrderStatus.Created || order.status == OrderStatus.AcceptedByRestaurant,
            "BlockBiteEscrow: order cannot be rejected at this state"
        );

        order.status = OrderStatus.RejectedByRestaurant;
        uint256 refundAmount = order.totalAmount;

        (bool success, ) = order.customer.call{value: refundAmount}("");
        require(success, "BlockBiteEscrow: refund transfer failed");

        emit OrderRejected(orderId, msg.sender, reason);
        emit OrderCancelled(orderId, order.customer, refundAmount);
    }

    /**
     * @notice Delivery Partner claims order.
     */
    function acceptDelivery(string calldata orderId) external whenNotPaused {
        Order storage order = orders[orderId];
        require(order.customer != address(0), "BlockBiteEscrow: order not found");
        require(order.driver == address(0), "BlockBiteEscrow: driver already assigned");
        require(
            order.status == OrderStatus.AcceptedByRestaurant,
            "BlockBiteEscrow: order not ready for pickup"
        );
        require(msg.sender != order.customer && msg.sender != order.restaurant, "BlockBiteEscrow: invalid driver role");
        require(verifiedDrivers[msg.sender], "BlockBiteEscrow: driver is not verified");
        order.driver = payable(msg.sender);
        order.status = OrderStatus.DriverAssigned;
        driverOrderIds[msg.sender].push(orderId);

        emit DriverAssigned(orderId, msg.sender);
    }

    /**
     * @notice Delivery Partner marks order as picked up.
     */
    function updatePickedUp(string calldata orderId) external whenNotPaused {
        Order storage order = orders[orderId];
        require(msg.sender == order.driver, "BlockBiteEscrow: caller is not assigned driver");
        require(order.status == OrderStatus.DriverAssigned, "BlockBiteEscrow: order status invalid");

        order.status = OrderStatus.PickedUp;
        emit OrderPickedUp(orderId);
    }

    /**
     * @notice Delivery Partner or Customer adds optional ETH tip for driver.
     */
    function addTip(string calldata orderId) external payable whenNotPaused {
        Order storage order = orders[orderId];
        require(order.customer != address(0), "BlockBiteEscrow: order not found");
        require(msg.sender == order.customer, "BlockBiteEscrow: only customer can tip");
        require(
            order.status == OrderStatus.DriverAssigned ||
            order.status == OrderStatus.PickedUp,
            "BlockBiteEscrow: tipping not allowed at this state"
        );
        require(msg.value > 0, "BlockBiteEscrow: tip must be > 0");

        order.tipAmount += msg.value;
        order.totalAmount += msg.value;
    }

    /**
     * @notice Verifies OTP PIN, releases ETH payment from escrow to restaurant and driver, and mints $BITE reward tokens.
     * @param orderId Unique ID.
     * @param rawOtp Raw secret OTP string provided by customer (e.g. "4821").
     */
    function confirmDelivery(string calldata orderId, string calldata rawOtp) external whenNotPaused nonReentrant {
        Order storage order = orders[orderId];
        require(order.customer != address(0), "BlockBiteEscrow: order not found");
        require(
            msg.sender == order.driver || msg.sender == order.customer || msg.sender == owner,
            "BlockBiteEscrow: unauthorized caller"
        );
        require(order.status == OrderStatus.PickedUp, "BlockBiteEscrow: order must be picked up before delivery");

        // Verify OTP secret hash match
        bytes32 providedHash = keccak256(abi.encodePacked(rawOtp));
        require(providedHash == order.otpHash, "BlockBiteEscrow: invalid delivery OTP PIN");

        order.status = OrderStatus.Delivered;
        order.deliveredAt = block.timestamp;

        // Calculate ETH payouts
        uint256 restaurantPayout = order.foodAmount;
        uint256 driverPayout = order.deliveryFee + order.tipAmount;

        // Payout to Restaurant
        (bool restSuccess, ) = order.restaurant.call{value: restaurantPayout}("");
        require(restSuccess, "BlockBiteEscrow: ETH transfer to restaurant failed");

        // Payout to Driver
        if (order.driver != address(0) && driverPayout > 0) {
            (bool driverSuccess, ) = order.driver.call{value: driverPayout}("");
            require(driverSuccess, "BlockBiteEscrow: ETH transfer to driver failed");
        }

        emit OrderDelivered(orderId, order.customer, order.driver, restaurantPayout, driverPayout);

        // Distribute ERC20 Reward Tokens ($BITE)
        if (address(rewardToken) != address(0)) {
            // Customer reward
            rewardToken.mintReward(order.customer, CUSTOMER_ORDER_REWARD);

            // Restaurant reward
            rewardToken.mintReward(order.restaurant, RESTAURANT_COMPLETION_REWARD);

            // Driver reward
            if (order.driver != address(0)) {
                rewardToken.mintReward(order.driver, DRIVER_DELIVERY_REWARD);
            }

            // Referrer bonus reward if applicable
            if (order.referrer != address(0) && order.referrer != order.customer) {
                rewardToken.mintReward(order.referrer, REFERRAL_REWARD);
            }
        }
    }

    /**
     * @notice Submits IPFS Hash of review and claims review reward tokens.
     */
    function submitReview(string calldata orderId, string calldata reviewIpfsHash) external whenNotPaused nonReentrant {
        Order storage order = orders[orderId];
        require(order.customer != address(0), "BlockBiteEscrow: order not found");
        require(msg.sender == order.customer, "BlockBiteEscrow: only order buyer can review");
        require(order.status == OrderStatus.Delivered, "BlockBiteEscrow: order not delivered yet");
        require(!order.isReviewRewarded, "BlockBiteEscrow: review reward already claimed for this order");
        require(bytes(reviewIpfsHash).length > 0, "BlockBiteEscrow: invalid review hash");

        order.reviewHash = reviewIpfsHash;
        order.isReviewRewarded = true;

        if (address(rewardToken) != address(0)) {
            rewardToken.mintReward(msg.sender, REVIEW_REWARD);
        }

        emit ReviewSubmitted(orderId, msg.sender, reviewIpfsHash, REVIEW_REWARD);
    }

    /**
     * @notice Allows customer to cancel order before restaurant accepts.
     */
    function cancelOrder(string calldata orderId) external whenNotPaused nonReentrant {
        Order storage order = orders[orderId];
        require(order.customer != address(0), "BlockBiteEscrow: order not found");
        require(msg.sender == order.customer, "BlockBiteEscrow: only customer can cancel");
        require(order.status == OrderStatus.Created, "BlockBiteEscrow: cannot cancel after restaurant response");

        order.status = OrderStatus.Cancelled;
        uint256 refundAmount = order.totalAmount;

        (bool success, ) = order.customer.call{value: refundAmount}("");
        require(success, "BlockBiteEscrow: refund failed");

        emit OrderCancelled(orderId, msg.sender, refundAmount);
    }

    /**
     * @notice Customer or Restaurant raises dispute.
     */
    function raiseDispute(string calldata orderId, string calldata reason) external whenNotPaused {
        Order storage order = orders[orderId];
        require(order.customer != address(0), "BlockBiteEscrow: order not found");
        require(
            msg.sender == order.customer || msg.sender == order.restaurant || msg.sender == order.driver,
            "BlockBiteEscrow: unauthorized caller"
        );
        require(
            order.status != OrderStatus.Delivered && order.status != OrderStatus.Cancelled,
            "BlockBiteEscrow: cannot dispute closed order"
        );

        order.status = OrderStatus.Disputed;
        emit DisputeRaised(orderId, msg.sender, reason);
    }

    /**
     * @notice Admin resolves escrow dispute.
     */
    function resolveDispute(string calldata orderId, bool refundCustomer) external onlyOwner nonReentrant {
        Order storage order = orders[orderId];
        require(order.customer != address(0), "BlockBiteEscrow: order not found");
        require(order.status == OrderStatus.Disputed, "BlockBiteEscrow: order is not disputed");

        uint256 amount = order.totalAmount;

        if (refundCustomer) {
            order.status = OrderStatus.Cancelled;
            (bool success, ) = order.customer.call{value: amount}("");
            require(success, "BlockBiteEscrow: refund transfer failed");
            emit DisputeResolved(orderId, true, amount);
        } else {
            order.status = OrderStatus.Delivered;
            order.deliveredAt = block.timestamp;
            (bool success, ) = order.restaurant.call{value: order.foodAmount}("");
            require(success, "BlockBiteEscrow: restaurant payment failed");

            if (order.driver != address(0) && order.deliveryFee > 0) {
                (bool driverSuccess, ) = order.driver.call{value: order.deliveryFee + order.tipAmount}("");
                require(driverSuccess, "BlockBiteEscrow: driver payment failed");
            }
            if (address(rewardToken) != address(0)) {
            rewardToken.mintReward(
            order.customer,
             CUSTOMER_ORDER_REWARD
    );

         rewardToken.mintReward(
        order.restaurant,
        RESTAURANT_COMPLETION_REWARD
    );

    if (order.driver != address(0)) {
        rewardToken.mintReward(
            order.driver,
            DRIVER_DELIVERY_REWARD
        );
    }

    if (
        order.referrer != address(0) &&
        order.referrer != order.customer
    ) {
        rewardToken.mintReward(
            order.referrer,
            REFERRAL_REWARD
        );
    }
}
            emit DisputeResolved(orderId, false, amount);
        }
    }

    // View Functions
    function getOrderDetails(string calldata orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getUserOrders(address user) external view returns (string[] memory) {
        return userOrderIds[user];
    }

    function getRestaurantOrders(address restaurant) external view returns (string[] memory) {
        return restaurantOrderIds[restaurant];
    }

    function getDriverOrders(address driver) external view returns (string[] memory) {
        return driverOrderIds[driver];
    }
}
