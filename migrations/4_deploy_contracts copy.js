const Main = artifacts.require("Main");
const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");

module.exports = async function (deployer, network, accounts) {
	const sender = accounts[0]; // change this;

	// Deploy Main contract
	const ELLContractAddr = "0x61872c4a40D70586A6469dF04d01d00B66580777";
	const MaxSwappableELL = web3.utils.toWei("18984565"); // 18984565
	const UniswapRouterAddr = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
	await deployer.deploy(
		Main,
		MaxSwappableELL,
		ELLContractAddr,
		Dilithium.address,
		Auction.address,
		UniswapRouterAddr,
		{ from: sender },
	);

	const auc = await Auction.deployed();
	const dil = await Dilithium.deployed();

	// Set the Main contract as the new owner of the Auction
	// and Dilithium contract to Maim
	await auc.setOwner(Main.address, { from: sender });
	await dil.setOwner(Main.address, { from: sender });
};
