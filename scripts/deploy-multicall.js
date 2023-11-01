async function main() {
  let [deployer] = await ethers.getSigners();

  const multicallFactory = await ethers.getContractFactory('Multicall3', deployer);
  const multicall = await multicallFactory.deploy();

  console.log('multicall deployed to ' + multicall.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
