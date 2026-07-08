import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

function isAuthorized(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_PANEL_SECRET;
}

const TRAITSHOP_ABI = parseAbi([
  "function withdraw(address to) external",
  "function owner() external view returns (address)",
]);

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { toAddress } = await req.json();
  if (!toAddress) return NextResponse.json({ error: "Missing toAddress" }, { status: 400 });

  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  const contractAddress = process.env.NEXT_PUBLIC_TRAITSHOP_CONTRACT as `0x${string}`;
  const rpcUrl = process.env.MAINNET_RPC_URL;

  if (!privateKey || !rpcUrl) {
    return NextResponse.json({ error: "Missing PRIVATE_KEY or MAINNET_RPC_URL" }, { status: 500 });
  }

  try {
    const account = privateKeyToAccount(privateKey);
    const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) });
    const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });

    // Check contract balance first
    const balance = await publicClient.getBalance({ address: contractAddress });

    if (balance === 0n) {
      return NextResponse.json({ error: "Contract balance is 0 — nothing to withdraw" }, { status: 400 });
    }

    const hash = await walletClient.writeContract({
      address: contractAddress,
      abi: TRAITSHOP_ABI,
      functionName: "withdraw",
      args: [toAddress as `0x${string}`],
      chain: mainnet,
      account,
    } as any);

    await publicClient.waitForTransactionReceipt({ hash });

    return NextResponse.json({
      success: true,
      hash,
      etherscan: `https://etherscan.io/tx/${hash}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contractAddress = process.env.NEXT_PUBLIC_TRAITSHOP_CONTRACT as `0x${string}`;
  const rpcUrl = process.env.MAINNET_RPC_URL;

  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl!) });
  const balance = await publicClient.getBalance({ address: contractAddress });
  const ethBalance = Number(balance) / 1e18;

  return NextResponse.json({ balance: ethBalance.toFixed(6), wei: balance.toString() });
}
