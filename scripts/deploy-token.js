async function main() {
  let [deployer] = await ethers.getSigners();

  const address = deployer.address;

  const musicFactory = await ethers.getContractFactory('MusicWithMinting', deployer);
  const musicToken = await musicFactory.deploy(address);

  console.log('$music deployed to ' + musicToken.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
