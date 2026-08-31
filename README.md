# BLOCKBITE 🍕 | Decentralized Food Delivery Protocol

BLOCKBITE is a full-stack, production-ready Web3 food delivery platform powered by Ethereum smart contracts, Node.js REST API, MongoDB storage, and a React + Vite frontend. It features an **ERC-20 Reward Token ($BITE)**, a **Decentralized Escrow Contract** that locks payment until physical delivery is confirmed via a secret OTP PIN, **Role-Based Portals** (Customer, Restaurant, Delivery Partner, Admin), **MetaMask integration**, and **Pinata IPFS** for review hash storage.

---

## 🏗️ Project Architecture

```
block_chain/
├── contracts/                  # Solidity Smart Contracts
│   ├── BlockBiteToken.sol      # ERC-20 Reward Token ($BITE)
│   └── BlockBiteEscrow.sol     # Multi-Party Order Escrow & Reward Distribution
├── scripts/
│   └── deploy.js               # Hardhat Deployment & Contract JSON exporter
├── test/
│   └── BlockBite.test.js       # Automated Smart Contract Test Suite
├── server/                     # Node.js + Express REST API
│   ├── config/                 # DB & Contract Config
│   ├── middleware/             # JWT & Role Authentication
│   ├── models/                 # Mongoose Schemas (User, Restaurant, MenuItem, Order, Review)
│   ├── routes/                 # Express API Endpoints
│   ├── utils/                  # IPFS Pinata Service & Helpers
│   └── index.js                # Server entry point & Demo Data Seeder
├── client/                     # Vite + React Frontend
│   ├── src/
│   │   ├── components/         # Navbar, Footer, CartDrawer, Modals
│   │   ├── context/            # AuthContext & Web3Context (Ethers.js v6)
│   │   ├── pages/              # Customer, Restaurant, Delivery, Admin Views
│   │   └── contracts/          # Deployed Contract ABIs & Addresses
│   └── tailwind.config.js       # Dark Mode Glassmorphism Theme System
├── hardhat.config.js           # Hardhat Configuration (Localhost & Sepolia)
└── package.json                # Root Dependencies & Scripts
```

---

## ⚡ Quick Start & Installation Guide

### Prerequisites
- **Node.js**: v18.0 or higher
- **npm**: v9.0 or higher
- **MetaMask Wallet Extension** installed in browser

### 1. Install Dependencies

In the root directory:
```bash
npm install
```

In the server directory:
```bash
cd server
npm install
```

In the client directory:
```bash
cd client
npm install
```

---

## ⚙️ Environment Variables Setup

Create a `.env` file in the `server` directory:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/blockbite
JWT_SECRET=blockbite_super_secret_jwt_key_2026
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_API_KEY=your_pinata_secret
SEPOLIA_RPC_URL=https://rpc.sepolia.org
SEPOLIA_PRIVATE_KEY=your_wallet_private_key
```

---

## 🛠️ Hardhat Commands & Smart Contract Deployment

### Compile Contracts
```bash
npm run compile
```

### Run Smart Contract Unit Tests
```bash
npm run test
```

### Deploy to Local Hardhat Node
1. Start local Hardhat node in terminal 1:
```bash
npm run node
```

2. Deploy contracts in terminal 2:
```bash
npm run deploy:local
```

---

## 🚀 Multi-Instance Local Development (Simulate all 3 roles side-by-side)

Run in PowerShell:
```powershell
npm run start:multi
```
This automatically launches:
- Hardhat node on port `8545`
- Express API server on port `5000`
- Customer portal on [`http://localhost:3001`](http://localhost:3001)
- Restaurant portal on [`http://localhost:3002`](http://localhost:3002)
- Delivery Rider portal on [`http://localhost:3003`](http://localhost:3003)

---

## 🔑 Pre-seeded Demo Accounts

| Role | Email | Password | Features |
| :--- | :--- | :--- | :--- |
| **Customer** | `customer@blockbite.com` | `password123` | Order food, track escrow, earn $BITE tokens, write IPFS reviews |
| **Restaurant** | `mario@pizzabite.eth` | `password123` | Accept/reject orders, add/edit menu items, view revenue |
| **Delivery Partner** | `driver@blockbite.com` | `password123` | Accept delivery runs, verify customer OTP PIN, trigger ETH release |
| **Admin** | `admin@blockbite.com` | `password123` | View protocol GMV analytics, verify restaurants, audit escrows |

---

## 🛡️ Security Audit Highlights
- **Reentrancy Guard**: Non-reentrant modifiers protect Escrow ETH payouts.
- **Role-Based Access Control**: Strict access modifiers on contract functions and JWT route guards on API endpoints.
- **Cryptographic OTP Verification**: Secret OTP PIN hash matching protects buyer funds until physical handoff.
- **IPFS Immutability**: Review metadata pinned to Pinata IPFS.
