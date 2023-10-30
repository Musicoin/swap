const batchSize = 100;

async function main() {
  let [deployer] = await ethers.getSigners();

  const address = await deployer.getAddress();

  const musicFactory = await ethers.getContractFactory('MusicWithMinting', deployer);
  this.musicToken = await musicFactory.deploy(address);
  const tokenAddress = await this.musicToken.getAddress();

  console.log('$music deployed to ' + tokenAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
