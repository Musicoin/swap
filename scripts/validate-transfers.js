require('dotenv').config();

const connection = require('../db/connection');
const SwapSchema = require('../db/core/Swap.js');

const dbSwap = connection.model('Swap', SwapSchema, 'swaps');

const batchSize = 1000;
const multicallAddress = process.env.MULTICALL_ADDRESS;

async function main() {
  let [deployer] = await ethers.getSigners();

  try {
    this.musicToken = await ethers.getContractAt('MusicWithMinting', process.env.MUSIC_TOKEN, deployer);
    console.log('Music token address: ' + process.env.MUSIC_TOKEN);

    const multicall = await ethers.getContractAt('Multicall3', multicallAddress, deployer);

    // get wallets and amounts
    let totalWallets = await dbSwap.countDocuments({ kind: 'EOA', status: 'IN_PROGRESS' }).exec();
    console.log('totalWallets: ' + totalWallets);
    const loops = parseInt(totalWallets / batchSize) + 1;
    console.log('loops: ' + loops);

    if (loops > 0) {
      // approve the multicall contract

      for (let round = 0; round <= loops; round++) {
        console.log('round ', round, ' out of ', loops);
        // check if balances are correct and update db status
        let wallets = await dbSwap.find({ kind: 'EOA', status: 'IN_PROGRESS' }).limit(batchSize).exec();

        const balanceCalls = wallets.map((wallet, i) => ({
          target: process.env.MUSIC_TOKEN,
          allowFailure: false,
          callData: this.musicToken.interface.encodeFunctionData('balanceOf', [wallet.address]),
        }));

        // Execute those calls.
        const balanceResults = await multicall.callStatic.aggregate3(balanceCalls);
        // console.log(balanceResults);

        // Decode the responses.
        const walletBalances = balanceResults.map(async ({ success, returnData }, i) => {
          if (!success) throw new Error(`Failed to get balance for ${wallets[i]}`);
          const balance = this.musicToken.interface.decodeFunctionResult('balanceOf', returnData)[0];
          if (ethers.utils.parseEther(wallets[i].balance) <= balance) {
            wallets[i].status = 'SWAPPED';
            await wallets[i].save();
          } else {
            console.log('swap failed for account ' + wallets[i].address);
            wallets[i].status = 'FAILED';
            await wallets[i].save();
          }
          console.log(wallets[i], balance);
        });
      }
    }
  } catch (e) {
    console.log(e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
