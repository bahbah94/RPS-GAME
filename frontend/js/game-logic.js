import { contract, connectGame, connectWallet } from './web3-init.js';


async function playMove(contractAddress, move, stakeAmount){
    //this should take wallet signing of j2
    const {_, signer} = await connectWallet();
    //const gameContract = await connectGame(contractAddress);
    let gameContract = new ethers.Contract(contractAddress,CONTRACT_ABI,signer);
    const tx = await gameContract.play(move, {
        value: ethers.parseEther(stakeAmount)
    });

    await tx.wait();
    return tx;
}

async function revealMove(contractAddress,move,salt){
    // here reveal move should take wallet of j1
    const {_,signer} = await connectWallet();
    //const gameContract = await connectGame(contractAddress);
    let gameContract = new ethers.Contract(contractAddress,CONTRACT_ABI,signer);
    const tx = await gameContract.solve(move,salt);
    await tx.wait();
    return tx;
}

async function J1Timeout(contractAddress){
    const {_,signer} = await connectWallet();
    //this is called by j2
    let gameContract = new ethers.Contract(contractAddress,CONTRACT_ABI,signer);
    const tx = await gameContract.j1Timeout();
    await tx.wait();
    return tx;
}

async function J2Timeout(contractAddress){
    const {_,signer} = await connectWallet();
    //this is called by j1
    let gameContract = new ethers.Contract(contractAddress,CONTRACT_ABI,signer);
    const tx = await gameContract.j2Timeout();
    await tx.wait();
    return tx;
}

async function getGameState(contractAddress) {
    // use provider no signer required
    const provider = new ethers.BrowserProvider(window.ethereum);
    const gameContract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
    
    const [j1, j2, c1Hash, c2, stake, lastAction] = await Promise.all([
        gameContract.j1(),
        gameContract.j2(),
        gameContract.c1Hash(),
        gameContract.c2(),
        gameContract.stake(),
        gameContract.lastAction()
    ]);

    return {
        j1,
        j2,
        c1Hash,
        c2: Number(c2),
        stake: ethers.formatEther(stake),
        lastAction: Number(lastAction)
    };
}

function isTimedOut(lastAction) {
    const TIMEOUT = 300; // 5 minutes
    const now = Math.floor(Date.now() / 1000);
    return now > lastAction + TIMEOUT;
}

function win(c1, c2) {
    // Map moves: 1=Rock, 2=Paper, 3=Scissors, 4=Spock, 5=Lizard
    // Returns true if c1 beats c2
    const beats = {
        1: [3, 5], // Rock beats Scissors and Lizard
        2: [1, 4], // Paper beats Rock and Spock
        3: [2, 5], // Scissors beats Paper and Lizard
        4: [1, 3], // Spock beats Rock and Scissors
        5: [2, 4], // Lizard beats Paper and Spock
    };
    return beats[c1].includes(c2);
}

export {
    playMove,
    revealMove,
    J1Timeout,
    J2Timeout,
    getGameState,
    isTimedOut,
    win
};