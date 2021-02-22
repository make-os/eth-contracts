const Main = artifacts.require("Main");
const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");

module.exports = async function (deployer, network, accounts) {
	const sender = accounts[0];

	// Deploy Main contract
	const ELLContractAddr = "0xd138d4813f23bf3bafc6a8e35e2515d8681bd3f6";
	const MaxSwappableELL = web3.utils.toWei("19000000");
	await deployer.deploy(Main, MaxSwappableELL, ELLContractAddr, Dilithium.address, {
		from: sender,
		gas: 899674,
	});

	// Set the Main contract as the new owner of the Dilithium contract to Main
	const dil = await Dilithium.deployed();
	const tx = await dil.setOwner(Main.address, { from: sender, gas: 937989 });
	console.log("Set DIL Contract Owner: ", tx.hash);
};
