const connection = require('../db/connection');
const BalanceSchema = require('../db/core/Balance.js');
const UserSchema = require('../db/core/User.js');
const ReleaseSchema = require('../db/core/Release.js');
const SwapSchema = require('../db/core/Swap.js');

const dbBalance = connection.model('Balance', BalanceSchema, 'GMCBalances'); // Balances
const dbUser = connection.model('User', UserSchema, 'users');
const dbRelease = connection.model('Release', ReleaseSchema, 'GMCReleases');
const dbSwap = connection.model('Swap', SwapSchema, 'swaps');

let totalArtistNotFound = 0;
let artistNotFoundBalances = [];

async function main() {
  let total = 0;
  let totalUsers = 0;
  let totalReleases = 0;
  let totalEOAs = 0;

  const balances = await dbBalance
    .find({
      addr: {
        $nin: [
          '0xc168062c9c958e01914c7e3885537541dbb9ed08',
          '0xafadc4302f07e9460eb4c31ec741c0f3e308ff3a',
          '0xea62a60b127efd524b6e19791bcb374a49302c71',
          '0x0000000000000000000000000000000000000000',
        ],
      },
      balance: { $exists: true, $ne: null, $ne: '0.000000000000000000 ', $ne: 0 },
    })
    .exec();
  console.log(balances.length);
  let totalNonZero = 0;

  for (let element of balances) {
    // check user.profileAddress, if the wallet has an account add to the user.swapBalance of that user
    const balance = parseFloat(element.balance);
    if (balance > 0) {
      totalNonZero++;
      const user = await dbUser.findOne({ profileAddress: element.addr });
      if (user) {
        totalUsers++;
        await addToUserBalance(balance, element.addr, 'DB_USER');
      } else {
        // check release.contractAddress and add the balance to the release.artistAddress
        const release = await dbRelease.findOne({ contractAddress: element.addr });

        if (release) {
          totalReleases++;
          // distribute contributor shares
          await distributeShares(release, balance);
        } else {
          // if neither exist in the db we can conclude that the address is from a private key wallet and add them to the list for the transfer
          totalEOAs++;
          await addToUserBalance(balance, element.addr, 'EOA');
        }
      }

      total += element.balance;
      console.log('progress: ' + totalNonZero + '/' + balances.length);
    }
  }

  console.log('total users: ', totalUsers);
  console.log('total releases: ', totalReleases);
  console.log("total EOA's: ", totalEOAs);
  console.log('total artist not found: ', totalArtistNotFound);
  console.log('total balance for swap: ', total.toString());
  console.log(artistNotFoundBalances);
}

async function addToUserBalance(balance, walletAddress, kind) {
  swapUser = await dbSwap.findOne({ address: walletAddress, kind: kind });
  if (swapUser) {
    swapUser.balance = parseFloat(swapUser.balance + balance).toFixed(18);
    swapUser.save();
  } else {
    dbSwap.create({ address: walletAddress, balance: parseFloat(balance).toFixed(18), kind });
  }
}

async function distributeShares(release, balance) {
  if (release.contributors && release.contributors.length > 1) {
    // get total amount of shares for this release to get the denominator
    const sharesTotal = release.contributorShares.reduce((partialSum, a) => partialSum + a, 0);
    console.log(release.contributors);
    console.log(release.contributorShares);
    console.log('contributor share');
    console.log('total balance for release: ', balance);

    //distribute shares to all contributors
    for (let i = 0; i < release.contributors.length; i++) {
      const shareBalance = (release.contributorShares[i] * balance) / sharesTotal;
      const contributor = release.contributors[i];
      const user = await dbUser.findOne({ profileAddress: contributor });
      let kind = 'EOA';
      if (user) {
        kind = 'DB_USER';
      }
      await addToUserBalance(shareBalance, contributor, kind);

      console.log('contributor share: ', shareBalance, contributor, kind);
    }
  } else {
    const artist = await dbUser.findOne({ profileAddress: release.artistAddress });
    if (artist) {
      await addToUserBalance(balance, release.artistAddress, 'DB_USER');
    } else {
      // artist removed profile, so we can't return the coins
      totalArtistNotFound++;
      console.log('artist not found');
      console.log(release, balance);
      artistNotFoundBalances.push({ release: release, balance: balance });
      await addToUserBalance(balance, release.artistAddress, 'EOA');
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
