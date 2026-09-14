export function networkLabel(network: "starknet_local" | "sepolia"): string {
  return network === "sepolia" ? "Sepolia" : "Starknet Local";
}
