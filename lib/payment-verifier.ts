import { WALLET_ADDRESSES } from './payment'

type VerifyResult = { ok: boolean; amount?: number; error?: string }

async function verifyTrc20(txHash: string, expectedAddress: string, expectedAmount: number): Promise<VerifyResult> {
  try {
    const r = await fetch(`https://apilist.tronscanapi.com/api/transaction-info?hash=${txHash}`, {
      headers: { 'TRON-PRO-API-KEY': '' },
    })
    const data = await r.json()
    if (!data.confirmed) return { ok: false, error: 'Transaction not confirmed' }
    const ti = data.tokenTransferInfo
    if (!ti) return { ok: false, error: 'No token transfer info' }
    if (ti.tokenInfo?.tokenAbbr !== 'USDT') return { ok: false, error: 'Not USDT' }
    if (ti.to_address?.toLowerCase() !== expectedAddress.toLowerCase()) return { ok: false, error: 'Wrong recipient address' }
    const amount = Number(ti.amount_str) / 1e6
    if (amount < expectedAmount * 0.99) return { ok: false, error: `Amount too low: ${amount}` }
    return { ok: true, amount }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'TRC20 verify failed' }
  }
}

async function verifyEvm(txHash: string, expectedAddress: string, expectedAmount: number, network: 'eth' | 'bsc'): Promise<VerifyResult> {
  try {
    const baseUrl = network === 'eth' ? 'https://api.etherscan.io/api' : 'https://api.bscscan.com/api'
    const apiKey = network === 'eth' ? (process.env.ETHERSCAN_API_KEY || '') : (process.env.BSCSCAN_API_KEY || '')
    const usdtContract = network === 'eth'
      ? '0xdAC17F958D2ee523a2206206994597C13D831ec7'
      : '0x55d398326f99059fF775485246999027B3197955'

    const url = `${baseUrl}?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${apiKey}`
    const r = await fetch(url)
    const data = await r.json()
    const receipt = data.result
    if (!receipt) return { ok: false, error: 'Transaction not found' }
    if (receipt.status !== '0x1') return { ok: false, error: 'Transaction failed' }

    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    const logs = (receipt.logs || []) as Array<{ address: string; topics: string[]; data: string }>
    const transferLog = logs.find(log =>
      log.address.toLowerCase() === usdtContract.toLowerCase() &&
      log.topics[0] === transferTopic &&
      log.topics[2] &&
      ('0x' + log.topics[2].slice(26)).toLowerCase() === expectedAddress.toLowerCase()
    )
    if (!transferLog) return { ok: false, error: 'No matching USDT transfer to address' }

    const decimals = network === 'eth' ? 6 : 18
    const amount = parseInt(transferLog.data, 16) / Math.pow(10, decimals)
    if (amount < expectedAmount * 0.99) return { ok: false, error: `Amount too low: ${amount}` }
    return { ok: true, amount }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'EVM verify failed' }
  }
}

async function verifySol(txHash: string, expectedAddress: string, expectedAmount: number): Promise<VerifyResult> {
  try {
    const r = await fetch(`https://public-api.solscan.io/transaction/${txHash}`)
    const data = await r.json()
    const usdtMint = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

    const balances = data.tokenBalances as Array<{ account: string; token: { tokenAddress: string }; amount: { uiAmount: number } }> | undefined
    if (balances) {
      const match = balances.find(b =>
        b.account === expectedAddress &&
        b.token?.tokenAddress === usdtMint &&
        b.amount?.uiAmount >= expectedAmount * 0.99
      )
      if (match) return { ok: true, amount: match.amount.uiAmount }
    }

    const instructions = data.parsedInstruction as Array<{ type: string; params: Record<string, unknown> }> | undefined
    if (instructions) {
      const transfer = instructions.find(i =>
        (i.type === 'transfer' || i.type === 'transferChecked') &&
        i.params?.destination === expectedAddress
      )
      if (transfer) {
        const amt = Number(transfer.params?.tokenAmount ?? transfer.params?.amount ?? 0)
        if (amt >= expectedAmount * 0.99) return { ok: true, amount: amt }
      }
    }

    return { ok: false, error: 'No matching USDT transfer found' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'SOL verify failed' }
  }
}

async function verifyApt(txHash: string, expectedAddress: string, expectedAmount: number): Promise<VerifyResult> {
  try {
    const r = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${txHash}`)
    const data = await r.json()
    if (!data.success) return { ok: false, error: 'Transaction failed' }

    const events = data.events as Array<{ type: string; data: Record<string, unknown> }> | undefined
    if (!events) return { ok: false, error: 'No events' }

    const deposit = events.find(e =>
      (e.type.includes('DepositEvent') || e.type.includes('deposit')) &&
      (e.data?.account === expectedAddress || e.data?.to === expectedAddress)
    )
    if (!deposit) return { ok: false, error: 'No deposit event to address' }

    const rawAmount = Number(deposit.data?.amount ?? 0)
    const amount = rawAmount / 1e6
    if (amount < expectedAmount * 0.99) return { ok: false, error: `Amount too low: ${amount}` }
    return { ok: true, amount }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'APT verify failed' }
  }
}

async function verifyTon(txHash: string, expectedAddress: string, expectedAmount: number): Promise<VerifyResult> {
  try {
    const r = await fetch(`https://tonapi.io/v2/blockchain/transactions/${txHash}`)
    const data = await r.json()

    const outMsgs = data.out_msgs as Array<{ decoded_body?: { amount?: string; destination?: { address?: string } } }> | undefined
    if (outMsgs) {
      for (const msg of outMsgs) {
        const dest = msg.decoded_body?.destination?.address
        const rawAmt = Number(msg.decoded_body?.amount ?? 0)
        const amount = rawAmt / 1e6
        if (dest === expectedAddress && amount >= expectedAmount * 0.99) {
          return { ok: true, amount }
        }
      }
    }

    const inMsg = data.in_msg as { decoded_body?: { amount?: string; destination?: { address?: string } } } | undefined
    if (inMsg) {
      const dest = inMsg.decoded_body?.destination?.address
      const rawAmt = Number(inMsg.decoded_body?.amount ?? 0)
      const amount = rawAmt / 1e6
      if (dest === expectedAddress && amount >= expectedAmount * 0.99) {
        return { ok: true, amount }
      }
    }

    return { ok: false, error: 'No matching USDT transfer found' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'TON verify failed' }
  }
}

export async function verifyPayment(
  network: string,
  txHash: string,
  expectedAmountUsd: number
): Promise<{ ok: boolean; error?: string }> {
  const address = WALLET_ADDRESSES[network]
  if (!address) return { ok: false, error: 'Unknown network' }

  switch (network) {
    case 'trc20': return verifyTrc20(txHash, address, expectedAmountUsd)
    case 'eth':   return verifyEvm(txHash, address, expectedAmountUsd, 'eth')
    case 'bsc':   return verifyEvm(txHash, address, expectedAmountUsd, 'bsc')
    case 'sol':   return verifySol(txHash, address, expectedAmountUsd)
    case 'apt':   return verifyApt(txHash, address, expectedAmountUsd)
    case 'ton':   return verifyTon(txHash, address, expectedAmountUsd)
    default:      return { ok: false, error: 'Unsupported network' }
  }
}
