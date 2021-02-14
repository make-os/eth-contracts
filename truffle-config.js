const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
	plugins: ["solidity-coverage"],
	compilers: {
		solc: {
			version: "0.6.6",
			settings: {
				optimizer: {
					enabled: true,
					runs: 200,
				},
			},
		},
	},
	networks: {
		development: {
			host: "127.0.0.1",
			port: 7545,
			network_id: "*",
		},
		rinkeby: {
			provider: function () {
				return new HDWalletProvider(
					process.env.MNEMONIC,
					"https://rinkeby.infura.io/v3/18ddf63e78c54562abc1e640cb005c84",
				);
			},
			network_id: "4",
			websockets: true,
		},
	},
};
