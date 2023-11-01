require('dotenv').config();

const connection = require('../db/connection');
const SwapSchema = require('../db/core/Swap.js');

const dbSwap = connection.model('Swap', SwapSchema, 'swaps');

const batchSize = 100;
const multicallAddress = process.env.MULTICALL_ADDRESS;
const filterByStatus = 'FAILED';

async function main() {
  let [deployer] = await ethers.getSigners();

  try {
    this.musicToken = await ethers.getContractAt('MusicWithMinting', process.env.MUSIC_TOKEN, deployer);
    console.log('Music token address: ' + process.env.MUSIC_TOKEN);

    const multicall = await ethers.getContractAt('Multicall3', multicallAddress, deployer);

    // get wallets and amounts
    let totalWallets = await dbSwap.countDocuments({ kind: 'EOA', status: filterByStatus }).exec();
    console.log('totalWallets: ' + totalWallets);
    const loops = parseInt(totalWallets / batchSize) + 1;
    console.log('loops: ' + loops);

    let totals = await dbSwap.aggregate([
      { $match: { kind: 'EOA', status: filterByStatus } },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: { $toDouble: '$balance' } },
        },
      },
    ]);
    console.log(totals);

    if (totals.length > 0) {
      // approve the multicall contract
      await this.musicToken
        .connect(deployer)
        .approve(
          multicallAddress,
          ethers.utils.parseEther(Math.round(parseFloat(totals[0].totalTokens) + 1).toString()),
        );

      for (let round = 0; round <= loops; round++) {
        let wallets = await dbSwap.find({ kind: 'EOA', status: filterByStatus }).limit(batchSize).exec();

        let distributionCalls = [];

        console.log(wallets.length);
        wallets.forEach((wallet, index) => {
          console.log(wallet.balance);
          distributionCalls.push([
            process.env.MUSIC_TOKEN,
            false,
            this.musicToken.interface.encodeFunctionData('transferFrom', [
              deployer.address,
              wallet.address,
              ethers.utils.parseEther(wallet.balance),
            ]),
          ]);
          wallet.status = 'IN_PROGRESS';
          wallet.save();
        });

        const tx = await multicall.connect(deployer).aggregate3(distributionCalls, { gasLimit: 100000 });
      }
    }

    // ToDo: just to be sure set the allowance to 0 after the swap is done
    await this.musicToken.connect(deployer).approve(multicallAddress, 0);
  } catch (e) {
    console.log(e);
    await this.musicToken.connect(deployer).approve(multicallAddress, 0);
    return;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
