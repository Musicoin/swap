require('dotenv').config();

const connection = require('../db/connection');
const SwapSchema = require('../db/core/Swap.js');
const multicallABI = require('../abi/Multicall.json');

const dbSwap = connection.model('Swap', SwapSchema, 'swaps');

const batchSize = 100;

async function main() {
  let [deployer] = await ethers.getSigners();
  const multicallAddress = '0xcA11bde05977b3631167028862bE2a173976CA11';

  try {
    this.musicToken = await ethers.getContractAt('MusicWithMinting', process.env.MUSIC_TOKEN, deployer);
    console.log('Music token address: ' + process.env.MUSIC_TOKEN);

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

    if (totals.length > 0) {
      // approve the multicall contract
      await this.musicToken
        .connect(deployer)
        .approve(
          multicallAddress,
          ethers.utils.parseEther(Math.round(parseFloat(totals[0].totalTokens) + 1).toString()),
        );

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
              deployer.address,
              wallet.address,
              ethers.utils.parseEther(wallet.balance),
            ]),
          ]);
          wallet.status = 'IN_PROGRESS';
          wallet.save();
        });

        const tx = await multicall.connect(deployer).aggregate3(distributionCalls);
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
