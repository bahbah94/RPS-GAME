# 🎮 Decentralized Rock Paper Scissors Lizard Spock

A blockchain-based implementation of the classic Rock Paper Scissors Lizard Spock game deployed on Ethereum Sepolia testnet. Two players compete in a commit-reveal scheme with on-chain winner determination and automated timeout mechanisms.

**Play the game:** https://rps-game-six-rho.vercel.app/
**Link to Demo** : https://youtu.be/lGg_s-WCDP0


---

## ⚠️ Important Setup Instructions

### Browser & Environment Requirements
- **Browser:** Chrome (Version 142.0.7444.60 or similar)
- **Network:** Ethereum Sepolia Testnet
- **Setup:** Use **2 separate tab sessions on Chrome** for smooth gameplay (one for Player 1, one for Player 2)

### Pre-Game Checklist
Before connecting or starting a game:
1. Ensure you have appropriate wallet accounts selected for both Player 1 and Player 2
2. Both accounts should be funded with Sepolia ETH (available from faucets)
3. Open the game in two Chrome tabs or windows
4. Each player should connect their respective wallet account

---

## 🎯 Game Overview

This is a decentralized implementation of Rock Paper Scissors Lizard Spock with the following flow:

1. **Player 1 (P1) Commits:** Hashes their move with a random salt and submits along with a stake
2. **Player 2 (P2) Plays:** Openly plays their move and matches P1's stake
3. **Player 1 Reveals:** Submits their original move and salt for verification
4. **Winner Determination:** Smart contract determines winner and distributes funds
5. **Timeout Protection:** If either player doesn't act within 5 minutes, the other can claim victory

---

## 🔧 Technical Architecture

### Solidity Contract Changes
The following modifications were made to the base contract:

- **Payable Addresses:** All addresses converted to `payable` type for fund transfers
- **Transfer Method:** Uses `.transfer()` instead of `.call()` for safer fund distribution
- **Solidity Version:** Updated to `^0.8.28`
- **Logic:** All game logic and core implementation completed from scratch

### Game Mechanics

**Move Validation:** The commit-reveal scheme prevents Player 1 from changing their move. The submitted hash is verified against the reveal parameters to ensure integrity.

**Winner Calculation:** Based on classic RPSLS rules:
- Rock crushes Scissors & Lizard
- Paper covers Rock & disproves Spock
- Scissors cuts Paper & decapitates Lizard
- Lizard eats Paper & poisons Spock
- Spock vaporizes Rock & smashes Scissors

**Fund Distribution:**
- Winner receives both player stakes (2x original stake)
- Loser loses their stake
- In timeout scenarios, the claiming player receives double stake

---

## 🔐 Security Considerations

### Contract Level

**Reentrancy Protection:** The contract uses `.transfer()` instead of `.call()` to limit gas forwarding, which prevents recursive calls and reentrancy attacks. Additionally, the stake is set to zero after transfers to block multiple withdrawal attempts.

**Zero Address Validation:** Currently, the contract does not validate that Player 2's address is non-null before fund assignment. This should be added in production to prevent accidental fund loss. Use only trusted addresses when initiating games.

**Access Control:** Timeout functions rely on game state rather than explicit `msg.sender` checks. Only Player 2 can trigger `j1Timeout()` because they're the only one who can set the game state variable `c2`. Similarly, `j2Timeout()` can only be triggered by Player 1 after verifying that P2 hasn't played (`c2 == Move.Null`).

**Move Integrity:** The commit-reveal scheme ensures Player 1 cannot change their move after commitment. Hash verification during reveal confirms the move matches the original commitment.

### Frontend Level

**Move & Salt Storage:** Player 1's move and salt are stored in browser localStorage for UX convenience. If localStorage is cleared or the browser is reset, the player cannot reveal their move and loses access to their stake. This is an acceptable trade-off for improved user experience.

**RPC Endpoint Exposure:** The Infura API key is visible in the frontend code. This uses the free tier with rate limits, which is acceptable for testing purposes. For production deployment, implement a backend proxy server to hide credentials.

**Input Validation:** Player addresses are validated using `ethers.isAddress()` before making contract calls, preventing submission of malformed addresses.

### Timeout Handling

**Non-Reveal Scenario:** If Player 1 fails to call `solve()` (reveal) within 5 minutes, Player 2 can claim `j1Timeout()` and receive double the original stake. The contract tracks this using `lastAction` timestamp as the source of truth, with frontend polling every 1 second.

**Non-Play Scenario:** If Player 2 never plays, Player 1 can claim `j2Timeout()` after 5 minutes and recover their original stake. This is protected by a game state check (`c2 == Move.Null`) ensuring only Player 1 can trigger this function.

**Cross-Tab Notifications:** When a timeout is claimed, both browser tabs are notified via BroadcastChannel so players know the game has ended.

### Salt Security

**Generation:** Random 256-bit salt generated client-side using `crypto.getRandomValues()`, providing strong entropy for the commitment hash.

**Storage:** Salt is stored in browser localStorage alongside the move. Even if the browser is compromised, an attacker cannot exploit the salt without Player 1's private key to sign the reveal transaction.

**Recovery:** Players should manually back up their salt if permanent access is needed. If salt is lost and the move cannot be revealed, game funds remain locked in the contract.

**Uniqueness:** Each game session generates a unique salt. Even if two games use the same move, different salts produce different commitment hashes, preventing collision attacks.

**Hash Commitment:** Salt and move are combined via `keccak256(abi.encode(move, salt))` before submission to the blockchain. Even if an opponent somehow discovers the salt during gameplay, they cannot verify it matches Player 1's actual move until reveal occurs, as the commitment is already locked on-chain.

---

## 🚀 How to Play

### Starting a Game

1. **Connect Wallet:** Both players connect their Sepolia-funded wallet accounts
2. **Player 1 Initiates:** P1 selects a move (Rock, Paper, Scissors, Lizard, or Spock), generates a random salt, and submits the commitment with a stake amount
3. **Transaction Confirmation:** Wait for the commit transaction to be confirmed on-chain
4. **Share Contract Address:** The game contract address is auto-filled in the URL for easy sharing

### Playing a Move

1. **Player 2 Plays:** P2 selects their move and matches P1's stake amount
2. **Transaction Confirmation:** Wait for confirmation

### Revealing & Resolving

1. **Player 1 Reveals:** P1 enters their original move and salt to reveal their commitment
2. **Outcome:** The contract determines the winner and automatically distributes funds
3. **View Results:** Check your wallet balance to confirm the outcome

### Timeout Claims

**If Player 1 Doesn't Reveal (5 minutes):**
- Player 2 can call `j1Timeout()` to claim Player 1's timeout
- Player 2 receives both stakes

**If Player 2 Doesn't Play (5 minutes):**
- Player 1 can call `j2Timeout()` to claim Player 2's timeout
- Player 1 recovers their original stake

⚠️ **Important:** Please be wary to click the appropriate timeout options when the timeout period is finished. Be patient when waiting for moves, as the implementation uses signers rather than providers for ease of use, which may result in slightly slower response times.

---

## 🛠️ Technical Stack

**Smart Contract:**
- Solidity ^0.8.28
- Ethereum Sepolia Testnet
- Commit-Reveal Pattern

**Frontend:**
- ethers.js for wallet integration and contract interaction
- BroadcastChannel API for cross-tab synchronization
- localStorage for client-side state management
- React/Vue (or similar) for UI rendering

**Deployment:**
- Vercel (frontend hosting)
- Ethereum Sepolia (contract deployment)

---

## 📦 Installation & Setup

### Prerequisites
Ensure you have the following installed on your system:
- **Node.js** (v16 or higher) - Download from https://nodejs.org/
- **npm** (comes with Node.js)
- **Git** (for version control)

### Global Dependencies
Install the required global packages:

```bash
npm install -g npx
npm install -g serve
```

### Project Setup

#### 1. Clone or Download the Project
```bash
git clone <your-repo-url>
cd <project-directory>
```

#### 2. Install Project Dependencies
```bash
npm install
```

This will install all dependencies listed in `package.json`, including:
- ethers.js (Web3 integration)
- Any build tools or frameworks used in the project

### 🔨 Compiling Smart Contract ABI

To compile the Solidity contract and generate the ABI (Application Binary Interface):

```bash
npx compile
```

**What this does:**
- Compiles the Solidity contract (^0.8.28)
- Generates the ABI JSON file needed for frontend interaction
- Creates output files in the `artifacts/` or `build/` directory (depending on your setup)

**After compilation:**
- Copy the generated ABI file to your frontend directory
- Update the contract address and ABI in your frontend configuration

### 🚀 Running the Frontend

Navigate to the frontend directory and start the development server:

```bash
cd frontend
npx serve
```

**What this does:**
- Starts a local development server (typically on http://localhost:3000 or http://localhost:5000)
- Serves your frontend files with hot-reloading capabilities
- Allows you to test the game locally before deploying to Vercel

**Alternative - Using npm start (if configured):**
```bash
npm start
```

### 📋 Complete Setup Workflow

Follow these steps in order for a fresh setup:

```bash
# 1. Navigate to project directory
cd your-project-directory

# 2. Install all dependencies
npm install

# 3. Compile the smart contract ABI
npx compile

# 4. Navigate to frontend folder
cd frontend

# 5. Install frontend dependencies (if separate package.json)
npm install

# 6. Start the development server
npx serve
```

Your game should now be running locally! Open your browser to the URL shown in the terminal (usually http://localhost:3000 or http://localhost:5000).

### 🌐 Environment Variables

Before running the frontend, ensure you have the following configured:

Create a `.env` or `.env.local` file in your frontend directory:

```
REACT_APP_INFURA_KEY=your_infura_key_here
REACT_APP_CONTRACT_ADDRESS=your_sepolia_contract_address_here
REACT_APP_NETWORK_ID=11155111
```

**Important:**
- `REACT_APP_INFURA_KEY`: Your Infura API key (for RPC endpoints)
- `REACT_APP_CONTRACT_ADDRESS`: The deployed contract address on Sepolia
- `REACT_APP_NETWORK_ID`: 11155111 is the Sepolia testnet chain ID

### ✅ Verification Checklist

After setup, verify everything is working:

- [ ] All npm packages installed successfully
- [ ] Contract compiled without errors (`npx compile` completes)
- [ ] ABI file generated in the expected directory
- [ ] Frontend server starts with `npx serve`
- [ ] Browser opens to localhost without errors
- [ ] MetaMask or wallet extension connects successfully
- [ ] Sepolia testnet is selected in wallet
- [ ] Both player accounts have Sepolia ETH

### 🐛 Troubleshooting

**"npx compile not found"**
- Ensure your project has a compile script in `package.json` under the "scripts" section
- Check the script name matches your build tool (Hardhat, Truffle, etc.)

**"npx serve not found"**
- Install globally: `npm install -g serve`
- Or run: `npx serve` directly (npx will download it if needed)

**Port already in use**
- If port 3000 or 5000 is busy, specify a different port:
  ```bash
  npx serve --listen 8080
  ```

**Contract compilation errors**
- Verify Solidity version matches (^0.8.28)
- Check for syntax errors in `.sol` files
- Ensure all imports are available

**Frontend won't connect to contract**
- Verify contract address in environment variables
- Ensure ABI file is in the correct location
- Check that you're on Sepolia testnet
- Verify Infura key has appropriate permissions

---

## 📋 Gameplay Flow Diagram

```
Player 1                          Smart Contract                    Player 2
   |                                    |                               |
   |--- Commit (hash, salt, stake) ---->|                               |
   |                                    |                               |
   |                                    |<---- Play (move, stake) ------|
   |                                    |                               |
   |--- Reveal (move, salt) ----------->|                               |
   |                                    |--- Determine Winner --------->|
   |<-- Receive Winnings/Loss ---------|                               |
   |                                    |<-- Receive Winnings/Loss -----|
```

---

## ⏱️ Game Timeouts

Both players have strict 5-minute windows for action:

| Action | Player | Timeout | Consequence |
|--------|--------|---------|-------------|
| Reveal Move | P1 | 5 min | P2 claims victory + double stake |
| Play Move | P2 | 5 min | P1 claims victory + recovers stake |

The contract uses `lastAction` timestamp as the source of truth, with frontend polling every 1 second for real-time updates.

---

## 🎓 Educational Disclosure

This project was created as an educational blockchain application combining smart contracts with frontend web3 integration. The following tools were used:

- **AI Tool (Claude.ai):** Used for beautification and formatting of documentation and UI
- **Core Logic & Implementation:** Completed entirely from scratch by the developer

---

## 🌐 Network Details

- **Network:** Ethereum Sepolia Testnet
- **Testnet Faucet:** Available at https://sepoliafaucet.com
- **Recommended Wallet:** MetaMask with Sepolia configured

---

## 💡 Tips for Smooth Gameplay

1. **Use Two Separate Tabs:** Open the game in two Chrome tabs for optimal experience
2. **Separate Accounts:** Use different wallet accounts for P1 and P2
3. **Sufficient Balance:** Ensure both accounts have enough Sepolia ETH for gas fees and stakes
4. **Patient Interaction:** Allow extra time for transactions to confirm, especially during network congestion
5. **Backup Salt:** Consider manually backing up your salt if you need persistent access to the game state
6. **Monitor Timeouts:** Be aware of the 5-minute timeout windows and take action accordingly

---

## 🔗 Links

- **Live Game:** https://rps-game-six-rho.vercel.app/
- **Network:** Ethereum Sepolia Testnet

---

## 📝 License

This project is provided as-is for educational purposes. Use at your own risk on testnet environments.

---

## ✅ Browser Compatibility

- **Tested on:** Chrome Version 142.0.7444.60 (Official Build) (arm64)
- **Required:** Chrome with Web3 wallet extension (MetaMask recommended)
- **Note:** Other browsers may work but are not officially tested

---

**Enjoy the game and may the best move win! 🎲**