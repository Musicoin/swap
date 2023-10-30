require('dotenv').config();

const connection = require('../db/connection');
const SwapSchema = require('../db/core/Swap.js');
const multicallABI = require('../abi/Multicall.json');

const dbSwap = connection.model('Swap', SwapSchema, 'swaps');

const batchSize = 500;

async function main() {
  let [deployer, hotwallet] = await ethers.getSigners();
  try {
    this.musicToken = await ethers.getContractAt('MusicWithMinting', process.env.MUSIC_TOKEN, hotwallet);
    console.log('Music token address: ' + process.env.MUSIC_TOKEN);

    const multicallAddress = '0xcA11bde05977b3631167028862bE2a173976CA11';
    const multicall = new ethers.Contract(multicallAddress, multicallABI, deployer);

    // get wallets and amounts
    let totalWallets = await dbSwap.countDocuments({ kind: 'EOA', status: 'UNSWAPPED' }).exec();
    console.log('totalWallets: ' + totalWallets);
    const loops = Math.round(totalWallets / batchSize);
    console.log('loops: ' + loops);

    let totals = await dbSwap.aggregate([
      { $match: { kind: 'EOA', status: 'UNSWAPPED' } },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: { $toDouble: '$balance' } },
        },
      },
    ]);
    console.log(totals);

    // approve the multicall contract
    await this.musicToken
      .connect(hotwallet)
      .approve(multicallAddress, ethers.parseEther(Math.round(parseFloat(totals[0].totalTokens) + 1).toString()));

    for (let round = 0; round < loops; round++) {
      let wallets = await dbSwap.find({ kind: 'EOA', status: 'UNSWAPPED' }).limit(batchSize).exec();

      let distributionCalls = [];

      console.log(wallets.length);
      wallets.forEach((wallet, index) => {
        console.log(wallet.balance);
        distributionCalls.push([
          process.env.MUSIC_TOKEN,
          false,
          this.musicToken.interface.encodeFunctionData('transferFrom', [
            hotwallet.address,
            wallet.address,
            ethers.parseEther(wallet.balance),
          ]),
        ]);
        wallet.status = 'IN_PROGRESS';
        wallet.save();
      });

      const tx = await multicall.connect(hotwallet).aggregate3(distributionCalls);
      await tx.wait();

      // check if balances are correct and update db status
      wallets = await dbSwap.find({ kind: 'EOA', status: 'IN_PROGRESS' }).exec();

      for (let i = 0; i < wallets.length; i++) {
        const balance = await this.musicToken.balanceOf(wallets[i].address);
        if (ethers.parseEther(wallets[i].balance) == balance) {
          wallets[i].status = 'SWAPPED';
          await wallets[i].save();
        } else {
          console.log('swap failed for account ' + wallets[i].address);
          wallets[i].status = 'FAILED';
          await wallets[i].save();
        }
      }
    }

    // ToDo: just to be sure set the allowance to 0 after the swap is done
    await this.musicToken.connect(hotwallet).approve(multicallAddress, 0);
  } catch (e) {
    console.log(e);
    await this.musicToken.connect(hotwallet).approve(multicallAddress, 0);
    return;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
