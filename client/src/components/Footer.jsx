import React from "react";
import { ShieldCheck, Cpu, Database, ExternalLink } from "lucide-react";
import contractsConfig from "../contracts/contracts.json";

export const Footer = () => {
  return (
    <footer className="mt-auto border-t border-gray-800 bg-[#060911] text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-white">
              BLOCK<span className="text-brand-500">BITE</span>
            </span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            The next-generation decentralized food delivery network. Powered by Ethereum Smart Contracts, automated escrow, and ERC20 token rewards.
          </p>
          <div className="flex items-center gap-2 text-xs text-brand-neon">
            <ShieldCheck className="w-4 h-4" /> Hardhat & Sepolia Secured Escrow
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Protocol Features</h4>
          <ul className="space-y-2 text-xs">
            <li>• Zero-Fee Escrow Lockup</li>
            <li>• ERC-20 $BITE Token Cashback</li>
            <li>• IPFS Pinata Review Hash Storage</li>
            <li>• Multi-Party Cryptographic OTP Release</li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Smart Contracts</h4>
          <div className="space-y-2 text-xs font-mono">
            <div>
              <span className="text-gray-500 block">Token Contract:</span>
              <span className="text-brand-400 truncate block">
                {contractsConfig.token?.address || "0x..."}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Escrow Contract:</span>
              <span className="text-brand-400 truncate block">
                {contractsConfig.escrow?.address || "0x..."}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Network Status</h4>
          <div className="p-3 glass-panel rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between text-gray-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span> Network:
              </span>
              <span className="font-bold text-white">Sepolia / Localhost</span>
            </div>
            <div className="flex items-center justify-between text-gray-300">
              <span>Gas Price:</span>
              <span className="font-mono text-brand-gold">~12 Gwei</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8 pt-6 border-t border-gray-800/60 text-center text-xs text-gray-500">
        © 2026 BLOCKBITE Protocol. Built with Solidity, React, Node.js, Express & MongoDB.
      </div>
    </footer>
  );
};
