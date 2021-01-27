const Main = artifacts.require("Main");
const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");

module.exports = async function (deployer, network, accounts) {
	const sender = accounts[0];

	// Deploy dilithium contract.
	await deployer.deploy(Dilithium, { from: sender });

	// Deploy auction contract
	const MinRequiredDILSupply = 1000;
	const MaxPeriods = 1;
	const LTNSupplyPerPeriod = 10;
	const MinBidAmount = 1000;
	await deployer.deploy(
		Auction,
		Dilithium.address,
		MinRequiredDILSupply,
		MaxPeriods,
		LTNSupplyPerPeriod,
		MinBidAmount,
		{ from: sender },
	);

	// Mint non-public supply
	const nonPublicSupplyAddr = accounts[4];
	const nonPublicSupply = "75000000000000000000000000";
	const auc = await Auction.deployed();
	await auc.mint(nonPublicSupplyAddr, nonPublicSupply);

	// Deploy main contract
	const ELLContractAddr = "0x9d9aeea38de4643066bc09d3b210737b59af3a93";
	const MaxSwappableELL = "18984565000000000000000000"; // 18984565
	const FundingAddr = accounts[5];
	await deployer.deploy(
		Main,
		MaxSwappableELL,
		ELLContractAddr,
		Dilithium.address,
		Auction.address,
		FundingAddr,
		{ from: sender },
	);

	// Set auction contract owner
	await auc.setOwnerOnce(Main.address, { from: sender });
};
