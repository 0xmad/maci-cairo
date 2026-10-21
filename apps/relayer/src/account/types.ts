/** A `sign_up` call paid by the Relayer account. */
export interface PaidCall {
  contractAddress: string;
  entrypoint: "sign_up";
  calldata: string[];
}

export interface ChainEvent {
  fromAddress: string;
  keys: string[];
  data: string[];
}

/** Included `sign_up`: the Relayer account is the sender and the fee payer. */
export interface PaidInvocation {
  transactionHash: string;
  sender: string;
  feeAmount: string;
  paymasterData: string[];
  events: ChainEvent[];
  revertReason?: string;
}

/** Starknet account that calls `sign_up` and pays the fee. */
export interface RelayerAccount {
  address: string;
  invokeAndPay: (call: PaidCall) => Promise<PaidInvocation>;
}
