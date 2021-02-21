const Main = artifacts.require("Main");
const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");

module.exports = async function (deployer, network, accounts) {
	const sender = accounts[0]; // change this;
	const nonPublicSupplyAddr = accounts[4];

	// Deploy the Auction contract.
	const MinRequiredDILSupply = web3.utils.toWei("50000000");
	const MaxPeriods = 300;
	const LTNSupplyPerPeriod = web3.utils.toWei("225000");
	const MinBidAmount = web3.utils.toWei("1000");
	const FundingAddr = "0x27fB67E8C0dA74230Bd30068Ef2C6cF45801bCA0";
	const AuctionFee = web3.utils.toWei("0.00001");
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

	// Pre-mine non-public supply of Latinum.
	const auc = await Auction.deployed();
	const nonPublicSupply = web3.utils.toWei("75000000");
	await auc.mint(nonPublicSupplyAddr, nonPublicSupply);
};
