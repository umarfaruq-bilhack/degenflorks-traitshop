import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Degen Florks Trait Shop",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [mainnet],
  ssr: true,
});

export const DEGENFLORKS_CONTRACT = process.env.NEXT_PUBLIC_DEGENFLORKS_CONTRACT as `0x${string}`;
export const TRAITSHOP_CONTRACT = process.env.NEXT_PUBLIC_TRAITSHOP_CONTRACT as `0x${string}`;

export const DEGENFLORKS_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const TRAITSHOP_ABI = [
  {
    name: "purchaseTrait",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "traitId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "traitPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "traitId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
