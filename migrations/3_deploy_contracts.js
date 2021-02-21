const Main = artifacts.require("Main");
const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");

module.exports = async function (deployer, network, accounts) {
	const sender = accounts[0]; // change this;

	// Deploy Main contract
	const ELLContractAddr = "0xd138d4813f23bf3bafc6a8e35e2515d8681bd3f6";
	const MaxSwappableELL = web3.utils.toWei("19000000");
	await deployer.deploy(Main, MaxSwappableELL, ELLContractAddr, Dilithium.address, {
		from: sender,
	});

	// Set the Main contract as the new owner of the Dilithium contract to Maim
	const dil = await Dilithium.deployed();
	const tx = await dil.setOwner(Main.address, { from: sender });
	console.log("Set DIL Contract Owner: ", tx.hash);
};
