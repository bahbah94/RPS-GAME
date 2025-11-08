import { connectWallet, deployGame, generateSalt, createCommitment } from './web3-init.js';
import { playMove, revealMove, J1Timeout, J2Timeout, getGameState, win } from './game-logic.js';

let currentSalt;
let currentMove;
let currentGameAddress;
let timeoutInterval;
let currentGamePhase = null;

const TIMEOUT_DURATION = 5 * 60 * 1000; // Keep for reference, but timer uses contract's TIMEOUT
const channel = new BroadcastChannel("rps_game_channel");

// ======================
// INITIALIZATION
// ======================
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameAddress = urlParams.get('game');
    
    if (gameAddress) {
        currentGameAddress = gameAddress;
        document.getElementById('contract-address').value = gameAddress;
        showPlayer2Mode();
    } else {
        showPlayer1Mode();
    }
});

function showPlayer1Mode() {
    document.getElementById('mode-indicator').textContent = 'Player 1 Mode: Create Game';
}

function showPlayer2Mode() {
    document.getElementById('mode-indicator').textContent = 'Player 2 Mode: Join Game';
    document.getElementById('mode-indicator').style.color = '#4CAF50';
    document.getElementById('create-game-section').style.display = "none";
    document.getElementById('join-game-section').style.borderLeft = '4px solid #4CAF50';
}

// ======================
// WALLET CONNECTION
// ======================
document.getElementById('connect-btn').addEventListener('click', async () => {
    try {
        const {address, _} = await connectWallet();
        document.getElementById('wallet-address').textContent = `Connected: ${address}`;
        showSections();
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
    }
});

// ======================
// PLAYER 1: CREATE GAME
// ======================
document.getElementById('create-game-btn').addEventListener('click', async () => {
    try {
        const move = document.getElementById('p1-move').value;
        const j2Address = document.getElementById('p2-address').value;
        const stake = document.getElementById('stake-amount').value;

        if (!j2Address || j2Address.trim() === '') {
            showStatus('Error: Player 2 address is required', 'error');
            return;
        }

        if (!ethers.isAddress(j2Address)) {
            showStatus('Error: Invalid Player 2 address format', 'error');
            return;
        }

        if (!stake || parseFloat(stake) <= 0) {
            showStatus('Error: Stake must be greater than 0', 'error');
            return;
        }

        currentSalt = generateSalt();
        currentMove = move;
        const commitment = createCommitment(move, currentSalt);

        showStatus('Deploying game...', 'info');
        const gameAddress = await deployGame(commitment, j2Address, stake);
        currentGameAddress = gameAddress;

        // Save game data to localStorage
        localStorage.setItem(`game_${gameAddress}`, JSON.stringify({
            move,
            salt: currentSalt,
            j2Address,
            stake
        }));

        // Create shareable link
        const shareLink = `${window.location.origin}${window.location.pathname}?game=${gameAddress}`;
        
        document.getElementById('game-info').innerHTML = `
            <h3>✅ Game Created!</h3>
            <p><strong>Contract Address:</strong> ${gameAddress}</p>
            <p><strong>⚠️ SAVE THIS INFO:</strong></p>
            <p>Your Move: ${getMoveText(move)}</p>
            <p>Salt: ${currentSalt}</p>
            <hr style="margin: 10px 0;">
            <h4>📤 Share with Player 2:</h4>
            <input type="text" id="share-link-input" value="${shareLink}" readonly 
                   style="width: 100%; padding: 8px; margin: 5px 0; font-size: 12px; border: 1px solid #ddd; border-radius: 4px;">
            <button id="copy-link-btn" style="margin-top: 5px; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">📋 Copy Link</button>
            <p style="font-size: 12px; color: #666; margin-top: 5px;">Player 2 can click this link to join automatically!</p>
            <div id="p1-timer" style="margin-top: 15px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; text-align: center;">
                <p style="margin: 0; font-weight: bold; font-size: 12px;">⏱️ Waiting for Player 2 to play...</p>
                <p style="margin: 5px 0 0 0; font-size: 20px; color: #4CAF50; font-weight: bold;" id="p1-timer-display">5:00</p>
            </div>
        `;
        
        document.getElementById('copy-link-btn').addEventListener('click', () => {
            const linkInput = document.getElementById('share-link-input');
            linkInput.select();
            navigator.clipboard.writeText(shareLink);
            showStatus('Link copied to clipboard!', 'success');
        });

        // Start Phase 1 timer (awaiting P2 move) - uses contract's lastAction
        currentGamePhase = 'awaiting_p2_move';
        startTimeoutTimer(gameAddress, 'awaiting_p2_move', 'p1-timer-display');

        showStatus('Game created successfully! Share the link with Player 2.', 'success');
    } catch (error) {
        console.error('Full error:', error);
        showStatus('Error: ' + error.message, 'error');
    }
});

// ======================
// PLAYER 2: LOAD GAME
// ======================
document.getElementById('load-game-btn').addEventListener('click', async () => {
    try {
        const address = document.getElementById('contract-address').value;
        
        if (!address || !ethers.isAddress(address)) {
            showStatus('Error: Invalid contract address', 'error');
            return;
        }

        showStatus('Loading game...', 'info');
        const state = await getGameState(address);

        document.getElementById('game-details').innerHTML = `
            <h3>Game Details</h3>
            <p><strong>Player 1:</strong> ${state.j1}</p>
            <p><strong>Player 2:</strong> ${state.j2}</p>
            <p><strong>Stake:</strong> ${state.stake} ETH</p>
            <p><strong>P2 Move:</strong> ${state.c2 === 0 ? '⏳ Not Played Yet' : getMoveText(state.c2)}</p>
            <div id="p2-timer" style="margin-top: 15px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; text-align: center;">
                <p style="margin: 0; font-weight: bold; font-size: 12px;">⏱️ Game Status...</p>
                <p style="margin: 5px 0 0 0; font-size: 18px; color: #4CAF50; font-weight: bold;" id="p2-timer-display">5:00</p>
            </div>
        `;

        if (state.c2 === 0) {
            document.getElementById('p2-move').classList.remove('hidden');
            document.getElementById('play-move-btn').classList.remove('hidden');
            showStatus('Ready to play! Select your move.', 'info');
            
            // Start Phase 1 timer for P2 (waiting for P2 to play) - uses contract's lastAction
            currentGamePhase = 'awaiting_p2_move';
            document.getElementById('p2-timer').querySelector('p').textContent = '⏱️ Waiting for you to play...';
            startTimeoutTimer(address, 'awaiting_p2_move', 'p2-timer-display');
        } else {
            showStatus('You already played. Waiting for Player 1 to reveal.', 'info');
            
            // Start Phase 2 timer for P2 (waiting for P1 to reveal) - uses contract's lastAction
            currentGamePhase = 'awaiting_p1_reveal';
            document.getElementById('p2-timer').querySelector('p').textContent = '⏱️ Waiting for Player 1 to reveal...';
            startTimeoutTimer(address, 'awaiting_p1_reveal', 'p2-timer-display');
        }
        
        currentGameAddress = address;
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
    }
});

// ======================
// PLAYER 2: PLAY MOVE
// ======================
document.getElementById('play-move-btn').addEventListener('click', async () => {
    try {
        const move = document.getElementById('p2-move').value;
        
        if (!currentGameAddress) {
            showStatus('Error: Load game first', 'error');
            return;
        }

        const state = await getGameState(currentGameAddress);

        showStatus('Playing move...', 'info');
        await playMove(currentGameAddress, move, state.stake);
        showStatus('✅ Move played! Waiting for Player 1 to reveal.', 'success');
        
        // Switch to Phase 2 (awaiting P1 reveal) - uses contract's lastAction after play() is called
        currentGamePhase = 'awaiting_p1_reveal';
        
        // Update timer label
        const timerLabel = document.getElementById('p2-timer');
        if (timerLabel) {
            timerLabel.querySelector('p').textContent = '⏱️ Waiting for Player 1 to reveal...';
        }
        
        startTimeoutTimer(currentGameAddress, 'awaiting_p1_reveal', 'p2-timer-display');

        // Broadcast to P1 via channel
        channel.postMessage({ 
            type: 'p2_played',
            address: currentGameAddress,
            timestamp: Date.now()
        });
        
        document.getElementById('play-move-btn').classList.add('hidden');
        document.getElementById('p2-move').classList.add('hidden');

    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
    }
});

// ======================
// PLAYER 1: REVEAL MOVE
// ======================
document.getElementById('reveal-btn').addEventListener('click', async () => {
    try {
        const address = document.getElementById('reveal-contract').value;
        
        if (!address || !ethers.isAddress(address)) {
            showStatus('Error: Invalid contract address', 'error');
            return;
        }

        const savedGame = localStorage.getItem(`game_${address}`);

        if (!savedGame) {
            showStatus('Error: Game data not found in localStorage. Did you create this game?', 'error');
            return;
        }

        const { move, salt } = JSON.parse(savedGame);
        showStatus('Revealing move...', 'info');
        await revealMove(address, move, salt);
        const state = await getGameState(address);

        let winnerText = '';
        const j1Move = move;
        const j2Move = state.c2;

        if (j2Move === 0) winnerText = 'Waiting for Player 2';
        else if (j1Move === j2Move) winnerText = 'It\'s a Tie! 🤝';
        else if (win(j1Move, j2Move)) winnerText = 'Player 1 Wins! 🏆';
        else winnerText = 'Player 2 Wins! 🏆';

        // Display results
        document.getElementById('game-results').innerHTML += `
            <div style="padding: 15px; background: #e8f5e9; border: 2px solid #4CAF50; border-radius: 4px; margin-top: 10px;">
                <p><strong>Player 1 Move:</strong> ${getMoveText(j1Move)}</p>
                <p><strong>Player 2 Move:</strong> ${getMoveText(j2Move)}</p>
                <h3>🏆 ${winnerText}</h3>
            </div>
        `;

        // Stop timer
        clearInterval(timeoutInterval);
        currentGamePhase = null;

        // Broadcast results to P2
        channel.postMessage({ 
            type: 'game_result',
            address, 
            j1Move, 
            j2Move, 
            winnerText 
        });
        
        showStatus("Move revealed. Game complete!", "success");

    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
    }
});

// ======================
// TIMEOUT HANDLERS
// ======================

// this element will be called by j2 because j1 didnt reveal
document.getElementById('j1-timeout-btn').addEventListener('click', async () => {
    try {
        const address = document.getElementById('timeout-contract').value;
        
        if (!address || !ethers.isAddress(address)) {
            showStatus('Error: Invalid contract address', 'error');
            return;
        }

        showStatus('Claiming timeout...', 'info');
        await J1Timeout(address);
        
        clearInterval(timeoutInterval);
        currentGamePhase = null;

        // Display timeout result
        const timeoutResultsDiv = document.getElementById('timeout-results');
        if (timeoutResultsDiv) {
            timeoutResultsDiv.innerHTML = `
                <div style="padding: 15px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 4px; margin-top: 10px;">
                    <h3>⏱️ TIMEOUT - Player 2 Wins</h3>
                    <p><strong>Result:</strong> Player 2 successfully claimed timeout</p>
                    <p><strong>Reason:</strong> Player 1 did not reveal their move within 5 minutes</p>
                    <p><strong>Prize:</strong> Player 2 receives 2× stake</p>
                    <p><strong>Status:</strong> Game ended</p>
                </div>
            `;
        }

        // Broadcast to P2
        channel.postMessage({ 
            type: 'p1_timeout_win',
            address: address,
            winner: 'Player 2',
            message: 'Player 2 claimed timeout. You did not play within 5 minutes.',
            reason: 'Player 1 did not play/reveal'
        });

        showStatus('✅ P1 timeout claimed! Player 2 wins by timeout.', 'success');
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
    }
});

document.getElementById('j2-timeout-btn').addEventListener('click', async () => {
    try {
        const address = document.getElementById('timeout-contract').value;
        
        if (!address || !ethers.isAddress(address)) {
            showStatus('Error: Invalid contract address', 'error');
            return;
        }

        showStatus('Claiming timeout...', 'info');
        await J2Timeout(address);
        
        clearInterval(timeoutInterval);
        currentGamePhase = null;

        // Display timeout result
        const timeoutResultsDiv = document.getElementById('timeout-results');
        if (timeoutResultsDiv) {
            timeoutResultsDiv.innerHTML = `
                <div style="padding: 15px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 4px; margin-top: 10px;">
                    <h3>⏱️ TIMEOUT - Player 1 Wins</h3>
                    <p><strong>Result:</strong> Player 1 successfully claimed timeout</p>
                    <p><strong>Reason:</strong> Player 2 did not reveal/play move within 5 minutes</p>
                    <p><strong>Prize:</strong> Player 1 receives 2× stake</p>
                    <p><strong>Status:</strong> Game ended</p>
                </div>
            `;
        }

        // Broadcast to P1
        channel.postMessage({ 
            type: 'p2_timeout_win',
            address: address,
            winner: 'Player 1',
            message: 'Player 1 claimed timeout. You did not reveal within 5 minutes.',
            reason: 'Player 2 did not reveal/play'
        });

        showStatus('✅ P2 timeout claimed! Player 1 wins by timeout.', 'success');
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
    }
});

// ======================
// TIMER SYSTEM (Contract-based)
// ======================
async function startTimeoutTimer(gameAddress, phase, displayElementId) {
    clearInterval(timeoutInterval);

    timeoutInterval = setInterval(async () => {
        try {
            // Query contract state
            const state = await getGameState(gameAddress);
            const lastActionTimestamp = state.lastAction; // Blockchain timestamp in seconds
            const currentBlockTime = Math.floor(Date.now() / 1000); // Current time in seconds
            
            // Calculate elapsed time since last action
            const elapsedSeconds = currentBlockTime - lastActionTimestamp;
            const timeoutSeconds = 5 * 60; // 5 minutes in seconds
            const remainingSeconds = Math.max(0, timeoutSeconds - elapsedSeconds);

            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            // Update timer display
            const timerDisplay = document.getElementById(displayElementId);
            if (timerDisplay) {
                timerDisplay.textContent = timeString;
                
                // Color change based on time remaining
                if (remainingSeconds < 60) {
                    timerDisplay.style.color = '#ff6b6b'; // Red - urgent (< 1 min)
                } else if (remainingSeconds < 180) {
                    timerDisplay.style.color = '#ffc107'; // Yellow - warning (1-3 min)
                } else {
                    timerDisplay.style.color = '#4CAF50'; // Green - normal (> 3 min)
                }
            }

            // Time's up!
            if (remainingSeconds <= 0) {
                clearInterval(timeoutInterval);
                
                if (phase === 'awaiting_p2_move') {
                    showStatus('⏱️ Timeout! Player 2 did not play. Player 1 can claim timeout.', 'warning');
                    channel.postMessage({ 
                        type: 'p2_timeout_available',
                        address: gameAddress
                    });
                } else if (phase === 'awaiting_p1_reveal') {
                    showStatus('⏱️ Timeout! Player 1 did not reveal. Player 2 can claim timeout.', 'warning');
                    channel.postMessage({ 
                        type: 'p1_timeout_available',
                        address: gameAddress
                    });
                }
                
                currentGamePhase = null;
            }
        } catch (error) {
            console.error('Error updating timer:', error);
        }
    }, 1000); // Update every second
}

// ======================
// BROADCAST CHANNEL LISTENER
// ======================
channel.onmessage = (event) => {
    const { type, address, j1Move, j2Move, winnerText, message } = event.data;

    if (type === 'game_result') {
        document.getElementById('game-results').innerHTML = `
            <div style="padding: 15px; background: #e8f5e9; border: 2px solid #4CAF50; border-radius: 4px; margin-top: 10px;">
                <p><strong>Player 1 Move:</strong> ${getMoveText(j1Move)}</p>
                <p><strong>Player 2 Move:</strong> ${getMoveText(j2Move)}</p>
                <h3>🏆 ${winnerText}</h3>
            </div>
        `;
        showStatus("✅ Game result synced from other tab", "success");
        clearInterval(timeoutInterval);
        currentGamePhase = null;
    } 
    else if (type === 'p2_played') {
        showStatus("✅ Player 2 has played! Waiting for Player 1 to reveal...", "info");
        // Update P1's timer label
        const p1Timer = document.getElementById('p1-timer');
        if (p1Timer) {
            p1Timer.querySelector('p').textContent = '⏱️ Waiting for you to reveal...';
        }
    } 
    else if (type === 'p2_timeout') {
        document.getElementById('game-results').innerHTML = `
            <div style="padding: 15px; background: #ffebee; border: 2px solid #f44336; border-radius: 4px; margin-top: 10px;">
                <h3>⏱️ TIMEOUT - Player 2</h3>
                <p>${message}</p>
            </div>
        `;
        showStatus(message, "warning");
        clearInterval(timeoutInterval);
        currentGamePhase = null;
    } 
    else if (type === 'p1_timeout') {
        document.getElementById('game-results').innerHTML = `
            <div style="padding: 15px; background: #ffebee; border: 2px solid #f44336; border-radius: 4px; margin-top: 10px;">
                <h3>⏱️ TIMEOUT - Player 1</h3>
                <p>${message}</p>
            </div>
        `;
        showStatus(message, "warning");
        clearInterval(timeoutInterval);
        currentGamePhase = null;
    } 
    else if (type === 'p2_timeout_available') {
        showStatus('⏱️ Timeout available! Player 2 did not play in time.', 'warning');
        const btn = document.getElementById('j1-timeout-btn');
        if (btn) {
            btn.style.backgroundColor = '#ff6b6b';
            btn.textContent = '⚠️ Claim Timeout (P2 Forfeited)';
        }
    } 
    else if (type === 'p1_timeout_available') {
        showStatus('⏱️ Timeout available! Player 1 did not reveal in time.', 'warning');
        const btn = document.getElementById('j2-timeout-btn');
        if (btn) {
            btn.style.backgroundColor = '#ff6b6b';
            btn.textContent = '⚠️ Claim Timeout (P1 Forfeited)';
        }
    }
    else if (type === 'p1_timeout_win') {
        // P2 won via timeout
        const timeoutResultsDiv = document.getElementById('timeout-results');
        if (timeoutResultsDiv) {
            timeoutResultsDiv.innerHTML = `
                <div style="padding: 15px; background: #ffebee; border: 2px solid #ff6b6b; border-radius: 4px; margin-top: 10px;">
                    <h3>⏱️ TIMEOUT - Player 2 Wins</h3>
                    <p><strong>Result:</strong> You did not reveal your move within 5 minutes</p>
                    <p><strong>Winner:</strong> Player 2</p>
                    <p><strong>Reason:</strong> ${event.data.reason}</p>
                    <p><strong>Status:</strong> Game ended</p>
                </div>
            `;
        }
        showStatus(event.data.message, 'warning');
        clearInterval(timeoutInterval);
        currentGamePhase = null;
    }
    else if (type === 'p2_timeout_win') {
        // P1 won via timeout
        const timeoutResultsDiv = document.getElementById('timeout-results');
        if (timeoutResultsDiv) {
            timeoutResultsDiv.innerHTML = `
                <div style="padding: 15px; background: #ffebee; border: 2px solid #ff6b6b; border-radius: 4px; margin-top: 10px;">
                    <h3>⏱️ TIMEOUT - Player 1 Wins</h3>
                    <p><strong>Result:</strong> You did not play your move within 5 minutes</p>
                    <p><strong>Winner:</strong> Player 1</p>
                    <p><strong>Reason:</strong> ${event.data.reason}</p>
                    <p><strong>Status:</strong> Game ended</p>
                </div>
            `;
        }
        showStatus(event.data.message, 'warning');
        clearInterval(timeoutInterval);
        currentGamePhase = null;
    }
};

// ======================
// UTILITY FUNCTIONS
// ======================
function showSections() {
    const sections = document.querySelectorAll('.section');
    sections.forEach(el => el.classList.remove('hidden'));
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = type;
    status.style.display = 'block';
    
    // Auto-hide after 5 seconds for info/success
    if (type === 'info' || type === 'success') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 5000);
    }
}

function getMoveText(move) {
    const moves = ['Null', '✊ Rock', '✋ Paper', '✌️ Scissors', '🖖 Spock', '🦎 Lizard'];
    return moves[move] || 'Unknown';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    clearInterval(timeoutInterval);
    channel.close();
});