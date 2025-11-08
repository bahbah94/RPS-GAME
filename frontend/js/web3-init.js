//const { ethers } = require("ethers"); already downloaded from CDN
//import {CONTRACT_ABI, CONTRACT_BYTECODE} from './config'; 

let provider;
let signer;
let contract;
let userAddress;

// initializes the connection
async function connectWallet(){
    if (typeof window.ethereum == 'undefined'){
        throw new Error('metamask not installed');
    }

   provider = new ethers.BrowserProvider(window.ethereum);
   console.log("Provider created");


   await provider.send("eth_requestAccounts", []);
   console.log("Accounts requested");

   signer = await provider.getSigner();
   userAddress = await signer.getAddress();

   console.log("Got signer & address:", userAddress);

   // Check network
   const network = await provider.getNetwork();
   if (network.chainId !== 11155111n) {
       throw new Error('Please switch to Sepolia network');
   }

   return {userAddress, signer};

}

async function deployGame(commitment, j2address,stakeAmount) {
    const factory = new ethers.ContractFactory(CONTRACT_ABI,CONTRACT_BYTECODE,signer);
    const contract = await factory.deploy(commitment, j2address, {
        value: ethers.parseEther(stakeAmount)
    });
    await contract.deploymentTransaction().wait();
    return contract.getAddress();
}

async function connectGame(contractAddress){
    contract = new ethers.Contract(contractAddress,CONTRACT_ABI,signer);
    return contract;
}

function generateSalt() {
    const saltArray = new Uint8Array(32);
    crypto.getRandomValues(saltArray);
    return ethers.hexlify(saltArray);
}

function createCommitment(move,salt) {
    return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['uint8', 'uint256'],
            [move, salt]
        )
    );
}

export {
    connectWallet,
    deployGame,
    connectGame,
    generateSalt,
    createCommitment,
    provider,
    signer,
    contract,
    userAddress
}


