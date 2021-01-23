const Main = artifacts.require("Main");
const Dilithium = artifacts.require("Dilithium");
const Latinum = artifacts.require("Latinum");

module.exports = function (deployer) {
	const ELLContractAddr = "0x9d9aeea38de4643066bc09d3b210737b59af3a93";
	deployer.deploy(Main, ELLContractAddr);
};
