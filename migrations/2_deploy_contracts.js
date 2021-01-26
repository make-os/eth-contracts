const Main = artifacts.require("Main");
const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");

module.exports = async function (deployer, network, accounts) {
	const ELLContractAddr = "0x9d9aeea38de4643066bc09d3b210737b59af3a93";

	// Deploy dilithium contract.
	await deployer.deploy(Dilithium, { from: accounts[0] });

	// Deploy auction contract
	await deployer.deploy(Auction, Dilithium.address, 1, 10, 1000, {
		from: accounts[0],
	});

	// Deploy main contract
	await deployer.deploy(Main, ELLContractAddr, Dilithium.address, Auction.address, {
		from: accounts[0],
	});

	// Set auction contract owner
	const auc = await Auction.deployed();
	await auc.setOwnerOnce(Main.address);
};
