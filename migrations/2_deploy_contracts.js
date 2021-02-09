const Main = artifacts.require("Main");
const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");

module.exports = async function (deployer, network, accounts) {
	const sender = accounts[0]; // change this;

	// Deploy the Dilithium contract.
	const DecayHaltFee = web3.utils.toWei("2");
	const DecayDuration = 86400 * 60;
	await deployer.deploy(Dilithium, DecayHaltFee, DecayDuration, { from: sender });
	const dil = await Dilithium.deployed();

	// Deploy the Auction contract.
	const MinRequiredDILSupply = 1000;
	const MaxPeriods = 1;
	const LTNSupplyPerPeriod = 10;
	const MinBidAmount = 1000;
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

	// Pass the Latinum/Auction contract address to the Dilithium contract,
	// so the Dilithium contract know the address of the Latinum/Auction contract.
	await dil.setLTNAddress(auc.address);

	// Pre-mine non-public supply of Latinum.
	const nonPublicSupplyAddr = accounts[4];
	const nonPublicSupply = web3.utils.toWei("75000000");
	await auc.mint(nonPublicSupplyAddr, nonPublicSupply);

	// Deploy Main contract
	const ELLContractAddr = "0x9d9aeea38de4643066bc09d3b210737b59af3a93";
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
