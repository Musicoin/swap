require('dotenv').config();

const connection = require('../db/connection');
const SwapSchema = require('../db/core/Swap.js');
const multicallABI = require('../abi/Multicall.json');

const dbSwap = connection.model('Swap', SwapSchema, 'swaps');

const batchSize = 100;

async function main() {
  let [deployer] = await ethers.getSigners();

  try {
    this.musicToken = await ethers.getContractAt('MusicWithMinting', process.env.MUSIC_TOKEN, deployer);
    console.log('Music token address: ' + process.env.MUSIC_TOKEN);

    // get wallets and amounts
    let totalWallets = await dbSwap.countDocuments({ kind: 'EOA', status: 'IN_PROGRESS' }).exec();
    console.log('totalWallets: ' + totalWallets);
    const loops = Math.round(totalWallets / batchSize);
    console.log('loops: ' + loops);

    if (loops > 0) {
      // approve the multicall contract

      for (let round = 0; round < loops; round++) {
        // check if balances are correct and update db status
        let wallets = await dbSwap.find({ kind: 'EOA', status: 'IN_PROGRESS' }).limit(batchSize).exec();

        for (let i = 0; i < wallets.length; i++) {
          const balance = await this.musicToken.balanceOf(wallets[i].address);
          if (ethers.utils.parseEther(wallets[i].balance) <= balance) {
            wallets[i].status = 'SWAPPED';
            await wallets[i].save();
          } else {
            console.log('swap failed for account ' + wallets[i].address);
            wallets[i].status = 'FAILED';
            await wallets[i].save();
          }
        }
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
