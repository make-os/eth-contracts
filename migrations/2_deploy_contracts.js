const Main = artifacts.require("Main");
const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");

module.exports = async function (deployer, network, accounts) {
	const sender = accounts[0]; // change this;

	// Deploy the Dilithium contract.
	await deployer.deploy(Dilithium, { from: sender });
	const dil = await Dilithium.deployed();

	// Deploy the Auction contract.
	const MinRequiredDILSupply = web3.utils.toWei("1");
	const MaxPeriods = 1;
	const LTNSupplyPerPeriod = web3.utils.toWei("1000");
	const MinBidAmount = web3.utils.toWei("100");
	const FundingAddr = accounts[5];
	const AuctionFee = 1;
	await deployer.deploy(
		Auction,
		Dilithium.address,
		MinRequiredDILSupply,
		MaxPeriods,
		LTNSupplyPerPeriod,
		MinBidAmount,
		FundingAddr,
		AuctionFee,
		{ from: sender },
	);
	const auc = await Auction.deployed();

	// Pre-mine non-public supply of Latinum.
	const nonPublicSupplyAddr = accounts[4];
	const nonPublicSupply = web3.utils.toWei("75000000");
	await auc.mint(nonPublicSupplyAddr, nonPublicSupply);

	// Deploy Main contract
	const ELLContractAddr = "0x61872c4a40D70586A6469dF04d01d00B66580777";
	const MaxSwappableELL = "18984565000000000000000000"; // 18984565
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

	// Set the Main contract as the new owner of the Auction
	// and Dilithium contract to Maim
	await auc.setOwner(Main.address, { from: sender });
	await dil.setOwner(Main.address, { from: sender });
};
