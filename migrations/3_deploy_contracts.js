const Main = artifacts.require("Main");
const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");

module.exports = async function (deployer, network, accounts) {
	const sender = accounts[0]; // change this;

	// Deploy Main contract
	const ELLContractAddr = "0x61872c4a40D70586A6469dF04d01d00B66580777";
	const MaxSwappableELL = web3.utils.toWei("18984565"); // 18984565
	await deployer.deploy(Main, MaxSwappableELL, ELLContractAddr, Dilithium.address, {
		from: sender,
	});

	// Set the Main contract as the new owner of the Dilithium contract to Maim
	const dil = await Dilithium.deployed();
	await dil.setOwner(Main.address, { from: sender });
};
