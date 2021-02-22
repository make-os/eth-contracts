const Main = artifacts.require("Main");
const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");

module.exports = async function (deployer, network, accounts) {
	const sender = accounts[0];

	// Deploy the Dilithium contract.
	await deployer.deploy(Dilithium, { from: sender, gas: 937989 });
};
