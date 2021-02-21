const HDWallet = require("@truffle/hdwallet-provider");
const web3 = require("web3");
const mnemonic = process.env.MNEMONIC;
const providerAddr = process.env.PROVIDER_ADDR;

module.exports = {
	plugins: ["solidity-coverage"],
	compilers: {
		solc: {
			version: "0.6.6",
			settings: {
				optimizer: {
					enabled: true,
					runs: 1,
				},
			},
		},
	},
	networks: {
		live: {
			provider: () => {
				return new HDWallet(mnemonic, providerAddr);
			},
			gasPrice: web3.utils.toWei("120", "gwei"),
			network_id: 1,
		},
		development: {
			host: "127.0.0.1",
			port: 7545,
			network_id: "*",
			gasPrice: web3.utils.toWei("120", "gwei"),
		},
		rinkeby: {
			provider: function () {
				return new HDWallet(process.env.MNEMONIC, process.env.PROVIDER_ADDR);
			},
			network_id: "4",
			websockets: true,
		},
	},
};
